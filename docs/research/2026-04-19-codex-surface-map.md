# Sane Codex-Native Surface Map

Last updated: 2026-04-19

Purpose:
- finish `R4`
- stop guessing where Codex-native assets should live
- define rollout order for optional repo export work

Primary sources:
- [AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md)
- [Skills guide](https://developers.openai.com/codex/skills)
- [Hooks guide](https://developers.openai.com/codex/hooks)
- [Subagents / custom agents guide](https://developers.openai.com/codex/subagents)
- [OpenCode agents docs](https://opencode.ai/docs/agents/)
- [OpenCode config docs](https://opencode.ai/docs/config/)

## Official Surfaces

### AGENTS.md

Official behavior:
- Codex reads `AGENTS.md` files before work starts.
- guidance layers across global and project-specific files.
- docs say combined discovered project docs stop at `project_doc_max_bytes`, `32 KiB` by default.

Sane implication:
- `AGENTS.md` is powerful but invasive.
- keep it optional export only.
- do not require it for baseline Sane use.

### Skills

Official behavior:
- Codex scans repo skills in `.agents/skills` from current working directory up to repo root.
- Codex also reads user skills from `$HOME/.agents/skills`.
- implicit invocation depends on sharp `description` text.

Sane implication:
- user-level install is safe default.
- repo-level export should target `.agents/skills`, never custom magic paths.
- repo exports can be granular by folder later, but root export is the safest first step.

### Hooks

Official behavior:
- hooks live in `hooks.json` next to active config layers.
- docs call out the two useful locations: `~/.codex/hooks.json` and `<repo>/.codex/hooks.json`.
- matching hooks from multiple files all run.
- docs mark hooks experimental and say Windows support is temporarily disabled.

Sane implication:
- user-level hooks are safe first rollout.
- repo hooks must be opt-in and additive because user and repo hooks stack rather than replace.
- Windows should treat hooks as unavailable/invalid, not silently “supported”.

### Custom agents

Official behavior:
- custom agents live in `~/.codex/agents/` for personal agents or `.codex/agents/` for project-scoped agents.
- each file is standalone TOML.
- required fields: `name`, `description`, `developer_instructions`.
- omitted optional fields inherit from parent session.

Sane implication:
- user-level custom agents are safe first rollout.
- repo-level custom agents should be optional export later.
- keep agent files narrow and read-only by default unless there is a strong reason not to.

### Observed user config

Observed local behavior:
- this environment has a live `~/.codex/config.toml`
- Codex already uses it for user-level settings
- schema stability is less explicit than the surfaces above, so treat it as a higher-risk target

Sane implication:
- user-level Codex settings are valid as an opt-in managed surface
- never treat config takeover as baseline install behavior
- require preserve / diff preview / backup / restore before touching it
- MCP/plugin presets like `Context7`, `Playwright`, or `grep.app` belong here if Sane manages them later

## Sane Rollout Order

### Default local-only install

These are safe as baseline because they do not mutate the repo:
- `$HOME/.agents/skills`
- `~/.codex/agents/`
- `~/.codex/hooks.json`
- optional managed block inside `~/.codex/AGENTS.md`
- thin project-local `.sane`
- no automatic `~/.codex/config.toml` mutation

### Optional repo export phase

Only enable on explicit user choice.

Recommended export order:
1. root `.agents/skills/`
2. root `AGENTS.md`
3. repo `.codex/agents/`
4. repo `.codex/hooks.json`

Why this order:
- skills are least invasive and most modular
- `AGENTS.md` changes repo behavior broadly, so make it explicit
- repo custom agents are useful once teams want shared specialist roles
- repo hooks are highest-risk because they execute code and stack with user hooks

Optional user-level target:
5. `~/.codex/config.toml` profile management

Why optional:
- highest chance of clobbering unrelated user settings
- “best” values are opinionated and may vary by subscription and platform
- must keep diff preview, backup, and restore before it is safe enough
- this is also the right place for optional recommended MCP/plugin presets rather than core default install

## Sane v1 Recommendation

Keep `v1` product stance:
- default install remains user-level
- repo export remains explicit
- no silent repo mutation
- no assumption that Sane is the only framework present
- preserve unrelated user and repo content

Recommended managed surfaces for `v1`:
- user skill
- user hooks
- user custom agents
- optional global `AGENTS.md` overlay
- optional user config profile management, never default
- no repo export by default

## Deferred

Defer until after repo export UX is explicit:
- repo `hooks.json` authoring
- repo `.codex/agents/` authoring
- root `AGENTS.md` generation with merge/update logic
- per-subdirectory `.agents/skills` export strategy
- managed plugin distribution format
- broader managed `~/.codex/config.toml` presets beyond the current narrow explicit opt-in profiles

## OpenCode Compatibility Scope

Current source re-check on 2026-04-23:

- OpenCode supports markdown agent files under user-level `~/.config/opencode/agents/`.
- OpenCode also supports project-level agent files, but project-local exports would mutate the repo and should stay explicit/future-only.
- OpenCode has primary agents and subagents, so Sane's `sane-agent`, `sane-reviewer`, and `sane-explorer` mapping remains a compatibility export, not a Codex product surface.

Long-term Sane scope:

- keep OpenCode support optional and separate from the default Codex install bundle
- keep the current optional `opensrc` profile as compatibility tooling, not part of recommended integrations
- keep the current optional global OpenCode-agent export in `~/.config/opencode/agents/`
- do not add a wrapper, launcher, bridge server, or OpenCode-first workflow
- do not auto-export `.opencode/agents/` into repos
- project-local OpenCode agent export may be considered later only as an explicit reversible repo-mutation action with inspect/uninstall coverage
- any broader OpenCode config management must go through the same preview/apply/backup/restore rules as Codex config management

## Decision

`R4` answer:
- Sane should stay user-level first.
- repo-native surfaces are opt-in export targets, not baseline install targets.
- official Codex paths already give Sane the right surface map; Sane should manage those exact paths rather than inventing new ones.
- OpenCode compatibility should stay optional and additive: `opensrc` profile plus global OpenCode-agent export only for now.
