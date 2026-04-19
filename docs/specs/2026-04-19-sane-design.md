# Sane Design Spec

## Vision

`Sane` is a Codex-native QoL framework for plain-language, high-signal development work. It should improve the quality, speed, and ergonomics of working with Codex without forcing users into a command language, rigid workflow, or repo-bound setup. It must remain useful in ordinary repos, in long multi-hour sessions, and for users with minimal prior customization.

## Goals

- Make Codex feel meaningfully better out of the box
- Preserve plain-language prompting as the default interaction model
- Auto-select the right process, skills, and subagent setup only when needed
- Optimize for speed, token efficiency, and long-session survivability
- Work without `AGENTS.md` or repo mutation
- Remain cross-platform and public-ready at `v1`
- Be safe to dogfood on its own repo later

## Non-Goals

- Becoming a mandatory daily wrapper around Codex
- Requiring a command vocabulary to unlock quality
- Shipping a giant plugin marketplace in `v1`
- Fully autonomous self-rewriting from day one
- Collecting telemetry for anything other than product improvement
- Taking over repo configuration by default

## Product Principles

### 1. Plain Language First

Users should be able to ask naturally for help, changes, explanations, debugging, planning, and reviews. The framework should decide when extra process is worth the overhead.

### 2. Adaptive Obligations, Not Fixed Modes

`Sane` should not present a small set of rigid modes that users must learn. Instead, each turn may activate or skip obligations such as:

- planning
- debugging rigor
- TDD loop
- verification
- subagent eligibility
- context compaction
- self-repair

These obligations can change as the session evolves.

### 3. Local-First by Default

The default install should not change repo behavior for collaborators. Runtime state should be project-local and gitignored. Shared / exported behavior should be an explicit opt-in.

### 4. Codex-Native, But Not Codex-Dependent on Repo Files

`Sane` should integrate with native Codex surfaces where useful, but it must still function when a repo has no `AGENTS.md`, or when a repo already uses another framework.

### 5. Token Discipline Is a Feature

Prompt bloat, giant always-loaded methodology, and excessive orchestration are product failures. `Sane` should keep base guidance small, load specific capabilities lazily, and maintain compact state.

## System Architecture

`Sane` should use a local runtime plus optional Codex-native export.

### Runtime Layers

1. Stable local runtime
- installed via TUI
- cross-platform
- not tied to a specific repo export

2. Project-local runtime state
- local-only by default
- stores run state, decisions, summaries, and compact machine-readable history

3. Optional exported native surfaces
- generated only when the user explicitly enables sharing/export
- can include `AGENTS.md` and other Codex-native assets later

4. Built-in curated capability packs
- shipped with `v1`
- internally pack-shaped
- no frozen public plugin API yet

## State Model

The state model should separate stable policy, machine state, and human summaries.

### Requirements

- readable enough for humans to inspect
- compact enough for token-efficient loading
- append-friendly for long sessions
- easy to snapshot and compact
- portable across macOS, Linux, and Windows

### Recommended Shape

- config/policy: `TOML`
- event streams and structured state: `JSON` / `JSONL`
- handoff / current-brief summaries: small `Markdown`

### Default Behavior

- all runtime state lives in a namespaced local directory
- state is gitignored by default
- explicit promotion/export is required before anything becomes shared repo surface

## Adaptive Orchestration Model

`Sane` should route by dynamic policy selection rather than by a fixed workflow ladder.

### Inputs To Policy

- user intent
- task shape
- risk
- ambiguity
- parallelism opportunity
- context pressure
- current run state

### Outputs From Policy

- direct handling
- lightweight verification
- planning/spec requirement
- debugging rigor
- TDD obligation
- review obligation
- subagent eligibility
- context compaction
- self-repair opportunity

### Subagent Policy

- single-agent by default
- subagents only when work decomposes cleanly
- choose model and reasoning settings per subtask
- respect subscription / capability availability
- keep one central verifier / coordinator

## Model Strategy

`Sane` should not hardcode a single model policy. Instead it should maintain a model-selection layer that can map work types to:

- coordinator model
- sidecar model
- reasoning effort
- verification model

Example classes:

- quick answer / direct response
- repo exploration
- planning / architecture
- implementation
- review / verification
- long-running sidecar analysis

Exact presets remain an open implementation task, but the design principle is fixed: choose the best available configuration for the task rather than forcing one global model.

## TUI

The TUI is an operations surface, not a chatting surface.

### `v1` responsibilities

- install
- configure
- update
- export
- doctor
- reset / rollback
- privacy / telemetry inspection

### `v1` should not do

- become the normal way users prompt Codex
- turn ordinary use into a command flow
- hide what files or config it changes

## Privacy / Telemetry

Telemetry is allowed only under strict rules.

### Hard rules

- opt-in only
- local-first
- inspectable
- resettable
- product improvement only
- never used for ads, profiling, or growth tactics

### Never collect by default

- prompt contents
- code contents
- repo names or paths unless explicitly approved and sanitized
- secrets
- file contents

## Issue Relay

Issue relay is separate from telemetry.

### Design intent

- verify issue locally first
- detect likely duplicates
- enrich existing reports when useful
- keep remote reporting opt-in
- prioritize draft/review flows before unattended submission

## Self-Hosting Roadmap

Self-hosting is a later phase, not a launch assumption.

### Phases

1. Build `Sane` with normal Codex workflow
2. Use `Sane` in shadow mode on its own repo
3. Use `Sane` for bounded parts of its own workflow
4. Let `Sane` propose self-improvements
5. Allow narrow safe classes of self-applied fixes

### Preconditions

- stable runtime
- stable state model
- doctor / repair flow
- strong eval harness
- rollback capability
- regression suite for routing and long-session behavior

## Research Backlog

Still requires targeted research before freezing `v1`:

- built-in capability pack shortlist
- model preset matrix
- Rust TUI library choice
- state compaction format
- export surface design
- cross-platform path discovery and install integration
- doctor / repair taxonomy
- self-hosting milestone checklist
- telemetry schema

## Initial Repository Shape

Recommended initial structure:

```text
docs/
  decisions/
  specs/
  plans/
crates/
  sane-core/
  sane-tui/
  sane-platform/
  sane-state/
  sane-config/
```

The crate boundaries are provisional and can be tightened during the first implementation pass.
