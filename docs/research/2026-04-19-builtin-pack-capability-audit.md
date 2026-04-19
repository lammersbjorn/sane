# Sane Builtin Pack Capability Audit

Last updated: 2026-04-19

Purpose:
- finish `R1`
- decide what builtin packs belong in `v1`
- keep pack boundaries ready for a future plugin system without freezing one yet

Source decisions:
- pack/plugin-ready architecture, but no public plugin API in `v1`
- do not lock builtin packs before the capability audit
- for `v1`, builtin packs should be curated, not marketplace-driven
- inspirations and likely inputs named so far:
  - `RTK`
  - `Caveman`
  - `Cavemem`
  - `Uncodixfy`
  - `Impeccable`

## Audit Rule

A `v1` builtin pack must satisfy all of these:
- clear user-facing value
- maps to an actual Codex-native surface or installer-managed behavior
- narrow enough to own one area cleanly
- worth shipping for a broad audience, not only one niche workflow

## Shortlist

### 1. `core`

Owns:
- `sane-router`
- managed hooks
- managed custom agents
- optional global `AGENTS.md` overlay
- model-role defaults
- privacy defaults

Why `v1`:
- non-optional foundation
- already real in repo

### 2. `caveman`

Owns:
- compressed communication defaults
- token-saving communication/profile integration

Why `v1`:
- directly aligned with Sane’s speed/token philosophy
- broad utility for long sessions

### 3. `cavemem`

Owns:
- durable memory compression / handoff support
- brief / compaction helpers

Why `v1`:
- directly tied to long-session continuity
- complements the `R3` state model

### 4. `rtk`

Owns:
- safer shell command routing
- environment/policy integration when RTK is present

Why `v1`:
- already part of your real workflow
- concrete QoL, not abstract framework theater

### 5. `frontend-craft`

Initial contents:
- `uncodixfy`
- `impeccable`

Why bundled together in `v1`:
- both serve the same broad user problem:
  avoiding generic AI frontend output
- better as one install choice than two half-explained packs at launch

## Not Recommended As Separate `v1` Packs

Do not split these yet:
- `uncodixfy` standalone pack
- `impeccable` standalone pack

Reason:
- too much surface for early pack UX
- easier `v1` story if “frontend craft” is one curated bundle

## Defer

Defer from `v1` builtin pack status:
- self-improvement pack
- telemetry pack
- issue-relay pack
- repo-export pack
- pack marketplace / third-party registry
- external MCP integrations as mandatory default behavior

Reason:
- these are platform concerns or later extensibility, not early broad bundles

## Recommended Optional Integrations

These should not be forced into the bare default pack.

Best shape:
- installer checkbox or preset profile
- explicit opt-in
- written through managed user-level Codex config only after diff preview and backup

Recommended first optional integrations:
- `Context7`
- `Playwright`
- `grep.app`

Why:
- both have broad utility
- both materially improve coding/research/testing workflows
- both make sense for many users, but not every user

Experimental / not default:
- `OpenSRC`

Why not default:
- less proven in this product plan so far
- unclear whether it belongs in the broad “recommended for almost everyone” bucket
- better as later optional/experimental preset

## Ownership Matrix

`core`
- install/config/export/doctor
- Codex-native managed assets
- default policy

`caveman`
- terse communication + token economy

`cavemem`
- durable memory + compaction helpers

`rtk`
- shell execution discipline

`frontend-craft`
- high-quality UI generation / anti-generic frontend output

`recommended-integrations`
- optional `Context7`
- optional `Playwright`
- optional `grep.app`
- experimental `OpenSRC`

## `v1` Recommendation

Ship `v1` with this builtin pack set:
- `core`
- `caveman`
- `cavemem`
- `rtk`
- `frontend-craft`

Expose them as curated install choices in the TUI later.

Also offer one optional integration preset:
- `recommended-integrations`
  - includes `Context7`
  - includes `Playwright`
  - includes `grep.app`
  - does not include `OpenSRC` by default

Do not expose a public pack API yet.

## Decision

`R1` answer:
- `v1` should ship a curated builtin set of five packs: `core`, `caveman`, `cavemem`, `rtk`, and `frontend-craft`.
- `uncodixfy` and `impeccable` should stay bundled together initially under `frontend-craft`.
- marketplace/plugin extensibility remains deferred until after `v1`.
