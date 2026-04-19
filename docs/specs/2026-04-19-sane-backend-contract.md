# Sane Backend Contract

Last updated: 2026-04-19

This document defines the thin backend contract the proper `Sane` TUI must wrap.

It is not a promise that these operations remain exposed as user-facing CLI commands. In fact, per locked product decisions, they should not be the primary UX.

## Purpose

The backend contract exists so:

- the TUI has a stable action layer
- tests can target real operations without terminal UI coupling
- managed Codex-native assets can be installed, removed, inspected, and repaired consistently

## Scope

This contract covers only:

- local operational runtime setup under `.sane`
- current managed Codex-native user assets
- status / doctor reporting
- config inspection

It does not yet cover:

- adaptive routing
- subagent orchestration
- long-session compaction
- telemetry sending
- issue relay

## Current Managed Targets

Current managed targets are:

1. local operational runtime under project `.sane`
2. user skill pack at `~/.agents/skills/sane-router`
3. optional additive global overlay block in `~/.codex/AGENTS.md`
4. additive user-level hooks entry in `~/.codex/hooks.json`
5. additive user-level custom agents in `~/.codex/agents/`

## Required Operations

These are the backend actions the TUI is allowed to call in the current phase.

### Runtime

- `install_runtime`
  - ensure `.sane` directories exist
  - ensure local config exists
  - ensure run snapshot exists

- `show_config`
  - read config from `.sane/config.local.toml`
  - display current model-role defaults

- `show_status`
  - read structured inventory for all current managed targets
  - keep touched paths explicit for auditability
  - may remain a backend/dev escape hatch under the later TUI

### Doctor / Status

- `doctor`
  - inspect `.sane` runtime presence
  - inspect config validity
  - inspect run snapshot validity
  - inspect managed user skill presence
  - inspect managed global AGENTS block presence
  - emit repair hints

- `inventory`
  - structured status of all managed targets
  - this may initially be internal-only, but the TUI needs it

## Asset Management

- `export_user_skills`
- `export_global_agents`
- `export_hooks`
- `export_custom_agents`
- `export_all`
- `uninstall_user_skills`
- `uninstall_global_agents`
- `uninstall_hooks`
- `uninstall_custom_agents`
- `uninstall_all`

## Contract Rules

All backend operations must obey these rules:

- additive by default
- removable cleanly
- preserve unrelated user content
- no repo mutation by default
- no required `AGENTS.md`
- no assumption that Sane is the only framework present
- output should be deterministic enough for tests

## Output Shape

Short term:

- human-readable string output is acceptable

Required next step:

- introduce a typed result shape behind the scenes, then render that shape into:
  - TUI panels
  - test assertions
  - optional debug/CLI output

Current state:

- typed shared backend result/inventory structures now exist
- current command shell renders those typed results back into text
- explicit `show_status` inventory read now exists on top of the typed layer
- proper TUI still needs to wrap the typed layer instead of strings directly

Recommended typed shape:

- `kind`
- `status`
- `summary`
- `details`
- `paths_touched`
- `repair_hint`
- `scope`

## Managed Target Status Model

Every managed target should converge on one of these states:

- `installed`
- `missing`
- `invalid`
- `present_without_sane_block`
- `repairable`

Current mappings:

- `.sane` missing -> `missing`
- invalid config -> `invalid`
- invalid run snapshot -> `invalid`
- missing `sane-router` skill -> `missing`
- AGENTS file exists but no Sane block -> `present_without_sane_block`

Current implementation note:

- `doctor` now derives its summary from the same shared inventory inspection used by `show_status`
- touched paths are deduplicated before render
- inventory is now explicitly scoped as either `local runtime` or `codex-native`
- current TUI status panel renders those two groups separately
- current hooks target is user-level only and uses the `sane-tui` binary itself as the managed `SessionStart` command
- current custom-agents target installs two read-only managed agents: `sane-reviewer` and `sane-explorer`

## TUI Boundary Rule

The future TUI should not invent logic separate from this backend contract.

The TUI may:

- present actions
- show status
- ask for confirmation
- show paths and explanations

The TUI must not:

- hide what action is actually being applied
- mutate files through separate UI-only logic
- diverge from backend tests

## Next Phase Gate

The proper interactive TUI phase may proceed only after:

- this backend contract is accepted as the current boundary
- inventory/status expectations are clear
- touched paths remain explicit and auditable
- backend/dev escape hatches stay subordinate to the later TUI, not the product UX
