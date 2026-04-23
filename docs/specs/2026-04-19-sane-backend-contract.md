# Sane Backend Contract

Last updated: 2026-04-19

This document defines the thin backend contract the proper `Sane` TUI must wrap.

It is not a promise that these operations remain exposed as user-facing CLI commands. Per locked product decisions, the primary UX is the onboarding-first TUI, with backend verbs kept as escape hatches.

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
- narrow Codex config profile management

Current implementation note:

- the active policy-preview path is TypeScript control-plane code in `packages/control-plane/src/policy-preview.ts`

It does not yet cover:

- adaptive routing as a live user-facing engine
- subagent orchestration
- long-session compaction
- telemetry sending
- issue relay

Current internal exception:

- backend/dev policy inspection is allowed for adaptive-engine groundwork as long as it stays secondary to the TUI and does not become command-first UX

## Current Managed Targets

Current managed targets are:

1. local operational runtime under project `.sane`
2. user core skill pack at `~/.agents/skills/` (currently `sane-router` and `continue`)
3. optional repo-local shared core skill pack at `<repo>/.agents/skills/` (same current core skill names)
4. optional additive repo-local overlay block in `<repo>/AGENTS.md`
5. optional additive global overlay block in `~/.codex/AGENTS.md`
6. additive user-level hooks entry in `~/.codex/hooks.json`
7. additive user-level custom agents in `~/.codex/agents/`
8. optional additive OpenCode agent export in `~/.config/opencode/agents/`
9. narrow explicit opt-in profile management for user-level Codex config at `~/.codex/config.toml`

Current managed export behavior also depends on local config:
- built-in pack set is fixed today: always-on `core` plus optional `caveman`, `rtk`, and `frontend-craft`
- exported core skills currently include `sane-router` plus `continue`
- exported `sane-router` skill content can reflect enabled guidance packs and current routing defaults
- exported global and repo `AGENTS.md` overlays can reflect enabled guidance packs and current routing defaults
- status/doctor should flag those assets as invalid when current exports drift from enabled guidance-pack or routing config
- enabled optional packs may materialize as additional managed user skills during `export_user_skills` (currently `sane-caveman`, the full pinned upstream `Leonxlnx/taste-skill` skill suite, and `impeccable`)
- enabled optional packs may materialize as additional managed repo skills during `export_repo_skills` (same exported skill names as user scope)
- `frontend-craft` currently exports every upstream `Leonxlnx/taste-skill` skill plus `impeccable`, so agents can select task-specific Taste variants such as `gpt-taste` and `image-taste-frontend`
- capability-only packs (`rtk`) do not export dedicated skill directories, but they still change and can be enforced through router/overlay/custom-agent output
- installed `caveman` pack guidance is enforced through exported router guidance, overlays, and custom-agent templates; it is not just an advisory inspect note
- default continuity should still come from scoped Codex-native exports plus thin local `.sane` state, not Codex native `memories`
- repo-local `AGENTS.md` overlay export should stay distinct from the global overlay while reusing the same underlying routing state
- built-in pack manifests may also carry read-only provenance metadata for bundled upstream-derived skills or MCP references
- that provenance is inspectable metadata only, not a live fetch/update contract
- inspect/runtime-summary reads may surface bounded latest history previews for the most recent `event`, `decision`, and `artifact` alongside the underlying counts, but that stays read-only and does not add a log-browsing surface
- runtime handoff inspection should preserve canonical `present` vs `missing` vs `invalid` layer truth for `current-run`, `summary`, and `brief` instead of collapsing everything into value-truthiness

## Required Operations

These are the backend actions the TUI is allowed to call in the current phase.

### Runtime

- `install_runtime`
  - ensure `.sane` directories exist
  - ensure local config exists
  - ensure run snapshot exists

- `show_config`
  - read config from `.sane/config.local.toml`
  - display current routing defaults

- `show_codex_config`
  - read `~/.codex/config.toml` if present
  - summarize current model, reasoning, hooks feature, Codex native memories setting, MCP servers, plugins, trusted project count, and current TUI statusline/theme state
  - remain read-only until explicit opt-in write flow exists

- `backup_codex_config`
  - copy `~/.codex/config.toml` into local `.sane/backups/codex-config/`
  - never mutate user Codex config
  - exist to support future diff-preview/write safety

- `preview_codex_profile`
  - compute read-only recommended core profile changes for user Codex config
  - keep recommendations narrow: core model, reasoning, and hook support only
  - do not turn Codex native `memories` into a default recommended write
  - keep integrations out of the bare core profile preview

- `preview_integrations_profile`
  - compute read-only recommended integrations changes separately from the core profile
  - return structured audit details for install/config surfaces (recommended adds, existing entries, skips, and touched config scopes)
  - current recommended set:
    - `context7`
    - `playwright`
    - `grep.app`
  - do not treat `opensrc` as default recommended profile

- `apply_integrations_profile`
  - backup current `~/.codex/config.toml` first when it exists
  - write only missing recommended integrations:
    - `mcp_servers.context7`
    - `mcp_servers.playwright`
    - `mcp_servers.grep_app`
  - leave `opensrc` outside the default recommended profile
  - preserve all unrelated user config
  - emit post-apply structured audit details that match preview categories

