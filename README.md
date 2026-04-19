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
- TUI built-in pack editor for `core`, `caveman`, `cavemem`, `rtk`, and `frontend-craft`
- opt-in privacy / telemetry screen with local-only consent levels and reset controls
- read-only Codex config inspection for current model, reasoning, MCP, plugin, and trust summary
- opt-in local backup of `~/.codex/config.toml` into `.sane/backups/codex-config/`
- read-only preview plus explicit opt-in apply/restore flow for the narrow core Codex profile
- read-only preview plus explicit opt-in apply flow for the separate recommended integrations profile (`Context7` + `Playwright` + `grep.app`)
- separate explicit opt-in Cloudflare provider profile for Cloudflare MCP tooling
- backend/dev escape hatch verbs for `install`, `config`, `status`, `doctor`, `export`, and `uninstall`
- grouped audit view separating local runtime state from Codex-native managed assets
- status/doctor now expose built-in pack state as managed local runtime inventory
- optional packs are currently tracked as local configuration first; managed install/export stays deferred
- current user-skill and global AGENTS exports now reflect enabled guidance packs from local config
- first managed user-level hooks target at `~/.codex/hooks.json`
- first managed user-level custom agents target at `~/.codex/agents/`
- first managed Codex-native user surfaces:
  - `~/.agents/skills/sane-router`
  - optional `~/.codex/AGENTS.md` overlay block
- `doctor` now inspects both `.sane` operational state and managed Codex-native user assets

## Quick Start

```bash
cargo run -p sane
```

No-args now opens the actual TUI.

Current config editor:
- opens inside the TUI
- edits `coordinator`, `sidecar`, and `verifier` defaults
- built-in pack editor also opens inside the TUI
- `core` stays required, optional packs toggle locally for now
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
cargo run -p sane -- status
cargo run -p sane -- install
cargo run -p sane -- config
cargo run -p sane -- codex-config
cargo run -p sane -- preview codex-profile
cargo run -p sane -- preview integrations-profile
cargo run -p sane -- preview cloudflare-profile
cargo run -p sane -- backup codex-config
cargo run -p sane -- apply codex-profile
cargo run -p sane -- apply integrations-profile
cargo run -p sane -- apply cloudflare-profile
cargo run -p sane -- restore codex-config
cargo run -p sane -- doctor
cargo run -p sane -- export all
cargo run -p sane -- export hooks
cargo run -p sane -- export custom-agents
cargo run -p sane -- uninstall all
cargo run -p sane -- uninstall hooks
cargo run -p sane -- uninstall custom-agents
```

Current hook note:
- Codex hooks are still experimental upstream, and OpenAI’s current hooks docs say Windows support is temporarily disabled as of April 19, 2026.

Current Codex config note:
- Sane only inspects `~/.codex/config.toml` right now.
- Current managed writes are narrow and explicit opt-in only:
  - `model`
  - `model_reasoning_effort`
  - `features.codex_hooks`
- Current managed integrations writes are also explicit opt-in only:
  - `mcp_servers.context7`
  - `mcp_servers.playwright`
  - `mcp_servers.grep_app`
- Separate provider profile currently supported:
  - `mcp_servers.cloudflare-api`
- Everything else is preserved.

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
