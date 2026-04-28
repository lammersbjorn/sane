# Sane TUI Tooling And UX Audit

Last updated: 2026-04-23

> [!WARNING]
> Historical UX research snapshot (dated 2026-04-23). This note is archival/date-state evidence, not current naming or active product spec.

Purpose:
- avoid blindly swapping terminal UI stacks
- study what makes strong terminal tools feel polished
- define what `Sane` should copy and what it should reject now that the shipped path is TypeScript-only

## Sources

- [Yazi](https://github.com/sxyazi/yazi)
- [lazygit](https://github.com/jesseduffield/lazygit)
- [gitui](https://github.com/gitui-org/gitui)
- [k9s](https://github.com/derailed/k9s)
- [Bubble Tea](https://github.com/charmbracelet/bubbletea)
- [Lip Gloss](https://github.com/charmbracelet/lipgloss)
- [Textual](https://textual.textualize.io/)
- [Ink](https://github.com/vadimdemedes/ink)

## Main Finding

Good terminal apps do not feel polished because they use a magical renderer.

They feel polished because they:

- show less at once
- choose one primary task per screen
- keep navigation mentally obvious
- use typography, spacing, color, and focus states consistently
- avoid dumping every diagnostic panel on the first view
- add motion only after the information architecture is already clean

`Sane` was failing more on information architecture than on renderer choice.

That finding still holds after the TypeScript cutover:

- onboarding is section-first
- the default view is guided, not a backend verb wall
- risky writes use confirmations
- result feedback stays compact and close to the current task
- narrow layouts stack instead of forcing cramped splits

## What Strong Tools Actually Do

### Yazi

Strong patterns:

- one main mental model: navigate, preview, act
- wide, readable primary pane
- secondary detail, not six equally loud boxes
- performance and polish on top of a sharp structure

Relevance to `Sane`:

- `Sane` should have one obvious primary action on each screen
- detailed status belongs behind inspect/expand views, not on first load

### lazygit / gitui

Strong patterns:

- narrow scope
- action density only after orientation is already clear
- shell still complements the app
- views are role-based, not "all controls everywhere"

Relevance to `Sane`:

- the app should feel like a guided control surface, not a wall of backend verbs
- `Sane` should keep onboarding, configure, inspect, and repair clearly separated

### k9s

Strong patterns:

- strong theming and focus states
- shortcuts available, but not required to grasp the layout
- the default screen is still focused

Relevance to `Sane`:

- theming should follow layout clarity, not substitute for it
- shortcuts can exist, but first-run comprehension wins

### Bubble Tea / Lip Gloss, Textual, Ink

Strong patterns:

- strong visual hierarchy
- deliberate spacing and focus treatment
- expressive but still task-oriented terminal UX

Relevance to `Sane`:

- copy the visual discipline and interaction patterns
- do not switch stacks just because another ecosystem has nicer examples

## Renderer Assessment

Current call:

- stay on the current TypeScript terminal path
- keep improving structure, terminal behavior, and packaging before entertaining another renderer swap

Why:

- the current gaps are polish, parity, and packaging hardening
- none of those require reopening the implementation stack
- another renderer migration would mostly burn time while preserving the same UX problems if IA slips again

Only reconsider the renderer if:

- the current terminal path cannot deliver the required layout/focus behavior
- packaged distribution becomes materially worse because of the current stack
- a concrete blocker appears that is renderer-specific rather than product-architecture-specific

## Recommendation

Do not chase a renderer rewrite right now.

Current order of operations stays:

1. keep the information architecture sharp
2. keep narrow layouts readable
3. use confirmations/notices for risky or successful writes
4. keep result feedback compact
5. improve parity and packaging before visual flourish

## Current Implementation Check

- section tabs remain the primary navigation model: `Get started`, `Preferences`, `Install`, `Inspect`, `Repair`
- onboarding is an ordered `Get started` flow, not a command launcher
- user-facing install language names concrete things like skills, hooks, `AGENTS.md` blocks, and custom agents
- inspect holds detailed inventory
- repair holds dangerous / rollback actions
- preferences holds local choices
- install holds Codex-native write actions

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

- blind renderer switch because the TUI feels rough
- adding motion before fixing IA
- stuffing more status panels into the home screen
- treating style/theme as a substitute for product clarity