- `preview_cloudflare_profile`
  - compute read-only optional provider profile changes for Cloudflare
  - current provider target:
    - `cloudflare-api`
  - keep it separate from the broad recommended integrations profile

- `apply_cloudflare_profile`
  - backup current `~/.codex/config.toml` first when it exists
  - write only:
    - `mcp_servers.cloudflare-api`
  - preserve all unrelated user config

- `preview_opencode_profile`
  - compute read-only optional compatibility-profile changes for Opencode-adjacent tooling
  - current compatibility target:
    - `opensrc`
  - keep it separate from the broad recommended integrations profile

- `preview_statusline_profile`
  - compute read-only optional native Codex TUI changes
  - current target keys:
    - `tui.notification_condition`
    - `tui.status_line`
    - `tui.terminal_title`
  - keep this additive and native-config-only; no Sane-owned custom statusline product surface

- `apply_opencode_profile`
  - backup current `~/.codex/config.toml` first when it exists
  - write only:
    - `mcp_servers.opensrc`
  - preserve all unrelated user config

- `apply_statusline_profile`
  - backup current `~/.codex/config.toml` first when it exists
  - write only:
    - `tui.notification_condition`
    - `tui.status_line`
    - `tui.terminal_title`
  - preserve all unrelated user config

- `apply_codex_profile`
  - backup current `~/.codex/config.toml` first when it exists
  - write only:
    - `model`
    - `model_reasoning_effort`
    - `features.codex_hooks`
  - preserve all unrelated user config

- `restore_codex_config`
  - restore latest local backup from `.sane/backups/codex-config/`
  - only count real local backup files, not mere directory presence or stray entries
  - never guess from remote state

- `show_status`
  - read structured inventory for all current managed targets
  - keep touched paths explicit for auditability
  - include warning-only conflict signals for invalid Codex config and unmanaged `mcp_servers.*` entries without changing inventory status or attempting repair
  - may remain a backend/dev escape hatch under the later TUI

- `preview_policy`
  - internal/backend inspection only for now
  - render canonical adaptive-policy scenarios into typed output
  - include editable role defaults plus derived routing classes for each scenario
  - persist the latest preview snapshot so Inspect can show read-only, current-run-derived policy visibility
  - latest persisted snapshot may include typed input classification per scenario for Inspect/runtime-summary visibility
  - keep typed scenario/orchestration/continuation/trace payloads available for internal history/state plumbing even if current user-facing render stays compact
  - continuation guidance may express internal stop posture such as answer directly, continue until verified, continue until blocked, self-repair until unblocked, or close when verified
  - normalize current-run phase aliases conservatively: `done` / `complete` / `finished` map to closing posture, while `error` / `failed` / `failing` map to blocked self-repair posture
  - exist to verify obligation rules without presenting a shipped live orchestration runtime

### Doctor / Status

- `doctor`
  - inspect `.sane` runtime presence
  - inspect config validity
  - inspect run snapshot validity
- inspect managed user skill presence
- inspect optional repo-local shared skill presence
- inspect optional repo-local AGENTS overlay presence
- inspect managed global AGENTS block presence
- inspect user-level Codex config presence / parse validity
- surface warning-only Codex config conflicts in Inspect; do not auto-fix unmanaged setup
- inspect optional OpenCode-agent export presence
- emit repair hints

- `inventory`
  - structured status of all managed targets
  - this may initially be internal-only, but the TUI needs it

## Asset Management

- `export_user_skills`
- `export_repo_skills`
- `export_repo_agents`
- `export_global_agents`
- `export_hooks`
- `export_custom_agents`
- `export_all`
- `uninstall_user_skills`
- `uninstall_repo_skills`
- `uninstall_repo_agents`
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
- missing all core skills -> `missing`
- partially missing or drifted core skills -> `invalid`
- AGENTS file exists but no Sane block -> `present_without_sane_block`

Current implementation note:

- `doctor` now derives its summary from the same shared inventory inspection used by `show_status`
- touched paths are deduplicated before render
- inventory is now explicitly scoped as either `local runtime` or `codex-native`
- current TUI status panel renders those two groups separately
- current hooks target is user-level only and uses the `sane` binary itself as the managed `SessionStart` command
- current Windows behavior marks hooks as unavailable/invalid and should steer users toward WSL for hook-enabled flows
- current custom-agents target installs two read-only managed agents: `sane-reviewer` and `sane-explorer`
- current Codex config work supports narrow explicit opt-in writes for the core profile
- current integrations profile work supports narrow explicit opt-in writes for recommended MCP servers only
- current install/inspect integrations UI consumes the structured integrations audit payload instead of rebuilding its own diff logic
- current Inspect policy visibility is read-only and sourced from the latest current-run-derived preview snapshot
- current Cloudflare profile work supports separate explicit opt-in provider-profile writes only
- current Opencode compatibility profile work supports separate explicit opt-in compatibility-profile writes only
- current OpenCode-agent work supports separate explicit opt-in compatibility exports only and stays outside `export_all`

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
