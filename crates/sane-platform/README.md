# sane-platform

Platform-aware path and environment helpers for `Sane`.

Current responsibility:
- host platform detection
- project-root discovery
- `.sane` operational path layout
- layered state paths (`current-run.json`, `summary.json`, JSONL logs, `BRIEF.md`)
- `.sane/telemetry` local privacy data path
- Codex-native user path discovery (`~/.codex`, `~/.agents/skills`, hooks, AGENTS, custom agents)

Keep this crate focused on filesystem/platform concerns.
