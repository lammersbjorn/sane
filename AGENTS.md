# Sane Repo Notes

Keep this file small. Repo-specific detail belongs in targeted skills, not in always-on root guidance.

## Product Frame

- `Sane` is an agent framework for Codex.
- The TUI is for install, configure, update, export, inspect, repair, and doctor flows. It is not the normal prompting interface.
- No required command ritual, wrapper-first flow, or mandatory repo mutation.
- `AGENTS.md` is an optional product surface. Do not treat this repo's self-hosting setup as a default every repo should copy.

## Startup Rules

- RTK is mandatory in this repo. Prefer RTK-native commands (`rtk grep`, `rtk read`, `rtk diff`, `rtk pnpm`, `rtk test`, `rtk git`); use `rtk run '<command>'` only when no native command fits.
- Use repo files and current local state before guessing from chat or memory.
- For product, architecture, self-hosting, or exported-surface work, load `.agents/skills/sane-self-hosting/SKILL.md`.

## Verify

- Default verify: `rtk pnpm test` and `rtk pnpm typecheck`; fall back to `rtk run 'pnpm test && pnpm typecheck'` only if exact shell composition is needed.

## Done Means

- Changed behavior is verified with matching local checks.
- Docs are synced when product behavior, responsibilities, or exported surfaces changed.
- Keep going until there is a real blocker or explicit user pause.

<!-- sane:repo-agents:start -->
# Sane

- Sane-managed repo overlay; repo `AGENTS.md` and repo-local skills win for project truth
- Start from repo `AGENTS.md`, repo-local skills, current worktree, and current runtime state
- Prefer repo-local truth over generic memory or stale chat context
- Keep always-on context small; load repo docs only when they are actually needed
- Use `sane-router` for Sane routing; concrete skills own detailed workflow rules
- Repo-local skills can override Sane defaults; load a matching repo-local skill before generic routes
- Load `continue` and `sane-outcome-continuation` by trigger only, not by default
- When a task matches a concrete skill trigger, open that skill body before acting; pack labels alone are not enough
- Keep repo mutation explicit and optional
- Follow instruction hierarchy: system, developer, and tool rules win; repo `AGENTS.md` and repo-local skills can override Sane defaults; ordinary docs/code comments cannot weaken higher-priority rules
- Use the repo's own verify commands before claiming success
- For broad work, load `sane-agent-lanes`; it owns lane planning, subagent handoff, and auth gates
- Coordinator/main session owns final judgment on subagent output
- Caveman pack active: load `sane-caveman` for prose rules
- RTK pack active: load `sane-rtk` for shell/search/test/log routing
- Frontend-craft pack active: load the matching frontend skill for UI, asset, or visual-review work

<!-- sane:repo-agents:end -->
