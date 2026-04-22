# Sane Marketing Site Plan

**Goal:** Ship a clean public website for `Sane` that matches the product philosophy: plain-language first, no wrapper ritual, Codex-native, reversible, local-first, and trust-oriented.

**Primary constraint:** Site work must not interfere with active core product work in `apps/sane-tui`, `packages/*`, docs that define locked product truth, or ongoing TypeScript migration slices.

## Locked Inputs

These are now fixed for the first site pass:

- audience: everyone, consistent with the decision log
- primary CTAs: install command and GitHub
- site structure: small 3-page product site
- screenshots: do not use screenshots
- comparison stance: explicit but restrained contrast with wrapper-first / ritual-heavy tools
- BuildStory mention: include it on-site, but keep it secondary to the product story

## Product Positioning

`Sane` should not market itself like another AI IDE, chat app, or autonomous coding runtime.

The site should own this wedge:

- Codex-native setup and recovery control plane
- makes Codex easier to trust, tune, inspect, and recover
- plain-language first
- no daily wrapper ritual
- manages Codex-native installs and narrow reversible diffs
- local-first and reversible

Corrected competitor frame as of April 22, 2026:

Closest direct competitors:

- `openagentsbtw`
  - cross-platform agent scaffolding with generated platform artifacts and strict routing
  - very close on install/export pack surface
- `Superpowers`
  - workflow operating system for coding agents
  - closer on methodology and operating ritual than on repair/reversibility
- `gstack`
  - opinionated daily operating system for agent work with strong role/process defaults
  - closer on session behavior and process stack than on Codex-native repair
- `cc-thingz`
  - portable marketplace of skills, hooks, agents, and commands across agent tools
  - strongest direct overlap on skill-pack distribution
- `Arc`
  - full workflow bundle with Claude/Codex install modes
  - closer on idea-to-shipped-code runtime flow than on control-plane repair
- `Everything Claude Code`
  - broad harness optimization stack with skills, memory, hooks, rules, and MCP
  - heavy overlap in scope, but runtime/harness-first

Important adjacent analogs:

- `Trellis`
  - multi-platform agent harness around specs, tasks, and workspace memory
- `Agent OS`
  - standards/spec-driven agent layer
- `Claude Code` and `OpenCode`
  - important platform context and configurable runtime comparison
  - not the primary peer set for the site narrative

Contrast only:

- `Cursor`
- `Windsurf`
- `Aider`
- `Qodo`
- `OpenHands`

Implication:

- `Sane` should market setup, control, reversibility, and repair
- `Sane` should show restraint and specificity
- the copy should make clear that `Sane` improves Codex without becoming another runtime you have to live in
- closest narrative contrast should be against framework packs, harnesses, and workflow operating systems first
- IDEs and primary coding runtimes are secondary contrast only, not the main comparison set

## Site Job

The first version of the site should do four things well:

1. Explain what `Sane` is in under 10 seconds.
2. Differentiate `Sane` from runtime-first agent frameworks, skill marketplaces, and wrapper-heavy workflows.
3. Give users one clear next step.
4. Build trust through specificity about what `Sane` changes and what it does not change.

## Non-Goals

- do not turn the site into a giant docs portal in phase 1
- do not promise future orchestration or outcome-runner work as if shipped
- do not mirror the entire README
- do not introduce marketing language that conflicts with locked product docs
- do not block or reshape current TUI/control-plane implementation work

## Non-Interference Rules

Site work must stay in its own lane.

Allowed write scope for the first implementation pass:

- `apps/site/**`
- `docs/plans/2026-04-22-sane-site-plan.md`
- optional additive site-specific assets under a new isolated path such as `docs/site/` or `public/` inside `apps/site/`

Avoid in the first pass:

- `apps/sane-tui/**`
- `packages/**`
- `packs/**`
- `docs/specs/**`
- `docs/decisions/**`
- `README.md`
- root build scripts unless there is a hard blocker

