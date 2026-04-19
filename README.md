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
- layered local state skeleton: `current-run.json`, `summary.json`, JSONL logs, and `BRIEF.md`
- append-only operational event log under `.sane/state/events.jsonl`
- validated model-role config using the actual Codex model/reasoning choices available in-app
- TUI model defaults editor for coordinator, sidecar, and verifier roles
- opt-in privacy / telemetry screen with local-only consent levels and reset controls
- read-only Codex config inspection for current model, reasoning, MCP, plugin, and trust summary
- opt-in local backup of `~/.codex/config.toml` into `.sane/backups/codex-config/`
- read-only preview of recommended core Codex profile changes before any future managed write flow
- backend/dev escape hatch verbs for `install`, `config`, `status`, `doctor`, `export`, and `uninstall`
- grouped audit view separating local runtime state from Codex-native managed assets
- first managed user-level hooks target at `~/.codex/hooks.json`
- first managed user-level custom agents target at `~/.codex/agents/`
- first managed Codex-native user surfaces:
  - `~/.agents/skills/sane-router`
  - optional `~/.codex/AGENTS.md` overlay block
- `doctor` now inspects both `.sane` operational state and managed Codex-native user assets

## Quick Start

```bash
cargo run -p sane-tui
```

No-args now opens the actual TUI.

Current config editor:
- opens inside the TUI
- edits `coordinator`, `sidecar`, and `verifier` defaults
- validates against the current Codex model set:
  - `gpt-5.4`
  - `gpt-5.2-codex`
  - `gpt-5.1-codex-max`
  - `gpt-5.4-mini`
  - `gpt-5.3-codex`
  - `gpt-5.3-codex-spark`
  - `gpt-5.2`
  - `gpt-5.1-codex-mini`
- supports reasoning:
  - `low`
  - `medium`
  - `high`
  - `xhigh`

Current privacy foundation:
- telemetry defaults to `off`
- local consent levels:
  - `off`
  - `local-only`
  - `product-improvement`
- no remote upload logic yet
- local telemetry data can be deleted from the TUI

Backend/dev escape hatches still exist:

```bash
cargo run -p sane-tui -- status
cargo run -p sane-tui -- install
cargo run -p sane-tui -- config
cargo run -p sane-tui -- codex-config
cargo run -p sane-tui -- preview codex-profile
cargo run -p sane-tui -- backup codex-config
cargo run -p sane-tui -- doctor
cargo run -p sane-tui -- export all
cargo run -p sane-tui -- export hooks
cargo run -p sane-tui -- export custom-agents
cargo run -p sane-tui -- uninstall all
cargo run -p sane-tui -- uninstall hooks
cargo run -p sane-tui -- uninstall custom-agents
```

Current hook note:
- Codex hooks are still experimental upstream, and OpenAI’s current hooks docs say Windows support is temporarily disabled as of April 19, 2026.

Current Codex config note:
- Sane only inspects `~/.codex/config.toml` right now.
- Any future managed settings/profile writes must stay explicit opt-in with diff preview and backup/restore.

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
