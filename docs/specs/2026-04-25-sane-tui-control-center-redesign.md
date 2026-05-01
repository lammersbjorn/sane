# Sane TUI Task-First Redesign

Date: 2026-04-25

Purpose:
- remake the TUI for users who already use Codex and want better defaults without learning Sane internals
- replace weird/internal labels with plain language
- preserve direct CLI commands for scripts and advanced users
- split destructive removal into its own obvious area

## Locked Direction

Primary user:
- already uses Codex
- wants Sane to make Codex better, safer, and easier to maintain
- should not need to know what every skill, hook, profile, or custom agent file means before getting value

Launch behavior:
- first ever `sane` when Sane is not installed opens guided setup/tune-up flow
- `sane install` always opens guided setup/tune-up wizard, even after Sane is already installed
- after successful first setup, default no-args `sane` launch opens `Status` (setup check)
- `Home` remains available as orientation/recommended next-step screen, not default post-onboarding landing

The TUI is still setup and operations only. It is not the normal prompting interface.

## Top-Level Jobs

Use these TUI labels:

- `Home`
- `Settings`
- `Add to Codex`
- `Status`
- `Repair`
- `Uninstall`

Implementation section ids should follow the same shape:

- `get_started` -> `home`
- `preferences` -> `settings`
- `install` section -> `add_to_codex`
- `inspect` section -> `status`
- `repair` stays `repair`
- add `uninstall`

Keep CLI command names practical:

- keep `sane install` as the guided install wizard
- keep `sane status`
- keep `sane repair`
- keep `sane uninstall ...`
- keep an explicit advanced backend alias for scripts: `sane install-runtime`
- keep `sane inspect` only as a compatibility alias if needed, not as primary copy
- do not add `sane add-to-codex`

## Screen Responsibilities

### Home

Purpose:
- answer "what should I do next?"
- keep orientation and recommendations calm and short

Content:
- concise setup summary
- 1 primary recommended action
- small set of quick actions
- last result
- warnings that matter now

First-run Home:
- acts as guided setup/tune-up
- previews what Sane will add or change
- makes backup behavior clear
- lets the user customize first
- ends in the normal post-onboarding flow after successful install

Normal Home:
- available after setup for orientation and recommended actions
- summarizes health, drift, and recommended fixes
- links to Settings, Add to Codex, Status, Repair, and Uninstall

### Settings

Purpose:
- change local Sane preferences in plain language

Content:
- model and reasoning defaults
- agent/task defaults described by outcome, not internal role jargon:
  - Main session
  - Explorer agent
  - Implementation agent
  - Reviewer agent
  - Realtime helper
- built-in packs
- privacy and telemetry
- optional provider profiles

Do not call this `Preferences` in TUI copy.
Do not expose only `coordinator` / `sidecar` / `verifier` rows without the agent/task rows a user can actually reason about.

### Add to Codex

Purpose:
- install or refresh Sane-managed Codex-native surfaces

Content:
- user skills
- global `AGENTS.md` block
- hooks
- custom agents
- optional repo skills
- optional repo `AGENTS.md`

Rules:
- explain each target as "what this adds to Codex"
- show exact files touched before writes
- make repo-level writes explicit
- avoid inventory-first packaging language; keep copy outcome-first

### Status

Purpose:
- read-only truth in plain language
- default post-onboarding launch screen (`sane` after setup)

Content:
- installed/missing/stale/invalid state
- Codex config warnings
- drift warnings
- runtime handoff state
- current-run / summary / brief presence
- latest policy/status snapshots where useful
- worktree readiness
- outcome rescue signals

Do not call this `Inspect` in TUI copy.

Internal function names may keep `inspect*` only where they mean read-only backend inspection and do not leak to users.

Status should start with a clear setup-check summary before deeper detail.

### Repair

Purpose:
- fix or restore broken managed state without mixing in destructive removal

