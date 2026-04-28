---
name: sane-frontend-review
description: Use when reviewing, auditing, or polishing frontend UI for visual quality, responsiveness, accessibility, asset rendering, motion, or generic AI-design problems.
---

# Sane Frontend Review

## Goal

Catch frontend defects that normal code checks miss.

## Use When

- frontend implementation is close to done
- user asks for UI review, polish, QA, responsiveness, accessibility, or design critique
- screenshots or browser checks are needed before completion
- visual assets, generated imagery, canvas, video, or animation might be broken

## Don't Use When

- there is no UI surface to inspect
- the user asks for code review only and visual behavior is out of scope

## Inputs

- changed UI files
- running app URL or launch command
- available browser, Playwright, screenshot, image, and terminal tooling
- design references and product context

## Outputs

- prioritized findings with file/area references
- screenshots or concrete browser evidence when available
- minimal fix list, grouped by severity
- final pass/fail recommendation

## Model Route

- Frontend review/visual QA subagents should run on `gpt-5.5` with `high` reasoning when available.
- Use `gpt-5.5` with `xhigh` for final visual approval, broad redesign QA, screenshot/Figma parity, complex responsive surfaces, canvas/WebGL/game UI, or when judging taste and product fit.
- Do not use a mini or generic reviewer for visual approval when `gpt-5.5` is available.

## Review Checklist

- layout holds at mobile, tablet, and desktop widths
- text does not overflow, wrap badly, or overlap controls
- hit targets are usable and focus states are visible
- images load, crop, and contrast correctly
- generated assets match the product and are not decorative filler
- animations do not cause layout shift or first-frame stutter
- palette has enough contrast and is not one-note
- empty/loading/error/disabled states exist where expected
- the first screen communicates the actual product or workflow
- the UI does not look like a generic template for a different product

## How To Run

1. Establish the runnable surface.
   - If the user gives a URL, inspect that URL.
   - If the repo has a frontend dev server, start it and use the local URL.
   - If the surface is static HTML, open the file directly or through a tiny local server when assets require it.
   - If the UI cannot run, say so and fall back to source review plus exact missing runtime steps.

2. Use the strongest available visual tool.
   - Prefer the in-app browser / Browser Use plugin when the user asks to open, inspect, click, or test a browser target.
   - Use Playwright when repeatable screenshots, viewport sweeps, DOM checks, form flows, console errors, or interaction tests are needed.
   - Use screenshot comparison or local image viewing for static screenshots, generated assets, canvas outputs, and before/after visual evidence.
   - Use terminal checks for build/lint/type/test only as supporting evidence; they do not replace visual review.
   - If a runnable UI exists and no browser/screenshot check was possible, mark the review incomplete and name the blocker.

3. Check required viewport set.
   - Desktop: about 1440px wide.
   - Tablet/narrow desktop: about 900px wide.
   - Mobile: about 390px wide.
   - Add app-specific breakpoints if the project defines them.

4. Inspect interactions.
   - Click primary actions, menus, tabs, toggles, forms, dialogs, and toolbars.
   - Check hover/focus/active states where the tool can simulate them.
   - Watch for layout shift, scroll traps, clipped popovers, and stale loading states.

5. Inspect rendering evidence.
   - Capture screenshots when layout, asset, animation, or responsive issues are plausible.
   - For canvas/WebGL/Three.js/game surfaces, verify nonblank pixels and movement/framing, not just DOM presence.
   - For generated or edited images, verify file presence, crop, contrast, and final rendered placement.

6. Report and re-check.
   - Look for visual defects first, then code causes.
   - Recommend fixes that reuse existing project patterns.
   - Re-check after fixes before marking done.

## Gotchas

- Do not rely only on unit tests for frontend completion.
- Do not review screenshots without checking the live UI when the app can run.
- Do not mark visual QA complete from source inspection alone when browser tooling is available.
- Do not bury severe overlap, blank canvas, or broken asset issues under style suggestions.
- Do not use static source inspection as the final answer when browser tooling is available.
