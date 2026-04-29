# Sane Repo Notes

Keep this file small. Repo-specific detail belongs in targeted skills, not in always-on root guidance.

## Product Frame

- `Sane` is an agent framework for Codex.
- The TUI is for install, configure, update, export, status, repair, and doctor flows. It is not the normal prompting interface.
- No required command ritual, wrapper-first flow, or mandatory repo mutation.
- `AGENTS.md` is an optional product surface. Do not treat this repo's self-hosting setup as a default every repo should copy.

## Startup Rules

- RTK is mandatory in this repo. Prefer RTK-native commands (`rtk grep`, `rtk read`, `rtk diff`, `rtk pnpm`, `rtk test`, `rtk git`); use `rtk run '<command>'` only when no native command fits.
- Use repo files and current local state before guessing from chat or memory.
- For product, architecture, self-hosting, or exported-surface work, load `.agents/skills/sane-self-hosting/SKILL.md`.

## Verify

- Default release-bound verify: `rtk pnpm run release:verify`.
- For narrow non-package changes, use `rtk pnpm test` and `rtk run 'pnpm typecheck'`. Current RTK native typecheck routing can false-exit while reporting no TypeScript errors, so avoid `rtk pnpm typecheck` until that wrapper is repaired.

## Done Means

- Changed behavior is verified with matching local checks.
- Docs are synced when product behavior, responsibilities, or exported surfaces changed.
- Keep going until there is a real blocker or explicit user pause.

<!-- sane:repo-agents:start -->
# Sane

- Sane repo overlay. Repo `AGENTS.md`, repo-local skills, current worktree, and runtime state are project truth.
- Prefer repo-local evidence over memory or stale chat context.
- Keep always-on context small; load docs and skills only when they answer the current task.
- Use `sane-router` for Sane routing unless a concrete repo-local skill already matches.
- Load `continue` and `sane-outcome-continuation` by trigger only.
- For broad work or follow-up implementation, load `sane-agent-lanes`; follow its lane, handoff, edit-boundary, and auth gates.
- Use the repo's own verify commands before claiming success.
- Coordinator owns final judgment on subagent output.
- Caveman pack active: load `sane-caveman` for prose rules
- RTK pack active: load `sane-rtk` for shell/search/test/log routing
- Frontend-craft pack active: load the matching frontend skill for UI, asset, or visual-review work

<!-- sane:repo-agents:end -->
