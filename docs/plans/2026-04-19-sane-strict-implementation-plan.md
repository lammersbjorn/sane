# Sane Strict Implementation Plan

Last updated: 2026-04-19

This plan is intentionally strict.

It exists to stop three failure modes:

- losing already-made decisions
- mixing research work with implementation work
- letting backend experiments become product direction by accident

Source of truth:
- `/Users/bjorn/Code/labs/betteragents/docs/decisions/2026-04-19-sane-decision-log.md`

If this plan conflicts with the decision log, the decision log wins.

## Hard Guardrails

Never violate these:

- plain-language first
- commands/skills optional, not required
- must work without `AGENTS.md`
- no required repo mutation
- no command-first UX
- no wrapper-first runtime
- Rust is the thin installer / configurator / updater / doctor / asset manager
- Codex-native installation targets are the main product surface
- `.sane` stays thin and operational
- proper install TUI from day one
- TUI is for setup / config / update / export / doctor
- TUI is not the daily prompting interface
- cross-platform first
- pack/plugin-ready architecture, but no public plugin API in `v1`
- do not lock builtin packs before the capability audit

## Plan Shape

This plan has two tracks.

1. Research gates
2. Build gates

Research gates answer open questions.
Build gates implement only already-supported direction.

Do not mix them.

## Research Gates

These must be handled as research / design work, not assumed in code.

### R1. Builtin Pack Capability Audit

Goal:
- decide what builtin packs belong in `v1`

Must answer:
- what packs are core enough for `v1`
- what each pack owns
- what each pack installs/exports
- what should be deferred

Must not assume:
- final builtin list
- public plugin API

Outputs:
- builtin pack shortlist
- pack ownership matrix
- defer list

### R2. Model / Subagent Preset Matrix

Goal:
- decide coordinator / sidecar / verifier default strategy

Must answer:
- capability classes
- fallback order by subscription
- reasoning defaults
- sidecar eligibility rules

### R3. State / Compaction Design

Goal:
- decide exact machine-readable state model

Must answer:
- config format
- operational state format
- compaction/handoff format
- migration strategy

### R4. Codex-Native Surface Map

Goal:
- decide exact managed surfaces beyond current ones

Must answer:
- user-level targets
- global targets
- repo-level optional exports
- order of rollout

### R5. Privacy / Telemetry Schema

Goal:
- define only product-improvement-safe data model

Must answer:
- what can exist locally
- what can ever leave machine
- what must never be collected
- inspect/reset UX

## Build Gates

Only build these in order.

## B0. Decision Hygiene

Goal:
- keep source-of-truth docs correct

Done when:
- decision log up to date
- strict plan up to date
- TODO points to them

## B1. Thin Backend Contract

Goal:
- stabilize the backend operations the TUI will wrap

Allowed:
- typed operation results
- typed inventory/status
- stable backend action list
- stable touched-path reporting

Not allowed:
- new UI stack decisions
- new Codex-native targets beyond already accepted ones

Exit criteria:
- backend contract explicit
- tests cover it

## B2. Proper TUI Foundation

Goal:
- make no-args launch open the actual installer/config TUI

Rules:
- TUI-first user path
- current command verbs may remain only as backend/dev escape hatch
- docs present TUI first

Minimum TUI:
- home screen
- status summary
- action list
- output/result panel
- quit path

First TUI actions:
- install local runtime
- doctor
- export all current managed assets
- uninstall all current managed assets
- inspect config

Not allowed:
- pack browser yet
- routing engine UI yet

## B3. Asset Inventory / Auditability

Goal:
- make managed assets visible before more targets are added

Deliverables:
- installed/missing/invalid view
- repair hints
- touched paths
- clear distinction between local operational state and Codex-native managed assets

Gate:
- no more managed targets until this exists

## B4. Next Managed Targets

Goal:
- expand Codex-native targets in strict order

Order:
1. hooks
2. optional custom agents
3. optional further overlays
4. repo-level exports later

Rules:
- additive only
- removable
- preserve unrelated user content
- merge/preserve/remove tests required

## B5. Model/Subagent Config Surface

Goal:
- expose model-role defaults and capability constraints

Allowed:
- config schema
- TUI config inspection/editing
- fallback rules

Not allowed:
- full adaptive routing engine yet

## B6. Privacy / Telemetry Foundation

Goal:
- local-first privacy model before any remote behavior

Allowed:
- opt-in config
- transparency view
- reset/delete controls

Not allowed:
- remote telemetry by default
- any data outside product-improvement scope

## B7. Adaptive Orchestration Engine

Goal:
- implement actual routing / obligation policy later

Why late:
- core product logic
- easy place to drift
- must sit on stable install/config/state/model foundations first

## Current Known Repo Mismatch

Current repo already has:
- backend asset management
- command shell
- current managed surfaces
- doctor coverage

Current mismatch with locked product direction:
- pack/plugin-ready architecture not yet reflected clearly enough in plan/docs
- builtin pack work not clearly separated into research gate

## Working Rule For Any Agent

Before touching code:

1. read decision log
2. read this plan
3. identify current gate
4. if task belongs to later gate, do not start it

Before touching docs:

1. keep `Locked`, `Recommended`, `Open` separate
2. do not silently convert research questions into implementation facts

## Immediate Next Allowed Work

Allowed now:
- finish `B1` only
- explicit inventory/status read
- touched-path reporting cleanup
- backend contract docs/tests

Not allowed now:
- rewriting the product around command UX
- adding new managed targets
- inventing final builtin packs
- public plugin API work
- routing-engine work
- large TUI experimentation before `B1` exit criteria are complete
