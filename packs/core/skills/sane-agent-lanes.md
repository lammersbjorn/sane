---
name: sane-agent-lanes
description: Use when a broad PRD, issue, or multi-agent ask needs to be sliced into owned lanes with TDD, verification, review, and human acceptance.
---

# Sane Agent Lanes

## Goal

Turn broad work into small owned lanes with clear write boundaries, verification, and review.

## Use When

- a PRD, issue, backlog, or user ask is too large for one focused change
- parallel agents or worktrees are being considered
- the work needs scoped tests, review, and a human pick/merge decision
- there are multiple independent code areas with clear ownership boundaries

## Don't Use When

- the task is a small single-file fix
- the user only asked for a tiny direct answer, narrow status check, or narrow research answer
- the research/product pass is not broad enough to need owned parallel lanes
- ownership boundaries cannot be described before implementation starts

## Inputs

- the user's objective or PRD/issue text
- current repo status and relevant docs
- allowed write scopes and forbidden areas
- verification commands for each lane
- worktree readiness from Status when available

## Output

Produce a compact lane plan. Keep it task-specific; do not include repo overviews.

| Lane | Owner | Scope | Write Boundary | Test First | Verify | Review |
| --- | --- | --- | --- | --- | --- | --- |

Also include:

- the shared acceptance criteria
- lane dependencies, if any
- which lanes can run now and which must wait
- the first successful subagent handoff needed before broad work continues
- whether this is a new implementation phase after research/planning, and the first implementation/review handoff needed before edits
- the blocked-handoff fallback question to ask only if launch is blocked, unavailable, or requires explicit user authorization
- the merge/review order
- review-lane convergence format: each finding labeled `confirmed`, `needs-verify`, or `rejected` with one-line reason/evidence
- coordinator step that picks smallest implementation lane that resolves all `confirmed` findings and only required `needs-verify` checks
- what the human must pick or approve before final integration

## How To Run

1. Restate the objective in one sentence.
2. Check current repo state before assigning lanes.
3. Split by ownership and write boundary, not by vague activity type.
4. Give each lane a small write boundary and a matching verify command.
5. Require failing or focused tests before implementation when behavior changes.
6. Attempt to spawn at least one lane before broad work continues. Use explorer/reviewer lanes for broad reviews and implementation lanes when files will change.
7. Treat each phase change as a new lane decision. Research/planning lanes do not authorize later implementation; before broad edits, spawn an implementation lane or a read-only reviewer lane with exact boundaries.
8. Ask for subagent authorization only after a handoff is blocked. If launch is unavailable, denied, missing, at thread cap, or higher-priority policy requires explicit user authorization before invocation, report the exact blocker, ask once, and stop. Do not inspect, verify, patch, or continue broad work locally as a substitute.
9. If spawn fails or thread cap is hit, close completed agents and retry once with either `message` or `items`, not both.
10. Keep one coordinator lane responsible for integration and review.
11. Stop and ask when write boundaries conflict or the next step needs a human choice.
12. Keep review verdicts compact; avoid long narrative sprawl once findings are classified.

## Safety

- Subagent-first for every lane plan. Stay single-agent only for tiny direct answers.
- Do not let two lanes own the same files unless one is explicitly read-only.
- Do not start broad edits before an implementation lane owns a disjoint write scope.
- Do not count earlier research or planning lanes as the implementation handoff for a later "add it", "build it", "fix it", or "redo it" turn.
- Do not create lanes for broad repo summaries; create lanes for decisions, files, tests, or reviews.
- Do not do a tiny solo pass for broad review, whole-codebase review, release review, or architecture review.
- Do not pre-ask just because work is broad when a subagent handoff can be attempted.
- Blocked, missing, or unauthorized subagent launch is never a reason to route broad work to "main session only"; ask and stop instead.
- Do not create hidden background loops.
- Do not skip verification just because lanes ran in parallel.
- Do not leave review findings as unclassified prose; classify as `confirmed`, `needs-verify`, or `rejected`.
- Do not turn Sane into the daily prompting interface; this is exported workflow guidance.
