"""Core JSONL session parser - extracts SessionData from Claude Code logs."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from dateutil.parser import isoparse

from omas.config import AUTOMATED_MESSAGE_PATTERNS, MIN_HUMAN_MESSAGE_LENGTH
from omas.models import (
    SessionData,
    SubAgentInfo,
    TokenUsage,
    ToolCall,
    UserMessage,
)


def _is_automated_text(text: str) -> bool:
    """Check if text matches any automated message pattern."""
    for pattern in AUTOMATED_MESSAGE_PATTERNS:
        if pattern in text:
            return True
    return False


def _extract_string_content(content: str) -> str | None:
    """Extract human text from string-format content (traditional format)."""
    text = content.strip()
    if not text:
        return None
    if _is_automated_text(text):
        return None
    if len(text) < MIN_HUMAN_MESSAGE_LENGTH:
        return None
    return text


def _extract_list_content(content: list) -> str | None:
    """Extract human text from list-format content (newer Claude Code format).

    Lists that contain only ``tool_result`` items (permission approvals) are
    not human messages.  Text items matching automated patterns or IDE context
    tags are filtered out.
    """
    item_types = {
        item.get("type", "") for item in content if isinstance(item, dict)
    }
    if item_types <= {"tool_result"}:
        return None

    human_parts: list[str] = []
    for item in content:
        if not isinstance(item, dict) or item.get("type") != "text":
            continue
        text = (item.get("text") or "").strip()
        if not text or _is_automated_text(text):
            continue
        if text.startswith("<ide_") or text.startswith("<command-"):
            continue
        human_parts.append(text)

    if not human_parts:
        return None
    combined = " ".join(human_parts)
    if len(combined) < MIN_HUMAN_MESSAGE_LENGTH:
        return None
    return combined


def _extract_human_text(record: dict) -> str | None:
    """Extract genuine human-typed text from a user record.

    Returns the human text if found, or None if the record is not a human
    message.  Delegates to format-specific helpers for string vs list content.
    """
    if record.get("type") != "user" or record.get("userType") != "external":
        return None

    content = record.get("message", {}).get("content", "")

    if isinstance(content, str):
        return _extract_string_content(content)
    if isinstance(content, list):
        return _extract_list_content(content)
    return None


def _is_human_message(record: dict) -> bool:
    """Determine if a user record represents a genuine human message."""
    return _extract_human_text(record) is not None


def _extract_tool_calls(record: dict, timestamp: datetime) -> tuple[list[ToolCall], int]:
    """Extract tool calls from an assistant message.

    Returns:
        (tool_calls, ai_written_lines) — lines counted from Write/Edit/MultiEdit inputs.
    """
    calls = []
    written_lines = 0
    message = record.get("message", {})
    content_items = message.get("content", [])

    if not isinstance(content_items, list):
        return calls, 0

    for item in content_items:
        if isinstance(item, dict) and item.get("type") == "tool_use":
            name = item.get("name", "unknown")
            tool_id = item.get("id", "")
            tool_input = item.get("input", {})

            # Check if this is an Agent (sub-agent) call
            is_subagent = name == "Agent"
            agent_id = None
            if is_subagent:
                agent_id = tool_input.get("name", None)

            # Count AI-written lines from file-writing tools
            written_lines += _count_written_lines(name, tool_input)

            calls.append(
                ToolCall(
                    name=name,
                    tool_use_id=tool_id,
                    timestamp=timestamp,
                    is_subagent=is_subagent,
                    agent_id=agent_id,
                )
            )

    return calls, written_lines


def _count_written_lines(tool_name: str, tool_input: dict) -> int:
    """Count lines of code written by AI from Write/Edit/MultiEdit tool inputs."""
    try:
        if tool_name == "Write":
            content = tool_input.get("content", "")
            return len(content.splitlines()) if content else 0
        elif tool_name == "Edit":
            new_string = tool_input.get("new_string", "")
            lines = len(new_string.splitlines()) if new_string else 0
            return min(lines, 100)  # Edit 1회당 최대 100줄
        elif tool_name == "MultiEdit":
            edits = tool_input.get("edits", [])
            return sum(
                min(len(e.get("new_string", "").splitlines()), 100)
                for e in edits
                if isinstance(e, dict)
            )
    except (AttributeError, TypeError):
        pass
    return 0


def _extract_token_usage(record: dict) -> TokenUsage:
    """Extract token usage from an assistant message."""
    message = record.get("message", {})
    usage = message.get("usage", {})

    return TokenUsage(
        input_tokens=usage.get("input_tokens", 0),
        output_tokens=usage.get("output_tokens", 0),
        cache_read_tokens=usage.get("cache_read_input_tokens", 0),
        cache_creation_tokens=usage.get("cache_creation_input_tokens", 0),
    )


def _parse_timestamp(record: dict) -> Optional[datetime]:
    """Parse ISO timestamp from a record."""
    ts_str = record.get("timestamp")
    if ts_str:
        try:
            return isoparse(ts_str)
        except (ValueError, TypeError):
            pass
    return None


def parse_session(jsonl_path: Path, subagent_dir: Optional[Path] = None) -> SessionData:
    """Parse a single session JSONL file into structured SessionData."""
    data = SessionData(session_id=jsonl_path.stem)
    timestamps: list[datetime] = []
    model_name = "unknown"

    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            ts = _parse_timestamp(record)
            if ts:
                timestamps.append(ts)

            record_type = record.get("type", "")
            if record_type == "user":
                _handle_user_record(record, ts, data)
            elif record_type == "assistant":
                model_name = _handle_assistant_record(record, ts, data, model_name)
            elif record_type == "progress":
                _handle_progress_record(record, ts, data)

    data.model = model_name
    if timestamps:
        data.start_time = min(timestamps)
        data.end_time = max(timestamps)

    _build_sub_agents(data)
    _enrich_subagent_info(data, subagent_dir)
    return data


def _handle_user_record(record: dict, ts, data: SessionData):
    """Process a user-type record."""
    human_text = _extract_human_text(record)
    is_human = human_text is not None
    preview = (human_text or "")[:100].strip()
    if ts:
        data.user_messages.append(
            UserMessage(timestamp=ts, is_human=is_human, content_preview=preview)
        )


def _handle_assistant_record(record: dict, ts, data: SessionData, model_name: str) -> str:
    """Process an assistant-type record. Returns updated model name."""
    data.assistant_message_count += 1
    if ts:
        calls, written_lines = _extract_tool_calls(record, ts)
        data.tool_calls.extend(calls)
        data.ai_written_lines += written_lines

        # Register Agent tool calls as agent_events so _build_sub_agents()
        # can detect them.  Previously only "agent_progress" progress records
        # populated agent_events, but current Claude Code versions do not
        # always emit those — the Agent tool_use in assistant messages is
        # the reliable source.
        for call in calls:
            if call.is_subagent and call.agent_id:
                data.agent_events.append((call.agent_id, ts))

        if len(calls) > data.peak_parallel_tools_in_message:
            data.peak_parallel_tools_in_message = len(calls)

    usage = _extract_token_usage(record)
    data.total_usage.input_tokens += usage.input_tokens
    data.total_usage.output_tokens += usage.output_tokens
    data.total_usage.cache_read_tokens += usage.cache_read_tokens
    data.total_usage.cache_creation_tokens += usage.cache_creation_tokens

    msg = record.get("message", {})
    return msg.get("model", None) or model_name


def _handle_progress_record(record: dict, ts, data: SessionData):
    """Process a progress-type record for concurrency detection."""
    progress_data = record.get("data", {})
    if progress_data.get("type") == "agent_progress":
        agent_id = progress_data.get("agentId", "")
        if agent_id and ts:
            data.agent_events.append((agent_id, ts))


def _build_sub_agents(data: SessionData):
    """Build sub-agent info from accumulated agent events."""
    agent_ranges: dict[str, dict] = {}
    for agent_id, ts in data.agent_events:
        if agent_id not in agent_ranges:
            agent_ranges[agent_id] = {"first": ts, "last": ts, "count": 1}
        else:
            agent_ranges[agent_id]["first"] = min(agent_ranges[agent_id]["first"], ts)
            agent_ranges[agent_id]["last"] = max(agent_ranges[agent_id]["last"], ts)
            agent_ranges[agent_id]["count"] += 1

    for agent_id, info in agent_ranges.items():
        data.sub_agents.append(
            SubAgentInfo(
                agent_id=agent_id, first_seen=info["first"],
                last_seen=info["last"], tool_call_count=info["count"],
            )
        )


def _enrich_subagent_info(data: SessionData, subagent_dir: Optional[Path]):
    """Enrich sub-agent data from JSONL files (nested agents, prompts)."""
    if not subagent_dir or not subagent_dir.exists():
        return
    data.subagent_jsonl_count = len(list(subagent_dir.glob("agent-*.jsonl")))

    for sa_jsonl in subagent_dir.glob("agent-*.jsonl"):
        agent_id = sa_jsonl.stem.replace("agent-", "")
        sa = next((s for s in data.sub_agents if s.agent_id == agent_id), None)
        if not sa:
            continue
        if _subagent_has_nested_agents(sa_jsonl):
            sa.has_nested_agents = True
        prompt = _extract_subagent_first_prompt(sa_jsonl)
        if prompt:
            sa.prompt_preview = prompt[:200]


def _subagent_has_nested_agents(jsonl_path: Path) -> bool:
    """Check if a subagent JSONL file contains its own agent_progress events."""
    try:
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    record = json.loads(line.strip())
                    if record.get("type") == "progress":
                        if record.get("data", {}).get("type") == "agent_progress":
                            return True
                except json.JSONDecodeError:
                    continue
    except OSError:
        pass
    return False


def _extract_subagent_first_prompt(jsonl_path: Path) -> str:
    """Extract the first user prompt from a subagent JSONL file."""
    try:
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    record = json.loads(line.strip())
                    if record.get("type") == "user":
                        content = record.get("message", {}).get("content", "")
                        if isinstance(content, str) and content.strip():
                            return content.strip()
                except json.JSONDecodeError:
                    continue
    except OSError:
        pass
    return ""
