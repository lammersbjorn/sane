# sane-platform

Platform-aware path and environment helpers for `Sane`.

Current responsibility:
- host platform detection
- project-root discovery
- `.sane` operational path layout
- layered state paths (`current-run.json`, `summary.json`, JSONL logs, `BRIEF.md`)
- `.sane/backups/codex-config` backup path
- `.sane/telemetry` local privacy data path
- Codex-native user path discovery (`~/.codex/config.toml`, `~/.agents/skills`, hooks, AGENTS, custom agents)

Keep this crate focused on filesystem/platform concerns.
