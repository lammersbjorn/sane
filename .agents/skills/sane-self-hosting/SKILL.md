---
name: sane-self-hosting
description: Use when building, changing, reviewing, or documenting Sane itself. Keeps repo-specific self-hosting guidance out of root AGENTS, points to the right product and architecture docs, and preserves Sane's no-wrapper, minimal-context philosophy.
---

# Sane Self-Hosting

Use this skill for work on `Sane` itself. Do not copy this shape into other repos by default.

## Core Stance

- Keep root `AGENTS.md` tiny. Put recurring repo detail here or in repo docs, not in always-on guidance.
- `Sane` is an agent framework for Codex, not a daily wrapper.
- The TUI is the setup/config/update/export/inspect/repair surface.
- Normal use should stay plain-language first. Do not introduce command ritual to get good results.
- Repo-local self-hosting on this repo is dogfooding, not a universal requirement for repos that use `Sane`.

## Read First

Read these before changing product direction, architecture, or self-hosting guidance:

- `README.md`
- `docs/what-sane-does.md`
- `docs/decisions/2026-04-19-sane-decision-log.md`
- `docs/specs/2026-04-19-sane-design.md`
- `docs/specs/2026-04-19-sane-backend-contract.md`
- `docs/specs/2026-04-20-sane-tui-redesign.md`
- `TODO.md`

If the task touches implementation order or gated future work, also read:

- `docs/plans/2026-04-19-sane-strict-implementation-plan.md`
- `docs/research/2026-04-20-tui-tooling-and-ux-audit.md`

## Architecture Doc Map

Use the boundary docs instead of guessing:

- TUI flows, copy, onboarding, install/repair UX:
  - `docs/specs/2026-04-20-sane-tui-redesign.md`
  - `crates/sane-tui/README.md`
- Managed assets, export/install/uninstall semantics, additive markers:
  - `docs/specs/2026-04-19-sane-backend-contract.md`
  - `crates/sane-core/README.md`
- Config meaning, defaults, packs, model-role settings:
  - `crates/sane-config/README.md`
- Project-root discovery, `.sane/` layout, user-level Codex paths:
  - `crates/sane-platform/README.md`
- Local runtime state, summaries, backups, rewrite metadata:
  - `crates/sane-state/README.md`
- Adaptive policy groundwork and inspectable policy output:
  - `crates/sane-policy/README.md`

## Working Rules

- Treat `docs/decisions/2026-04-19-sane-decision-log.md` as locked product truth unless a new decision log changes it.
- Keep `README.md` public-facing and beginner-first.
- Keep under-the-hood details in `docs/`, `TODO.md`, crate READMEs, or this skill.
- When the user says `continue`, `keep going`, `resume`, or equivalent, also load `.agents/skills/continue/SKILL.md` and follow it unless the user explicitly narrows scope differently.
- When self-hosting on the `Sane` repo itself, use the repo's own currently installed/local-state-defined agents, tools, skills, and routing surfaces where they exist instead of bypassing them by default.
- Keep that self-hosting behavior aligned with `Sane`'s real exported/local-state behavior so future self-improve and self-heal work can build on the same surfaces instead of a hidden one-off workflow.
- If guidance starts becoming broad or stale, split it into docs or a more targeted skill instead of expanding root `AGENTS.md`.
- Do not present future work as shipped behavior.
- Do not blur the TUI/setup boundary into a normal prompting interface.
- Preserve additive, reversible behavior for managed Codex-native surfaces.

## Doc Sync Rules

Update docs in the same change when you alter:

- what users see in the TUI
- what `Sane` writes
- what install/export/uninstall changes do
- what is optional, additive, or reversible
- crate boundaries or responsibilities

When crate responsibilities change, update the relevant crate `README.md` in the same change.

## Verification Baseline

Use the lightest verification that matches the change. Default baseline:

```bash
cargo fmt --check
cargo check
cargo test
```

Add flow checks when relevant:

- TUI or onboarding changes: `cargo run -p sane`
- settings/config changes: `cargo run -p sane -- settings`
- managed-surface or repair work: `cargo run -p sane -- status` and `cargo run -p sane -- doctor`

## Self-Hosting Guardrail

This skill exists so root `AGENTS.md` can stay small and high-signal. Prefer adding recurring repo guidance here over turning root guidance into a giant always-loaded file.
