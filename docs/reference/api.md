# Cloud API Reference

The OMAS Cloud API is an optional service for uploading and comparing metrics. The server-side implementation is planned for a future release.

::: info
The API endpoints are defined but not yet publicly deployed. This reference documents the planned interface.
:::

## Base URL

```
https://api.omas.dev
```

Override with the `OMAS_API_URL` environment variable.

## Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are obtained via the OAuth device flow (`omas auth login`).

## Endpoints

### POST `/api/v1/auth/verify`

Verify an OAuth token with the server.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**Response:**

```json
{
  "valid": true,
  "username": "your-username",
  "provider": "github"
}
```

### POST `/api/v1/metrics/upload`

Upload session metrics.

**Headers:**

```
Authorization: Bearer <token>
Content-Type: application/json
User-Agent: omas-cli/0.1.0
```

**Request Body:**

```json
{
  "sessions": [
    {
      "session_id": "abc123-def456",
      "project_hash": "sha256:...",
      "timestamp": "2025-06-15T10:30:00Z",
      "thread_type": "L",
      "session_duration_minutes": 45.2,
      "total_tool_calls": 127,
      "total_human_messages": 3,
      "parallelism": {
        "max_concurrent_agents": 3,
        "total_sub_agents": 5,
        "peak_parallel_tools": 4,
        "p_thread_score": 4.0
      },
      "autonomy": {
        "longest_autonomous_stretch_minutes": 32.5,
        "max_tool_calls_between_human": 89,
        "session_duration_minutes": 45.2,
        "max_consecutive_assistant_turns": 12,
        "l_thread_score": 7.1
      },
      "density": {
        "tool_calls_per_minute": 2.81,
        "max_sub_agent_depth": 1,
        "total_tool_calls": 127,
        "tokens_per_minute": 1250.0,
        "b_thread_score": 5.0
      },
      "trust": {
        "tool_calls_per_human_message": 42.33,
        "assistant_per_human_ratio": 8.0,
        "ask_user_count": 1,
        "autonomous_tool_call_pct": 99.21,
        "z_thread_score": 7.4
      },
      "overall_score": 5.87
    }
  ]
}
```

**Response:**

```json
{
  "accepted": 1,
  "duplicates": 0
}
```

### GET `/api/v1/metrics/me`

Retrieve the authenticated user's uploaded metrics.

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "username": "your-username",
  "total_sessions": 42,
  "sessions": [...]
}
```

### GET `/api/v1/leaderboard` (Future)

Global leaderboard comparing composite rank scores.

## Privacy

All uploaded data follows strict privacy rules:

- **Project paths are hashed** (SHA-256) before upload — no directory names are exposed
- **Session IDs** are retained for deduplication only
- **No source code** or file contents are ever transmitted
- **No conversation content** is included in the payload
- Only numeric scores, timestamps, and classification labels are sent

## Error Handling

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `401` | Invalid or expired token |
| `409` | Duplicate session (already uploaded) |
| `422` | Invalid payload format |
| `429` | Rate limited |
| `500` | Server error |

## Retry Behavior

The CLI automatically queues failed uploads to `~/.omas/upload_queue.json` and retries on subsequent `omas upload` calls (max 5 attempts per session).
