# Codebase Cleanup To Current Standards

Date: 2026-04-27

Purpose:
- clean up the post-feature-buildout mess without reopening settled product philosophy
- make docs, TODO, package READMEs, tests, and code names match the current product surface
- preserve research and historical context while stopping stale planning text from acting like active spec

## Outcome

The repo should be easy for the next agent or maintainer to enter:

- current product behavior is discoverable from README, `docs/what-sane-does.md`, and active specs
- historical docs are clearly marked as historical
- unstable claims, especially model availability, live in dated research notes
- `TODO.md` is a live handoff, not a giant changelog
- package READMEs explain current ownership and verification
- code remains TypeScript-first, Codex-native, additive, reversible, and setup/ops-focused

## Sources Of Truth

Use in this order:

1. `AGENTS.md`
2. `.agents/skills/sane-self-hosting/SKILL.md`
3. `docs/decisions/2026-04-19-sane-decision-log.md`
4. `docs/what-sane-does.md`
5. `docs/specs/2026-04-25-sane-tui-control-center-redesign.md`
6. dated research notes only for their dated evidence

`TODO.md` is not a spec. It is a live work queue and handoff.
`packs/core/skills/vendor/` content is reference-only unless the manifest explicitly exports it.

## Current Standards

### Product Boundary

- `Sane` is a Codex framework with setup, status, repair, install/export, and uninstall surfaces.
- TUI is not the normal prompting interface.
- No required wrapper command, repo mutation, `AGENTS.md`, or command ritual.
- Later end-to-end outcome runner remains future work and should be named consistently.
- Internal `advance_outcome` and readiness plumbing must not be marketed as current autonomous execution.

### Docs

- Public docs prefer stable capability language over dated runtime claims.
- Dated model-picker findings stay in research docs and are described as dated.
- Use current TUI labels: `Home`, `Settings`, `Add to Codex`, `Status`, `Repair`, `Uninstall`.
- `inspect` may appear only as internal API or legacy compatibility alias, not primary user-facing copy.
- Older specs must be clearly historical if they still contain prescriptive language.

### Packs And Skills

- Fixed `v1` built-in pack set: `core`, optional `caveman`, optional `rtk`, optional `frontend-craft`.
- Optional exported skills now include:
  - `sane-caveman`
  - `sane-rtk`
  - `sane-frontend-craft`
  - `sane-frontend-visual-assets`
  - `sane-frontend-review`
- Docs must not describe `rtk` as capability-only while the manifest exports `sane-rtk`.

### Code

- Keep package boundaries as current TypeScript workspace boundaries.
- Prefer shared control-plane/status/runtime helpers over ad hoc reads.
- Keep TUI app model separate from renderer/runtime detail.
- Preserve compatibility aliases only where tests or scripts require them.
- Do not add broad dependencies or new managed surfaces as part of cleanup.

## Work Plan

1. Normalize live docs and handoff:
   - shrink `TODO.md`
   - update README and walkthrough wording
   - clarify historical specs
   - sync package README verification examples
2. Check code/docs for stale user-facing labels:
   - allow internal `inspect*` names
   - allow compatibility alias notes
   - fix public-facing leaks
3. Run verification:
   - `rtk pnpm test`
   - `rtk pnpm typecheck`
4. Repair only failures caused by cleanup or obvious current-standard drift.
5. Leave B17 visual QA as next slice unless verification exposes a blocking TUI issue.

## Acceptance Criteria

- `TODO.md` is under control and points to active sources.
- README and `docs/what-sane-does.md` agree on current vs future product surface.
- Optional pack docs match `packs/core/manifest.json`.
- Active TUI docs use `Status` and `Settings`; older `Inspect` / `Preferences` wording is historical or compatibility-only.
- Verification passes, or exact remaining blocker is recorded.

## Managed-Surface Drift Checklist

- [x] Managed-surface docs include optional plugin artifact paths: `~/.codex/plugins/sane/` and `~/.agents/plugins/marketplace.json`.
- [x] `What Sane Writes` / managed-surface tables match backend managed targets and `export_all` vs `export_plugin` boundary.
- [x] Public docs keep internal runner/state-plumbing details out of current shipped capability lists.
- [x] User-facing docs use current TUI labels (`Status`, `Settings`) and keep `inspect*` wording internal or historical-only.
- [ ] Any managed-surface addition ships with preview/status visibility, uninstall behavior, and docs update in same slice.
