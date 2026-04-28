# Sane Strict Implementation Plan

Last updated: 2026-04-25

> [!IMPORTANT]
> Historical implementation plan. Do not use this file as current product or TUI guidance. Current active cleanup and TUI direction live in `docs/specs/2026-04-27-codebase-cleanup-current-standards.md` and `docs/specs/2026-04-25-sane-tui-control-center-redesign.md`. When labels conflict, use `Home`, `Settings`, `Add to Codex`, `Status`, `Repair`, and `Uninstall`.
>
> Historical status: superseded as active implementation plan on 2026-04-27. Keep for decision/context trace only.

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
- subagent-first for all non-tiny work; stay single-agent only for tiny direct answers
- broad work needs a lane plan and successful subagent handoff before deep work
- broad review needs explorer/reviewer lanes; if higher-priority tool rules require explicit subagent authorization and it is missing, ask and pause
- broad editing needs an implementation lane with a disjoint write scope
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

### R7. Recent Public Takes Harvest

Goal:
- normalize the already-collected recent-first corpus of public takes about AI coding tools, Codex, agents, model routing, reasoning effort, MCP, and workflow UX

Must answer:
- which recent posts and videos are actually about product or workflow behavior rather than hype
- which sources are duplicated, low-signal, or stale
- which takes are from the last 30-60 days versus older background context
- whether the existing corpus needs a small refresh or can be used as-is

Must not assume:
- that every loud take is relevant
- that a viral post is a reliable product signal
- that X and YouTube have the same signal quality
- that the corpus should be re-harvested from scratch unless freshness is actually missing

Outputs:
- deduped take corpus
- source/date ledger
- keep/drop list
- refresh-needed flag
- linked research note

Status:
- done via `docs/research/2026-04-25-recent-public-takes.md`
- no fresh scrape required for `v1`; current corpus is sufficient unless a new Codex/OpenAI surface lands

### R8. Take Validation And Sane Impact Mapping

Goal:
- verify the surviving takes from the existing corpus and translate them into Sane-relevant product changes

Must answer:
- which claims are supported by official docs, transcripts, or repeatable public behavior
- which claims are opinion only and should stay out of the plan
- which validated takes matter for Sane now versus later
- which Sane surface each take points at: routing, verify, worktrees, MCP, background agents, frontend browser use, or docs
- which items are already validated versus only newly surfaced by the corpus refresh

Must not assume:
- that a validated take should become a shipped feature
- that every Sane-relevant take belongs in `v1`
- that model-name churn should be hard-coded into docs without a refresh rule

Outputs:
- validated take summary
- Sane impact matrix
- phase / priority recommendation list
- reuse / refresh recommendation
- linked research note

Status:
- done via `docs/research/2026-04-25-recent-public-takes.md`
- validated `v1` pressure maps to shipped routing evidence, adaptive effort/model posture, MCP/plugin/guidance-bloat drift visibility, browser-backed frontend verification, resumable state/stop conditions, worktree readiness, rescue-signal heuristics, and compact lane-planning guidance

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
- tests cover it with stable contract-level assertions

## B1.5. Test Discipline And Fixture Stability

Goal:
- make tests assert durable behavior instead of volatile implementation details

Rules:
- test contracts, not incidental spellings
- avoid pinning update-prone skill names, refs, or manifest contents unless that exact value is the contract under test
- prefer shared fixtures, helpers, and shape assertions for managed surfaces and exported assets
- when a volatile surface changes, update the shared helper or fixture first, then the dependent tests

Exit criteria:
- brittle assertions replaced across touched areas
- volatile export / ref checks moved onto stable helpers or explicit contract fixtures
- future slices have one clear rule for when a test should tolerate churn versus pin an exact value

