# Sane TODO

High-signal handoff for current `Sane` cleanup. Keep detailed history in dated docs, specs, research notes, and decision logs. Keep this file small enough that next agent can trust it.

## Read First

- `AGENTS.md`
- `.agents/skills/sane-self-hosting/SKILL.md`
- `docs/decisions/2026-04-19-sane-decision-log.md`
- `docs/specs/2026-04-27-codebase-cleanup-current-standards.md`
- `docs/plans/2026-05-04-maintainability-architecture-reset.md`
- `docs/specs/2026-05-02-sane-product-acceptance-standard.md`
- `docs/specs/2026-05-04-source-record-framework-spine.md`
- `docs/specs/2026-04-25-sane-tui-control-center-redesign.md`
- `docs/what-sane-does.md`

Do not re-litigate locked product philosophy unless a new decision log changes it.

## Hard Guardrails

- `Sane` is a Codex framework, not a daily wrapper.
- TUI is for install, configure, update, export, status, repair, uninstall, and setup checks.
- Plain-language outcome flow is primary; no command ritual.
- `AGENTS.md` is optional. Repo mutation is optional.
- Root `AGENTS.md` stays small; targeted behavior belongs in skills and docs.
- Built-in `v1` pack set is fixed: `core`, optional `caveman`, optional `rtk`, optional `frontend-craft`, optional `docs-craft`.
- Current optional pack skill exports include `sane-caveman`, `sane-rtk`, `sane-frontend-craft`, `sane-frontend-visual-assets`, `sane-frontend-review`, and `sane-docs-writing`.
- Later end-to-end outcome runner is future work, not current product surface.
- RTK is mandatory in this repo for shell/search/test/log work.
- Verify release-bound changes with `rtk pnpm run accept`. For narrow non-package changes, use `rtk pnpm test` and `rtk run 'pnpm typecheck'` while RTK native typecheck routing false-exits.

## Verified Current State

- TypeScript-first workspace is active.
- Main packages: `@sane/sane-tui`, `@sane/config`, `@sane/control-plane`, `@sane/framework-assets`, `@sane/state`.
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

## Source-Record Framework Spine

- [x] Land first source-record slice:
  - typed source records for `sane-router`, `sane-agent`, and managed
    `SessionStart`
  - Codex renderer emits artifact objects with `provider`, `path`,
    `mode=file|config`, `ownershipMode`, `hash`, `sourceId`, executable flag,
    structured keys, block marker, provenance, and content
  - manifest-owned artifact plan previews, deploys, and uninstalls the slice in
    fixture roots
  - fixture tests prove deploy, uninstall preservation, stale manifest
    preservation, same-name overwrite blocking, and hook execution
- [x] Extend source records and manifest-owned artifact plan to every Sane
      custom agent: `sane-agent`, `sane-reviewer`, `sane-explorer`,
      `sane-implementation`, and `sane-realtime`
- [x] Extend source records and manifest-owned artifact plan to every core
      skill: `sane-router`, `sane-bootstrap-research`, `sane-agent-lanes`,
      `sane-outcome-continuation`, and `continue`
- [x] Extend source records and manifest-owned artifact plan to global and repo
      `AGENTS.md` managed blocks
- [x] Extend source records and manifest-owned artifact plan to optional pack
      skills, including multi-skill packs and support-file path ownership
- [x] Extend source records and manifest-owned artifact plan to config/profile
      fragments with structured key ownership for `codex-profile` and
      `integrations-profile`
- [x] Extend optional manifest-owned config/profile fragments to
      `cloudflare-profile` and `statusline-profile` when explicitly enabled in
      artifact-plan options
- [x] Add hook runtime v2 guard slice as source records and managed executable
      hooks: command safety, generated-surface edit guard, weak `BLOCKED`
      guard, and optional RTK command guard
- [x] Surface `framework-artifacts` manifest status in Status, Doctor, and
      Repair backend snapshots
- [x] Add per-artifact drift diagnostics for `framework-artifacts` status,
      including changed files, missing hooks, changed config keys, stale
      source ids, and manifest hash drift
- [ ] Extend source-record spine after this slice:
  - route/evidence guard records once Codex exposes stable route payloads

## Next Slice

- [x] Start maintainability architecture reset:
  - baseline metrics on 2026-05-04 local state:
    323 tracked files, 9 workspace package manifests under `apps/` and
    `packages/`, `cloc --vcs=git` 50,361 code LOC across 285 files, and
    18,944 test LOC under `apps/` and `packages/`
  - baseline verification: `rtk pnpm test` passed; `rtk run 'pnpm typecheck'`
    passed; `rtk pnpm test -- --runInBand` failed because Vitest 4 rejects
    `--runInBand`
  - dirty worktree was present before reset work continued; preserve existing
    source-record/hook-runtime slice edits and review them before package moves
  - launched audit lanes for packages, control-plane, framework assets, TUI,
    tests, dead/broken code, instruction surfaces, docs, and source-record
    review
  - keep/move/delete/rewrite decisions are recorded in lane outputs; first
    confirmed delete is `packages/control-plane/src/opencode.ts`
