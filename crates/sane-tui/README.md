# sane

Thin command surface for installing and managing `Sane`.

Current responsibility:
- command parsing
- install/config/doctor/export/uninstall shell
- backend/dev status inventory shell
- no-args interactive TUI home screen
- no-args interactive TUI config editor for model defaults
- no-args interactive TUI pack editor for built-in pack toggles
- no-args interactive privacy / telemetry screen with reset control
- read-only Codex config inspection for current user-level settings
- read-only preview of recommended core Codex profile changes
- opt-in Codex config backup flow into `.sane/backups/codex-config`
- explicit opt-in apply / restore flow for the narrow core Codex profile
- explicit opt-in apply flow for the separate recommended integrations profile
- explicit opt-in Cloudflare provider profile flow
- action list, status summary, output panel, and quit flow
- grouped status inventory for local runtime vs Codex-native assets
- built-in pack status surfaced through local runtime inventory
- optional packs now move from config-only to installed once managed user-skill exports are present
- current user-skill and global AGENTS exports pick up enabled guidance packs from local config
- stale exported guidance assets are now flagged by status/doctor and repaired by rerunning export
- user-facing operational output
- thin orchestration over managed Codex-native targets
- doctor/reporting for managed local and Codex-native surfaces
- current batch ergonomics for all managed targets
- first managed hooks target at `~/.codex/hooks.json`
- first managed custom agents target at `~/.codex/agents/`

This crate should stay thin. Push durable behavior into the lower crates when possible.
