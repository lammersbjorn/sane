# Sane Current-Practices Refresh

Date: 2026-05-04

Status: proposal source for a draft PR; no implementation in this document

## Executive Summary

Useful findings exist. Sane should make a few small, near-term adjustments, but
the product boundary should not move.

Accept now:

- Refresh Sane's Codex-surface audit for current config, hooks, skills,
  plugins, worktrees, browser/computer-use, and automation signals before the
  next package/export behavior change.
- Tighten OpenCode export validation around skill frontmatter, skill discovery
  paths, agent permissions, and task-permission semantics.
- Add status/doctor visibility for Codex hook representation conflicts and
  project trust boundaries where Sane manages or recommends hook/config
  surfaces.
- Treat Sane automations as reviewed maintenance prompts, not a hidden outcome
  runner.

Proposal only:

- Explore a minimal Codex plugin packaging experiment for Sane skills only after
  the current native export surface is stable and reversible.
- Add optional "automation recipe" docs for recurring Sane maintenance tasks.
- Add cross-client export manifest notes for OpenCode, Windsurf, Claude Code,
  Agent Layer, and dotagents compatibility, without becoming a cross-client
  wrapper.

Watch:

- Native Codex Automations, cloud triggers, computer use, in-app browser,
  managed memory, plugin marketplace, stable route payloads, and hook event
  growth.
- Benchmark divergence across SWE-bench, Terminal-Bench, BrowserGym/WebArena,
  Aider, and browser-agent evals.

Reject:

- Daily wrapper UX.
- Mandatory repo mutation or generated mega-`AGENTS.md`.
- Sane-managed default global memory.
- Hidden autonomous mutation loops.
- Benchmark marketing claims without Sane-owned eval evidence.

## Source Map

Access date for all external sources: 2026-05-04.

### Repo Truth

- `README.md`: Sane is a Codex-native framework around prompting; `sane` is the
  install/status/repair/control surface, not the normal prompting interface.
- `TODO.md`: hard guardrails keep Sane out of wrapper-first, command-ritual, and
  hidden runner territory; current packages are `apps/sane-tui`,
  `packages/control-plane`, `packages/config`, `packages/framework-assets`, and
  `packages/state`.
- `docs/what-sane-does.md`: current surfaces are skills, overlays, custom
  agents, optional hooks, narrow config profiles, optional packs, thin `.sane`
  state, and optional OpenCode export.
- `docs/architecture.md`: current source of package/import truth after the
  maintainability reset.
- `packs/core/manifest.json`: current v1 pack truth includes `core`,
  `caveman`, `rtk`, `frontend-craft`, and `docs-craft`.

### External Sources

- OpenAI Codex app launch:
  https://openai.com/index/introducing-the-codex-app/
- OpenAI Codex upgrades:
  https://openai.com/index/introducing-upgrades-to-codex/
- OpenAI Codex `AGENTS.md` docs:
  https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex skills docs:
  https://developers.openai.com/codex/skills
- OpenAI Codex plugins docs:
  https://developers.openai.com/codex/plugins
- OpenAI Codex config reference:
  https://developers.openai.com/codex/config-reference
- OpenAI Codex hooks docs:
  https://developers.openai.com/codex/hooks
- OpenAI skills catalog:
  https://github.com/openai/skills
- OpenAI Codex GitHub issues:
  https://github.com/openai/codex/issues
- OpenCode skills docs:
  https://opencode.ai/docs/skills/
- OpenCode agents docs:
  https://opencode.ai/docs/agents/
- Windsurf memories/rules docs:
  https://docs.windsurf.com/windsurf/cascade/memories
- Windsurf skills docs:
  https://docs.windsurf.com/windsurf/cascade/skills
- Windsurf hooks docs:
  https://docs.windsurf.com/windsurf/cascade/hooks
- Claude Code subagents docs:
  https://code.claude.com/docs/en/sub-agents
- Claude Code hooks docs:
  https://code.claude.com/docs/en/hooks
- Superpowers:
  https://github.com/obra/superpowers
