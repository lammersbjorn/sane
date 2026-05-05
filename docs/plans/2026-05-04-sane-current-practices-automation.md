# Sane Current-Practices Research Automation

Date: 2026-05-04

Status: repo-local automation plan

Developer template:
- `docs/templates/codex-app/sane-current-practices-research-automation.md`

Purpose:
- keep Sane aligned with current Codex app, OpenAI, OpenCode, agent-framework,
  benchmark, competitor, and prompt-surface practice
- create reviewable draft PRs for implementation-ready recommendations, not
  hidden core mutations or raw triage
- give a main Codex agent a clear implementation prompt after human review

This automation is for this repository's maintenance workflow. It is not a Sane
product feature, not an exported pack, and not part of the managed Sane runtime.

## Cadence

Run every 3 days.

Two days is likely to create noisy churn. Three days is short enough for Codex
app and model-surface changes, while still giving each research PR time to be
reviewed or closed.

## Expected Output

The automation opens a draft PR only when it has useful, implementation-ready
recommendations. The PR body is the primary artifact and must stand alone: it
must explain what should change, why, affected surfaces, compatibility posture,
verification, completed audits, and a main-agent implementation prompt.

Docs-only and prompt-template-only recommendations should be implemented in the
branch. Core package behavior, exported-surface compatibility, risky
prompt-surface, package, or architecture changes should stay proposal-only in
the PR body with exact implementation instructions.

## Research Scope And PR Contract

Use the developer template at
`docs/templates/codex-app/sane-current-practices-research-automation.md`.

The template owns the required research lanes, subagent expectations, PR body
shape, evidence rules, copyable-idea matrix, Recommended Changes table, private
discarded set, completed audit notes, and maintainer decision path.

## Decision Rules

- `implement now`: small, high-confidence, backwards-compatible change.
- `needs human review`: core package, exported surface, prompt-surface, package,
  architecture, or behavior change needing human review first.
- `watch`: plausible signal without enough evidence.
- `reject`: conflicts with Sane's product boundary, lacks evidence, or adds
  hidden automation/mutation.

Major changes should be proposed, not implemented. Backwards compatibility must
be handled through an additive path, migration plan, feature flag, deprecation
window, or explicit breaking-change proposal.

## Automation Prompt

Use the developer template at
`docs/templates/codex-app/sane-current-practices-research-automation.md`.
That file owns the exact Codex app fields, prompt, PR body contract, research
lanes, and proposal classification rules.

## Codex App Setup Notes

Use a cron automation attached to this repository, not a heartbeat in a chat
thread. The automation should run in a worktree environment so draft PRs are
created from isolated branches.

Recommended fields:
- name: `Sane current-practices research`
- schedule: every 3 days
- workspace: this repository
- execution environment: worktree
- model: current strongest Codex-capable model available to the app
- reasoning: high
- prompt: the `Prompt` section in the developer template

The automation needs repository and PR access. If GitHub tooling, labels,
assignment, or branch creation is unavailable inside the run, it should state
the blocker in the PR body or final run summary instead of pretending the action
succeeded. When available, draft PRs should be assigned to `lammersbjorn` and
labeled `automation`, `research`, and `codex-automation`.