Operational guardrails:

- use a separate app package: `apps/site`
- keep site dependencies inside `apps/site/package.json`
- do not create shared UI packages during phase 1
- do not reuse unstable core-product code as a dependency
- verify site work with `pnpm --filter @sane/site ...` so checks stay local
- if root `pnpm check` is run later, the site package must satisfy existing `typecheck` and `test` task names without changing current app/package behavior

## Proposed Repo Shape

Phase 1 target:

- `apps/site/package.json`
- `apps/site/tsconfig.json`
- `apps/site/vite.config.ts`
- `apps/site/index.html`
- `apps/site/src/main.tsx`
- `apps/site/src/app.tsx`
- `apps/site/src/styles.css`
- `apps/site/src/components/*`
- `apps/site/src/content/*`
- `apps/site/public/*`
- `apps/site/vitest.config.ts`

Recommendation:

- use a small Vite app with React + TypeScript
- static-first
- no backend
- no coupling to `@sane/*` packages
- keep content mostly code-native for fast iteration

Why this shape:

- already fits the `pnpm` workspace
- additive under `apps/*`
- isolated dependency graph
- easy local preview
- low collision risk with current product work

Stack call:

- use standard `Vite + React`, not `Vite+`, for the first pass
- reason: smallest blast radius inside the current `pnpm`/`turbo` TypeScript workspace
- keep `Vite+` as a later workspace-tooling evaluation, not a prerequisite for the marketing site

## Messaging Architecture

Homepage message hierarchy:

1. `Sane` is a Codex-native setup and recovery control plane.
2. It makes Codex easier to trust, tune, inspect, and recover.
3. It works through Codex-native installs and narrow reversible changes.
4. It does not force a wrapper workflow, replace Codex, or take over the repo.

Candidate headline directions:

- Make Codex easier to trust.
- The control plane for Codex.
- Tune Codex without turning it into a ritual.
- Better Codex defaults. Clearer installs. Safer recovery.

Candidate supporting line:

- `Sane` is a plain-language-first control plane for Codex. Preview narrow changes, install Codex-native helpers, repair drift, and keep using Codex normally.

Core proof points:

- preview before apply
- backup and restore paths
- reversible Codex-native installs
- local operational record
- optional packs and integrations
- no required `AGENTS.md`
- no daily wrapper

Primary CTA pair:

- install from source now
- view on GitHub

## Information Architecture

Phase 1 should stay small.

Recommended pages:

### `/`

Purpose:
- explain product fast
- establish differentiation
- drive the main CTA

Sections:
- hero
- philosophy wedge
- "what changes in practice"
- trust/reversibility strip
- product surfaces
- explicit "not another runtime / not another repo takeover" contrast block
- competitor frame block:
  - agent runtimes and workflow harnesses are adjacent
  - `Sane` owns setup, inspect, repair, backup, and reversible Codex-native installs
- install command + GitHub CTA block
- small BuildStory note
- today vs later
- CTA footer

### `/philosophy`

Purpose:
- expand the product worldview without bloating the homepage

Sections:
- plain-language first
- no wrapper-first workflow
- token discipline
- Codex-native surfaces
- local-first and reversible

### `/how-it-works`

Purpose:
- show the TUI / local runtime / Codex-native surface split

Sections:
- setup layer
- local `.sane/` runtime
- Codex-native installs
- what `Sane` writes
- what `Sane` intentionally does not do

Optional later:

- `/docs` as a handoff to repo docs
- `/roadmap` only if the messaging stays disciplined about shipped vs future

## Visual Direction

The site should feel intentional, calm, and exact.

Design rules:

- avoid generic AI gradients and purple default aesthetics
- use a sharper editorial/product hybrid look
- high-contrast typography
- restrained motion
- diagrams and file-path specificity over hype illustration
- terminal or config motifs are fine, but avoid cosplay terminal UI everywhere

Suggested visual language:

