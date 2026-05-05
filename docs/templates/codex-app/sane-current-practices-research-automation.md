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
- expected result: draft PR with implementation-ready Sane product/surface recommendations
- PR assignee: `lammersbjorn`
- PR labels: `automation`, `research`

The automation needs repository, web, and PR access. If GitHub tooling is
unavailable inside a run, the agent should leave a branch and PR-ready summary
instead of claiming that it opened a PR.

The PR description is the primary artifact. Do not hide the recommendation in a
large committed research document and leave only a summary in the PR body.

Every PR opened by this automation must be visibly marked as automated and must
assign `lammersbjorn` so GitHub sends a review notification.

## Prompt

```text
Research whether Sane should change based on latest Codex app, OpenAI, OpenCode, agent-framework, benchmark, competitor, prompt-engineering, token/context-saving, and public workflow signals.

This is a repo-maintenance automation for Sane. Its job is to keep Sane current and as strong as possible. It must do the research and audits itself, then open a draft PR only for Sane product, package, exported-surface, prompt-surface, workflow, eval, or docs changes it actually recommends.

Do not make the automation contract, this template, the automation plan, labels, cadence, or the automation prompt itself the main recommendation. Automation-maintenance changes are allowed only when the run itself is broken, and then they must be secondary to Sane recommendations or be handled as a separate maintenance PR. If the only surviving change is about this automation, do not open a current-practices research PR; write memory/final notes instead.

The PR body must stand alone. A reviewer must be able to understand what changed or should change, why, which files or surfaces are affected, and what compatibility plan is required without opening a committed research document. Do not write "included in docs/..." as a substitute for the detailed PR description.

Do not make the maintainer sort through raw triage. The PR must focus on changes Sane should actually make now or should schedule next through a concrete main-agent lane. Watch, rejected, hype-only, and weak-signal ideas belong in the agent's private notes. Mention them only when a short "Not included" note prevents confusion about an obvious non-change.

Mandatory process:
1. Start from repo truth:
   - read AGENTS.md if present
   - inspect README.md, TODO.md, docs/research, docs/plans, docs/decisions, packs/core, .agents/skills, packages, and apps
   - treat prior Sane research as memory to re-check, not authority
2. Use explicit research lanes. Launch subagents when the Codex app allows it. If subagent launch is blocked, unavailable, or permission-limited, state that in the PR body and final run summary.
3. Audit before proposing. If a lane says "audit X", perform that audit in the same run unless blocked by access or runtime limits. Do not open a PR that merely asks the maintainer or a future agent to do the research audit.
4. Do not write the PR body until lane outputs have been merged into one Sane-change recommendation set and a private discarded set.
5. Use at least one verifier/reviewer lane or reviewer pass after synthesis. The reviewer must remove weak, speculative, duplicate, already-handled, self-referential, or non-actionable items before the PR is opened.
6. If all real Sane changes are deferred because they need implementation lanes, keep the best lane-ready recommendations in the PR. Do not collapse the PR down to automation-template cleanup.

Required lanes:
- Public takes lane: X/Twitter, YouTube, transcripts, newsletters, and mirrors. Extract workflow pressure only. Mark every item as commentary unless corroborated.
- Sane prompt-surface lane: AGENTS.md, skills, overlays, custom agents, session hooks, compact prompts, repo-local skills, and prior instruction-surface research. Identify prompt bloat, duplicated policy, stale guidance, and concrete prompt/template changes.
- Token/context lane: token-saving tools, context compaction, prompt caching, retrieval, memory, MCP/tool curation, statusline/context-budget ideas, and repo-state summarization. Identify what Sane can copy without hidden memory or wrapper behavior.
- Codex improvements lane: official OpenAI/Codex docs, release notes, cookbook examples, model docs, Codex app/CLI behavior, Codex repo issues/PRs, skills, plugins, hooks, automations, web search, worktrees, browser/computer-use, and current model/runtime guidance.
- Competitor lane: OpenCode, Superpowers, OpenAgentLayer/Agent Layer, Cursor, Windsurf, Claude Code, Copilot skills, dotagents, and adjacent AGENTS.md / skills / MCP ecosystems. Produce copy / adapt / reject decisions.
- Benchmarks/evals lane: SWE-bench variants, Terminal-Bench, BrowserGym/WebArena/WorkArena, Artificial Analysis, Aider leaderboard, Passmark-style browser evals, agentevals, and any agent-flow eval tools. Map each eval to Sane workflow surfaces; do not use external leaderboards as marketing claims.
- Integration lane: merge findings into exact recommended Sane change IDs, affected surfaces, compatibility notes, verification needs, and main-agent prompt.
- Reviewer lane: classify each candidate privately as implement now, implement through main-agent lane, needs more research, reject, or watch. Only implement-now and implement-through-main-agent-lane items may appear in the main PR decision table.

Each lane output must include:
- direct source links and access dates
- what changed since prior Sane notes
- source class: official docs, repo source, benchmark/eval, competitor pattern, public commentary, or copyable idea
- Sane impact in one sentence
- copyability: direct copy or adapt only for recommended Sane items
- boundary fit: safe for Sane's Codex-native framework boundary; exclude risky or rejected items from the main PR body

Research scope:
- official OpenAI/Codex docs, release notes, cookbook examples, model docs, Codex app/CLI behavior, and OpenAI Codex repository issues/PRs
- Sane's own prompts and exports: root AGENTS.md, packs/core, .agents/skills, custom agents, hooks, overlays, compact prompts, docs/research, docs/plans, docs/decisions
- token-saving/context tools: compaction, prompt caching, retrieval, context windows, memory, MCP/tool curation, repo fact indexes, statusline/context-budget signals
- public takes: X/Twitter, YouTube, transcripts, newsletters, and mirrors, clearly separated from source-backed claims
- competitors: OpenCode, Superpowers, OpenAgentLayer/Agent Layer, Cursor, Windsurf, Claude Code, Copilot skills, dotagents, and adjacent skill/agent frameworks
- benchmarks/evals: SWE-bench variants, Terminal-Bench, BrowserGym/WebArena/WorkArena, Artificial Analysis, Aider leaderboard, Passmark-style browser evals, agentevals, and relevant agent-flow eval tools
- copyable ideas distilled from all lanes, with explicit boundary notes and what must not be copied for each recommended change

Open a draft PR only when there are meaningful Sane product, package, exported-surface, prompt-surface, workflow, eval, or docs changes to recommend. The PR description must include:
- automation notice at the top: "Automated Sane current-practices research run"
- maintainer decision table with change ID, readiness, exact change, affected files/surfaces, signal class, source quality, copyability, boundary fit, risk, verification, and default recommendation
- executive summary that names the recommended merge/review decision
- lane evidence sections:
  - Public Takes
  - Prompt / Instruction Surfaces
  - Token / Context Tools
  - Codex Improvements
  - Competitor Patterns
  - Benchmarks / Evals
  - Copyable Ideas
- prior Sane research rechecked, with file paths and confirmed/stale/contradicted notes
- short "Not included" section only when needed to explain why an obvious tempting idea was excluded
- completed audit notes: what the automation checked before opening the PR
- detailed implementation prompt for a main Codex agent
- suggested lane plan for implementation when work is broad

Evidence rules:
- Follow ETH Zurich / LogicStar AGENTS.md research
  (https://arxiv.org/abs/2602.11988): repository context files often reduce task
  success and increase inference cost when they add unnecessary requirements.
  Treat every new always-loaded instruction as suspect until it has a clear,
  task-relevant payoff.
- Public commentary cannot be sole evidence for a recommended Sane change.
- Benchmarks cannot be used as Sane marketing claims unless Sane ran the exact harness.
- A copyable competitor idea must map to a Sane surface and include what not to copy.
- A recommended Sane change is not actionable unless it names affected files or surfaces, compatibility posture, and verification.
- Automation-template, automation-plan, label, cadence, or prompt-contract changes are not valid current-practices recommendations unless the run is explicitly a maintenance fix for this automation.
- Reject any idea that turns Sane into a daily chat shell, wrapper-first workflow, hidden autonomous mutation loop, or opaque memory system.
- For prompt, `AGENTS.md`, skill, overlay, hook, or agent-template changes:
  - prefer deleting, shortening, splitting, or moving rules behind skills before adding text
  - state expected token/context impact
  - explain why the instruction must be always-loaded or why progressive disclosure is enough
  - require an eval, fixture, or review check when the change could increase always-on context

Committed files should match the recommendation:
- If the recommended change is docs-only or prompt-template-only, make the actual file edits in the branch.
- If the recommended change touches core package behavior, exported surfaces, compatibility, or risky prompt surfaces, keep code changes out of the automation branch and provide a main-agent implementation prompt with exact target files and verification.
- Do not add a large docs/research memo unless it is needed as a compact appendix and the PR body already contains the actionable recommendation detail.
- Do not make documentation changes look like implementation unless the recommended change is actually docs-only.

After opening the PR:
- mark it as draft
- assign lammersbjorn
- add automation and research labels when available
- if labels are missing or permissions block assignment, state that clearly in the PR body and final run summary

Keep Sane's product boundary intact: Sane is a Codex-native framework for install, config, update, export, status, repair, doctor, routing, skills, and workflow guidance. It is not the daily prompting interface, a hidden autonomous mutation loop, or a wrapper-first workflow.

For the main-agent implementation prompt, require:
- re-check current repo state first
- load repo-local skills that match the accepted work
- use sane-agent-lanes and subagents for broad work before edits
- map every recommended item to a concrete Sane surface
- preserve backwards compatibility or write an explicit migration/breaking-change plan
- update docs when behavior, responsibilities, or exported surfaces change
- verify with rtk pnpm test, rtk run 'pnpm typecheck', and rtk pnpm run accept when package/export behavior changes
```

