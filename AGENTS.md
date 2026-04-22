# Sane Repo Notes

Keep this file small. Repo-specific detail belongs in targeted skills, not in always-on root guidance.

## Product Frame

- `Sane` is an agent framework for Codex.
- The TUI is for install, configure, update, export, inspect, repair, and doctor flows. It is not the normal prompting interface.
- No required command ritual, wrapper-first flow, or mandatory repo mutation.
- `AGENTS.md` is an optional product surface. Do not treat this repo's self-hosting setup as a default every repo should copy.

## When Working On Sane Itself

- Load the repo skill: `.agents/skills/sane-self-hosting/SKILL.md`.
- Before changing product direction or architecture, read:
  - `docs/decisions/2026-04-19-sane-decision-log.md`
  - `docs/specs/2026-04-19-sane-design.md`
  - `docs/specs/2026-04-19-sane-backend-contract.md`
  - `docs/specs/2026-04-20-sane-tui-redesign.md`
  - `TODO.md`
