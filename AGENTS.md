# Sane Repo Notes

Keep this file small. Repo-specific detail belongs in targeted skills, not in always-on root guidance.

## Product Frame

- `Sane` is an agent framework for Codex.
- The TUI is for install, configure, update, export, inspect, repair, and doctor flows. It is not the normal prompting interface.
- No required command ritual, wrapper-first flow, or mandatory repo mutation.
- `AGENTS.md` is an optional product surface. Do not treat this repo's self-hosting setup as a default every repo should copy.

## Startup Rules

- RTK is mandatory in this repo. Route shell work through `rtk`.
- Use repo files and current local state before guessing from chat or memory.
- For product, architecture, self-hosting, or exported-surface work, load `.agents/skills/sane-self-hosting/SKILL.md`.

## Verify

- Default verify: `rtk run 'pnpm test && pnpm typecheck'`
- If you touch legacy Rust paths, also run: `rtk run 'cargo test'`

## Done Means

- Changed behavior is verified with matching local checks.
- Docs are synced when product behavior, responsibilities, or exported surfaces changed.
- Keep going until there is a real blocker or explicit user pause.
