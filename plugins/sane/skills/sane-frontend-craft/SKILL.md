---
name: sane-frontend-craft
description: Use when building, redesigning, or polishing frontend UI in a web app, dashboard, game, landing page, product page, or visual tool, especially when the result must avoid generic AI-looking design.
---

# Sane Frontend Craft

## Goal

Build frontend work that feels specific to the product, not like a generic AI UI.

## Use When

- creating a new UI, page, app, game, dashboard, tool, or landing page
- redesigning or polishing an existing frontend
- implementing UI from visual references, screenshots, product context, or brand constraints
- the user complains the UI is generic, sloppy, lifeless, samey, or not premium enough

## Don't Use When

- the task is backend-only or CLI-only
- the user asks only for copy, data modeling, infrastructure, or tests with no UI impact
- a narrower frontend review or visual asset skill is the better first step

## Inputs

- repo UI conventions and existing design system
- user-provided references, screenshots, brand assets, and product constraints
- target user, workflow, and domain
- available browser/screenshot tooling
- available image generation or image editing capability

## Outputs

- focused UI implementation or redesign
- concrete visual asset plan when the interface needs imagery
- browser/screenshot verification notes
- concise summary of changed files and checks

## Model Route

- UI implementation subagents should run on `gpt-5.5` with `high` reasoning when available.
- Use `gpt-5.5` with `xhigh` for first-pass visual systems, high-polish redesigns, Figma/screenshot-to-code, complex responsive surfaces, canvas/WebGL/game UI, or when prior UI attempts looked generic.
- Do not use cheaper implementation, explorer, or realtime defaults for visual UI work unless the task is a tiny non-visual code edit.

## How To Run

1. Start from repo truth.
   - Find the actual app stack, component patterns, CSS system, routing, icons, and asset conventions.
   - Reuse existing UI primitives before adding new abstractions.

2. Define the design target in product terms.
   - Name the audience, task, density, tone, and visual references.
   - Avoid vague style words unless tied to concrete layout, typography, color, asset, or motion choices.

3. Run the visual loop before coding large surfaces.
   - Convert screenshots, Figma notes, brand constraints, or product context into concrete layout, type, spacing, color, motion, and asset decisions.
   - For open-ended UI, produce or request a visual reference direction before writing many components.
   - Keep the first screen as the real product workflow, not explanatory copy about the app.

4. Use visual assets deliberately.
   - Websites, apps, games, product pages, venues, portfolios, and branded surfaces should use real or generated raster assets when assets help users inspect or feel the thing.
   - Prefer generated bitmap images for original scenes, hero art, empty states, icons that need pictorial detail, and visual direction boards.
   - Prefer real/product images when the user needs to inspect a specific product, place, person, or object.
   - Do not use decorative SVG blobs, generic gradients, or abstract stock-like backgrounds as a substitute for product signal.

5. Implement with stable layout mechanics.
   - Use real responsive constraints: grid tracks, min/max sizes, aspect ratios, stable toolbars, and fixed-format controls.
   - Keep text inside containers at all target widths.
   - Use icons for common actions and tooltips for unfamiliar icon-only controls.
   - Keep controls complete: loading, empty, error, selected, disabled, hover/focus, and narrow layouts.

6. Verify visually, then repair.
   - Run the app.
   - Use browser screenshots across desktop and mobile widths when a browser is needed.
   - Check for blank canvases, overlapping text, broken assets, tiny hit targets, layout shift, and stale generic copy.
   - Make at least one targeted repair pass for visible defects before claiming the UI is done.

## Frontend Quality Bar

- first screen is the actual product experience, not a marketing explanation, unless the user explicitly asks for a landing page
- palette is not one-note and not default purple/blue SaaS unless the brand requires it
- typography hierarchy matches the surface density
- cards are used for repeated items or framed tools, not nested decorative sections
- animations are purposeful, interruptible, and use transform/opacity where possible
- browser checks prove the result, not screenshots described from memory

## Gotchas

- Do not import a broad design doctrine into always-on prompts.
- Do not generate images when an exact existing product/place/person image is required.
- Do not replace the app's design system with a one-off aesthetic unless the task is a redesign.
- Do not stop after making code compile if the UI is visibly generic or broken.
