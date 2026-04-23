---
name: continue
description: Use when the user says continue, keep going, resume, don't stop, or wants the agent to keep progressing through the current plan autonomously. Confirms the intended workstream once at the start if needed, then continues until a real blocker or explicit user input is required. Handles side tasks and then resumes the main work automatically.
---

# Continue

Use this skill when the user wants ongoing autonomous progress instead of a one-shot answer.

## Goal

- Confirm the intended workstream once at the start if there is real ambiguity.
- Then keep moving until there is a real blocker.
- If the user injects a side task, do it, then resume the mainline automatically.
- Do not stop at checkpoints, summaries, or "done with this slice" moments.

## What Counts As A Real Blocker

Stop only when at least one is true:

- a required decision has multiple materially different paths and the repo/context does not already answer it
- a needed credential, login, permission, or external dependency is missing and cannot be worked around
- a required file, service, environment, or API is unavailable and no safe fallback exists
- continuing would risk destructive or policy-breaking changes without explicit approval
- the user explicitly asks to pause or switch goals

Not blockers:

- you reached a checkpoint
- you finished one subtask
- you have enough for a progress update
- the conversation drifted to a side task you can finish and return from

## Start Behavior

At the beginning only:

1. Inspect current repo/task state before guessing:
   - root guidance like `AGENTS.md`
   - repo-local skills if present
   - current plan/TODO/handoff docs if present
   - current worktree / diff / runtime state if relevant
2. If there is genuine ambiguity about what "continue" means, ask one short question:
   - continue the current main plan
   - or work on another specific target
3. If the intended workstream is already clear from the repo and chat, do not ask. Just continue.

Do not keep re-confirming after that.

## Main Loop

Repeat until blocked:

1. Re-read current state from the repo, not memory alone.
2. Pick the highest-value next slice that is:
   - aligned with the current plan
   - non-overlapping with in-flight work
   - small enough to verify
   - meaningful enough to move the project forward
3. Do the work.
4. Verify the work with the lightest real checks that match the change.
5. Commit/checkpoint if the repo workflow expects it.
6. Immediately choose the next slice and continue.

Never end a turn merely because one slice is complete.

## Side Tasks

If the user interrupts with a side task:

1. Decide whether it is:
   - a small detour
   - a replacement priority
2. If it is a small detour:
   - do it directly, or delegate it if that is cleaner
   - verify it
   - then resume the previous mainline without waiting to be told
3. If it clearly replaces the previous priority, switch the mainline and continue from the new one

Default bias:

- treat small fixes, questions, prompts, docs tweaks, config tweaks, and research asks as detours unless the user explicitly reframes the whole goal

## Parallelism

Use parallel work aggressively when safe:

- split read-only exploration into parallel lanes
- split disjoint code/doc changes into parallel lanes
- keep one write lane if multiple writers would conflict
- close subagents when done

Prefer the project's own available:

- tools
- skills
- local state
- task docs
- routing rules
- model/subagent philosophy

If the repo has its own agent framework or local-state-defined behavior, use that instead of inventing a separate workflow.

## Model / Agent Selection

Pick models and reasoning by task shape, not habit.

- use smaller/faster models for bounded read-only mapping, grep work, and low-risk synthesis
- use stronger coding models for implementation-heavy or repo-coupled changes
- use stronger verifier/synthesis models for integration checks and high-risk review
- increase reasoning when ambiguity, coupling, or risk rises

Do not under-think by default on continuation work.

## Local State Bias

Prefer repo truth in this order:

1. current repo files
2. repo-local state/runtime files
3. current worktree status/diff
4. durable plan/TODO/handoff docs
5. prior memory/context

If local state exists for the project, use it to resume instead of reconstructing from chat alone.

## Communication

- Send short progress updates while working.
- Updates are not a stopping condition.
- When reporting progress, include what changed, what was verified, and what you are taking next.
- Do not ask "want me to continue?" unless there is a real blocker.

## Finish Condition

Only stop when:

- the project is actually blocked
- the user explicitly wants a pause
- the requested scope is fully exhausted and there is no meaningful next slice

If you stop, say exactly what blocked progress and what input is needed.