- [x] Continue maintainability architecture reset:
  - [x] collapsed shallow package boundaries into control-plane where they no
        longer needed separate package ownership; current app/package manifests
        are `apps/sane-tui`, `packages/control-plane`, `packages/config`,
        `packages/framework-assets`, and `packages/state`
  - [x] kept `packages/config`, `packages/state`, and
        `packages/framework-assets` after read-only lanes confirmed each owns a
        broad shared contract used by both TUI and control-plane
  - [x] moved control-plane behavior behind feature-owned modules under
        `packages/control-plane/src/features/` with thin compatibility shims and
        focused package subpaths
  - [x] reduced the root control-plane barrel from 642 lines to 144 lines by
        moving runtime installation and inspect/runtime-summary/outcome helpers
        into explicit feature modules
  - [x] moved TUI source imports off the root `@sane/control-plane` barrel when
        focused subpaths exist; remaining root imports are compatibility tests
  - [x] split broad package tests into focused behavior, fixture-root,
        generated-artifact, and smoke tests; removed the obsolete workspace
        package-boundary test
  - [x] shrank first instruction-surface overlap by reducing generated overlay
        templates to routing/trigger pointers; concrete skills own detailed
        lane, continuation, and pack policy
  - [x] wrote `docs/architecture.md` as the current package, feature, import,
        and verification map
  - [x] finished final docs audit and acceptance run; current docs no longer
        point to deleted package boundaries, `docs/architecture.md` is the
        current structure reference, and `rtk pnpm run accept` passed
  - [x] tracked `framework-artifacts-manifest.json` as a durable state-format
        risk in `docs/architecture.md`; `features/framework-artifacts` owns
        schema-sensitive deploy, uninstall, status, and repair coverage
- [ ] Wire remaining channel repos after first stable `v1` tag:
  - winget manifest PR
  - Scoop bucket update PR

## Product Acceptance Hardening

Goal: make Sane's shipped behavior provable end to end, not only documented or
represented by generated files. Keep this work Sane-owned and Codex-native; do
not widen the TUI into a daily prompting interface.

### Acceptance Standard

- [x] Add a dated Sane acceptance standard under `docs/specs/` that defines:
  - one product acceptance command or release gate
  - artifact validity rules for authored, generated, deployed, and installed
    files
  - manifest ownership requirements for full-file writes, marked blocks,
    structured config keys, checksums, executable bits, and source origins
  - fixture-root deploy/uninstall expectations that never touch real user home
  - hook fixture expectations for allowed, blocked, malformed, provider-output,
    and deployed-path execution cases
  - route, command, skill, and custom-agent contract requirements
  - generated/source drift checks
  - negative acceptance cases for placeholders, shallow descriptors,
    metadata-only records, non-executable hooks, unsupported config keys, and
    unsupported model names
- [x] Link the acceptance standard from the active cleanup/spec docs after it is
      written and verified.

### Acceptance Command And Tests

- [x] Decide the public gate is `pnpm accept`, delegating to current
      `release:verify` until the evidence bundle work ships.
- [x] Add a fixture-root acceptance suite for personal Codex exports:
  - user skills
  - global `AGENTS.md` managed block
  - hooks
  - custom agents
  - config profile previews or writes where covered
- [x] Add a fixture-root acceptance suite for optional repo exports:
  - repo skills
  - repo `AGENTS.md` managed block
  - repo agents, when enabled
  - bundle-level coverage remains blocked: `exportAll` / `uninstallAll` are
    intentionally personal Codex bundle operations today; repo exports are
    explicit commands and need a separate repo-bundle API decision before they
    belong in all-in-one lifecycle tests.
- [x] Prove bundle uninstall preserves user-owned skill and hook content while
      removing Sane-owned global-agent and hook content.
- [x] Prove repeated bundle uninstall is idempotent in a temp fixture root.
- [x] Extend idempotency fixture coverage to repeated deploy and repo exports.
- [x] Add negative tests that fail when generated artifacts are shallow,
      placeholder-only, metadata-only, or disconnected from source.

### Manifest And Provenance

- [x] Audit current manifest data against the acceptance standard.
- [x] Ensure generated/deployed artifacts expose source origin where the user or
      repair/status flow needs it.
- [x] Track ownership mode for core pack source-managed and generated-managed
      asset files in the manifest.
- [x] Extend ownership mode to marked blocks and structured config keys across
      export, status, repair, and uninstall.
- [x] Confirm current managed hooks do not depend on managed `.mjs`
      hook/runtime files or executable-bit preservation; inline exported
      commands execute directly in fixture roots.
- [x] Add drift tests for generated/exported surfaces against canonical pack
      source.

### Done In Acceptance Slice

