# Sane Decision Log

Last updated: 2026-04-27

This file is the durable source of truth for decisions already made in the April 19, 2026 session.

Primary source:
- `~/.codex/sessions/2026/04/19/rollout-2026-04-19T14-42-32-019da5c3-973f-7a62-9339-823069e71ac6.jsonl` (local session path, user-specific)

## How To Use This File

- `Locked`: already decided. Do not reopen in plans unless user changes them.
- `Recommended`: strong direction already reached, but still implementation-detail flexible.
- `Open`: not decided yet. Research or design still needed.

## Locked

### Product

- Name: `Sane`
- Audience: for anyone, not just one personal setup
- Positioning: full QoL framework / pack for Codex
- Open source at `v1`
- License: `MIT OR Apache-2.0`

### Core Philosophy

- Plain-language first
- No workflow lock-in
- Commands and skills should still be callable, but optional
- Framework should auto-determine when to use skills, hooks, process, and subagents
- Speed and token optimization are first-class concerns
- Avoid useless feature bloat
- Built for long adaptive sessions, including multi-hour one-shot runs
- Behavior should adapt over time instead of forcing one fixed mode

### Codex / Runtime

- Codex-native
- Must work without `AGENTS.md`
- Must work everywhere, not only in repos prepared for it
- `AGENTS.md` is optional enhancement / export path only
- `Sane`'s own repo may intentionally self-host with a minimal repo-local `AGENTS.md` plus targeted repo skill files when building `Sane` itself
- That repo-local self-hosting path is for bounded dogfooding, not a requirement or expectation for other repos
- Large catch-all `AGENTS.md` files are an anti-pattern; keep the root file minimal and push specific guidance into targeted skills
- No required repo mutation
- No daily wrapper required for prompting
- No command-first UX
- No wrapper-first runtime
- TypeScript-first control plane should primarily be the installer / configurator / updater / doctor / asset manager
- Implemented TypeScript package boundaries now include `@sane/sane-tui`, `@sane/config`, `@sane/control-plane`, `@sane/core`, `@sane/framework-assets`, `@sane/platform`, `@sane/policy`, and `@sane/state`
- File-first framework assets should render from checked-in `packs/core` sources through `packages/framework-assets`
- Codex-native installation targets are the main product surface
- Current managed Codex surfaces include the user skill, optional repo skills, optional repo `AGENTS.md` block, global `AGENTS.md` block, hooks, custom agents, and narrow Codex config profiles
- Optional user-level Codex settings management is allowed later, but only as an explicit opt-in surface with preserve / backup / restore behavior
- Local state may exist, but it must stay thin and operational rather than becoming a separate day-to-day runtime

### Workflow / Orchestration

- Hybrid adaptive workflow
- Spec / TDD / review may be skipped for trivial asks and one-liners
- Heavier rigor should appear automatically when useful
- Avoid rigid visible modes
- Use per-turn / per-prompt / per-session adaptive policy
- Subagent-first default for all non-tiny work
- Stay single-agent only for tiny direct answers
- Broad work needs a lane plan and successful subagent handoff before deep work
- A research/planning handoff does not carry into a later implementation turn; broad follow-up edits need a fresh implementation/review handoff before edits
- Broad review needs explorer/reviewer lanes; if higher-priority tool rules require explicit subagent authorization and it is missing, ask and stop
- Broad editing needs an implementation lane with a disjoint write scope
- One central verifier / reviewer authority
- No agent democracy or chatter loops
- Later state should include an end-to-end outcome runner that can take an idea, ask targeted follow-up questions, do research, verify itself, and keep going until the requested result is reached
- That later end-to-end flow should remain plain-language first
- A shortcut command may exist later, but the feature must not depend on command ritual

### Model Policy

- Do not lock `Sane` to one model
- `Sane` should auto-pick the best available models, reasoning settings, and subagent configurations for the task
- Selection should respect task shape, runtime support, and available Codex capabilities
- Fast / cheap sidecar tasks and heavier coordinator tasks may use different model presets
- When no saved config exists, recommended defaults should come from local Codex model availability and plan data when present; static presets stay as fallback only

