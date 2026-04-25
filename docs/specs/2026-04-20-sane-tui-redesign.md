# Sane TUI Redesign

Last updated: 2026-04-22

Purpose:
- replace the current cluttered terminal UI with a cleaner onboarding-first structure
- keep the TUI renderer-agnostic at the app-model boundary
- make `Sane` feel intentionally designed instead of debug-panel driven

Related:
- `docs/research/2026-04-20-tui-tooling-and-ux-audit.md`

## Product Goal

The TUI should feel like:

- a guided setup experience for first-time users
- a clean management surface for later users
- not a raw command dispatcher
- not a wall of boxes
- not an internal backend demo

## Current Screen Model

## Current TS Model Layers

- shell layer
  - `apps/sane-tui/src/shell.ts`
  - `apps/sane-tui/src/shell-layer.ts`
- view-model layer
  - `apps/sane-tui/src/dashboard.ts`
  - `apps/sane-tui/src/app-view.ts`
  - `apps/sane-tui/src/result-panel-layer.ts`
- editor-state layer
  - `apps/sane-tui/src/preferences-editor-state.ts`
- overlay layer
  - `apps/sane-tui/src/overlay-models.ts`

These layers are already implemented in TypeScript and should stay thin, typed, and renderer-friendly.
The current policy-preview source of truth is `packages/control-plane/src/policy-preview.ts`.
Optional pack registry ownership (optional pack names + config-key mapping + enabled/disabled selectors) lives in `@sane/framework-assets`; TUI editor/overlay and control-plane consumers should reuse those shared helpers instead of local pack lists.

### 1. Welcome Shell

Purpose:
- orient the user
- explain what `Sane` is in one glance
- offer the clearest next step

Should show:

- title and one-line value prop
- current project label and recommended next step
- one section-tab row
- one ordered action list for the active section
- one recommended primary action
- compact current state summary / warnings

Should not show:

- full inventory
- giant output log
- every install target at once
- every rollback action

### 2. Get Started

Purpose:
- drive first-run setup in one obvious ordered sequence

Steps:

1. local runtime
2. inspect current Codex config
3. preview core profile
4. optional backup
5. apply core profile
6. install `Sane` into Codex

Current install bundle:

- user skill
- global `AGENTS.md` block
- hooks
- custom agents: `sane-agent`, `sane-reviewer`, `sane-explorer`

Not part of the main onboarding button:

- repo skills
- repo `AGENTS.md` block
- optional provider/integration installs
- optional OpenCode-agent export

Rules:

- each step must explain impact
- each step must say what files change
- the list should read top-to-bottom without extra routing ceremony

### 3. Preferences

Purpose:
- let the user change local defaults without feeling like they are in a debug console

Content:

- model roles
- detected model availability and capability constraints behind the selected routing defaults
- built-in packs
- privacy / telemetry
- optional provider profiles

### 4. Inspect

Purpose:
- give clear read-only truth

Content:

- status summary
- doctor result
- runtime handoff state (`current-run`, `summary`, `brief`) with canonical `present` / `missing` / `invalid` layer truth
- bounded local runtime history previews for the latest `event`, `decision`, and `artifact`, plus counts for `events`, `decisions`, `artifacts`
- self-hosting shadow readiness as read-only inspection only; no self-heal runner is enabled
- latest persisted policy snapshot and typed input classification, read-only only
- current policy preview summary/scenario counts are shown with the same shared presenter used by action-level `preview policy` details (including per-scenario obligation/trace/orchestration lines), read-only only
- local config view
- Codex config view
- export drift view

### 5. Install

Purpose:
- manage Codex-native installs directly

Content:

- user skills
- repo skills
- repo `AGENTS.md`
- global `AGENTS.md` block
- hooks
- custom agents (`sane-agent`, `sane-reviewer`, `sane-explorer`)
- optional OpenCode agents (`~/.config/opencode/agents/`)
- integrations-profile actions should render backend structured audit output directly so users can see exact recommended adds before apply, and inspect/install overview copy should consume that same typed audit state instead of parsing preview summaries
- install overview copy should come from one typed install snapshot, including integrations status/count, instead of scraping action rows plus inspect state separately
- install all supported user-level items together

### 6. Repair

Purpose:
- recovery and rollback

Content:

- reinstall / repair runtime
- backup Codex config
- restore Codex config
- show latest local Codex backup path/count read-only so rollback truth is explicit before restore
- repair overview copy should come from one typed repair snapshot, including restore status and removable installs, instead of re-deriving them from action rows
- explicit local telemetry reset
- uninstall selected managed installs
- uninstall all

## Visual Rules

- one dominant pane per screen
- one secondary explanation pane
- compact footer for keys
- favor narrow layouts first; stack action/help/result vertically before forcing a cramped wide split
- avoid triple-stack box layouts by default
- no permanent "output dump" pane on every screen
- keep a compact `Last Result` area in the dashboard
- use confirm popups for risky writes
- use notice/result popups for successful writes that deserve explicit feedback

## Content Rules

- always explain impact in user language
- explain files touched before apply/export
- label optional repo mutation explicitly
- say "Codex-native" when relevant
- prefer "what this does for you" before "technical implementation"
- avoid vague "assets" wording in user-facing copy when the real thing is a skill, hook, `AGENTS.md` block, config change, or custom agent file

## Attribution Step

Not in the current TUI.

If added later:

- label: `Support Sane in this repo`
- default: off
- behavior: preview exact attribution text and exact files first
- removal: reversible from repair/settings later

Allowed shapes:

- default: short README credit line
- alternate explicit choice: README badge
- alternate explicit choice: both

Not allowed:

- hidden insertion
- default-on
- writing attribution without showing the patch preview
- remote badge image as the default attribution surface

## Landed Direction

1. section-tab navigation replaced the flat action wall
2. onboarding is now the default no-args entrypoint
3. the main onboarding flow is an ordered `Get started` list
4. wide two-pane layout is used only when there is room
5. compact result feedback and popup notices replaced the old always-open dump feel
6. risky writes require confirmation

## Remaining Polish

1. compact status chips / cards can still improve
2. attribution preview flow remains future work only
3. theme polish can continue
4. motion polish is still a later concern

## Success Criteria

- first-time user can understand `Sane` within 10 seconds
- first-time user can finish basic setup without knowing Codex internals
- advanced user can still reach preferences fast
- inspect and repair feel separate from onboarding
- the TUI no longer feels like a backend demo