- Agent Layer:
  https://agent-layer.dev/
- dotagents:
  https://dotagents.sentry.dev/
- SWE-bench official leaderboards:
  https://www.swebench.com/
- Terminal-Bench:
  https://www.tbench.ai/
- Terminal-Bench 2.0 leaderboard:
  https://www.tbench.ai/leaderboard/terminal-bench/2.0
- BrowserGym leaderboard:
  https://huggingface.co/spaces/ServiceNow/browsergym-leaderboard
- Aider leaderboards:
  https://aider.chat/docs/leaderboards/
- Public commentary, marked as commentary:
  - https://www.kajda.com/blog/delete-your-agents-md-context-management/
  - https://macaron.im/blog/codex-app-skills-automations
  - https://thenewstack.io/open-source-coding-agents-like-opencode-cline-and-aider-are-solving-a-huge-headache-for-developers/
  - https://agentmarketcap.ai/blog/2026/04/08/webarena-live-browsergym-2026-web-navigation-benchmarks

## Source-Backed Findings

### 1. Codex app makes parallel agents, worktrees, skills, plugins, and automations first-class

OpenAI positions the Codex app as a command center for supervising multiple
agents, isolated worktrees, long-running tasks, skills, plugins, and scheduled
automations that land in a review queue. This confirms Sane's direction: Sane
should manage Codex-native setup, status, repair, routing, skills, and packs,
then let Codex remain the daily work surface.

Implication: accept now. Update Sane research/docs and status language to
recognize Codex Automations as a host surface Sane can prepare prompts for, not
as a reason to ship a hidden Sane runner.

Compatibility and migration notes: no breaking change. Existing users keep
using Codex normally. Any new automation docs must be additive and label
automations as reviewed maintenance prompts.

### 2. Codex config grew more explicit around trust, skills, tools, web search, service tier, and image viewing

The Codex config reference now documents keys Sane should audit against current
emitted profiles: `skills.config`, `tools.view_image`,
`profiles.<name>.web_search`, `profiles.<name>.service_tier`,
`tool_suggest.*`, `projects.<path>.trust_level`, `sqlite_home`,
`project_doc_max_bytes`, and `project_doc_fallback_filenames`.

Implication: accept now. Add a current config-capability audit before changing
Sane profile output. Classify each key as managed, warning-only, display-only,
or rejected.

Compatibility and migration notes: preserve unmanaged Codex config keys. If a
key moves from warning-only to managed, require preview, backup, restore,
status, repair, and uninstall coverage first.

### 3. Codex hooks are mature enough to inspect more carefully, but not enough for hidden autonomy

Codex hooks can be sourced from user and project layers, project-local hooks
depend on trust, multiple sources are merged, and docs warn against mixing
`hooks.json` and inline `[hooks]` in one layer. Sane already has optional hooks
and hook status. It should add conflict/trust visibility before adding new hook
classes.

Implication: accept now. Status/doctor should report hook-source conflicts and
trusted-project gating when Sane-managed hook behavior depends on project
layers.

Compatibility and migration notes: read-only warning first. Do not rewrite
unmanaged hook files. Managed hook changes still need manifest ownership,
fixture-root deploy/uninstall coverage, and Windows/WSL notes.

### 4. Skills are converging across Codex, OpenCode, Windsurf, Claude Code, and public marketplaces

Codex, OpenCode, Windsurf, Superpowers, dotagents, and Agent Layer all treat
`SKILL.md`-style folders as reusable workflow units with short discovery
metadata and full content loaded only when relevant. OpenCode explicitly
supports `.agents/skills` and validates frontmatter `name` and `description`.
Windsurf also discovers `.agents/skills`.

Implication: accept now for validation, proposal only for broader cross-client
surface. Sane should keep `.agents/skills` as the portable skill source, and
its OpenCode export should validate skill names/descriptions against OpenCode
rules.

Compatibility and migration notes: stricter validation can surface warnings
before blocking exports. Existing Sane skill names already match lowercase
hyphen rules.

### 5. Competitors are moving from prose-only agents to permissioned, scoped agents