### State / Persistence

- Project-local state by default
- Local-only / gitignored by default
- Zero committed footprint by default
- Avoid interfering with other agent frameworks in cloned repos
- Optional shared / exported layer later
- Local state should balance readability and token efficiency
- `Sane` should not depend on a third-party global memory system for default continuity
- Default continuity should come from scoped Codex-native exports plus thin local `.sane` state
- Codex native `memories` should stay outside Sane's default continuity path for now
- Third-party memory systems may exist later only as explicit optional integrations, not as default startup replay

### TUI / Installation

- Proper install TUI from day one
- TUI is for setup / config / update / export / doctor flows
- TUI is not the normal prompting interface
- Onboarding can borrow from the strongest parts of `openagentsbtw`, without becoming command-first
- The current no-args TUI should open into an onboarding-first control-center layout
- Current section tabs are `Home`, `Settings`, `Add to Codex`, `Status`, `Repair`, and `Uninstall`
- Current TypeScript TUI implementation is layered as shell state, view models, editor state, and overlays rather than a renderer-owned monolith
- Narrow layouts take priority over forcing a cramped wide split
- Risky writes require confirmation, and successful writes may use explicit notice popups plus compact result feedback
- User-facing copy should name concrete installs/files instead of vague "assets"
- Onboarding may offer an explicit opt-in attribution option for the user's repo or project
- Attribution must be off by default, previewed clearly, easy to remove, and never hidden
- `Sane` may manage Codex native statusline/title config additively, but it should not invent its own custom status-bar product surface in `v1`

### Platform / Implementation

- Cross-platform from day one
- Targets: `macOS`, `Linux`, `Windows`
- TypeScript-first for implementation
- Architecture should be ready for Codex plugin packaging, while keeping Sane's internal pack model private
- Codex plugin packaging is deferred until Plugins support richer product surfaces.
- `v1` does not need a public third-party Sane plugin API yet
- `v1` should be pack-system ready internally, not pack-system complete
- Built-in packs in `v1`
- No third-party Sane extension contract in `v1`
- No compatibility promises for a Sane plugin API in `v1`
- Official Codex shape as of 2026-04-25: skills are the authoring format for reusable workflows, and Codex plugins are still not enough for the full Sane settings/TUI surface.
- Sane should therefore keep skills as the concrete workflow surface and defer Codex plugin packaging.
- The whole repository is not a plugin. The TUI/control plane remains the installer/config/inspect/repair surface.
- TUI-managed core install/export remains the default setup path.
- `export_all` remains the Codex-native install bundle and does not manage plugin artifacts.

### Built-in Packs

- `v1` built-in pack set is now fixed from the capability audit: `core`, `caveman`, `rtk`, and `frontend-craft`
- `frontend-craft` stays one curated pack, but it is now a compact Sane-owned frontend pack instead of exporting the full pinned upstream Taste Skill suite plus `impeccable`
- `frontend-craft` exports `sane-frontend-craft`, `sane-frontend-visual-assets`, and `sane-frontend-review`
- upstream Taste Skill, `impeccable`, and `make-interfaces-feel-better` are provenance and inspiration, not the exported `v1` surface
- the frontend review skill must name the visual tools it should use: in-app browser / Browser Use when appropriate, Playwright for repeatable screenshots and interaction sweeps, screenshots/local image viewing for static visual evidence, and terminal checks only as supporting evidence
- generated or real visual assets are part of the frontend craft surface when they make the product clearer; generic decorative filler is not
- Post-`v1` pack changes require a new capability audit, provenance, explicit optional/experimental status first, and install/inspect/uninstall coverage before graduation
- No public Sane plugin API compatibility promise exists in `v1`

### Outcome Runner Boundary

