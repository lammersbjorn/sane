---
name: sane-self-hosting
description: Use when building, changing, reviewing, or documenting Sane itself, especially product direction, exported Codex surfaces, self-hosting behavior, or migration work. Triggers on prompts like "work on Sane", "continue the Sane migration", or "rewrite Sane skills/docs".
---

# Sane Self-Hosting

## Goal

Work on `Sane` itself without turning this repo's self-hosting setup into a generic default for other repos.

## Use When

- changing Sane product direction, architecture, migration, or exported Codex surfaces
- rewriting repo-local skills, overlays, agents, packs, or self-hosting behavior
- syncing docs with real product behavior
- continuing the current Sane plan from local repo state

## Don't Use When

- working on some other repo
- doing one-off generic coding work with no Sane-specific product or instruction-surface impact
- you only need a vendor skill and no Sane-owned behavior is changing

## Inputs

- current repo files and worktree state
- root `AGENTS.md`
- `README.md`
- `docs/what-sane-does.md`
- `docs/decisions/2026-04-19-sane-decision-log.md`
- `docs/specs/2026-04-19-sane-design.md`
- `docs/specs/2026-04-19-sane-backend-contract.md`
- `docs/specs/2026-04-20-sane-tui-redesign.md`
- `docs/plans/2026-04-19-sane-strict-implementation-plan.md` when implementation order matters
- `docs/research/2026-04-23-codex-instruction-surface-rules.md` when changing repo-local skills, overlays, agents, or `AGENTS.md`
- `TODO.md`

## Outputs

- repo-aligned code or docs changes
- synced product docs when behavior or ownership changed
- matching local verification
- checkpoint commits between meaningful phases when implementation is underway

## How To Run

1. Start from repo truth and local state, not memory alone.
2. Keep root `AGENTS.md` small. Put recurring procedure detail here or in docs, not in always-on startup context.
3. Treat `Sane` as an agent framework for Codex, not a daily wrapper. The TUI remains install/config/update/export/inspect/repair/doctor.
4. When self-hosting on the Sane repo itself, use the repo's own local-state-defined agents, tools, skills, and routing where they exist.
5. Prefer Sane-owned routing/export changes before editing vendored upstream mirrors.
6. For repo-local skills and instruction surfaces, follow `docs/research/2026-04-23-codex-instruction-surface-rules.md`:
   - one job per skill
   - explicit `Use when` and `Don't use when`
   - exact outputs and verification
   - progressive disclosure instead of giant bodies
   - no duplicated policy across root guidance, skills, overlays, and agents
7. When the user says `continue`, `keep going`, or `resume`, also load `.agents/skills/continue/SKILL.md`.
8. Do not present future work as shipped behavior.
9. Keep managed Codex-native surfaces additive and reversible.

## Verification

- docs or instruction-surface-only changes: inspect diff for the touched files
- TS or exported-template changes: `rtk run 'pnpm test && pnpm typecheck'`

## Gotchas / Safety

- do not copy this repo's self-hosting shape into every repo by default
- do not widen the TUI into the normal prompting interface
- do not restate discoverable repo facts in multiple prompt surfaces
- if a skill starts growing large, split detail into docs or `references/` instead
- if a vendor skill is broad or heavy, fix Sane-owned routing first before patching the mirror

## Examples

- Positive: "Rewrite Sane's repo-local skills to match Codex best practices and sync the docs."
- Positive: "Continue the Sane migration from the current repo state."
- Negative: "Use Taste to restyle this React page." Use the concrete frontend skill instead.
