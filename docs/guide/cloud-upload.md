# Cloud Upload

OMAS supports optional cloud upload for sharing metrics and comparing your agentic coding scores with other developers. Check the leaderboard at [oh-my-agentic-score.com](https://oh-my-agentic-score.com). The system is designed with an **offline-first** architecture — everything works locally without any network access.

## Authentication Setup

OMAS Cloud uses OAuth for authentication via GitHub.

### Login

```bash
omas auth login
```

This initiates a device flow: OMAS displays a code, you visit a URL in your browser, enter the code, and authorize the application. Credentials are stored securely via your system keyring.

### Check Status

```bash
omas auth status
```

### Logout

```bash
omas auth logout
```

## Upload Flow

### Preview (Dry Run)

```bash
omas upload --dry-run
```

Shows exactly what would be uploaded without sending any data.

### Upload

```bash
omas upload
```

Sends session metrics to OMAS Cloud. The upload payload includes:

- Session ID (for deduplication)
- Four dimension scores
- Thread type classification
- Session duration and tool call counts
- **Hashed** project path

## Privacy Guarantees

OMAS takes privacy seriously:

| Data | Uploaded? | Details |
|------|-----------|---------|
| Dimension scores | Yes | Numeric scores only |
| Thread type | Yes | Classification label |
| Session metadata | Yes | Duration, tool counts, timestamps |
| Project path | **Hashed** | SHA-256 hash — no directory names exposed |
| Session ID | Yes | For deduplication only |
| Source code | **Never** | No file contents are ever read or transmitted |
| File paths | **Never** | Only hashed project root |
| Conversation content | **Never** | OMAS never reads message content |

## Offline-First Architecture

```
omas scan → SQLite DB (always)
              ↓
         Cloud upload (optional, background)
              ↓
         upload_queue.json (on failure, retry up to 5 times)
```

- Analysis results **always** save to local SQLite first
- Cloud upload runs in the background and is completely optional
- Network failures queue data for automatic retry (max 5 attempts)
- The dashboard works entirely from local data
- You can use OMAS indefinitely without ever enabling cloud features

## Leaderboard

After uploading, visit [oh-my-agentic-score.com](https://oh-my-agentic-score.com) to:

- View your ranking among other developers
- Compare your 4-dimension scores (More, Longer, Thicker, Fewer)
- Track your score progression over time
- See community-wide score distributions

### Quick Start (Scan → Upload → Rank)

```bash
omas auth login          # Authenticate with GitHub
omas dashboard           # Scans, exports, uploads, and launches dashboard
# Visit https://oh-my-agentic-score.com to check your ranking
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OMAS_API_URL` | Cloud API base URL | `https://api.omas.dev` |
| `OMAS_DISABLE_CLOUD` | Set to `1` to disable all cloud features | (unset) |