Content:
- rerun checks
- repair local runtime
- back up Codex config
- restore Codex config
- reset local telemetry data
- repair or refresh broken managed surfaces when a safe repair action exists

Do not put uninstall-all style actions here.

### Uninstall

Purpose:
- remove Sane-managed things cleanly and visibly

Content:
- remove user skills
- remove repo skills
- remove repo agents
- remove global `AGENTS.md` block
- remove hooks
- remove custom agents
- remove all Sane-managed installs

Rules:
- every action gets preview/confirmation
- unrelated Codex files, plugins, skills, and settings must be preserved
- copy should say "Remove" more often than "uninstall" inside the screen
- the tab label remains `Uninstall`

## Copy Rules

Global copy pass is part of this remake, not later polish.

Use:
- "Home"
- "Settings"
- "Add to Codex"
- "Status"
- "Repair"
- "Uninstall"
- "Remove"
- "Check setup"
- "Recommended next step"
- "Files changed"
- "What this does"
- "What changes"
- "How to undo"

Avoid user-facing:
- "Inspect"
- "Preferences"
- "assets"
- "backend"
- "operation"
- "runtime" unless talking about `.sane` local files
- "doctor" except as legacy CLI naming or internal implementation

Every write action should answer:

1. what this does for you
2. what files it changes
3. how to undo it

## Stack Decision

Renderer migration is in scope for this redesign. The current implementation choice is Ink.

Keep the TypeScript app-model boundary, but use a real live renderer instead of polishing the current text loop indefinitely.

Candidate outcome:

- Ink: selected for the live TTY path. It is the safest TypeScript option, has the React mental model, and keeps packaging risk lower.
- Rezi: promising TypeScript TUI framework with declarative widgets, focus/routing primitives, native-backed rendering, and testkit packages; current packages are `@rezi-ui/*` and are still `0.1.0-alpha`, so it stays deferred until a separate proof spike is boring.
- Clack: good prompt/wizard helper, but not enough for the persistent control center.
- CellState / Storm-style renderers: interesting, but not the first choice unless Ink/Rezi both fail the spike.

Implementation rule:

1. Keep text rendering for deterministic non-TTY output and snapshots.
2. Use Ink components for the interactive TTY path, not a text-frame renderer wrapped in Ink.
3. Load Ink dynamically so packed non-TTY commands such as `sane inspect` do not require Ink's ESM graph.
4. Do not let the renderer choice change the product model, CLI behavior, or screen responsibilities.
5. Revisit Rezi only if a later spike proves native dependency packaging, CI, terminal compatibility, and tests are clean.

## Interaction Design Rules

The live TTY must behave like a real TUI:
- one active screen per job; avoid multi-panel control-center feel
- use component windows for focused work areas
- use popups/modals for confirmation, notices, and editors
- editor popups show the editable list directly, with help beside or below it depending on terminal width
- use semantic color for state, selection, warnings, and focus
- avoid duplicate metadata lines
- default to one task-focused pane, not a full diagnostic dump
- keep logs, long paths, history, file lists, and raw command output behind selected actions or modal/detail states
- do not show `... N more line(s)` in the primary live focus pane
- make compact terminals switch layout instead of squeezing every panel onto screen
- keep the non-TTY renderer plain and deterministic for piping, tests, and snapshots
- keep contextual footer/help short and action-aware, not global command inventory
- reveal deeper commands only when user enters related flow

Current screen shape:
- brief header: what this job is for and current state
- main body: one clear next action plus secondary actions by outcome
- footer/help: contextual keys, safety hint, and where to go next
- compact terminals keep one reading path instead of side-by-side density

## Future Scope

Later import/export support:
- export Sane settings to a portable file
- import Sane settings from a portable file
- install from an exported settings file, likely through `sane install --from <file>` or `sane settings import <file>`
- keep this out of the current remake unless needed by the implementation

## Implementation TODO