## Draft PR Contract

Title:

```text
research: Sane current-practices update YYYY-MM-DD
```

Body:

```md
> Automated Sane current-practices research run.
> Requested reviewer/assignee: @lammersbjorn.

## Recommended Sane Changes

| ID | Readiness | Exact change | Affected files/surfaces | Signal class | Source quality | Copyability | Boundary fit | Risk | Verification | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | implement now / main-agent lane | One concrete sentence. | Paths or surfaces. | official docs / competitor / benchmark / commentary / repo source | high / medium / low | direct / adapt | safe | low / medium / high | command or review done/needed | approve / edit |

## Executive Summary

One screen or less. Name the concrete Sane changes this PR recommends and the
default maintainer action. Do not make automation-template maintenance the lead.

## Public Takes

Separate commentary from facts. Include direct links, access dates, and what is
corroborated elsewhere.

## Prompt / Instruction Surfaces

Map findings to Sane prompt surfaces: AGENTS.md, skills, overlays, custom
agents, hooks, compact prompts, and docs.

## Token / Context Tools

List token-saving or context-saving ideas that survived review. Mark direct
copy or adapt only, and map each to a Sane product or workflow surface.

## Codex Improvements

Cover current official Codex app/CLI/docs/source changes and Sane impact.

## Competitor Patterns

For each competitor pattern: what they do, what Sane can copy, what Sane must
not copy, and affected Sane surface.

## Benchmarks / Evals

Map evals to Sane workflow surfaces. Do not make marketing claims.

## Copyable Ideas

List portable patterns only when they support a recommended Sane change. Include
boundary notes and what must not be copied.

## Prior Sane Research Rechecked

For each touched prior note:
- path:
- still true:
- stale or contradicted:
- follow-up:

## Completed Audits

List the repo surfaces, prior research files, competitor claims, benchmark
claims, prompt surfaces, token/context tools, and Codex changes the automation
actually checked before opening the PR.

## Not Included

Optional. Keep this short. Include only obvious tempting ideas that were excluded
so reviewers do not wonder whether they were missed.

## Main Agent Implementation Prompt

Paste a complete prompt that a maintainer can hand to a main Codex agent after
review. Include recommended change IDs, lane plan, compatibility constraints,
docs sync, and verification commands.

## Sources

Use direct links. Mark public commentary separately from primary docs, source,
issues, benchmarks, and release notes.
```

## Candidate Handling

- `implement now`: high-confidence, actionable, source-backed change that Sane
  should make now. Only these appear in the main PR recommendation table.
- `main-agent lane`: high-confidence, source-backed change that Sane should make
  next, but broad implementation, exported-surface risk, compatibility, or
  verification means a main Codex agent should implement it after maintainer
  review. These appear in the PR recommendation table with exact target files,
  lane plan, compatibility posture, and verification.
- `needs more research`: plausible but not audit-complete. Keep out of the PR
  unless it is a one-line omission note.
- `watch`: plausible signal without enough evidence. Keep out of the PR unless
  needed as a one-line omission note.
- `reject`: conflicts with Sane's product boundary, lacks evidence, is hype-only,
  or adds hidden automation/mutation. Keep out of the PR unless needed as a
  one-line omission note.

Major code or exported-surface changes should be recommended as `main-agent
lane` items with exact target files and a main-agent implementation prompt, not
implemented directly by the research automation. Backwards compatibility must be
handled through an additive path, migration plan, feature flag, deprecation
window, or explicit breaking-change proposal.

Prompt-surface proposals must also follow the ETH AGENTS.md finding: smaller,
task-relevant context first; generated or broad context last; executable checks
over repeated prose where possible.