OpenCode agents distinguish primary agents and subagents, with per-agent model,
permissions, task permissions, and read-only explore behavior. Claude Code
subagents support scoped tools, model/effort, hooks, MCP, memory, background
mode, and worktree isolation. Superpowers packages multi-step TDD, worktrees,
subagents, review, and finishing workflows across agents.

Implication: proposal only. Sane's lane model is aligned, but exported Sane
agents should be audited for permission clarity and task-permission language
across Codex and OpenCode. Do not copy Claude Code's larger subagent surface
until Codex exposes equivalent stable fields.

Compatibility and migration notes: keep current Sane agent names and roles.
Prefer status warnings or docs over breaking agent template changes.

### 6. Memory systems remain useful but unsafe as Sane's default continuity layer

Windsurf recommends rules or `AGENTS.md` for durable reusable knowledge instead
of relying on autogenerated memories. Cursor memories require approval before
save. Claude Code exposes explicit memory scopes for agents. Prior Sane
research already rejected default global memory dependency.

Implication: confirmed. Keep `.sane` thin local state as the canonical Sane
continuity layer. Watch Codex native memory/Chronicle surfaces, but do not
manage them by default.

Compatibility and migration notes: no migration. If native memory support is
added later, it must be opt-in, inspectable, reversible, and repo-scoped.

### 7. Benchmarks show scaffold and workflow matter as much as model choice

SWE-bench is still a central software-engineering benchmark, but it now has
many variants and scaffold filters. Terminal-Bench 2.0 lists Codex CLI with
GPT-5.5 at the top on 2026-04-23, while other agents using strong models land
nearby. BrowserGym/WebArena and WorkArena measure different capabilities than
SWE-bench. Aider leaderboards remain useful for edit-loop comparison, not a
complete agent-flow eval.

Implication: accept now for research policy, watch for product claims. Sane
should not market itself with external benchmark scores. It should preserve its
own acceptance/eval gate and use external benchmarks only to shape workflows:
terminal recovery, browser verification, subagent lanes, and scaffold quality.

Compatibility and migration notes: no user-facing migration. Any future Sane
eval feature should use Sane-owned fixtures and report exact harnesses.

### 8. Public commentary reinforces review queues, small instruction files, and versioned skills

Commentary only: recent public posts and videos repeat three themes: long
`AGENTS.md`/`CLAUDE.md` files can harm context quality; Codex automations need
human review before merge; skills should be version-controlled instead of saved
only in an app UI. These are corroborated by official docs and Sane's existing
research, but the commentary itself should not be treated as authority.

Implication: confirmed. Keep root guidance small. Keep skills in versioned
files. Keep automation outputs review-gated.

Compatibility and migration notes: no migration. Avoid clickbait framing in
Sane docs.

## Prior Sane Research Review

Confirmed:

- `docs/research/2026-04-23-codex-instruction-surface-rules.md`: minimal
  always-on context, progressive disclosure, one job per skill, executable
  checks over repeated prose.
- `docs/research/2026-04-23-codex-continuity-and-statusline-audit.md`: keep
  `.sane` state as the default continuity path; avoid Sane-owned statusline
  product surface.
- `docs/research/2026-04-25-lifecycle-hooks.md`: hooks should be opt-in,
  inspectable, reversible, and privacy-scoped.
- `docs/research/2026-04-25-codex-plugin-and-frontend-craft-shape.md`: skills
  remain the workflow authoring surface; plugin packaging is not yet Sane's
  primary product shape.
- `docs/research/2026-04-25-agent-flow-evals.md`: browser and terminal evals
  inform workflow design but should not become unsupported marketing claims.

Stale or needs refresh:

- `docs/research/2026-04-19-model-subagent-matrix.md`: model names and routing
  defaults are time-sensitive. Re-check before changing exported agent
  templates.
- `docs/research/2026-04-19-mcp-default-tool-audit.md`: Codex plugin/app,
  tool-suggest, web search, and connector surfaces have moved.