1. Add tests for the new TUI section names and launch routing before renaming code.
2. Choose Ink for live TTY path and keep Rezi deferred behind later spike.
3. Keep the current app-view/text-renderer boundary for deterministic output.
4. Rename TUI-specific section ids, files, screen models, tests, and docs.
5. Add `Uninstall` as a separate section and move uninstall actions out of `Repair`.
6. Keep backend `inspect*` APIs where they are internal read-only inspection, but remove leaked `Inspect` copy from TUI/docs.
7. Update CLI routing so `sane install` opens guided wizard, `sane status` is primary, and `sane inspect` remains compatibility-only if retained.
8. Implement first-run vs post-install launch behavior with post-onboarding no-args default to `Status`.
9. Rewrite visible TUI copy using the copy rules above.
10. Refresh README, `apps/sane-tui/README.md`, and the older TUI redesign spec so they do not contradict this spec.
11. Verify with `rtk pnpm test` and `rtk run 'pnpm typecheck'` until RTK native typecheck routing is repaired.
12. Run a text preview and a terminal/browser visual check of the rendered TUI before calling the redesign done.
13. Replace the live Ink string renderer with actual Ink `Box`/`Text` windows and modal components.

## Current Implementation Notes

Implemented in the current B16 slice:

- `sane install` is the guided Home wizard launch shortcut; `sane install-runtime` remains the direct backend runtime install alias for scripts.
- First-run no-args launch opens guided setup; post-onboarding no-args launch opens `Status`.
- TUI section labels now use `Home`, `Settings`, `Add to Codex`, `Status`, `Repair`, and `Uninstall`.
- Destructive removal actions live in `Uninstall`, not `Repair`.
- Home, Settings, Add to Codex, Status, Repair, and Uninstall now render from an explicit experience model: eyebrow, title, body, primary action, safety hint, panels, grouped moves, and selected-action detail.
- Main text and Ink renderers prioritize one active screen with contextual detail instead of inventory-heavy multi-pane layout.
- User-facing action labels now lead with outcomes such as "Get this repo ready", "Choose how Codex should work", "Teach Codex the Sane workflow", and "Read setup health".
- Home recommendation selection uses the same mapping as the Home screen model, so completed setup lands on a health check instead of an unrelated refresh action.
- Live TTY rendering uses Ink component windows and modal overlays instead of wrapping the old text snapshot renderer.
- Read-only backend output, long file paths, logs, and raw detail payloads open as notices/modals instead of filling the main focus pane.
- Settings now exposes editable defaults for Main session, Explorer agent, Implementation agent, Reviewer agent, and Realtime helper.
- Local config persists those task-shaped agent defaults; legacy coordinator/sidecar/verifier compatibility exists only where existing internals still need it.
- Fallback config defaults derive from Sane's preferred model ranking instead of a second hardcoded defaults table.
- Non-TTY text output remains deterministic for tests, piping, and snapshot-style inspection.

Verification already run after the implementation slice:

```bash
rtk pnpm --filter @sane/sane-tui test
rtk run 'pnpm --filter @sane/sane-tui typecheck'
```

Text previews were run for Home, Settings, Status, and compact Home. Earlier live TTY smoke checks were also run for `sane install` and `sane settings`, including opening the Settings editor modal.

## Remaining Work

- Human visual acceptance in a real terminal is still needed for the exact feel.
- Continue compact-editor polish if a later screenshot shows cramped help text.
- Keep settings import/export as later portability scope unless explicitly pulled into the current gate.

## Success Criteria

- a Codex user can open `sane` and understand the next step without knowing Sane internals
- first-run install feels guided
- post-onboarding launch defaults to setup check (`Status`) with calm next-step guidance
- destructive removal is easy to find but hard to do accidentally
- `Inspect` and other weird internal wording disappear from user-facing TUI copy
- CLI users can still run `sane install`, `sane status`, `sane repair`, and `sane uninstall ...`; scripts can use `sane install-runtime` for the direct backend runtime install
