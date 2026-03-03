# Dashboard Demo Recording Guide

## Prerequisites

- OMAS installed and data scanned (`omas scan`)
- Dashboard dependencies installed (`cd dashboard && npm install`)
- Screen recording tool (OBS Studio or macOS built-in)

## Recording Steps

1. **Start the dashboard**:
   ```bash
   omas dashboard
   ```

2. **Record the following pages** (5-10 seconds each):
   - Overview page (radar chart, score cards, trend)
   - Projects page (project grid with mini dimension bars)
   - Click into a project for detail view
   - Session detail view (click a session row)
   - Scoring Guide page

3. **Convert to GIF** (if needed):
   ```bash
   # Using ffmpeg
   ffmpeg -i dashboard-demo.mov \
     -vf "fps=10,scale=1200:-1:flags=lanczos" \
     -c:v gif \
     demo/dashboard-demo.gif
   ```

## Tips

- Use dark mode browser for consistent look
- Set browser zoom to 90% for better fit
- Close other tabs for clean recording
- Record at 1920x1080 resolution
