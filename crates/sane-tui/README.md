# sane-tui

Thin command surface for installing and managing `Sane`.

Current responsibility:
- command parsing
- install/config/doctor/export/uninstall shell
- backend/dev status inventory shell
- no-args interactive TUI home screen
- no-args interactive TUI config editor for model defaults
- no-args interactive privacy / telemetry screen with reset control
- action list, status summary, output panel, and quit flow
- grouped status inventory for local runtime vs Codex-native assets
- user-facing operational output
- thin orchestration over managed Codex-native targets
- doctor/reporting for managed local and Codex-native surfaces
- current batch ergonomics for all managed targets
- first managed hooks target at `~/.codex/hooks.json`
- first managed custom agents target at `~/.codex/agents/`

This crate should stay thin. Push durable behavior into the lower crates when possible.