Status:
- complete for the current `v1` cleanup pass
- command metadata coverage now uses helper assertions for durable ordering, help fragments, platform deltas, and forbidden command ids instead of pinning every incidental array/string position
- framework asset coverage now centralizes manifest skill lookup, frontmatter validation, active asset-source parity, and plugin skill-copy drift checks
- frontend-craft coverage now asserts the compact Sane-owned skill contract and generated/plugin source parity instead of vendored upstream skill internals
- exact strings, refs, and action arrays remain acceptable only when they are the contract under test or an explicit fixture; future volatile surface changes should update the shared helper/fixture first

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

Historical visual/interaction direction for the TUI lived in:
- `/Users/bjorn/Code/labs/betteragents/docs/specs/2026-04-20-sane-tui-redesign.md`
- `/Users/bjorn/Code/labs/betteragents/docs/research/2026-04-20-tui-tooling-and-ux-audit.md`

Current active visual/interaction direction lives in:
- `/Users/bjorn/Code/labs/betteragents/docs/specs/2026-04-25-sane-tui-control-center-redesign.md`

Current TUI sections:
- Home
- Settings
- Add to Codex
- Status
- Repair
- Uninstall

Current accepted shape:
- first no-args launch opens guided Home setup; later no-args launch opens control center
- section tabs are the main navigation model
- `sane settings` lands directly in `Settings`
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
- custom agents: `sane-agent`, `sane-reviewer`, `sane-explorer`, `sane-implementation`, `sane-realtime`

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
- Status renders outcome readiness next to self-hosting shadow state
- `advance_outcome` advances framework-owned `.sane` outcome state internally, including objective, phase, active tasks, blockers, verification posture, summary, brief, and history
- outcome advancement is writable inside Sane's own runtime state, but the autonomous loop remains disabled
- warning-only conflict detection covers invalid Codex config, disabled hooks, unmanaged plugins/MCPs, managed MCP drift, explicit core model/reasoning drift, explicit statusline drift, and native Codex memories enabled

Not allowed yet:
- user-facing autonomous runner command
- user-facing `sane outcome step` command
- command ritual for daily prompting
- autonomous mutation loop
- presenting readiness as completed autonomous outcome execution

## B9. Frontend Craft Remake

Goal:
- make frontend improvement a first-class Sane capability without shipping a huge vendor skill mirror as the `v1` user surface

Accepted shape:
- keep `frontend-craft` as one optional built-in pack
- export three compact Sane-owned skills:
  - `sane-frontend-craft` for build/redesign/polish work
  - `sane-frontend-visual-assets` for real/generated images and art direction
  - `sane-frontend-review` for visual QA before completion
- keep Taste Skill, `impeccable`, and `make-interfaces-feel-better` as provenance/reference material only
- frontend review must specify the tools to use: in-app browser / Browser Use, Playwright, screenshots/local image viewing, and terminal checks as supporting evidence
- frontend work must prefer real or generated product-relevant visuals over abstract decoration when visuals are needed
- browser/screenshot verification is required before calling substantial UI work done when the app can run

Not allowed:
- exporting every upstream frontend skill as the default `v1` surface
- broad always-on style doctrine in overlays or SessionStart hooks
- static source review as the final frontend review when browser tooling is available

## B10. Codex Plugin Packaging

Goal:
- ship Sane as a Codex-native installable package alongside the existing repo and TUI/control plane

Current official Codex shape:
- skills are the authoring format for reusable workflows
- plugins are the installable distribution unit for skills, app integrations, and MCP servers
- local plugin development uses a plugin manifest such as `.codex-plugin/plugin.json` plus marketplace metadata that can point at a repo root or subdirectory

Accepted shape:
- do not switch away from skills for workflow design
- package Sane's exported skills/integrations as a Codex plugin when the goal is install/share
- keep the TUI/control plane as the local install/config/update/export/status/repair surface
- keep TUI-managed core install/export as the default setup path
- treat the Sane plugin artifact as an optional Codex distribution/install surface, not as the default control plane
- keep `export_all` unchanged; it must not implicitly install or rewrite the Sane plugin artifact
- keep Sane's internal pack system private in `v1`; no third-party Sane plugin API promise

