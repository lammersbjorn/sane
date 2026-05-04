# Sane Backend Contract

Last updated: 2026-04-29

> [!WARNING]
> Historical contract snapshot. Use this file for legacy backend verb context only. Current framework artifact ownership, source-record architecture, and manifest-backed status behavior live in `docs/specs/2026-05-04-source-record-framework-spine.md`.

This document captured the thin backend contract that the TUI wrapped during the April 2026 implementation phase.

It is not a promise that these operations remain exposed as user-facing CLI commands. Per locked product decisions, the primary UX is the onboarding-first TUI, with backend verbs kept as escape hatches.

## Purpose

The backend contract exists so:

- the TUI has a stable action layer
- tests can target real operations without terminal UI coupling
- managed Codex-native assets can be installed, removed, status-checked, and repaired consistently

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
2. user core skill pack at `~/.agents/skills/` (currently `sane-router`, `sane-bootstrap-research`, `sane-agent-lanes`, `sane-outcome-continuation`, and `continue`)
3. optional repo-local shared core skill pack at `<repo>/.agents/skills/` (same current core skill names)
4. optional additive repo-local overlay block in `<repo>/AGENTS.md`
5. optional additive global overlay block in `~/.codex/AGENTS.md`
6. additive user-level hooks entry in `~/.codex/hooks.json`
7. additive user-level custom agents in `~/.codex/agents/`
8. optional full OpenCode export at `~/.config/opencode/` (skills, `AGENTS.md`, session-start plugin wiring, and Sane agents)
9. narrow explicit opt-in profile management for user-level Codex config at `~/.codex/config.toml`

Current managed export behavior also depends on local config:
- built-in pack set is fixed today: always-on `core` plus optional `caveman`, `rtk`, and `frontend-craft`
- exported core skills currently include `sane-router`, `sane-bootstrap-research`, `sane-agent-lanes`, `sane-outcome-continuation`, and `continue`
- exported `sane-router` skill content can reflect enabled guidance packs and current routing defaults
- exported global and repo `AGENTS.md` overlays can reflect enabled guidance packs and current routing defaults
- status/doctor should flag those assets as invalid when current exports drift from enabled guidance-pack or routing config
- enabled optional packs may materialize as additional managed user skills during `export_user_skills` (currently `sane-caveman`, `sane-rtk`, `sane-frontend-craft`, `sane-frontend-visual-assets`, and `sane-frontend-review`)
- enabled optional packs may materialize as additional managed repo skills during `export_repo_skills` (same exported skill names as user scope)
- `frontend-craft` currently exports compact Sane-owned frontend skills instead of the full upstream Taste/Impeccable mirrors; Taste Skill, `impeccable`, and `make-interfaces-feel-better` remain provenance/reference inputs
- `sane-frontend-review` must direct agents to use browser, Playwright, screenshot/local image, and terminal tooling according to what evidence the UI review needs
- `rtk` exports the `sane-rtk` skill and also changes router/overlay/custom-agent output
- installed `caveman` pack guidance is enforced through exported router guidance, overlays, custom-agent templates, and the SessionStart obligation receipt; it is not just an advisory status note
- exported custom-agent templates treat enabled pack notes as active developer instructions, so optional packs apply inside spawned Sane agents instead of relying on parent-session memory
- exported hooks include a compact SessionStart obligation receipt covering triggered skill bodies, broad-work lane handoff, blocked-handoff behavior, current style mode, and enabled optional-pack state
- default continuity should still come from scoped Codex-native exports plus thin local `.sane` state, not Codex native `memories`
- repo-local `AGENTS.md` overlay export should stay distinct from the global overlay while reusing the same underlying routing state
- built-in pack manifests may also carry read-only provenance metadata for bundled upstream-derived skills or MCP references
- that provenance is inspectable metadata only, not a live fetch/update contract
- status/runtime-summary reads may surface bounded latest history previews for the most recent `event`, `decision`, and `artifact` alongside the underlying counts, but that stays read-only and does not add a log-browsing surface
- runtime handoff status checks should preserve canonical `present` vs `missing` vs `invalid` layer truth for `current-run`, `summary`, and `brief` instead of collapsing everything into value-truthiness

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
  - when Codex context is available, also display detected model availability, plan hint, supported reasoning efforts, and the capability line that explains each selected routing default

- `export_portable_settings`
  - write portable settings JSON to `.sane/settings.portable.json`
  - export current local config when present, otherwise export default local config

- `import_portable_settings`
  - read portable settings JSON from `.sane/settings.portable.json`
  - validate payload version and embedded config
  - write validated config into `.sane/config.local.toml` with normal backup behavior

- `install_from_portable_settings`
  - run runtime install/repair baseline
  - then import `.sane/settings.portable.json` into local config

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
    - `playwright`
  - optional, non-default helpers:
    - `context7-cli` should be installed through its upstream CLI path when docs lookup is needed
    - `grep.app` stays optional for environments without RTK/local search
- `apply_integrations_profile`
  - backup current `~/.codex/config.toml` first when it exists
  - write only missing recommended integrations:
    - `mcp_servers.playwright`
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

