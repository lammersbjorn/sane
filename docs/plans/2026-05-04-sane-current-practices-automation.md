# Sane Current-Practices Research Automation

Date: 2026-05-04

Status: repo-local automation plan

Developer template:
- `docs/templates/codex-app/sane-current-practices-research-automation.md`

Purpose:
- keep Sane aligned with current Codex app, OpenAI, OpenCode, agent-framework,
  benchmark, competitor, and prompt-surface practice
- create reviewable draft PRs with implementation-ready recommended changes,
  not raw research triage or hidden core mutations
- give a main Codex agent a clear implementation prompt after human review

This automation is for this repository's maintenance workflow. It is not a Sane
product feature, not an exported pack, and not part of the managed Sane runtime.

## Cadence

Run every 3 days.

Two days is likely to create noisy churn. Three days is short enough for Codex
app and model-surface changes, while still giving each research PR time to be
reviewed or closed.

## Expected Output

The automation opens a draft PR only when it finds changes Sane should actually
make now. The PR should focus on recommended changes, the evidence behind them,
completed audit work, compatibility posture, and verification. It should not ask
the maintainer to do the research audit that the automation was supposed to do.

Small repo-local documentation updates are allowed only when they make the
research PR easier to review, such as adding a dated memo under `docs/research/`.

## Research Scope And PR Contract

Use the developer template at
`docs/templates/codex-app/sane-current-practices-research-automation.md`.

The template owns the required research lanes, subagent expectations, PR body
shape, evidence rules, copyable-idea matrix, and recommended-change table.

## Decision Rules

- `implement now`: high-confidence, actionable, source-backed change that Sane
  should make now.
- `needs more research`: plausible but not audit-complete. Keep out of the main
  PR recommendation unless it explains an omission.
- `watch`: plausible signal without enough evidence. Keep out of the main PR
  recommendation unless it explains an omission.
- `reject`: conflicts with Sane's product boundary, lacks evidence, or adds
  hidden automation/mutation. Keep out of the main PR recommendation unless it
  explains an omission.

Major code or exported-surface changes should be recommended with exact target
files and a main-agent implementation prompt, not implemented directly by the
research automation. Backwards compatibility must be handled through an additive
path, migration plan, feature flag, deprecation window, or explicit
breaking-change proposal.

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

The automation needs repository and PR access. If GitHub tooling is unavailable
inside the run, it should leave the branch and PR-ready summary instead of
pretending a PR was opened.