- `docs/research/2026-04-25-recent-public-takes.md`: useful as prior corpus,
  but Codex app/automation signals now have stronger official confirmation.

Contradicted by current repo truth:

- `docs/decisions/2026-04-19-sane-decision-log.md` still names a smaller v1
  optional pack set in one historical section. Current `README.md`,
  `TODO.md`, and `packs/core/manifest.json` include `docs-craft`; current repo
  truth wins.
- Older package-list language in the decision log predates the architecture
  reset. Current architecture is in `docs/architecture.md`.

## Proposed Changes

### Accept Now

1. Current Codex surface audit.
   - Scope: config keys, hooks, skills, plugins, worktrees, browser/computer
     use, automations, and app/CLI behavior relevant to Sane.
   - Migration: docs/research first; code only after key classification.
   - Verification: `rtk pnpm test`, `rtk run 'pnpm typecheck'`; `rtk pnpm run
     accept` if package/export behavior changes.

2. Hook-source and trust visibility.
   - Scope: status/doctor warning when Sane sees mixed hook representations or
     project-local hook behavior blocked by trust state.
   - Migration: warning-only first; do not rewrite unmanaged hook config.
   - Verification: focused control-plane status/doctor tests plus typecheck.

3. OpenCode export validation.
   - Scope: validate Sane-exported skill names/descriptions and agent
     permission/task-permission assumptions against current OpenCode docs.
   - Migration: emit warnings before blocking user exports.
   - Verification: OpenCode export tests plus framework asset drift tests.

4. Automation prompt docs.
   - Scope: add reviewed maintenance prompt patterns for Sane automations,
     including "current-practices research" and "release-channel follow-up".
   - Migration: docs only. Explicitly state Codex app review queue or human
     PR review remains required.
   - Verification: docs diff review.

### Proposal Only

1. Minimal Codex plugin packaging experiment.
   - Scope: package Sane skills as a plugin artifact for discovery/install, not
     the TUI/control plane.
   - Migration: keep native export path primary. Plugin must not claim to own
     Sane settings, status, repair, or update flows.
   - Verification: plugin artifact tests, install/uninstall smoke, and docs.

2. Cross-client export manifest notes.
   - Scope: document how Sane-owned `.agents/skills`, OpenCode exports, and
     generated surfaces relate to Agent Layer, dotagents, Windsurf, and Claude
     Code.
   - Migration: no wrapper. Keep Sane as Codex-native with optional OpenCode
     export.
   - Verification: docs/source-record parity only unless code changes.

3. Sane-owned eval fixture refresh.
   - Scope: add or update fixture tasks that test lane handoff, hook warnings,
     browser verification expectations, and automation-review prompts.
   - Migration: no external benchmark claims.
   - Verification: policy/acceptance tests.

### Watch

- Codex cloud-triggered automations.
- Codex route/evidence payloads for stable route guard records.
- Codex managed memory/Chronicle behavior and scoping.
- Codex plugin marketplace maturity for full Sane distribution.
- Native browser/computer-use capabilities for frontend-craft verification.
- Hook events and project trust behavior across app, CLI, IDE, and Windows.
- OpenCode permission/task-permission changes.
- Agent Layer and dotagents adoption for shared `.agents` source-of-truth
  conventions.
- BrowserGym/WebArena/WorkArena, Terminal-Bench 3.0, SWE-bench variants, Aider
  leaderboards, and passmark-style browser evals.

### Reject

- Making Sane the daily chat or prompting shell.
- Mandatory `sane` wrapper before using Codex.
- Mandatory repo `AGENTS.md` or repo mutation.
- Generated broad repo summaries as always-on context.
- Sane-managed default memory injection.
- Hidden autonomous background mutation.
- Automatic merge from automations.
- Benchmark leaderboard claims without Sane-owned runs and exact harnesses.
- Public third-party Sane plugin API in v1.

## What Should Not Change

