# Sane TUI Tooling And UX Audit

Last updated: 2026-04-20

Purpose:
- avoid blindly swapping TUI libraries
- study what makes strong terminal tools feel polished
- define what `Sane` should copy and what it should reject

## Sources

- [Ratatui](https://ratatui.rs/)
- [Tachyonfx](https://ratatui.rs/ecosystem/tachyonfx/)
- [ratatui-image](https://docs.rs/ratatui-image/latest/ratatui_image/)
- [Yazi](https://github.com/sxyazi/yazi)
- [gitui](https://github.com/gitui-org/gitui)
- [lazygit](https://github.com/jesseduffield/lazygit)
- [k9s](https://github.com/derailed/k9s)
- [Bubble Tea](https://github.com/charmbracelet/bubbletea)
- [Lip Gloss](https://github.com/charmbracelet/lipgloss)
- [Textual](https://textual.textualize.io/)
- [egui](https://github.com/emilk/egui)
- [iced](https://iced.rs/)

## Main Finding

Good terminal apps do not feel polished because they use a magical library.

They feel polished because they:

- show less at once
- choose one primary task per screen
- keep navigation mentally obvious
- use typography, spacing, color, and focus states consistently
- avoid dumping every diagnostic panel on the first view
- add motion only after the information architecture is already clean

`Sane` was failing more on information architecture than on rendering technology.

The current `sane-tui` work already validates that call:

- `ratatui` stayed
- onboarding moved to section tabs
- the default screen now shows one ordered action list instead of a box wall
- successful writes use notice popups and a compact last-result area
- narrow layouts stack content before reaching for a cramped split view

## What Strong Tools Actually Do

### Yazi

Strong patterns:

- one main mental model: navigate, preview, act
- wide, readable primary pane
- secondary detail, not six equally loud boxes
- performance and polish on top of a sharp structure
- plugin/extensibility does not leak into first-run clutter

Relevance to `Sane`:

- `Sane` should have one obvious primary action on each screen
- detailed status belongs behind inspect/expand views, not always on the home screen

### lazygit / gitui

Strong patterns:

- narrow scope
- action density only after orientation is already clear
- shell still complements the app
- views are role-based, not "all controls everywhere"

Relevance to `Sane`:

- the app should feel like a guided control surface, not a wall of backend verbs
- `Sane` should separate onboarding, configure, inspect, and repair clearly

### k9s

Strong patterns:

- strong theming / skins
- shortcuts available, but not required to grasp the layout
- the default screen is still focused

Relevance to `Sane`:

- theming/skins should come after layout clarity
- `Sane` can support optional skins later, but should not use style to hide structural problems

### Bubble Tea / Lip Gloss apps

Strong patterns:

- strong visual hierarchy
- tasteful spacing, borders, and focus treatment
- often more expressive than average terminal apps

Important caveat:

- the Charm stack is in Go, not Rust
- this does not automatically justify a Rust stack migration

Relevance to `Sane`:

- copy the visual discipline, not the language stack blindly

## Library Assessment

### Ratatui

Pros:

- strongest mainstream Rust TUI base
- cross-platform
- rich ecosystem
- already in this repo
- enough to build a polished installer if the UX is good

Cons:

- lower-level than some "batteries included" stacks
- easier to build ugly box soup if structure is weak

Call:

- keep `ratatui` for now

### Ratatui + Tachyonfx

Pros:

- lets `Sane` add subtle motion and transitions later

Cons:

- polish only matters after layout is fixed

Call:

- later, not now

### Ratatui + ratatui-image

Pros:

- terminal image/logo support where protocols exist

Cons:

- terminal compatibility varies
- easy to become gimmicky

Call:

- optional future flourish only

### Textual

Pros:

- beautiful, batteries-included terminal app framework
- very strong for polished layouts

Cons:

- Python
- would fight the locked Rust decision

Call:

- reference for UX, not implementation

### Bubble Tea / Lip Gloss

Pros:

- very good design patterns for terminal apps
- expressive visual system

Cons:

- Go stack
- switching language/runtime would be unjustified right now

Call:

- copy interaction/design ideas, do not migrate stack

### egui / iced

Pros:

- if `Sane` wants true graphics, richer widgets, and GUI-level polish, these are the real options

Cons:

- no longer a terminal UI
- much larger product shift

Call:

- only consider if `Sane` deliberately pivots from TUI to GUI

## Recommendation

Do not switch away from `ratatui`.

Current code already proves the right order of operations:

1. fix information architecture first
2. prioritize narrow readable layouts
3. use popups/modals for confirmations and success feedback
4. keep result feedback compact and close to the current task
5. continue theme/motion polish only after the structure holds

Only reconsider library choice if this `ratatui` path clearly stops meeting product needs.

## Current Implementation Check

- Section tabs are now the primary navigation model: `Get started`, `Preferences`, `Install`, `Inspect`, `Repair`.
- Onboarding is an ordered `Get started` flow, not a separate command launcher.
- Widths under roughly `120` columns prioritize stacked layouts over a forced wide split.
- Risky writes use confirm popups; successful writes commonly use notice popups.
- The dashboard keeps `Last Result` visible without dedicating the whole screen to output.
- User-facing install language should name concrete things like skills, hooks, `AGENTS.md` blocks, and custom agents instead of calling them "assets".

## Concrete Design Rules For Sane

- home screen should answer:
  - what is `Sane`
  - what should I do first
  - what state am I in
- do not show full diagnostics on first load
- no more than one primary list on screen
- right side should explain the currently focused action or section
- status should be compact chips / summary, not a debug dump
- inspect should hold detailed inventory
- repair should hold dangerous / rollback actions
- preferences should hold local choices
- install should hold Codex-native write actions
- onboarding should feel like a sequence, not a control panel

## Attribution Option

If `Sane` adds a growth/attribution option in onboarding:

- it must be explicit opt-in
- it must never be preselected
- it must preview exact text and file targets
- it must be removable later
- it should feel like "support the project" rather than hidden self-promo

## Rejected For Now

- blind library switch because current TUI feels bad
- adding graphics before fixing IA
- stuffing more status panels into the current home screen
- treating style/theme as a substitute for product clarity