- Current B8 work is outcome readiness, conflict detection, policy preflight, and writable internal outcome state.
- It is not a full-auto runner.
- A full-auto runner means a plain-language outcome loop that can research, plan, implement, verify, self-repair, persist state, and resume after interruption without exposing a command ritual as the primary UX.
- `advance_outcome` is internal/state plumbing and should not be marketed as a public runner command.
- If full-auto execution is required before `v1`, it needs its own explicit build gate with tests and interruption/resume semantics.

### Agent-Flow Philosophy

- Prompt surfaces should be outcome-first, not command-first.
- Always-on instructions should stay small; concrete behavior belongs in router skills, task skills, agents, hooks, and tests.
- Sane should help agents challenge bad user choices once, then continue with the user's decision unless the choice is unsafe or impossible.
- New-project setup should include a current stack/package/tool research pass unless the user has already chosen a stack or the task is too small to justify it.
- Experimental tools are allowed when they are proven enough for semi-production use and clearly scoped.
- Session lifecycle hooks must be optional, inspectable, reversible, and privacy-scoped.
- External submission hooks such as Tokscale must be opt-in and should default to dry-run/preview before sending.
- Rate-limit resume behavior belongs in a lifecycle/resume gate, not in always-on prose.
- Evals and benchmark integrations such as Passmark should test agent-flow behavior, not become marketing claims without repo-local evidence.

### Self-Hosting / Self-Improvement

- `Sane` should eventually help build `Sane`
- Dogfooding should be phased, not immediate
- The current acceptable dogfooding step is minimal repo-local self-hosting guidance in `Sane`'s own repo
- Self-improvement must be verifier-driven and bounded
- Safe auto-fix classes may exist later
- Evals and verification are mandatory for self-hosting

### Issue Reporting / Telemetry

- GitHub issue relay can exist as an opt-in feature
- Must verify issues before reporting
- Must check duplicates
- Duplicate issues may be enriched instead of duplicated
- Telemetry is opt-in only
- Telemetry exists only to improve `Sane`
- No telemetry repurposing
- No creepy analytics, prompt harvesting, or product-growth misuse

## Recommended

These are strong direction, but not frozen down to exact implementation shape.

- Thin TypeScript-first control plane, Codex-native asset management as the core product
- Migration may be phased, but the target is one TypeScript-first control plane rather than a permanent mixed-stack product surface
- Adaptive policy engine over rigid visible modes
- No numeric scoring engine as the core UX
- Structured machine-readable state plus compact human summaries
- Self-hosting should be milestone-gated, not vibe-gated
- Internal architecture should treat builtin packs as if they were plugins:
  - manifest/config boundary
  - isolated templates/export content
  - clear capabilities
  - explicit install/export hooks
  - inspectable provenance metadata for curated upstream-derived content
  - vendored checked-in copies as the canonical source of truth, not live runtime fetches or git submodules by default
- The `v1` built-in pack set is fixed at `core`, `caveman`, `rtk`, and `frontend-craft`.
- Later pack expansion/contraction must start from a fresh capability audit and must not imply a public plugin API compatibility promise.

## Open

These are still undecided and should stay out of `Locked`.

- Exact local runtime directory layout and names
- Exact state file formats and compaction strategy
- Any additional managed surfaces beyond the current skills, `AGENTS.md` blocks, hooks, custom agents, and narrow Codex config profiles
- Exact model preset matrix and routing rules
- Exact control-surface implementation details within the TypeScript-first stack
- Final product name for the later end-to-end outcome-runner flow
- Exact self-hosting milestone checklist
- Exact telemetry schema
- Exact GitHub issue relay policy levels
- Final README tagline and marketing copy

## Planning Rule

Future plan/spec docs must:

- treat `Locked` as authoritative
- keep `Recommended` separate from `Locked`
- keep `Open` separate from both
- not silently promote `Open` items into implementation facts
- not reintroduce legacy-stack assumptions now that TypeScript-first is the locked stack direction
