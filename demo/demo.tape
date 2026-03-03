# Oh My Agentic Score - Terminal Demo
# Record with: vhs demo/demo.tape
# Install VHS: brew install charmbracelet/tap/vhs

Output demo/demo.gif

Set FontSize 14
Set Width 1200
Set Height 800
Set Theme "Catppuccin Mocha"
Set Padding 20

# Title
Type "# Oh My Agentic Score (OMAS)"
Enter
Sleep 1s

# Scan sessions
Type "omas scan --since 2025-02-01"
Enter
Sleep 5s

# Show report with fair comparison
Type "omas report --limit 10"
Enter
Sleep 4s

# Show trend
Type "omas trend --dimension all"
Enter
Sleep 3s

# Show list
Type "omas list --limit 5"
Enter
Sleep 3s

# Export for dashboard
Type "omas export"
Enter
Sleep 2s

# Show help
Type "omas --help"
Enter
Sleep 3s

# Auth status
Type "omas auth status"
Enter
Sleep 2s

# Upload dry run
Type "omas upload --dry-run"
Enter
Sleep 3s

Sleep 2s
