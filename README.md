# Sane

Sane is a Codex-native QoL framework for plain-language, adaptive, high-signal agent workflows.

It is being built for people who want stronger defaults, better automation, and less framework ceremony.

## Status

Early public WIP.

Already implemented:
- Rust workspace bootstrap
- project-local `.sane` runtime namespace
- config/state persistence foundations
- initial `install`, `config`, and `doctor` commands

## Quick Start

```bash
cargo run -p sane-tui
cargo run -p sane-tui -- install
cargo run -p sane-tui -- config
cargo run -p sane-tui -- doctor
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
