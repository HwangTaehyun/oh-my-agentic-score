# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-03-02

### Added

- Initial release of Oh My Agentic Score (OMAS)
- Four-dimension agentic performance measurement:
  - **More (P-threads)**: Parallel execution path detection
  - **Longer (L-threads)**: Autonomous work duration measurement
  - **Thicker (B-threads)**: Work density and sub-agent depth
  - **Fewer (Z-threads)**: Human checkpoint reduction scoring
- Seven thread type classification (Base, C, P, F, L, B, Z)
- CLI commands: `scan`, `analyze`, `report`, `trend`, `export`, `dashboard`, `list`
- Rich terminal dashboard with color-coded dimension panels
- Next.js 15 interactive dashboard with Chart.js visualizations
- SQLite persistence for historical metrics
- Session discovery from Claude Code JSONL logs
- Fair comparison system with minimum qualifying thresholds
- Weighted scoring and consistency metrics
- Textual TUI via Trogon integration
- OAuth Device Flow authentication (GitHub/Google)
- Offline-first cloud upload with retry queue
- Privacy-preserving project path hashing

### Technical Details

- Based on IndyDevDan's Thread-Based Engineering framework
- Sweep-line algorithm for concurrent agent detection
- Log-normalized scoring (0-10 scale) across all dimensions
- Jaccard similarity for fusion thread detection
- Activity-based autonomy measurement (not idle time)
