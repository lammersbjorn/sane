# Codex App Automation Template: Sane Current-Practices Research

Use this template to create a repo-maintenance automation for Sane developers.
It is not part of Sane's shipped product, exported packs, or managed runtime.

## Automation Fields

- name: `Sane current-practices research`
- kind: cron
- schedule: every 3 days
- workspace: Sane repository root
- execution environment: worktree
- model: strongest current Codex-capable model available in the Codex app
- reasoning: high
- expected result: draft PR with a deep research-backed Sane update brief
- PR assignee: `lammersbjorn`
- PR labels: `automation`, `research`

The automation needs repository, web, and PR access. It should use subagents
when the Codex app exposes them inside automation runs. If GitHub tooling is
unavailable inside a run, the agent should leave a branch and PR-ready summary
instead of claiming that it opened a PR.

The PR description is the primary artifact. Do not hide the research, decisions,
or implementation rationale in a committed memo. Any committed file should be a
small appendix, a concrete docs-only update, or an empty proposal commit when the
platform requires a branch.

Every PR opened by this automation must be visibly marked as automated and must
assign `lammersbjorn` so GitHub sends a review notification.

## Prompt

```text
Research how Sane should evolve based on the latest Codex app, OpenAI, OpenCode, agent-framework, benchmark, competitor, prompt-engineering, token/context-saving, and public workflow signals.

This is a repo-maintenance automation for Sane. Its job is to keep Sane current and strong. It must perform deep research, synthesize concrete Sane recommendations, and open a draft PR whose description is detailed enough for a maintainer to decide what to implement next.

This is not a template-maintenance job. Do not make the automation prompt, automation template, cadence, labels, or this automation's own process the main recommendation. If the automation itself is broken, mention the fix separately or open a separate maintenance PR. Current-practices PRs must focus on Sane product, package, exported-surface, prompt-surface, workflow, eval, docs, or compatibility changes.

The PR body must stand alone. A reviewer must be able to understand:
- what Sane should change
- why each change matters now
- what evidence supports it
- which files or surfaces are affected
- what compatibility posture is required
- how a main Codex agent should implement and verify it

Do not over-filter to one safe item. The goal is not "only changes this automation can implement by itself." The goal is a maintainer-grade update brief. Include:
- small changes that can be implemented now
- broad but high-confidence changes that should go to a main-agent implementation lane
- watch/reject items only in short side sections, so reviewers know they were considered

Mandatory process:
1. Start from repo truth:
   - read AGENTS.md if present
   - inspect README.md, TODO.md, docs/research, docs/plans, docs/decisions, docs/what-sane-does.md, packs/core, .agents/skills, packages, apps, and current open/merged research PRs
   - treat prior Sane research as memory to re-check, not authority
2. Use explicit research lanes. Launch subagents when the Codex app allows it. If subagent launch is blocked, unavailable, permission-limited, or hits a thread limit, state that in the PR body and final run summary.
3. Required subagent lanes:
   - Public takes lane: X/Twitter, YouTube, transcripts, newsletters, blogs, demos, release commentary, and mirrors. Extract workflow pressure only. Mark public commentary as commentary unless corroborated.
   - Sane prompt/bootstrap lane: Sane bootstrap, AGENTS.md generation, overlays, skills, custom agents, hooks, compact prompts, packs, source records, install/export/update/status/repair/doctor surfaces, and prior prompt-surface research.
   - Token/context lane: token-saving tools, prompt caching, context compaction, retrieval, memory, MCP/tool curation, repo indexes, summaries, statusline/context-budget signals, and ways to reduce always-on prompt mass.
   - Codex/OpenAI lane: official OpenAI/Codex docs, release notes, cookbook examples, model docs, Codex app/CLI behavior, Codex repo issues/PRs, skills, plugins, hooks, automations, worktrees, subagents, browser/computer-use, MCP, apps/connectors, and current runtime guidance.
   - Competitor lane: OpenCode, Superpowers, OpenAgentLayer/Agent Layer, Cursor, Windsurf, Claude Code, Copilot skills, dotagents, AGENTS.md ecosystem, MCP ecosystems, and adjacent agent frameworks. Produce copy/adapt/reject decisions.
   - Benchmarks/evals lane: SWE-bench variants, Terminal-Bench, BrowserGym/WebArena/WorkArena, Aider-style edit loops, Artificial Analysis, AgentEvals, OpenAI evals, browser/task benchmarks, and relevant agent-flow eval tooling. Map evals to Sane surfaces; do not use external leaderboards as marketing claims.
   - Integration lane: merge findings into a prioritized Sane roadmap and exact implementation prompt.
   - Reviewer lane: challenge evidence quality, shallow claims, missing repo audits, over-filtering, product-boundary fit, and whether the PR answers the original maintenance goal.
4. Do the audit before writing the PR. Do not ask the maintainer to audit a surface that this automation could inspect in the run.
5. Write the PR only after lane outputs have been merged into:
   - implement now
   - implement through main-agent lane
   - watch
   - reject
6. Aim for three or more meaningful Sane recommendations so the run does not over-filter to one safe item. Do not invent filler. If fewer than three survive, explain why in the executive summary with concrete evidence and name the strongest discarded candidates.
7. Open no PR when there are no meaningful Sane recommendations. In that case, write memory/final notes only.

Each lane output must include:
- direct source links and access dates
- source class: official docs, repo source, benchmark/eval, competitor pattern, public commentary, or copyable idea
- what changed since prior Sane notes
- Sane impact in one sentence
- copyability: copy, adapt, watch, or reject
- affected Sane surfaces
- implementation risk and compatibility posture

Evidence rules:
- Follow ETH Zurich / LogicStar AGENTS.md research (https://arxiv.org/abs/2602.11988): repository context files can reduce task success and increase inference cost when they add unnecessary requirements. Treat new always-loaded instruction as suspect.
- Public commentary cannot be sole evidence for implement-now or main-agent-lane recommendations.
- Benchmarks cannot be used as Sane marketing claims unless Sane ran the exact harness.
- A competitor idea is actionable only when it maps to a Sane surface and says what not to copy.
- A recommendation is actionable only when it names affected files or surfaces, compatibility posture, and verification.
- Reject any idea that turns Sane into a daily chat shell, wrapper-first workflow, hidden autonomous mutation loop, or opaque memory system.
- For AGENTS.md, skill, overlay, hook, compact prompt, or agent-template changes, prefer deleting, shortening, splitting, or moving rules behind triggered skills before adding text. State expected token/context impact and why always-loaded context is required, if any.

PR output contract:
- title: `research: Sane current-practices update YYYY-MM-DD`
- draft PR
- assigned to `lammersbjorn`
- labels `automation` and `research` when available
- automation notice at the top: "Automated Sane current-practices research run"
- detailed body using the sections below

PR body sections:
1. Executive Summary
   - one-screen summary of the top recommendations
   - direct answer to "what should change and why"
   - call out if the run had access/tool/subagent limits
2. Recommended Sane Changes
   - table with ID, readiness, exact change, affected files/surfaces, evidence class, source quality, copy/adapt decision, compatibility posture, risk, verification, and maintainer action
   - readiness values:
     - `implement now`: small/high-confidence change this automation may commit if docs-only or prompt-template-only
     - `implement through main-agent lane`: high-confidence change that should be implemented by a main Codex agent because it is broad, package-affecting, exported-surface-affecting, or compatibility-sensitive
3. Why Now
   - what changed in Codex/OpenAI/competitors/research since prior Sane notes
4. Lane Evidence
   - Public Takes
   - Sane Prompt / Bootstrap / Export Surfaces
   - Token / Context Tools
   - Codex / OpenAI Improvements
   - Competitor Patterns
   - Benchmarks / Evals
5. Copy / Adapt / Reject Matrix
   - competitor or tool pattern
   - Sane surface
   - copy/adapt/reject
   - what not to copy
6. Prior Sane Research Rechecked
   - path
   - still true
   - stale or contradicted
   - resulting recommendation
7. Watch / Reject
   - short lists only; do not make reviewer sort raw triage
8. Completed Audit Notes
   - repo surfaces inspected
   - subagents launched and result status
   - blocked tools or missing permissions
9. Main Agent Implementation Prompt
   - complete prompt a maintainer can hand to a main Codex agent
   - accepted/recommended IDs
   - lane plan
   - exact files/surfaces
   - compatibility constraints
   - docs sync
   - verification commands
10. Sources
   - direct links
   - public commentary clearly separated from primary docs, source, issues, benchmarks, and release notes

Committed files:
- If the recommendation is a small Sane docs-only change, make the actual doc edit.
- If the recommendation touches core package behavior, exported surfaces, Sane prompt surfaces, compatibility, or architecture, keep implementation out of the automation branch and provide the main-agent prompt.
- Do not edit this automation template, automation plan, cadence, labels, or prompt as an `implement now` item in a current-practices research PR.
- Empty proposal commits are acceptable when the PR body is the artifact and the platform requires a branch.
- Do not add a large docs/research memo unless the PR body already contains the same actionable detail.

Keep Sane's product boundary intact: Sane is a Codex-native framework for install, config, update, export, status, repair, doctor, routing, skills, and workflow guidance. It is not the daily prompting interface, a hidden autonomous mutation loop, or a wrapper-first workflow.

For the main-agent implementation prompt, require:
- re-check current repo state first
- load repo-local skills that match the accepted work
- use sane-agent-lanes and subagents for broad work before edits
- map every accepted item to concrete Sane surfaces
- preserve backwards compatibility or write an explicit migration/breaking-change plan
- update docs when behavior, responsibilities, or exported surfaces change
- verify with rtk pnpm test, rtk run 'pnpm typecheck', and rtk pnpm run accept when package/export behavior changes
```

## Maintainer Notes

This automation is meant to produce a high-signal research PR, not a tiny patch.
If it repeatedly emits one-item PRs, self-referential PRs, or empty bodies with
weak recommendations, treat that as an automation failure and revise this prompt.

The desired output is a clear update brief that can drive Sane forward:
deep research first, concrete Sane recommendations second, implementation prompt
third.