- Sane remains Codex-native first.
- TUI remains install/config/update/export/status/repair/doctor/uninstall.
- Codex remains the normal work surface.
- Root `AGENTS.md` remains small.
- Skills remain targeted and progressively disclosed.
- Broad work still uses lane plans and subagent handoff.
- `.sane` state remains thin, local, and operational.
- Optional packs remain opt-in.
- OpenCode support remains file export scope unless a separate decision expands
  it.

## Main-Agent Implementation Prompt

Use this prompt for the implementation PR after this proposal is reviewed:

```text
Implement the accepted items from docs/research/2026-05-04-current-practices-refresh.md without changing Sane's product boundary.

Before edits:
1. Re-check current repo state first: AGENTS.md, README.md, TODO.md, docs/architecture.md, docs/what-sane-does.md, packs/core/manifest.json, packages/control-plane, packages/framework-assets, packages/config, packages/state, and apps/sane-tui.
2. Load repo-local skills matching the work: sane-router, sane-self-hosting, sane-rtk, sane-docs-writing for docs, and sane-agent-lanes for broad work.
3. Use sane-agent-lanes and subagents before broad edits. Start with read-only lanes for Codex surface audit, OpenCode export validation, hook/status behavior, and docs impact.
4. Preserve backwards compatibility. If any exported artifact, config key, hook shape, skill metadata, agent template, or state format changes, write an explicit migration/breaking-change plan before implementation.
5. Keep unmanaged user config preserved. New managed keys require preview, backup, status, repair, restore, uninstall, and fixture coverage.
6. Update docs when behavior, responsibilities, or exported surfaces change.

Accepted work:
- Add a current Codex surface audit and classify new/changed config, hook, skill, plugin, automation, worktree, browser/computer-use, and trust surfaces as managed, warning-only, display-only, watch, or rejected.
- Add warning-only status/doctor visibility for hook-source representation conflicts and project trust gating when Sane-managed hooks/config depend on those surfaces.
- Tighten OpenCode export validation against current OpenCode skill and agent docs, starting warning-only if existing user exports may be affected.
- Add docs for reviewed Sane automation prompt patterns, making clear that automation output must land in review and is not a hidden Sane runner.

Suggested lane plan:
- Lane A, Codex surface audit, read-only: docs/config/hooks/plugins/app source map and key classification.
- Lane B, OpenCode export validation, implementation: packages/control-plane OpenCode export helpers and tests.
- Lane C, hook/status visibility, implementation: packages/control-plane status/doctor inventory and tests.
- Lane D, docs automation prompts, implementation: docs only.
- Lane E, reviewer, read-only: classify findings as confirmed, needs-verify, or rejected.

Verification:
- For docs-only slices: inspect diff.
- For package/export behavior changes: rtk pnpm test, rtk run 'pnpm typecheck', and rtk pnpm run accept.
- For focused package work: run the relevant package tests first, then whole-repo checks before final.
```

## Suggested Lane Plan For Broad Work

| Lane | Owner | Scope | Write Boundary | Test First | Verify | Review |
| --- | --- | --- | --- | --- | --- | --- |
| Codex audit | Explorer | Current Codex docs/source/config/hooks/plugins/app surfaces | Read-only | N/A | Source map | Coordinator |
| OpenCode validation | Implementation | OpenCode export helpers and tests | `packages/control-plane`, export tests | Add failing validation/warning test | Focused tests, typecheck | Reviewer |
| Hook visibility | Implementation | Status/doctor hook conflict and trust warnings | `packages/control-plane` status/inventory tests | Add failing status test | Focused tests, typecheck | Reviewer |
| Automation docs | Implementation | Reviewed automation prompt docs | `docs/` only | N/A | Diff review | Reviewer |
| Final review | Reviewer | Integrated diff and docs | Read-only | N/A | `rtk pnpm test`, `rtk run 'pnpm typecheck'`, `rtk pnpm run accept` when needed | Coordinator |

## Expected Verification Commands

Docs-only proposal PR:

```bash
rtk diff
```

Implementation PR with package/export behavior:

```bash
rtk pnpm test
rtk run 'pnpm typecheck'
rtk pnpm run accept
```

Focused implementation checks should run before whole-repo checks.
