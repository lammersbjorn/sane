# Sane Current-Practices Research Automation

Date: 2026-05-04

Status: repo-local automation plan

Developer template:
- `docs/templates/codex-app/sane-current-practices-research-automation.md`

Purpose:
- keep Sane aligned with current Codex app, OpenAI, OpenCode, agent-framework,
  benchmark, competitor, token/context, and prompt-surface practice
- run deep recurring research, not shallow one-off automation maintenance
- open draft PRs with detailed research-backed Sane recommendations, why they
  matter, and a main-agent implementation prompt
- notify `lammersbjorn` through assignment

This automation is for this repository's maintenance workflow. It is not a Sane
product feature, not an exported pack, and not part of the managed Sane runtime.

## Cadence

Run every 3 days.

Two days is likely to create noisy churn. Three days is short enough for Codex
app and model-surface changes, while still giving each research PR time to be
reviewed or closed.

## Expected Output

The automation opens a draft PR when it finds meaningful Sane changes to
recommend now or next. The PR body is the primary artifact and should explain:
- what Sane should change
- why each change matters now
- what evidence supports it
- which files or surfaces are affected
- what compatibility posture is required
- how a main Codex agent should implement and verify it

The automation should not collapse to a single safe docs change or a
self-referential automation-template fix. If the only finding is about this
automation's own prompt, cadence, labels, or template, it should write memory or
use a separate maintenance PR rather than opening a current-practices research
PR.

## Research Scope And PR Contract

Use the developer template at
`docs/templates/codex-app/sane-current-practices-research-automation.md`.

The template owns the required research lanes, subagent expectations, PR body
shape, evidence rules, copy/adapt/reject matrix, and main-agent implementation
prompt requirements.

## Recommendation Classes

- `small direct change`: small, high-confidence, source-backed change that can be
  committed safely by the automation when it is docs-only or Sane
  prompt-template-only. This does not include this automation's own template,
  prompt, cadence, or labels.
- `main-agent change`: high-confidence, source-backed change
  Sane should make next, but broad implementation, exported-surface risk,
  package behavior, compatibility, or verification requires a main Codex agent.
- `needs more research`: plausible but not audit-complete.
- `watch`: plausible signal without enough evidence.
- `reject`: conflicts with Sane's product boundary, lacks evidence, is hype-only,
  or adds hidden automation/mutation.

The main recommendation table should include `small direct change` and
`main-agent change` items. `watch`, `reject`, and `needs more research`
belong in short side sections so maintainers know they were considered without
having to sort raw triage.

## Automation Prompt

Use the developer template at
`docs/templates/codex-app/sane-current-practices-research-automation.md`.
That file owns the exact Codex app fields, prompt, PR body contract, research
lanes, and recommendation classes.

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

The automation needs repository, web, and PR access. It should use subagents when
the Codex app exposes them inside automation runs. If GitHub tooling is
unavailable inside the run, it should leave the branch and PR-ready summary
instead of pretending a PR was opened.
