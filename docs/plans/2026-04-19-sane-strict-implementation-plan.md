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

- The stack target is TypeScript-first. Do not keep adding legacy-stack assumptions to new plans/specs.
- Temporary bridge code is allowed only to preserve behavior while landing parity.
- Migration work must not be used to reopen product philosophy, add wrapper ritual, or widen repo self-hosting guidance.

## TS-Only Runtime Status

Current state:

- public repo-root entrypoint routes through the built TS path via `pnpm start` / `pnpm run start:settings`
- internal TS launch works through the `apps/sane-tui/bin/sane.mjs` shim, smart `tsx` preview routing, workspace package `exports`, and self-package app imports
- internal TS build emits `apps/sane-tui/dist/bin/sane.cjs` for runtime use without `tsx`
- the legacy Rust workspace and fallback startup path have been removed
- remaining TUI work is now about TS polish and packaging, not mixed-stack cutover

## Git Progress Tracking

- Track implementation progress with git while executing this plan.
- Check `git status --short` and relevant diffs between slices so progress stays visible in the worktree, not only in chat.
- Use git-backed milestones when explicitly requested, but do not make commits a hard requirement for every slice.

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
- whether an optional Codex statusline/status-bar surface belongs in the managed set
- whether that surface is config-only or needs managed helper files/hooks
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
- default surface, if this ships, is a short README credit line
- README badge and "both" remain explicit alternate choices only, not the default

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
- optional Codex statusline/status-bar support inspired by `openagentsbtw`, only if it stays explicit opt-in, additive, removable, and non-wrapper-first

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
- pure fixture-based eval harness for policy expectations
- backend/internal inspection only
- typed history/state plumbing for policy previews
- bounded read paths for latest policy snapshots

Not allowed yet:
- pretend policy is complete
- wire daily prompting through a command ritual
- claim autonomous end-to-end execution before verification/state foundations are ready

## B8. Outcome Readiness And Conflict Detection

Goal:
- support idea-to-done continuation by exposing whether the current local handoff and policy state is ready for long-running outcome work

Rules:
- plain-language first
- may ask only targeted questions when needed
- may do research, planning, implementation, verification, and review in one long run
- should persist toward the requested outcome instead of stopping at partial progress unless blocked
- any shortcut command/entrypoint must remain secondary to plain-language invocation

Shipped scope:
- `show_outcome_readiness` / `sane outcome-readiness` read local `.sane` handoff state and B8 policy preflight status
- Inspect renders outcome readiness next to self-hosting shadow state
- `advance_outcome` / `sane outcome step` advance framework-owned `.sane` outcome state, including objective, phase, active tasks, blockers, verification posture, summary, brief, and history
- outcome advancement is writable inside Sane's own runtime state, but the autonomous loop remains disabled
- warning-only conflict detection covers invalid Codex config, disabled hooks, unmanaged plugins/MCPs, managed MCP drift, explicit core model/reasoning drift, explicit statusline drift, and native Codex memories enabled

Not allowed yet:
- user-facing autonomous runner command
- command ritual for daily prompting
- autonomous mutation loop
- presenting readiness as completed autonomous outcome execution

## Current Known Repo Mismatch

Current repo already has:
- backend managed-surface handling
- command shell
- current managed surfaces
- doctor coverage

Resolved mismatch:
- pack/plugin-ready architecture is now reflected as internal manifest/template boundaries only
- builtin pack scope is locked by `R1`: `core`, `caveman`, `rtk`, and `frontend-craft`
- no public plugin API ships in `v1`; later pack changes require a fresh capability audit, provenance, and install/inspect/uninstall coverage
- packaging/distribution docs now separate the real local packaged-build path from post-`v1` public release automation

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
- optional Codex statusline/status-bar support may be evaluated inside `B4` under the additive/reversible rules above
- otherwise keep aligning real state files with the `R3` design
- keep privacy / telemetry local-first
- keep TUI first and backend verbs secondary
- keep pack changes within the fixed `v1` built-in set unless a new post-`v1` capability audit opens an experimental pack

Not allowed now:
- rewriting the product around command UX
- clobbering `~/.codex/config.toml`
- inventing final builtin packs
- public plugin API work
- routing-engine work
- remote telemetry transport before privacy controls exist
