# Sane Strict Implementation Plan

Last updated: 2026-04-19

This plan exists to stop implementation drift. It is intentionally strict. If work does not fit this sequence or violates a locked decision in the decision log, do not do it.

## Source Of Truth

Locked decisions come from:

- `/Users/bjorn/Code/labs/betteragents/docs/decisions/2026-04-19-sane-decision-log.md`

This plan is downstream from that file. If they conflict, the decision log wins.

## Hard Product Constraints

- `Sane` is a full QoL framework for Codex
- plain-language first
- no workflow lock-in
- no required command language
- no required `AGENTS.md`
- no required repo mutation
- Rust is the thin installer / configurator / updater / doctor / asset manager
- Codex-native installation targets are the main product surface
- local `.sane` state must stay thin and operational
- proper install TUI from day one
- TUI is for setup / config / update / export / doctor flows
- TUI is not the daily prompting interface
- single-agent default
- subagents only when clearly useful
- model selection must be dynamic per task and subscription
- cross-platform: macOS / Linux / Windows
- telemetry only if opt-in and only for improving Sane

## Explicit Anti-Goals

Do not do these:

- do not turn Sane into a daily wrapper around Codex
- do not ship command-first UX as the main product surface
- do not grow `.sane` into a parallel runtime
- do not add repo-level mutation by default
- do not add heavy surfaces before the TUI flow is defined
- do not lock behavior around one model
- do not let implementation outrun the decision log

## Current Reality Check

Current repo truth:

- backend asset-management primitives exist
- command shell exists
- user-skill install/uninstall exists
- optional global `~/.codex/AGENTS.md` overlay exists
- `doctor` covers `.sane` plus current managed assets

Current mismatch against locked decisions:

- the user-facing surface is still too command-shaped
- a proper interactive install TUI is not yet the primary surface

## Execution Rule

From this point:

1. finish only the current plan step
2. verify it fully
3. update docs/TODO/READMEs
4. commit
5. only then move to the next plan step

No skipping ahead.

## Phase Order

## Phase 0: Re-Baseline

Goal:
- align repo planning files with one strict sequence

Deliverables:
- this plan file
- TODO updated to point at this plan
- no new feature work beyond planning until this exists

Exit criteria:
- one clear ordered plan exists in repo

## Phase 1: Stabilize Backend Contract

Goal:
- freeze the thin backend operations the TUI will call

Allowed work:
- define the backend action list
- define operation result format
- define managed target inventory format
- define what `install`, `doctor`, `export`, `uninstall`, `config` mean internally

Must not do:
- add more Codex-native targets yet
- add more UI experimentation yet

Required backend contract:

- `install_runtime`
- `show_config`
- `doctor`
- `export_all`
- `export_user_skills`
- `export_global_agents`
- `uninstall_all`
- `uninstall_user_skills`
- `uninstall_global_agents`
- asset inventory/status read

Exit criteria:
- backend actions are explicit and stable enough for a TUI to wrap
- tests cover them

## Phase 2: Proper TUI Foundation

Goal:
- make default launch open an actual interactive installer/config TUI

Rules:
- no-args launch must open the TUI
- command verbs may remain only as backend/dev escape hatch
- docs must present the TUI first, not commands first

Minimum TUI surface:

- home screen
- action list
- current status panel
- output/result panel
- keyboard navigation
- quit path

Required first actions in TUI:

- install local runtime
- run doctor
- export all
- uninstall all
- inspect config

Nice-to-have later in same phase:

- dedicated assets screen
- dedicated config screen

Exit criteria:
- default user path is interactive
- command shell is no longer the primary documented interface

## Phase 3: Asset Inventory + Safer Asset Management

Goal:
- make managed assets visible and auditable

Deliverables:

- inventory/status view in TUI
- per-target installed/missing/broken state
- repair suggestions
- explicit display of touched paths

Only after this phase may new managed targets be added.

Exit criteria:
- user can see what Sane manages before and after applying actions

## Phase 4: Next Codex-Native Targets

Goal:
- expand beyond current two managed surfaces in a controlled order

Strict order:

1. hooks
2. optional custom agents
3. optional further overlays
4. repo-level exports only later

Rules:
- additive only
- removable
- preserve existing user content
- tests for merge/preserve/remove required

Exit criteria:
- next target is implemented with add/remove/preserve coverage

## Phase 5: Model/Subagent Config Surface

Goal:
- expose model-role defaults and capability constraints in config/TUI

Deliverables:

- explicit config schema for coordinator / sidecar / verifier
- subscription/capability-aware constraints
- TUI config editing/view flow

Must not do:
- implement full adaptive routing engine yet

Exit criteria:
- TUI can inspect and edit model-role defaults safely

## Phase 6: Privacy / Telemetry / Issue Relay Foundation

Goal:
- implement only the safe local-first config and transparency layer

Deliverables:

- opt-in telemetry config model
- transparency UI for what would be stored/sent
- issue relay draft policy structures

Must not do:
- send remote telemetry by default
- collect prompts/code/content

Exit criteria:
- privacy model exists before any remote behavior exists

## Phase 7: Adaptive Orchestration Layer

Goal:
- add the actual adaptive policy engine later, after install/config surfaces are stable

Why late:
- this is core product logic, but not the first installer/TUI milestone
- building it too early causes drift and fake completeness

Deliverables:

- task-shape inputs
- obligation outputs
- model/subagent selection policy
- verification authority rules

## Working Rules For Agents

- read the decision log first
- read this plan second
- if a task is not in the current phase, do not start it
- if a task introduces a new product decision, stop and log the decision first
- update README plus any touched crate README when responsibilities change
- keep public README short
- keep planning detail in docs

## Immediate Next Step

Next coding step is only:

- define and stabilize typed backend result/inventory structures
- verify current backend operations against that contract
- keep the UI surface unchanged until Phase 1 exit criteria are met

Not next:

- adding more targets
- shipping a new TUI dependency stack
- experimenting with UI flows before the backend contract is stable
- Phase 1: stabilize backend contract and write it down clearly

Not next:

- adding more targets
- shipping a new TUI dependency stack
- inventing new workflow behavior
