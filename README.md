# Sane

Sane is a Codex-native QoL framework for plain-language, adaptive, high-signal development work.

It is being built for people who want better agent workflows without command lock-in, repo pollution, or framework theater.

## Status

Early public WIP.

Current repo status:
- Rust workspace bootstrapped
- project-local `.sane` runtime namespace implemented
- config/state persistence foundations implemented
- initial `install`, `config`, and `doctor` commands implemented
- core design, decision log, and bootstrap plans written

This is not stable yet. The architecture and philosophy are real; the product surface is still being built.

## Principles

- Plain-language first
- No required command language
- No required `AGENTS.md`
- Local-first by default
- Optional export into native Codex surfaces later
- Adaptive workflow rigor instead of rigid modes
- Single-agent by default, subagents only when useful
- Token and speed optimization as first-class concerns

## Current Commands

```bash
cargo run -p sane-tui
cargo run -p sane-tui -- install
cargo run -p sane-tui -- config
cargo run -p sane-tui -- doctor
```

## Repository Docs

- Decision log: `docs/decisions/2026-04-19-sane-decision-log.md`
- Design spec: `docs/specs/2026-04-19-sane-design.md`
- Bootstrap plan: `docs/plans/2026-04-19-sane-v1-bootstrap.md`
- Runtime foundation plan: `docs/plans/2026-04-19-sane-runtime-foundation.md`

## Near-Term Roadmap

- richer config schema for model and subagent presets
- project root detection and stronger runtime discovery
- better `doctor` checks and repair actions
- initial adaptive routing policy implementation
- stronger install/update/export flows
- public docs cleanup

## Open Source

Licensed under either of:

- Apache License, Version 2.0
- MIT license

at your option.
