# sane-tui

Thin command surface for installing and managing `Sane`.

Current responsibility:
- command parsing
- install/config/doctor/export/uninstall shell
- user-facing operational output
- thin orchestration over managed Codex-native targets

This crate should stay thin. Push durable behavior into the lower crates when possible.
