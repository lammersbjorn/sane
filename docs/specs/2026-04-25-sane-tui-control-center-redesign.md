# Sane TUI Control Center Redesign

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
- first ever `sane` when Sane is not installed opens a guided install/tune-up flow
- `sane install` always opens the guided install/tune-up wizard, even after Sane is already installed
- after successful first install, the TUI transitions to the control center
- later no-args `sane` always opens the control center

The TUI is still setup and operations only. It is not the normal prompting interface.

## Navigation

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
- answer "what is my Codex setup state and what should I do next?"
- show the recommended next step without turning into a command wall

Content:
- current install state
- 1 primary recommended action
- small set of quick actions
- last result
- warnings that matter now

First-run Home:
- acts as guided install/tune-up
- previews what Sane will add or change
- makes backup behavior clear
- lets the user customize first
- ends in the normal control center after successful install

Normal Home:
- opens after Sane is installed
- summarizes health, drift, and recommended fixes
- links out to Settings, Add to Codex, Status, Repair, and Uninstall

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
- optional plugin artifact

Rules:
- explain each target as "what this adds to Codex"
- show exact files touched before writes
- make repo-level writes explicit
- do not make this screen feel like package-manager internals

### Status

Purpose:
- read-only truth in plain language

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
- remove plugin artifact
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

## Visual Design Rules

The live TTY must behave like a real TUI:
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

## Future Scope

Later import/export support:
- export Sane settings to a portable file
- import Sane settings from a portable file
- install from an exported settings file, likely through `sane install --from <file>` or `sane settings import <file>`
- keep this out of the current remake unless needed by the implementation

## Implementation TODO

1. Add tests for the new TUI section names and launch routing before renaming code.
2. Choose Ink for the live TTY path and keep Rezi deferred behind a later spike.
3. Keep the current app-view/text-renderer boundary for deterministic output.
4. Rename TUI-specific section ids, files, screen models, tests, and docs.
5. Add `Uninstall` as a separate section and move uninstall actions out of `Repair`.
6. Keep backend `inspect*` APIs where they are internal read-only inspection, but remove leaked `Inspect` copy from TUI/docs.
7. Update CLI routing so `sane install` opens the guided wizard, `sane status` is primary, and `sane inspect` remains compatibility-only if retained.
8. Implement first-run vs post-install launch behavior.
9. Rewrite visible TUI copy using the copy rules above.
10. Refresh README, `apps/sane-tui/README.md`, and the older TUI redesign spec so they do not contradict this spec.
11. Verify with `rtk run 'pnpm test && pnpm typecheck'`.
12. Run a text preview and a terminal/browser visual check of the rendered TUI before calling the redesign done.
13. Replace the live Ink string renderer with actual Ink `Box`/`Text` windows and modal components.

## Current Implementation Notes

Implemented in the current B16 slice:

- `sane install` is the guided Home wizard launch shortcut; `sane install-runtime` remains the direct backend runtime install alias for scripts.
- No-args launch opens Home only while Sane local runtime files are missing; installed repos open the control center on Status.
- TUI section labels now use `Home`, `Settings`, `Add to Codex`, `Status`, `Repair`, and `Uninstall`.
- Destructive removal actions live in `Uninstall`, not `Repair`.
- Live TTY rendering uses Ink component windows and modal overlays instead of wrapping the old text snapshot renderer.
- Read-only backend output, long file paths, logs, and raw detail payloads open as notices/modals instead of filling the main focus pane.
- Settings now exposes editable defaults for Main session, Explorer agent, Implementation agent, Reviewer agent, and Realtime helper.
- Local config persists those task-shaped agent defaults; legacy coordinator/sidecar/verifier compatibility exists only where existing internals still need it.
- Fallback config defaults derive from Sane's preferred model ranking instead of a second hardcoded defaults table.
- Non-TTY text output remains deterministic for tests, piping, and snapshot-style inspection.

Verification already run after the implementation slice:

```bash
rtk run 'pnpm test'
rtk run 'pnpm typecheck'
```

Live TTY smoke checks were also run for `sane install` and `sane settings`, including opening the Settings editor modal.

## Remaining Work

Do not call this redesign visually accepted until the B17 TODO lane is complete:

- run live terminal screenshots/smoke checks for `sane install`, `sane`, `sane settings`, `sane status`, the editor modal, read-only notice modal, and confirmation modal at compact, normal, and wide terminal sizes
- fix `sane install` on an already-installed repo so Home does not look like a dead first-run checklist
- shorten the editor header/help copy so compact terminals never show unreadable truncation such as `r r...`
- ensure Home always shows meaningful current setup lines in compact live mode
- keep the full Settings editor field list visible when width allows it, with compact mode showing fields first and help below
- do a fresh copy pass for any remaining internal terms in live TTY copy
- keep settings import/export as later portability scope unless the user explicitly pulls it into the current gate

## Success Criteria

- a Codex user can open `sane` and understand the next step without knowing Sane internals
- first-run install feels guided
- normal launch feels like a control center
- destructive removal is easy to find but hard to do accidentally
- `Inspect` and other weird internal wording disappear from user-facing TUI copy
- CLI users can still run `sane install`, `sane status`, `sane repair`, and `sane uninstall ...`; scripts can use `sane install-runtime` for the direct backend runtime install
