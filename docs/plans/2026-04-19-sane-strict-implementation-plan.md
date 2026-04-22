# Sane Strict Implementation Plan

Last updated: 2026-04-22

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
- repo-local `AGENTS.md` + repo skill self-hosting is allowed only as a minimal dogfooding path for `Sane`'s own repo
- do not treat that repo-local self-hosting path as a requirement for normal repos
- keep any root `AGENTS.md` minimal; prefer targeted repo skills over giant catch-all instructions
- no required repo mutation
- no command-first UX
- no wrapper-first runtime
- TypeScript-first control plane is the thin installer / configurator / updater / doctor / asset manager
- Codex-native installation targets are the main product surface
- `.sane` stays thin and operational
- proper install TUI from day one
- TUI is for setup / config / update / export / doctor
- TUI is not the daily prompting interface
- repo-local self-hosting guidance must not become a replacement for the TUI/setup boundary
- migration may be phased, but temporary mixed-stack internals must stay behind stable product behavior and one TypeScript-first target
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

## Stack Migration Rule

- The stack target is TypeScript-first. Do not keep adding Rust-first assumptions to new plans/specs.
- Temporary bridge code is allowed only to preserve behavior while landing parity.
- Migration work must not be used to reopen product philosophy, add wrapper ritual, or widen repo self-hosting guidance.

## Self-Hosting Boundary

For `Sane`'s own repo only:

- minimal repo-local `AGENTS.md` + repo skill files are allowed and useful for building `Sane`
- the root `AGENTS.md` should stay short, stable, and high-signal
- task- or domain-specific behavior should live in targeted repo skills
- this is repo-local dogfooding, not product direction that every repo should copy
- this must not weaken the core product promise that `Sane` works without repo mutation and is operated through setup/repair surfaces rather than daily wrapper ritual

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
- decide routing-default strategy for editable roles plus derived task classes

Must answer:
- capability classes
- fallback order by runtime support
- reasoning defaults
- sidecar eligibility rules
- refresh policy for newly relevant models such as `Kimi K2.6`
- which popular new models deserve explicit preset coverage vs generic capability-class fallback
- whether bonus-lane models such as `Codex-Spark` should be preferred for low-latency `realtime` work when a user's runtime/plan exposes separate quota, without making `Sane` depend on that lane

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
- optional user-level Codex settings profile target
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

### R6. Packaging / Distribution Strategy

Goal:
- decide how `Sane` becomes broadly installable after `v1`

Must answer:
- canonical release artifact source
- macOS/Linux package path
- Windows package path
- direct install fallback path
- automation and signing implications

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
- reopening the locked TypeScript-first stack direction
- new product-surface decisions unrelated to the backend contract
- new Codex-native targets beyond already accepted ones

Exit criteria:
- backend contract explicit
- tests cover it

## B2. Proper TUI Foundation

Goal:
- make no-args launch open the actual onboarding-first TUI

Rules:
- TUI-first user path
- onboarding first, settings second
- current command verbs may remain only as backend/dev escape hatch
- docs present TUI first
- optional attribution prompts are allowed only if they are explicit opt-in, previewed, and removable

Minimum TUI:
- onboarding home screen
- section navigation
- status summary
- action list inside each section
- output/result panel
- quit path

Current visual/interaction direction for the TUI lives in:
- `/Users/bjorn/Code/labs/betteragents/docs/specs/2026-04-20-sane-tui-redesign.md`
- `/Users/bjorn/Code/labs/betteragents/docs/research/2026-04-20-tui-tooling-and-ux-audit.md`

Current TUI sections:
- Get started
- Preferences
- Install
- Inspect
- Repair

Current accepted shape:
- no-args launch lands in `Get started`
- section tabs are the main navigation model
- `sane settings` lands directly in `Preferences`
- narrow layouts stack action/help/result before using a wide split
- risky writes require confirmation
- successful writes can use notice popups and compact result feedback
- current TypeScript TUI implementation is already split into shell, view-model, editor-state, and overlay layers

Required shortcut:
- `sane settings` should jump directly into the configure/settings section

Allowed onboarding choice:
- optional "Built with Sane" style attribution prompt for users who want to support the project
- must never be preselected
- must show exact target file(s) and exact text before apply

Not allowed:
- pack browser yet
- routing engine UI yet

## B3. Managed Surface Inventory / Auditability

Goal:
- make managed surfaces visible before more targets are added

Deliverables:
- installed/missing/invalid view
- repair hints
- touched paths
- clear distinction between local operational state and Codex-native managed installs

Gate:
- no more managed targets until this exists

## B4. Remaining Managed Targets

Goal:
- expand Codex-native targets in strict order without reopening already-landed surfaces

Already landed:
- user skill
- repo skills
- repo `AGENTS.md` block
- global `AGENTS.md` block
- install-surface apply flow for recommended integrations profile
- hooks
- custom agents: `sane-agent`, `sane-reviewer`, `sane-explorer`

Remaining order:
1. optional further overlays
2. optional user-level Codex settings profile widening
3. any new repo-level exports beyond the current set, only if clearly justified

Next justified additions to evaluate inside `B4`:
- future managed surfaces only if clearly justified by the Codex-native surface map

Rules:
- additive only
- removable
- preserve unrelated user content
- merge/preserve/remove tests required
- Codex settings management, if added, must be explicit opt-in with diff preview and backup / restore path

## B5. Model/Subagent Config Surface

Goal:
- expose routing defaults and capability constraints

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

Current accepted shape:
- start with a pure typed policy engine
- keep it internal first
- do not turn it into visible user-facing modes
- do not force command usage to access it

First allowed work:
- typed policy inputs
- typed obligation outputs
- pure evaluation rules
- tests for the locked philosophy
- backend/internal inspection only
- typed history/state plumbing for policy previews
- bounded read paths for latest policy snapshots

Not allowed yet:
- pretend policy is complete
- wire daily prompting through a command ritual
- claim autonomous end-to-end execution before verification/state foundations are ready

## B8. Later End-To-End Outcome Runner

Goal:
- support a later idea-to-done flow that can keep going until the requested result is reached

Rules:
- plain-language first
- may ask only targeted questions when needed
- may do research, planning, implementation, verification, and review in one long run
- should persist toward the requested outcome instead of stopping at partial progress unless blocked
- optional shortcut command/entrypoint may exist later, but must remain secondary to plain-language invocation

Prerequisites:
- `B7` adaptive policy stable enough
- compaction/handoff state proven
- verification/eval harness in place
- bounded self-repair and issue-relay policy in place

Later phase follow-on:
- add a conflict checker for pre-existing user setup that could interfere with Sane-managed behavior
- cover MCPs, plugins, config drift, and related Codex-adjacent setup before making assumptions about a clean environment
- treat this as detect-and-warn first, not auto-fix

## Current Known Repo Mismatch

Current repo already has:
- backend managed-surface handling
- command shell
- current managed surfaces
- doctor coverage

Current mismatch with locked product direction:
- pack/plugin-ready architecture not yet reflected clearly enough in plan/docs
- builtin pack work not clearly separated into research gate
- packaging/distribution plan not yet reflected clearly enough in plan/docs

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
- `B4` optional `Opencode` compatibility work is shipped; evaluate only further managed surfaces that are clearly justified
- otherwise keep aligning real state files with the `R3` design
- keep privacy / telemetry local-first
- keep TUI first and backend verbs secondary

Not allowed now:
- rewriting the product around command UX
- clobbering `~/.codex/config.toml`
- inventing final builtin packs
- public plugin API work
- routing-engine work
- remote telemetry transport before privacy controls exist
