# sane-tui

Thin command surface for installing and managing `Sane`.

Current responsibility:
- command parsing
- install/config/doctor/export/uninstall shell
- backend/dev status inventory shell
- no-args interactive TUI home screen
- action list, status summary, output panel, and quit flow
- grouped status inventory for local runtime vs Codex-native assets
- user-facing operational output
- thin orchestration over managed Codex-native targets
- doctor/reporting for managed local and Codex-native surfaces
- current batch ergonomics for all managed targets

This crate should stay thin. Push durable behavior into the lower crates when possible.