Open implementation tasks:
- chosen: `plugins/sane/` subdirectory packaging so the repo remains the product source and the plugin remains a distribution artifact
- done: create local plugin manifest at `plugins/sane/.codex-plugin/plugin.json`
- done: create repo-local marketplace artifact at `.agents/plugins/marketplace.json`
- done: package current Sane skills under `plugins/sane/skills/`
- done: add framework-assets tests that keep plugin skill copies aligned with manifest-exported skills and reject stale manifest asset sources
- done: prune stale vendor skill source entries from active `packs/core/manifest.json`
- done: refresh active upstream provenance refs for `caveman`, `taste-skill`, and `impeccable`
- done: surface boundary decided: core installs stay TUI-managed by default; the plugin artifact is optional and explicit
- done: add explicit TUI/control-plane export/install awareness for the plugin artifact outside `export_all`
- done: add Status/doctor visibility for plugin artifact presence, source/path, installed version, and drift as separate plugin state
- done: add explicit uninstall/remove awareness for the Sane plugin artifact while preserving unrelated Codex plugins
- done: keep plugin package skill copies checked in for v1 and guarded by sync tests, including the generated router copy
- note: `.agents/plugins/marketplace.json` is the repo-local marketplace artifact for development; `export plugin` writes the installed user marketplace with the absolute copied plugin path under `~/.codex/plugins/sane`.

## B11. Agent-Facing Outcome Continuation

Goal:
- ship the v1 outcome loop as agent-facing plain-language continuation on top of B8 state instead of presenting B8 as a public runner command

Definition:
- accepts a user outcome in plain language
- researches when needed
- plans and writes durable TODO/plan state
- implements through adaptive routing/subagents
- verifies and self-repairs until done or blocked
- persists resumable state
- can resume after rate-limit/interruption hooks without making a command ritual the primary UX
- does not add `sane runner`, `run outcome`, or `sane outcome step` as the public workflow ritual

Current status:
- shipped as core skill `sane-outcome-continuation`
- exported through core skill installs and the Sane Codex plugin package
- B8 still provides readiness/conflict/state plumbing only
- `advance_outcome` remains internal plumbing, not a public full-auto command
- public CLI/TUI/package surfaces are guarded against outcome-runner command rituals

Rules:
- coordinator owns final judgment and verifies subagent outputs before relying on them
- subagents are bounded side lanes only: exploration, implementation, verification, or realtime iteration when independent enough
- research is proportional: repo first; browse/current research when the next slice depends on current external facts, new stack choices, stale tool choices, or explicit latest/current asks
- durable TODO/plan/runtime state is required when work spans sessions
- stop only for verified completion, explicit user redirect, missing required decision/credential/dependency, destructive approval, unsafe action, or rate-limit/interruption with resume context preserved
- rate-limit resume remains opportunistic until Codex exposes a reliable reset timestamp

## B12. New-Project Bootstrap Research

Goal:
- make Sane agents research current stack/package/tool choices before creating a new project, while respecting explicit user choices

Rules:
- research latest stable and emerging options for the project domain
- include relevant helper tools, MCPs, plugins, package managers, test runners, design systems, deployment targets, and eval/debug tools
- experimental/new tools are allowed when they are proven enough and scoped clearly
- if the user chose a stack, follow it unless it is a clearly bad fit; correct the user once with evidence, then continue
- keep the research pass proportional; do not turn tiny edits into a broad market scan

Open implementation tasks:
- done: add dedicated `sane-bootstrap-research` core skill
- done: export `sane-bootstrap-research` with core user/repo skills and plugin package skills
- done: add policy fixture coverage for "new project" vs "small existing change"
- done: add docs for when to browse/current-research and when to stay repo-local

## B13. Session Lifecycle Hooks

Goal:
- support optional start/stop/resume hooks without making Sane a hidden automation layer

