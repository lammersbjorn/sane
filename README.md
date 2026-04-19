# Sane

Sane is a Codex-native QoL framework for plain-language, adaptive, high-signal agent workflows.

It is being built for people who want stronger defaults, better automation, and less framework ceremony.

## Status

Early public WIP.

Already implemented:
- Rust workspace bootstrap
- no-args terminal installer/config TUI
- thin project-local `.sane` operational namespace
- config/state persistence foundations
- backend/dev escape hatch verbs for `install`, `config`, `status`, `doctor`, `export`, and `uninstall`
- grouped audit view separating local runtime state from Codex-native managed assets
- first managed Codex-native user surfaces:
  - `~/.agents/skills/sane-router`
  - optional `~/.codex/AGENTS.md` overlay block
- `doctor` now inspects both `.sane` operational state and managed Codex-native user assets

## Quick Start

```bash
cargo run -p sane-tui
```

No-args now opens the actual TUI.

Backend/dev escape hatches still exist:

```bash
cargo run -p sane-tui -- status
cargo run -p sane-tui -- install
cargo run -p sane-tui -- config
cargo run -p sane-tui -- doctor
cargo run -p sane-tui -- export all
cargo run -p sane-tui -- uninstall all
```

## Commit Hook

Install the Conventional Commit hook with:

```bash
./scripts/install-hooks.sh
```

Examples:

```text
feat(tui): add install command
fix(config): persist local config to disk
chore: initialize workspace
```

## Docs

- Design spec: `docs/specs/2026-04-19-sane-design.md`
- Decision log: `docs/decisions/2026-04-19-sane-decision-log.md`

## License

Licensed under either Apache-2.0 or MIT, at your option.
