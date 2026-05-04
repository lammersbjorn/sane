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

## Use Main Session When

- the task is a small single-file fix
- the user asked for a tiny direct answer, narrow status check, or narrow research answer
- the research/product pass is small enough for one owned thread
- ownership boundaries need more discovery before implementation lanes can be assigned

## Inputs

- the user's objective or PRD/issue text
- current repo status and relevant docs
- allowed write scopes and forbidden areas
- verification commands for each lane
- worktree readiness from Status when available

## Output

Produce a compact lane plan. Keep it task-specific and skip repo overviews.

| Lane | Owner | Scope | Write Boundary | Test First | Verify | Review |
| --- | --- | --- | --- | --- | --- | --- |

Also include:

- the shared acceptance criteria
- lane dependencies, if any
- which lanes can run now and which must wait
- the first successful subagent handoff needed before broad work continues
- whether this is a new implementation phase after research/planning, and the first implementation/review handoff needed before edits
- the launch-failure fallback question to ask only when subagent launch is blocked, unavailable, or requires explicit user authorization
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
7. Treat each phase change as a new lane decision. After research/planning, require a fresh implementation or read-only reviewer handoff with exact boundaries before broad edits.
8. Attempt handoff before asking for subagent authorization. If launch is unavailable, denied, missing, at thread cap, or higher-priority policy requires explicit user authorization before invocation, report the exact blocker, ask once, and wait for user input before inspecting, verifying, patching, or continuing broad work locally.
9. If spawn fails or thread cap is hit, close completed agents and retry once with either `message` or `items`, not both.
10. Keep one coordinator lane responsible for integration and review.
11. Ask and wait when write boundaries conflict or the next step needs a human choice.
12. Keep review verdicts compact; avoid long narrative sprawl once findings are classified.

## Safety

- Start every lane plan with subagent handoff unless the request is a tiny direct answer.
- Give overlapping file ownership to one writing lane; make any second lane explicitly read-only.
- Begin broad edits only after an implementation lane owns a disjoint write scope.
- Treat later "add it", "build it", "fix it", or "redo it" turns as new implementation handoffs; earlier research or planning lanes are context only.
- Create lanes for decisions, files, tests, or reviews instead of broad repo summaries.
- Use reviewer lanes for broad, whole-codebase, release, or architecture review.
- Attempt handoff for broad work before asking about subagents.
- When subagent launch is blocked, missing, or unauthorized, keep broad work in the lane flow: report the blocker, ask once, and wait for direction.
- Keep background work visible as explicit lanes.
- Verify changed behavior even when lanes ran in parallel.
- Classify review findings as `confirmed`, `needs-verify`, or `rejected`.
- Keep Sane as exported workflow guidance, not the daily prompting interface.
