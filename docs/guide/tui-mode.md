# TUI Mode

OMAS includes an interactive terminal user interface (TUI) powered by [Trogon](https://github.com/Textualize/trogon) and [Textual](https://textual.textualize.io/).

## Launching the TUI

```bash
omas tui
```

This opens a form-based interface in your terminal that lets you browse all available commands, fill in options using form controls, and execute commands interactively.

## How It Works

Trogon introspects the Click CLI and automatically generates a terminal form for every command and option. Instead of typing command-line flags, you can:

- Navigate commands with arrow keys
- Toggle boolean flags with checkboxes
- Enter text values in input fields
- See help text for each option inline

## Auth Screen

The TUI includes a dedicated auth screen for managing OMAS Cloud authentication:

- **Login**: Select an OAuth provider (GitHub or Google) and initiate the device flow
- **Status**: View your current authentication state
- **Logout**: Clear stored credentials

## Upload Screen

The upload screen provides a visual interface for uploading metrics to OMAS Cloud:

- Preview what will be uploaded (dry-run mode)
- See upload progress and results
- View any queued uploads that failed previously

## Requirements

The TUI requires the following Python packages (included in OMAS dependencies):

- `textual>=0.40`
- `trogon>=0.5`

If Trogon is not installed, `omas tui` will gracefully degrade and print a message suggesting installation.
