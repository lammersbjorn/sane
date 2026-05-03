---
name: sane-router
description: Use as Sane routing switchboard for concrete skills, lane classes, and managed Sane operations when a task is not a tiny direct answer.
---

# Sane Router

## Goal

Choose the next Sane surface with minimal context: concrete skill, lane class, or managed command.

## Use When

- selecting a concrete Sane skill by trigger
- choosing explorer, implementation, verifier, or realtime lane class
- selecting concrete skills by trigger
- running Sane-managed install/export/config/routing-default operations

## Don't Use When

- handling a tiny direct answer that needs no Sane surface
- bypassing a concrete skill that already clearly matches the task

## Inputs

- current task
- exported model/reasoning defaults
- active pack state and concrete skill routes
- current Sane config when managed operations are in scope

## Outputs

- one routing decision:
  - main session only (tiny/indivisible)
  - load `sane-agent-lanes` for broad work
  - explorer, implementation, verifier, or realtime subagent lane
  - concrete skill to load
  - Sane command lane action when managed operations are needed

## How To Run

Make one routing decision. Do not restate workflows owned by concrete skills.

Broad work route:
- Broad work means multi-file cleanup, refactor, feature work, product pass, research pass, repair loop, or ambiguous repo work.
- Load `sane-agent-lanes`; it owns lane planning, subagent handoff, edit boundaries, and auth gates.
- Do not pre-ask for subagents when a handoff can be attempted. `sane-agent-lanes` should attempt the first lane handoff, then ask only if the tool, runtime, or higher-priority policy blocks launch.
- If subagent launch is blocked, unavailable, or requires explicit authorization, do not route broad work to "main session only"; `sane-agent-lanes` must report the blocker, ask once, and stop.
- Follow-up implementation after research/planning is broad work again; prior research lanes do not satisfy the implementation handoff.
- For review convergence, require findings triage as `confirmed`, `needs-verify`, or `rejected`, then route to smallest implementation lane that closes `confirmed` items plus required verification.
- Coordinator owns final judgment and verification.

Route subagent classes with current exported defaults:
- coordinator/main session: gpt-5.5 (low)
- explorer lane: gpt-5.4-mini (low)
- implementation lane: gpt-5.5 (low)
- verifier lane: gpt-5.5 (high)
- realtime lane: gpt-5.3-codex-spark (low)

Frontend/UI route override:
- Any subagent doing UI generation, redesign, visual polish, screenshot-to-code, Figma-to-code, game/canvas UI, or final visual QA should use `gpt-5.5` with `high` reasoning when available.
- Use `gpt-5.5` with `xhigh` for first-pass visual systems, high-polish redesigns, ambiguous product taste work, complex responsive layouts, canvas/WebGL/game surfaces, and final visual approval loops.
- Load the matching frontend skill for UI work; `sane-frontend-review` owns visual evidence requirements.

Load skills by trigger only:
- `continue`: continue/resume/keep going requests on an active workstream
- `sane-outcome-continuation`: plain-language outcome loops that need plan/implement/verify/repair/resume
- `sane-agent-lanes`: broad lane decomposition with owned parallel lanes
- `sane-bootstrap-research`: new stack/tool/project choices that need current research
- `sane-router`: route model class, lane class, skill choice, and Sane-managed command lanes

Pack-specific trigger routes:
- caveman task picks: communication-style, caveman-prose, brevity -> sane-caveman
- rtk task picks: shell, search, test, logs -> sane-rtk
- frontend-craft task picks: frontend-build, redesign, ui-implementation, visual-polish -> sane-frontend-craft
- frontend-craft task picks: image-generation, visual-assets, hero-media, art-direction -> sane-frontend-visual-assets
- frontend-craft task picks: frontend-review, responsive-qa, visual-audit, polish -> sane-frontend-review
- docs-craft task picks: documentation-writing, readme, user-docs, product-docs, changelog, docs-editing, docs-review, release-notes -> sane-docs-writing

Command lane for Sane-managed operations:
- run Sane CLI first: `sane status`, `sane preview ...`, `sane export ...`, `sane uninstall ...`
- if `sane` is unavailable in PATH, use `node apps/sane-tui/bin/sane.mjs ...`
- avoid direct manual edits to managed exports unless you are fixing Sane internals

- Caveman pack active: use `sane-caveman` prose rules; read the skill body before normal narrative when available
- RTK pack active: load `sane-rtk` for shell/search/test/log routing
- Frontend-craft pack active: load the matching frontend skill for UI, asset, or visual-review work
- Docs-craft pack active: load `sane-docs-writing` for README, user-docs, changelog, release-note, migration-note, support-doc, product-doc, or docs review/edit work

## Verification

- confirm the selected route
- for broad work, confirm `sane-agent-lanes` was loaded and followed
- for managed operations, preview before apply when possible and confirm touched managed paths

## Gotchas / Safety

- do not pre-load `continue` or `sane-outcome-continuation` on every task
- do not route by vague pack umbrella when a concrete skill exists
- do not add repo overviews or discoverable facts to startup context
- keep managed exports additive and reversible
