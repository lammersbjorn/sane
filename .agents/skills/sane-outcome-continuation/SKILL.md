---
name: sane-outcome-continuation
description: Use when the user gives a plain-language outcome and wants Sane to keep planning, implementing, verifying, repairing, and resuming until that outcome is done or a true blocker needs user input.
---

# Sane Outcome Continuation

## Goal

Turn a plain-language outcome into verified progress without exposing a runner command as the UX.

## Use When

- the user describes a desired end state instead of a narrow edit
- work needs more than one pass of research, planning, implementation, verification, or repair
- existing TODO, plan, runtime state, or interruption history should guide the next step
- the user asks for autonomous progress toward an outcome

## Don't Use When

- the task is a one-shot answer or a tiny local edit
- the user explicitly asks only for a plan, review, status, or command output
- a required product decision, credential, or destructive operation blocks safe progress

## Inputs

- latest user outcome
- repo files and current worktree state
- TODO, plan, handoff, runtime, verification, and interruption state if present
- task-specific Sane skills, repo-local skills, agents, tools, and verify commands

## Outputs

- the next concrete slice toward the requested outcome
- durable plan or TODO updates when the outcome must survive the session
- implementation, verification, and self-repair attempts until done or user input is needed
- a concise final state: changed files, verification, and any real blocker

## How To Run

1. Restate the outcome internally in one sentence; do not turn it into a command ritual.
2. Read current repo and durable state before choosing work.
3. Obey the repo shell policy before every shell tool call. If RTK is required, prefer RTK-native commands such as `rtk grep`, `rtk read`, `rtk diff`, `rtk test`, `rtk pnpm`, and `rtk git`; use `rtk run '<command>'` only when no native RTK command fits.
4. If `.sane` runtime state exists, use it as resumable context: objective, active tasks, blockers, verification posture, brief, summary, and latest history.
5. Pick the smallest useful slice that moves the outcome forward.
6. Research only when the next slice depends on current external facts, new stack choices, stale tool choices, or unknown repo shape.
7. Plan only as much as needed, then implement through the most specific available skill, agent, or tool.
8. Use subagents by default for anything beyond a tiny direct answer. For broad or multi-file outcomes, load `sane-agent-lanes`, write a lane plan, and attempt at least one subagent handoff before deep work. Broad reviews use explorer/reviewer lanes; broad edits use at least one disjoint implementation lane before the main session edits overlapping code. Attempt handoff before asking about subagents. If subagent launch is unavailable, denied, missing, at thread cap, or blocked by higher-priority policy requiring explicit user authorization before invocation, report the exact blocker, ask once, and wait for user input before inspecting, verifying, patching, or continuing broad work locally. If `spawn_agent` fails or thread cap is hit, close completed agents and retry once with either `message` or `items`, not both. If the harness still blocks subagents after retry, state the broad-work blocker; continue solo only for a tiny direct answer or explicitly narrowed fallback.
9. Verify with the matching local checks or evidence for the changed behavior.
10. If verification fails, diagnose the failing path and repair once before changing approach.
11. Persist durable TODO or plan state when the remaining work spans sessions.
12. Resume from interruption, rate-limit, or handoff state when present.
13. Finish only when the outcome is done, the user redirects, or a true blocker remains.

## Stop Conditions

- done: requested outcome is implemented, verified, and docs/state are synced when needed
- blocked: missing required user decision, credential, unavailable dependency, destructive approval, or unsafe action
- paused: user explicitly redirects, pauses, or narrows the task
- rate-limited: preserve current objective, next task, verification state, and resume context; schedule resume only when a reliable reset signal exists

## Gotchas / Safety

- keep this loop internal instead of exposing a public runner command
- describe internal state plumbing as internal until shipped as product behavior
- verify subagent output before treating it as true
- keep outcome state focused instead of turning it into a generated repo overview
- mutate only files required by the outcome
- preserve worktree edits from other agents
