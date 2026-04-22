# Sane Design Spec

## Vision

`Sane` is a QoL agent framework for Codex. It should improve the quality, speed, and ergonomics of working with Codex without forcing users into a command language, rigid workflow, or repo-bound setup. It must remain useful in ordinary repos, in long multi-hour sessions, and for users with minimal prior customization.

The product value should live in the framework behavior and managed Codex-native exports. The TUI is a control surface for that framework, not the center of the product identity.

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

### 6. Repo Guidance Must Stay Narrow

Repo-level guidance should be explicit, minimal, and easy to remove. Prefer file-based targeted skills over large always-on `AGENTS.md` blocks, especially when dogfooding `Sane` inside its own repo.

## System Architecture

`Sane` uses a thin TypeScript-first control plane to install, manage, and repair Codex-native assets.

The stack direction does not change the product boundary: the control plane stays thin, the TUI stays setup/ops-only, and the framework value stays in Codex-native behavior rather than wrapper ritual.

### Runtime Layers

1. TypeScript-first control plane
- exposed through a thin control surface, with the TUI handling install / configure flows in `v1`
- cross-platform
- owns install / configure / update / export / doctor flows

2. Codex-native targets
- user-level Codex assets
- optional repo-level assets
- skills, hooks, custom agents, model/subagent presets, and related managed files
- repo-level exports stay explicit and minimal
- first thin implemented surfaces:
  - user-level skills under `~/.agents/skills`
  - optional additive global overlay in `~/.codex/AGENTS.md`
  - narrow explicit opt-in management of `~/.codex/config.toml`

3. Thin local operational state
- local-only by default
- stores installer/configuration state and other operational metadata only
- should not become a separate day-to-day runtime that users interact with directly

4. Built-in curated capability packs
- shipped with `v1`
- internally pack-shaped
- no frozen public plugin API yet
- current local config/editor foundation can enable or disable optional built-in packs without exposing a public plugin system

### Current Package Boundaries

- `apps/sane-tui`
  - current TypeScript setup/ops surface
  - owns shell state, view models, editor state, and overlays
- `packages/config`
  - local config schema, defaults, normalization, environment-aware recommendations
- `packages/control-plane`
  - install/config/export/repair/history/inventory verbs
- `packages/core`
  - shared operation and inventory result primitives
- `packages/framework-assets`
  - file-first framework asset loader/renderer
  - reads `packs/core/manifest.json` and checked-in templates under `packs/core`
- `packages/platform`
  - project/home path discovery and layout
- `packages/policy`
  - adaptive policy logic and typed obligations
- `packages/state`
  - local state serialization, JSONL history helpers, backups, canonical rewrite metadata

Current Codex settings stance:
- inspect and preview first
- backup before managed writes
- keep bare core profile narrow
- treat integrations as separate opt-in profile work
- treat integrations-profile preview/apply as structured-audit first so install surfaces can explain exact recommended adds before write
- treat provider-specific stacks like Cloudflare as separate opt-in profiles
- preserve unrelated user config when applying core profile
- preserve unrelated user config when applying recommended integrations

## State Model

The state model should separate stable policy, thin operational state, and human summaries.

### Requirements

- readable enough for humans to inspect
- compact enough for token-efficient loading
- easy to inspect and migrate
- portable across macOS, Linux, and Windows

### Recommended Shape

- config/policy: `TOML`
- operational state: `JSON` / `JSONL`
- handoff / current-brief summaries: small `Markdown` only where truly needed

### Default Behavior

- local operational state lives in a namespaced local directory
- state is gitignored by default
- explicit install/export is required before anything becomes shared repo surface

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
- choose model and reasoning settings per subtask using task-shaped presets:
  - `explorer`
  - `implementation`
  - `verifier`
  - `realtime`
- respect runtime support / capability availability
- keep one central reviewer authority even when routing classes vary

## Later End-To-End Flow

Later `Sane` should support an end-to-end idea-to-done flow.

Design intent:

- user can start from plain language
- `Sane` may ask only the targeted questions needed to reduce ambiguity
- `Sane` may do research, planning, implementation, verification, and review across a long run
- `Sane` should keep going until the requested result is actually reached, not stop at a partial plan unless blocked
- this is not a rigid visible mode and should not require a command to exist
- a shortcut entrypoint may exist later, but plain-language invocation remains the primary UX

This capability depends on:

- stable adaptive policy
- stable compaction/handoff state
- stable verification/eval discipline
- bounded self-repair and issue relay behavior

## Model Strategy

`Sane` should not hardcode a single model policy. Instead it should maintain a model-selection layer that maps work to task-shaped classes plus coordinator defaults.

Class targets:
- `explorer`
- `implementation`
- `verifier`
- `realtime`
- coordinator/session authority (non-subagent synthesis)

Example classes:

- quick answer / direct response
- repo exploration
- planning / architecture
- implementation
- review / verification
- long-running execution
- real-time iteration

Current implementation direction:

- policy preview/docs should expose `explorer` / `implementation` / `verifier` / `realtime` routing classes directly
- local config + policy preview are now wired around those routing classes directly
- local config may still keep legacy role fields where needed for compatibility, but routing intent remains class-first
- inspect/runtime surfaces may expose bounded latest policy-preview snapshot state for read-only transparency, but must not imply live orchestration control
- documented OpenAI positioning and actual spawnable-here runtime support must be tracked separately
- OpenAI docs do not currently publish one hard benchmark table across these workflow classes, so class ordering is an implementation inference grounded in official positioning, not benchmark truth

The design principle is fixed: choose the best available configuration for the task rather than forcing one global model. When no saved local config exists, derive the starting defaults from detected local Codex model availability and fall back to stable static presets only if detection fails.

## TUI

The TUI is the current installer/configuration surface, not a chatting surface and not the center of the product identity.

Current implementation note:

- the active TypeScript TUI is already split into shell state, view-model, editor-state, and overlay-model layers
- renderer/runtime details are separate from those app-model boundaries

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
- grow into a parallel non-Codex runtime

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

For `Sane`'s own repo, self-hosting guidance should stay minimal. Dogfooding should prove that the framework remains useful without relying on a giant always-on repo instruction layer.

### Phases

1. Build `Sane` with normal Codex workflow
2. Use `Sane` in shadow mode on its own repo
3. Use `Sane` for bounded parts of its own workflow
4. Let `Sane` propose self-improvements
5. Allow narrow safe classes of self-applied fixes

### Repo Guidance Rule For `Sane` Itself

- default to no broad always-on repo `AGENTS.md`
- prefer small file-based targeted skills when repo-local help is actually needed
- use repo `AGENTS.md` only for durable facts that truly need to load every session
- keep self-hosting artifacts narrow enough that public docs do not need inflated claims to justify them

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
- TypeScript-first control-surface implementation choice
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
packages/
  sane-core/
  sane-tui/  # package path; binary/app name is `sane`
  sane-platform/
  sane-state/
  sane-config/
```

The package/module boundaries are provisional and can be tightened during the migration pass.

## Correction

Earlier planning drifted toward treating `.sane` as the center of the product. That is not the intended architecture. The product should remain a framework for Codex, with a TypeScript-first control plane acting as the thin operational layer that installs and manages Codex-facing assets.
