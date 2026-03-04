"""Tests for AI-written lines counting and density bonus."""

import pytest

from omas.config import AI_LINES_FULL_SCORE
from omas.parser.session_parser import _count_written_lines


class TestCountWrittenLines:
    """Unit tests for _count_written_lines helper."""

    def test_write_tool(self):
        lines = _count_written_lines("Write", {"content": "line1\nline2\nline3"})
        assert lines == 3

    def test_write_empty(self):
        lines = _count_written_lines("Write", {"content": ""})
        assert lines == 0

    def test_write_no_content(self):
        lines = _count_written_lines("Write", {})
        assert lines == 0

    def test_edit_tool(self):
        lines = _count_written_lines("Edit", {"new_string": "a\nb\nc\nd"})
        assert lines == 4

    def test_edit_empty(self):
        lines = _count_written_lines("Edit", {"new_string": ""})
        assert lines == 0

    def test_multi_edit_tool(self):
        edits = [
            {"new_string": "line1\nline2"},
            {"new_string": "line3"},
        ]
        lines = _count_written_lines("MultiEdit", {"edits": edits})
        assert lines == 3

    def test_multi_edit_empty(self):
        lines = _count_written_lines("MultiEdit", {"edits": []})
        assert lines == 0

    def test_unrelated_tool(self):
        lines = _count_written_lines("Read", {"file_path": "/foo"})
        assert lines == 0

    def test_bash_tool(self):
        lines = _count_written_lines("Bash", {"command": "echo hello"})
        assert lines == 0

    def test_malformed_input(self):
        lines = _count_written_lines("Write", None)  # type: ignore
        assert lines == 0


class TestDensityBonus:
    """Tests for AI line bonus in density scoring."""

    def test_zero_lines(self):
        bonus = min(0 / AI_LINES_FULL_SCORE, 1.0)
        assert bonus == 0.0

    def test_small_session(self):
        bonus = min(1000 / AI_LINES_FULL_SCORE, 1.0)
        assert bonus == pytest.approx(0.02)

    def test_medium_session(self):
        bonus = min(10000 / AI_LINES_FULL_SCORE, 1.0)
        assert bonus == pytest.approx(0.2)

    def test_full_score(self):
        bonus = min(50000 / AI_LINES_FULL_SCORE, 1.0)
        assert bonus == 1.0

    def test_over_full_score_capped(self):
        bonus = min(100000 / AI_LINES_FULL_SCORE, 1.0)
        assert bonus == 1.0