Accepted hooks:
- optional SessionEnd Tokscale submit hook with dry-run/preview support before real submission
- optional SessionEnd rate-limit detector that records reset timing when Codex exposes enough signal
- optional resume scheduling when a reset time is known and the user opted in

Rules:
- opt-in only
- visible in status/doctor surfaces
- reversible through repair/uninstall
- no prompt or transcript upload without explicit consent
- hooks must degrade gracefully when rate-limit reset data or Tokscale auth is unavailable

Open implementation tasks:
- done: Tokscale CLI supports `tokscale submit --codex --dry-run`; Sane wraps it through managed hook commands so failures do not block Codex
- done: config shape is `[lifecycle-hooks]` with `tokscale-submit`, `tokscale-dry-run`, and `rate-limit-resume`, all opt-in except dry-run defaulting true
- done: export/status/uninstall cover SessionStart, SessionEnd, Tokscale SessionEnd, and stale optional lifecycle drift
- done: tests cover config parsing, command rendering, hook export/uninstall, and SessionEnd rate-limit context
- remaining: automatic resume scheduling once Codex exposes a reset timestamp in hook payloads or another stable local signal

## B14. Agent-Flow Evals And Benchmarks

Goal:
- make philosophy/prompt/routing changes testable before `v1`

Inputs:
- existing `@sane/policy` fixture harness
- Passmark or similar agent benchmark references
- local dogfood scenarios from Sane development

Rules:
- evals should cover actual agent-flow behavior: research choice, tool selection, subagent use, frontend verification, lifecycle hooks, continuation, and stop conditions
- benchmark references are evidence inputs, not marketing claims
- any competitor-inspired feature must map to a Sane-owned behavior and test

Open implementation tasks:
- done: inspected `bug0inc/passmark`; decision is reference-only for v1, not vendor/wrap
- done: added B14 fixtures for frontend review, bootstrap research, plugin packaging, lifecycle hooks, continuation, and stop conditions
- done: added release-readiness eval checklist for philosophy/prompt regressions

## B15. Public Take Follow-Through

Goal:
- turn validated recent public takes into concrete Sane backlog slices without widening the product boundary

Allowed:
- trust-surface improvements
- routing evidence
- worktree/readiness checks
- stall/loop detection
- MCP/plugin conflict clarity
- verify-command surfacing
- optional planning/slicing helpers

Not allowed:
- a daily wrapper
- a chat UI
- hidden background mutation loops
- hard-coded model fandom

Exit criteria:
- validated takes mapped to specific Sane files and phases
- only Sane-relevant changes promoted into `TODO.md`
- risky boundary items kept out of `v1` while read-only/skill/export surfaces address the valid workflow pressure

Current status:
- done
- `v1` follow-through now includes read-only Status/runtime rescue signals, explicit verification surfacing, repo-verify surfacing when `AGENTS.md` is parseable, guidance-bloat warnings, worktree readiness, the existing resumable-state path, and `sane-agent-lanes` for PRD/issue-to-owned-lanes planning
- rescue signals cover long silence, repeated phase, no file delta, and repeated tool errors without enabling background mutation loops
- MCP/plugin conflict copy is warning-only and keeps integrations opt-in
- explicitly rejected for `v1`: wrapper UX, chat UI, and hidden background mutation loops

## Current Known Repo Mismatch

Current repo already has:
- backend managed-surface handling
- command shell
- current managed surfaces
- doctor coverage

Resolved mismatch:
- pack/plugin-ready architecture is now reflected as internal manifest/template boundaries only
- builtin pack scope is locked by `R1`: `core`, `caveman`, `rtk`, and `frontend-craft`
- no public plugin API ships in `v1`; later pack changes require a fresh capability audit, provenance, and install/status/uninstall coverage
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
- `B4` compatibility work is retired; evaluate only further managed Codex-native surfaces that are clearly justified
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
