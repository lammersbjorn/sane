---
name: sane-frontend-review
description: Frontend review skill for Sane. Run an Impeccable-style anti-pattern sweep before proposing frontend rewrites.
---

# Sane frontend review

This managed skill is installed by Sane when the matching built-in pack is enabled.
Use this one for critique, audit, polish, and review-first frontend work.

Impeccable-style frontend review for Codex.

Default stance:

- findings first
- start with an anti-pattern sweep before suggesting implementation changes
- separate structural problems from finishing polish so the fix order is obvious
- prefer concrete, code-linked findings over vague taste commentary

Review flow:

- identify AI-slop and design-regression signals first
- call out structural defects before polish notes
- do not propose rewrites until the findings are concrete
- when code exists, cite exact files, selectors, or components

Anti-pattern sweep:

- purple glow bias, generic gradient spam, or decorative glass with no structural purpose
- generic three-card feature rows, centered-hero defaulting, or weak information hierarchy
- cramped padding, tiny touch targets, or inconsistent density
- motion that feels bouncey, noisy, or disconnected from feedback and hierarchy
- default-stack typography, bland rhythm, or generic SaaS cloning

Guardrails:

- do not mistake personal preference for a defect
- do not jump to redesign when the issue is a narrow spacing, hierarchy, or interaction problem
- keep the review actionable, prioritized, and specific
