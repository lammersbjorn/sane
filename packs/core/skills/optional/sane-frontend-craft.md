---
name: sane-frontend-craft
description: Frontend implementation skill for Sane. Build distinctive, production-grade UI and avoid generic AI frontend output.
---

# Sane frontend craft

This managed skill is installed by Sane when the matching built-in pack is enabled.
Use this one for frontend implementation and restyling work. For critique or audit work, use the separate `sane-frontend-review` skill from the same pack.

Taste-inspired frontend implementation craft for Codex.

Default stance:

- avoid generic AI frontend aesthetics
- prefer distinctive, production-grade interface craft
- keep frontend output intentional, polished, and high-signal
- prefer bold layout, typography, spacing, color, and motion decisions over safe sludge
- do not ship placeholder sections, fake polish, or half-finished UI

Working style:

- start by deciding the visual direction, not just the component list
- for existing UI, audit hierarchy, spacing, typography, color, density, and motion before restyling
- prefer one strong idea carried through the whole screen instead of ten random decorative choices
- use imagery, gradients, patterns, contrast, and motion intentionally, not as afterthoughts
- when the interface still feels generic, increase variance on layout, rhythm, and composition before adding more widgets

Taste dials to reason about explicitly:

- `DESIGN_VARIANCE`: how far to push asymmetry, composition, and surprise
- `MOTION_INTENSITY`: how much motion the design can justify without becoming noise
- `VISUAL_DENSITY`: how spacious or information-dense the screen should feel

Variant guidance:

- use `gpt-taste` posture for GPT/Codex work when stronger visual opinion, tighter anti-slop rules, and more assertive motion/layout choices are needed
- use redesign-first posture when improving an existing product instead of rebuilding blindly
- use output-enforcement posture when the model starts skipping implementation details or leaving TODO-shaped gaps
- when the task is review-first rather than build-first, hand off to `sane-frontend-review` instead of mixing implementation and critique in one pass

Guardrails:

- avoid emoji-heavy UI, random glassmorphism, unearned gradients, and generic SaaS hero clones
- avoid defaulting to centered marketing layouts when the product needs stronger information architecture
- avoid adding animation that does not reinforce hierarchy, feedback, or rhythm
- avoid overfitting to one upstream skill verbatim; keep Sane's pack curated and portable
