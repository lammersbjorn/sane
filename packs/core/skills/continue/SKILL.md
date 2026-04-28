---
name: continue
description: Use when the user says continue, keep going, resume, don't stop, or wants autonomous progress on the current plan. Confirm the workstream once only if truly ambiguous, then keep moving until a real blocker or explicit user input is required.
---

# Continue

## Goal

Keep the current mainline moving until there is a real blocker. Delegate side tasks when possible, then resume automatically.

## Use When

- the user says `continue`, `keep going`, `resume`, `don't stop`, or equivalent
- the repo already has a main plan, TODO, or current migration lane
- the user wants autonomous progress instead of a one-shot answer

## Don't Use When

- the task is clearly a one-off answer with no ongoing workstream
- the user explicitly paused or switched goals
- a short clarification is required before any safe assumption can be made

## Inputs

- current repo files and worktree state
- current plan, TODO, handoff docs, runtime state, or local state if present
- latest user instruction
- side tasks that arrived during the mainline
- repo-local agents, tools, skills, routing defaults, and verify commands when present

## Outputs

- verified slices of progress
- checkpoint commits between meaningful phases when implementation is underway
- short milestone updates while work continues
- one explicit blocker only when progress truly cannot continue safely

## How To Run

1. Re-read current repo state before guessing from memory or old chat.
2. Obey the repo shell policy before every shell tool call. If RTK is required, prefer RTK-native commands such as `rtk grep`, `rtk read`, `rtk diff`, `rtk test`, `rtk pnpm`, and `rtk git`; use `rtk run '<command>'` only when no native RTK command fits.
3. If `continue` is truly ambiguous, ask one short question once at the start. Otherwise do not ask.
4. Pick the highest-value next slice that is small enough to verify and meaningful enough to move the project forward.
5. Use repo-local agents, tools, skills, local state, and routing defaults when present.
6. Preserve the repo's own terminology and current surface names. If the user points at a file, command, path, screen, or label, inspect it before arguing from memory.
7. Use parallel read/research lanes aggressively when safe.
8. For broad or multi-file work, load `sane-agent-lanes`, make a lane plan, and get a successful subagent handoff before deep work. Broad reviews need explorer/reviewer lanes; broad edits need at least one implementation lane with a disjoint write scope. If higher-priority rules require explicit subagent authorization and it is missing, ask and pause instead of doing a tiny solo substitute.
9. Delegate side tasks and bounded side lanes by default when possible so mainline progress does not stall.
10. If the user injects a side task:
   - delegate it when possible
   - do it directly only when delegation does not make sense
   - then resume the mainline automatically
11. When a repo exposes local subagents, tools, or skills, prefer using them instead of ad hoc habits so the workflow can self-improve later.
12. When committing, copy the repo's commit message style; if none exists or it is poor, default to Conventional Commits.
13. Keep model and reasoning choice task-shaped instead of reusing one default everywhere.
14. Use the lightest process that still works:
   - no mandatory mega-plan unless ambiguity or risk is real
   - no per-tool narration
   - brief milestone updates only
   - answer from context directly when no extra tooling is needed
15. If you reread or re-edit the same area twice without real progress, switch approach instead of looping.
16. After any side answer, research result, checkpoint, or verify pass, keep going on the mainline unless the user explicitly paused or a real blocker exists.
17. Stop only for a real blocker:
   - missing required decision the repo/context does not answer
   - missing credential or dependency with no workaround
   - destructive risk requiring approval
   - explicit user pause or goal change

## Verification

- use the lightest real local checks that match the change
- do not call a checkpoint "done" without at least matching diff review or local validation
- if the repo has exact verify commands, use those

## Gotchas / Safety

- reaching a checkpoint is not a blocker
- finishing one subtask is not a blocker
- a side task is not a blocker if you can do it and return
- answering the user's side question is not a blocker
- finishing research is not a blocker if implementation can continue from it
- do not keep asking whether to continue
- do not over-tool trivial asks just because you are in continuation mode
- do not leave idle subagents open after their result is no longer needed

## Examples

- Positive: user says "continue with the plan and don't stop unless blocked." Keep going.
- Positive: user asks a small side question mid-migration. Answer or implement it, verify it, then return to the migration.
- Negative: user asks a standalone factual question with no active workstream. Just answer it.