- warm neutral base with one strong accent
- confidence through whitespace and layout discipline
- structural motifs from config diffs, path trees, state layers, or reversible actions
- subtle motion for staged reveal, not “AI magic” effects

Specific direction:

- match `Sane`: disciplined, calm, exact, not flashy
- no screenshots, fake dashboard mockups, or decorative terminal cosplay
- use diagrams, type, spacing, and concrete file/config motifs instead

## Content Strategy

The site copy should answer these objections directly:

- "Is this another AI IDE?" No.
- "Do I have to use a wrapper command every day?" No.
- "Does this rewrite my repo?" No by default.
- "What does it actually change?" Specific Codex-native surfaces.
- "Can I inspect or undo it?" Yes.

Copy rules:

- be concrete about files and surfaces
- prefer user outcome before internal architecture
- avoid grand autonomy claims
- do not oversell future capabilities
- keep terminology aligned with current docs: setup, inspect, repair, export, Codex-native, reversible, local-first

## Delivery Phases

### Phase 0: Brief and guardrails

Deliverables:

- this plan
- locked messaging constraints
- page list
- visual direction

Exit criteria:

- scope is isolated
- no overlap with current core-product slices

### Phase 1: Site scaffold in isolated app

Deliverables:

- `apps/site` scaffold
- local dev command
- local `typecheck` and `test`
- baseline layout and styles

Exit criteria:

- app runs without touching `apps/sane-tui` or `packages/*`
- `pnpm --filter @sane/site typecheck`
- `pnpm --filter @sane/site test`

### Phase 2: Homepage

Deliverables:

- final homepage sections
- responsive layout
- foundational motion

Exit criteria:

- clear positioning in hero
- page readable on mobile and desktop
- messaging aligned with locked docs

### Phase 3: Secondary pages

Deliverables:

- `/philosophy`
- `/how-it-works`
- nav/footer

Exit criteria:

- site feels like a small product site, not one landing page with overflow

### Phase 4: Polish and deploy prep

Deliverables:

- meta tags
- OG image
- favicon set
- accessibility pass
- performance pass
- deploy target decision

Exit criteria:

- no blocking accessibility issues
- good first-load performance
- clean static deployment story

## Technical Plan

Recommended stack:

- React
- TypeScript
- Vite
- plain CSS or minimal CSS tooling
- Vitest for minimal smoke coverage

Avoid in phase 1:

- design system extraction
- CMS
- MDX pipeline
- server rendering unless a real requirement appears
- coupling site visuals to TUI implementation details

Recommended local commands:

```bash
pnpm --filter @sane/site dev
pnpm --filter @sane/site typecheck
pnpm --filter @sane/site test
```

## Coordination Plan

To avoid collisions with core-product agents:

1. Keep site work in `apps/site` only.
2. Treat product docs as read-mostly source of truth.
3. Do not edit active TUI/state/control-plane files while site work is underway.
4. Do not introduce shared packages during the initial build.
5. Keep root script churn at zero if possible.
6. If site needs screenshots, capture from existing product state rather than reshaping the product for marketing.
7. Merge site work as a separate branch/PR from core product work.
8. Prefer diagrams, code/config motifs, and copy structure over product screenshots.

## Risks

### Risk: Site drifts into fake-product marketing

Mitigation:

- tie every key claim to shipped behavior in current docs
- keep a strict "today vs later" section

### Risk: Site work collides with active repo migration

Mitigation:

- isolated app
- no edits in `apps/sane-tui` or `packages/*`

### Risk: Site becomes a prettier README clone

Mitigation:

- use a tighter narrative
- use secondary pages for philosophy and architecture

### Risk: Copy becomes too negative/comparative

Mitigation:

- differentiate by product stance, not attack copy

## Recommendation

Build the site as an isolated `apps/site` Vite app, start with a 3-page public surface (`/`, `/philosophy`, `/how-it-works`), and position `Sane` as the trust-and-control layer around Codex rather than another agent shell.
