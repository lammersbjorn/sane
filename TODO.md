# Sane TODO

High-signal handoff for current `Sane` cleanup. Keep detailed history in dated docs, specs, research notes, and decision logs. Keep this file small enough that next agent can trust it.

## Read First

- `AGENTS.md`
- `.agents/skills/sane-self-hosting/SKILL.md`
- `docs/decisions/2026-04-19-sane-decision-log.md`
- `docs/specs/2026-04-27-codebase-cleanup-current-standards.md`
- `docs/specs/2026-04-25-sane-tui-control-center-redesign.md`
- `docs/what-sane-does.md`

Do not re-litigate locked product philosophy unless a new decision log changes it.

## Hard Guardrails

- `Sane` is a Codex framework, not a daily wrapper.
- TUI is for install, configure, update, export, status, repair, uninstall, and setup checks.
- Plain-language outcome flow is primary; no command ritual.
- `AGENTS.md` is optional. Repo mutation is optional.
- Root `AGENTS.md` stays small; targeted behavior belongs in skills and docs.
- Built-in `v1` pack set is fixed: `core`, optional `caveman`, optional `rtk`, optional `frontend-craft`.
- Current optional pack skill exports include `sane-caveman`, `sane-rtk`, `sane-frontend-craft`, `sane-frontend-visual-assets`, and `sane-frontend-review`.
- Later end-to-end outcome runner is future work, not current product surface.
- RTK is mandatory in this repo for shell/search/test/log work.
- Verify release-bound changes with `rtk pnpm run release:verify`. For narrow non-package changes, use `rtk pnpm test` and `rtk run 'pnpm typecheck'` while RTK native typecheck routing false-exits.

## Verified Current State

- TypeScript-first workspace is active.
- Main packages: `@sane/sane-tui`, `@sane/config`, `@sane/control-plane`, `@sane/core`, `@sane/framework-assets`, `@sane/platform`, `@sane/policy`, `@sane/state`.
- Root public start scripts build and run the TypeScript TUI path.
- TUI sections are `Home`, `Settings`, `Add to Codex`, `Status`, `Repair`, and `Uninstall`.
- Launch behavior is part of the contract: first run opens guided Home, installed no-args opens Status, `sane install` opens the guided wizard, and `sane status` opens Status.
- Compatibility aliases may remain for scripts/internal APIs, but user-facing docs should use `Status` naming.
- Managed Codex surfaces include user skills, optional repo skills, optional repo `AGENTS.md`, global `AGENTS.md`, hooks, custom agents, and narrow Codex config profiles.
- User-stable preferences stay narrow: model/reasoning defaults, pack toggles, privacy level, and update preference in `.sane/config.local.toml`.
- `.sane` state stays thin: local config, handoff/runtime state, history, summaries, backups, and optional telemetry state.
- Recent blocker/readiness checks use Sane-owned `.sane` state only; no raw Codex log mining claims.
- Codex plugin artifact packaging is deferred from `v1`; `export_all` remains the core Codex-native install bundle.
- The autonomous/end-to-end outcome runner is not shipped.

## Active Cleanup Spec

Source: `docs/specs/2026-04-27-codebase-cleanup-current-standards.md`

Acceptance:
- docs name one current product surface and one future outcome-runner boundary
- README and walkthrough avoid unstable model-picker claims except by linking to dated research
- `TODO.md` remains a live handoff, not a historical changelog
- stale TUI names (`Inspect`, `Preferences`, `Get Started`) appear only in historical docs, compatibility notes, tests, or internal API names
- optional pack docs match the manifest
- package READMEs describe current responsibilities and verification commands
- tests and typecheck pass or failures are recorded with exact blockers

## Now

- [x] Create current cleanup spec for this pass
- [x] Reduce `TODO.md` to live state, guardrails, and next slices
- [x] Move unstable model-picker wording out of README product copy
- [x] Align optional pack docs with current `sane-rtk` skill export
- [x] Make `apps/sane-tui/README.md` prefer `status` in verification commands
- [x] Mark the older April 20 TUI spec as historical-only
- [x] Run full test and typecheck baseline after doc cleanup
- [x] Fix verification regression from `inspect` -> `status` smoke-script rename
- [x] Run whole-repo audit lanes for TUI, packages/packs/plugins, and docs/file structure
- [x] Remove ignored generated noise (`.turbo`, `apps/sane-tui/dist`, `docs/.DS_Store`, `.playwright-mcp`)
- [x] Add `.playwright-mcp/` to ignored local artifacts
- [x] Collapse duplicated TUI compact-label logic into shared presentation normalizer
- [x] Remove unused TypeScript symbols found by strict unused check
- [x] Mark vendored frontend skill mirrors as reference-only
- [x] Add explicit API-boundary notes for TUI and control-plane barrels
- [x] Fix Tokscale Stop hook stdout to emit valid Codex hook JSON

## Done In Current Slice

- [x] Larger API hardening:
  - reduced `@sane/control-plane` and `@sane/sane-tui` exports toward stable public symbols
  - kept compatibility aliases only at explicit subpath boundaries where needed
  - added package boundary tests
- [x] Pack prose generation hardening:
  - manifest/router/overlay policy prose derives from one canonical `policyNote` source
  - generated/exported surfaces are drift-tested
- [x] Finish B17 TUI visual QA/polish:
  - added text smoke checks for `sane install`, `sane`, `sane settings`, `sane status`, editor modal, read-only notice modal, and confirmation modal at compact, normal, and wide sizes
  - fixed installed-repo `sane install` so Home shows current setup lines instead of dead filler
  - shortened editor header/help copy for compact terminals
  - kept Settings editor field list visible when width allows
  - removed remaining user-facing internal agent terms from live TTY copy
- [x] Add settings portability:
  - export Sane settings to `.sane/settings.portable.json`
  - import Sane settings from portable file
  - support install from exported settings
- [x] Prepare packaging/distribution rollout for `v1`:
  - [x] GitHub Release artifact verification and asset upload (`.tgz`, `.zip`, `SHA256SUMS.txt`)
  - [x] npm publish gate for `sane-codex` (manual workflow, secret + environment required)
  - [x] Homebrew tap updater workflow trigger from tagged GitHub Release assets
  - [x] winget artifact/update plan stub
  - [x] Scoop artifact/update plan stub

## Next Slice

- [ ] Wire channel repos after first stable `v1` tag:
  - Verify `HOMEBREW_TAP_TOKEN` and first triggered tap update
  - winget manifest PR
  - Scoop bucket update PR

## Agent Working Rules

- Make durable decisions in docs, not only chat.
- Prefer small verified slices.
- Sync public docs when behavior or product boundaries change.
- Keep README short and public-facing.
- Keep historical planning in dated docs, not this file.
- Never describe Sane repo self-hosting as required for user repos.
- Do not add managed surfaces without preview, status visibility, uninstall, and docs.