- `preview_statusline_profile`
  - compute read-only optional native Codex TUI changes
  - current target keys:
    - `tui.notification_condition`
    - `tui.status_line`
    - `tui.terminal_title`
  - keep this additive and native-config-only; no Sane-owned custom statusline product surface

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
    - `compact_prompt`
    - `features.codex_hooks`
  - compact prompt stays small and operational: preserve objective, verified state, active Sane rules, the Sane obligation receipt, completed work, next actions, and blocker state without generated repo overviews
  - preserve all unrelated user config

- `restore_codex_config`
  - restore latest local backup from `.sane/backups/codex-config/`
  - only count real local backup files, not mere directory presence or stray entries
  - return the post-restore `codex-config` inventory from the restored file
  - never guess from remote state

- `show_status`
  - read structured inventory for all current managed targets
  - keep touched paths explicit for auditability
  - canonical status bundles include warning-only conflict signals for invalid Codex config, disabled `features.codex_hooks`, unmanaged `mcp_servers.*`, managed MCP drift, explicit model/reasoning drift, explicit statusline drift, native Codex memories enabled, and enabled `plugins.*` entries without changing inventory status or attempting repair
  - current `show_status` output remains inventory-only; Status renders the conflict warnings
  - Status also exposes read-only self-hosting shadow readiness over `.sane` handoff layers, blocking questions, verification status, and latest policy-preview presence; readiness blocks until verification has passed, and the runner remains disabled
  - may remain a backend/dev escape hatch under the later TUI

- `show_outcome_readiness`
  - read `.sane` handoff layers and the B8 policy preflight suite
  - summarize whether long-running outcome work is ready, blocked, or waiting on explicit input
  - include a read-only progress/rescue signal derived from persisted outcome timestamps only; warn on likely stall, do not pretend to detect arbitrary loops
  - keep the autonomous loop disabled and do not mutate repo or Codex config
  - remain secondary to plain-language continuation

- `advance_outcome`
  - advance framework-owned `.sane` outcome state for long-running Codex-native work
  - update objective, phase, active tasks, blocking questions, verification posture, summary, brief, and operation history
  - write only Sane runtime state and user-supplied touched paths; do not mutate Codex config or external project files directly
  - keep the autonomous loop disabled while still allowing Codex agents to use Sane state transitions during normal work

- `preview_policy`
  - internal/backend inspection only for now
  - render canonical adaptive-policy scenarios into typed output
  - include editable role defaults plus derived routing classes for each scenario
  - persist the latest preview snapshot so Status can show read-only, current-run-derived policy visibility
  - latest persisted snapshot may include typed input classification per scenario for Status/runtime-summary visibility
  - keep typed scenario/orchestration/continuation/trace payloads available for internal history/state plumbing even if current user-facing render stays compact
  - continuation guidance may express internal stop posture such as answer directly, continue until verified, continue until blocked, self-repair until unblocked, or close when verified
  - normalize current-run phase aliases conservatively: `done` / `complete` / `finished` map to closing posture, while `error` / `failed` / `failing` map to blocked self-repair posture
  - exist to verify obligation rules without presenting a shipped live orchestration runtime

### Doctor / Status

- `doctor`
  - check `.sane` runtime presence
  - check config validity
  - check run snapshot validity
- check managed user skill presence
- check optional repo-local shared skill presence
- check optional repo-local AGENTS overlay presence
- check managed global AGENTS block presence
- check user-level Codex config presence / parse validity
- surface warning-only Codex config conflicts in Status; do not auto-fix unmanaged MCP/plugin setup
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
- `export_opencode_all`
- `export_all`
- `uninstall_user_skills`
- `uninstall_repo_skills`
- `uninstall_repo_agents`
- `uninstall_global_agents`
- `uninstall_hooks`
- `uninstall_custom_agents`
- `uninstall_opencode_all`
- `uninstall_all`

Plugin artifact boundary:
- Codex plugin packaging is deferred until Plugins support richer Sane product surfaces.
- TUI-managed core export remains the default Sane setup path.
- `export_all` keeps its current native managed-target behavior and does not manage plugin artifacts.

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
- current path/install hardening covers workspace/project-root discovery, home/Codex path derivation, whitespace-only env fallback, native Windows hook exclusion, and preloaded Windows status inference
- current custom-agents target installs five managed agents: `sane-agent`, `sane-reviewer`, `sane-explorer`, `sane-implementation`, and `sane-realtime`
- current Codex config work supports narrow explicit opt-in writes for the core profile
- current integrations profile work supports narrow explicit opt-in writes for recommended MCP servers only
- current install/inspect integrations UI consumes the structured integrations audit payload instead of rebuilding its own diff logic
- current Status policy visibility is read-only and sourced from the latest current-run-derived preview snapshot
- current Cloudflare profile work supports separate explicit opt-in provider-profile writes only

## TUI Boundary Rule

The TUI should not invent logic separate from its backend contract. Verify the current contract against the 2026-05-04 source-record spine and code before using this historical section as implementation guidance.

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