- [x] Added `docs/specs/2026-05-02-sane-product-acceptance-standard.md` and
      linked it from the active cleanup spec.
- [x] Added bundle lifecycle test for preserving unmanaged skill/hook content
      and repeated uninstall behavior.
- [x] Added core pack asset ownership metadata, parser validation, accessors,
      and malformed-ownership tests.
- [x] Added config capability classification for warning-only/display-only
      Codex config surfaces, including `tui.theme`.
- [x] Added direct custom-agent contract assertions and shallow generated asset
      negative tests.
- [x] Added managed hook fixture tests for allowed, blocked, malformed,
      provider-output, and inline execution behavior.
- [x] Added repeated personal deploy and explicit repo export idempotency
      fixture tests.
- [x] Added optional skill support-file, executable helper-script, and
      non-shallow operational body audits.
- [x] Added command descriptor execution-contract and validation-expectation
      audits.
- [x] Added custom-agent hook/guardrail contract wording and tests.
- [x] Aligned CI, npm publish, and GitHub Release artifact workflows on the
      public `pnpm run accept` gate.
- [x] Confirmed optional pack provenance is surfaced in Status/Inspect, core
      asset source provenance is manifest-backed, managed block markers are
      fixture-tested, and structured Codex config writes preserve unmanaged
      keys.
- [x] Verified with:
  - `rtk pnpm run accept`
  - `rtk vitest packages/control-plane/test/bundles.test.ts`
  - `rtk vitest packages/control-plane/test/codex-config.test.ts`
  - `rtk vitest packages/control-plane/test/codex-native-hooks-custom-agents.test.ts`
  - `rtk vitest packages/control-plane/test/codex-native-skills-agents.test.ts`
  - `rtk vitest packages/framework-assets/test/framework-assets.test.ts`
  - `rtk vitest apps/sane-tui/test/command-metadata-registry.test.ts`
  - `rtk vitest packages/control-plane/test/inspect-presenter.test.ts apps/sane-tui/test/command-metadata-registry.test.ts apps/sane-tui/test/ink-terminal.test.ts packages/control-plane/test/inventory.test.ts packages/control-plane/test/inspect.test.ts`

### Hook And Route Quality Gates

- [x] Add fixture tests for managed hooks:
  - allowed input
  - blocked input
  - malformed input
  - inline exported command execution
  - provider-specific output shape
- [x] Add or document safety-hook backlog for:
  - destructive command guard
  - secret and credential guard
  - protected branch guard
  - environment-file read guard
  - unsafe git operation guard
  - generated-file edit guard
- [x] Add route/completion gate backlog for:
  - explanation-only completion rejection on edit-required routes
  - execution-evidence requirement on execution-required routes
  - weak `BLOCKED` rejection unless attempted/evidence/need are present
  - repeated failure circuit
  - large diff warning
  - test failure loop guard

### Config And Capability Policy

- [x] Audit Codex config profile output for deprecated or compatibility-only
      keys and replace them with current supported keys where applicable.
- [x] Validate emitted config keys against the current control-plane parser and
      focused tests where practical.
- [x] Make every enabled capability tied to Sane-owned behavior and every
      disabled capability tied to a control reason.
- [x] Classify warning-only/display-only adjacent Codex config surfaces:
      `features.memories`, enabled `plugins.*`, unmanaged `mcp_servers.*`, and
      `tui.theme`.
- [x] Evaluate explicit support for `tools_view_image`, hook/profile features,
      and a separate long-runtime profile before documenting them as shipped.
- [x] Keep default continuity scoped to `.sane` state; do not make native memory
      systems the default continuity path without a separate decision.

### Agent, Skill, And Route Contracts

- [x] Audit generated custom-agent templates for:
  - [x] exact trigger conditions
  - [x] non-goals
  - [x] tool/write/sandbox contract
  - [x] model route
  - [x] allowed skills
  - [x] route ownership
  - [x] hook/guard expectations
  - [x] workflow
  - [x] validation behavior
  - [x] final output contract
- [x] Audit skills for support-file preservation, executable helper scripts, and
      non-shallow operational bodies.
- [x] Audit TUI/CLI command descriptors so commands include actionable
      execution contracts and validation expectations instead of only labels.

### Release And Git Hygiene

- [x] Keep release verification aligned across npm, GitHub Release assets,
      Homebrew, winget, and Scoop surfaces.
- [x] Add drift checks for release artifacts and exported framework assets.
- [x] Evaluate optional git-workflow policy for canonical AI co-author trailers
      and malformed-domain blocking without making it a default repo mutation.

## Agent Working Rules

- Make durable decisions in docs, not only chat.
- Prefer small verified slices.
- Sync public docs when behavior or product boundaries change.
- Keep README short and public-facing.
- Keep historical planning in dated docs, not this file.
- Never describe Sane repo self-hosting as required for user repos.
- Do not add managed surfaces without preview, status visibility, uninstall, and docs.
