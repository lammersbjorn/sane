# Maintainability Architecture Reset Plan

Date: 2026-05-04

Status: proposed next major cleanup track, updated for current local state

Purpose:
- reduce Sane's file, package, and public API count
- make the codebase easier to read, change, test, and explain
- replace package-per-concern architecture with a modular monolith organized by product capability
- keep Sane's product boundary intact: a Codex framework with install, configure, update, export, status, repair, and doctor flows

This plan supersedes the package-preserving cleanup stance in
`docs/specs/2026-04-27-codebase-cleanup-current-standards.md` for future
maintainability work. That older spec remains useful as historical context and
as a record of the current shipped product surface.

## Current Problem

Sane is small as a product but large as a codebase.

Observed baseline from the 2026-05-04 audit, refreshed after the local
source-record and hook-runtime work:

- 323 tracked files
- about 50.3k `cloc` code lines
- about 18.5k test LOC under `apps/` and `packages/`
- 7 internal packages plus the TUI app package
- largest source concentrations:
  - `packages/control-plane`: about 16.8k LOC
  - `apps/sane-tui`: about 12.2k LOC
  - `packages/state`, `packages/policy`, and `packages/framework-assets` each carry package, test, and export overhead

The main maintainability issue is not raw LOC. It is too many shallow seams:

- many package boundaries for one deployable CLI product
- a god-like `control-plane` package that owns most backend behavior
- TUI internals split by renderer/registry/shell layers rather than by the work a maintainer is trying to change
- tests that defend package/export boundaries more than user-visible behavior
- duplicated instruction surfaces between `packs/core`, `.agents`, root guidance, and repo-local skills
- likely dead, broken, or half-working surfaces that have accreted while product direction changed
- tests so broad that maintainers must update large files for small behavior changes

## Research Inputs

Use these principles as the cleanup frame:

- Martin Fowler's "Monolith First": microservice-style decomposition has a premium and works best after real boundaries are known.
  <https://martinfowler.com/bliki/MonolithFirst.html>
- Sam Newman's decomposition guidance: decompose incrementally around coupling, cohesion, and explicit goals.
  <https://samnewman.io/books/monolith-to-microservices/>
- DHH's monolith recovery stance: small focused teams often move faster with a well-structured monolith than with premature service or package splits.
  <https://world.hey.com/dhh/how-to-recover-from-microservices-ce3803cc>
- Sandi Metz on wrong abstractions: duplication is cheaper than the wrong abstraction; inline and delete wrong abstractions before extracting new ones.
  <https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction>
- John Ousterhout's "deep modules" lens: prefer simple interfaces that hide meaningful complexity over many shallow interfaces.
  <https://system-design.space/en/chapter/philosophy-design-book/>
- TypeScript/monorepo guidance: extract packages only when they need independent versioning, build, runtime, or consumers.
  <https://www.pkgpulse.com/blog/javascript-monorepos-2026-best-practices-pitfalls>
- X/Twitter engineering decomposition lessons: decomposition can improve ownership, but also creates new coupling and coordination costs.
  <https://blog.x.com/engineering/en_us/topics/infrastructure/2020/accelerating-ad-product-development-at-twitter.html>
- GitLab's test strategy guidance: choose the lowest test level that gives confidence, then move upward only when needed.
  <https://docs.gitlab.com/development/testing_guide/testing_strategy/>
- Vitest testing guidance: keep tests focused and use the right test mode for the behavior, not the implementation seam.
  <https://main.vitest.dev/guide/learn/testing-in-practice>
- Superpowers competitor pattern: one skill/test concern is tested by small focused scripts or one package-level test, while broad work is handled by subagent/TDD/review workflow rather than giant architecture-guard suites.
  <https://github.com/obra/superpowers>

## Competitor Testing Notes

OpenAgentLayer and Superpowers both avoid Sane's current testing shape.

OpenAgentLayer's local clone has one focused `__tests__` file per package plus
one `tests/e2e.test.ts`. This is still package-oriented, but the test surface is
shallow and easy to locate:

```text
packages/accept/__tests__/accept.test.ts
packages/adapter/__tests__/adapter.test.ts
packages/artifact/__tests__/artifact.test.ts
packages/cli/__tests__/cli.test.ts
tests/e2e.test.ts
```

Superpowers uses behavior and workflow scripts rather than many TypeScript
contract tests. Its tests are organized around skill triggering, explicit skill
requests, plugin sync, OpenCode behavior, and subagent-driven development
fixtures. It also states the workflow principle clearly: design first, small
implementation tasks, TDD, subagent execution, and review checkpoints.

Sane should not copy either repo literally. Sane has more generated artifacts and
managed filesystem behavior. But Sane should copy the testing posture:

- small behavior tests close to the behavior
- thin end-to-end smoke tests for installed/exported user journeys
- explicit fixture-root tests for filesystem writes
- no broad tests that encode large internal object shapes unless the shape is a public contract
- subagent review and focused verification for each code-quality slice

## Target Architecture

Move to one primary package and a modular monolith source tree.

Target shape:

```text
src/
  cli/
    main.ts
    commands.ts

  tui/
    model/
    render/
    input/
    actions/

  features/
    install/
    export/
    status/
    repair/
    config/
    runtime-state/
    codex/
    opencode/

  framework/
    assets/
    packs/
    overlays/
    skills/

  lib/
    result.ts
    paths.ts
    fs.ts
    toml.ts
    version.ts

tests/
  features/
  tui/
  fixtures/

packs/
docs/
```

Target metrics:

| Metric | Current | Target |
| --- | ---: | ---: |
| tracked files | 323 | 180-220 |
| internal packages | 7 + app | 1 app/package, maybe 1 asset package if packaging proves it |
| TS source/test files under app/packages | about 180 | 90-120 |
| test LOC | about 18.5k | 9k-12k |
| public subpath exports | many | minimal |
| instruction surfaces | duplicated | one source per rule |

## Architecture Rules

1. No package unless it is independently published, built, versioned, or consumed by external code.
2. Organize by product capability before technical layer.
3. Prefer `features/export` over generic names like `control-plane`.
4. Public APIs must be few and intentional.
5. Feature internals may import `src/lib/*`; cross-feature imports go through a feature public entrypoint.
6. Avoid barrels except at feature boundaries.
7. Prefer plain functions and data tables over registry frameworks.
8. Allow local duplication until the shared concept is obvious.
9. Delete wrong abstractions before creating new ones.
10. Tests should prove behavior, not protect obsolete architecture.
11. `packs/core` is the distributable source of truth; `.agents` is local generated/exported output unless explicitly marked otherwise.
12. The TUI remains an install/config/status/repair/update/export surface, not the normal prompting interface.
13. Every broad refactor phase uses subagents. The main lane coordinates, reviews, integrates, and unblocks; it does not do broad implementation unless crucial.
14. Every feature folder gets a code-quality audit before or during migration: intent, actual callers, broken paths, dead exports, tests, and deletion candidates.
15. Delete non-working or unused code instead of preserving it as architecture.

## Required Subagent Lanes

The reset must be subagent-driven. Launch lanes for each major piece before
implementation starts. Each lane returns exact paths, confirmed problems,
recommended deletions/refactors, tests to keep, tests to delete, and verification
commands.

Required read-only research lanes:

| Lane | Scope | Output |
| --- | --- | --- |
| Package collapse | `packages/core`, `packages/platform`, `packages/config`, `packages/state`, `packages/policy` | Move/delete map and dependency risks |
| Control-plane features | `packages/control-plane/src` and tests | Feature ownership map, dead/broken surfaces, migration order |
| Framework assets | `packages/framework-assets`, `packs/core`, `.agents` | Source-of-truth map, generated-output boundaries, drift risks |
| TUI quality | `apps/sane-tui/src` and tests | Broken flows, over-split render/model seams, simpler target API |
| Test reset | all test files | Tests to keep, rewrite, split, or delete; new test taxonomy |
| Dead code | exports, scripts, commands, hooks, docs references | Unused/broken candidates with evidence |
| Docs finalizer | README, TODO, docs, package READMEs | Docs to update after final structure lands |
| Reviewer | final integrated diff | Findings classified as `confirmed`, `needs-verify`, or `rejected` |

Implementation lanes should own disjoint write boundaries. If boundaries are not
clear, do another explorer lane before editing.

## Phase 0: Baseline And Safety

Goal: freeze current behavior before moving files.

Tasks:

- Record baseline file count, package count, and `cloc` output.
- Run:

```bash
rtk pnpm test
rtk run 'pnpm typecheck'
```

- If baseline fails, record exact failure and decide whether it blocks the reset.
- Do not start broad moves without a green or explicitly accepted baseline.

Acceptance:

- baseline metrics are recorded in the implementation notes or PR body
- baseline test/typecheck status is known
- unrelated dirty worktree changes are identified and left untouched
- current dirty user work is listed and protected

## Phase 0.5: Code Reality Audit

Goal: prove what is used, broken, duplicated, or safe to delete before moving it.

Tasks:

- For every package and TUI area, launch a read-only subagent to answer:
  - what does this code claim to do?
  - who calls it?
  - what user behavior depends on it?
  - what is only used by tests?
  - what is broken, stale, or not wired to shipped behavior?
  - what can be deleted instead of moved?
- Use static checks where useful:
  - import/export grep
  - package script references
  - CLI command references
  - docs references
  - test-only usage checks
- Produce a deletion-first map before migration.

Acceptance:

- each source area has a keep/move/delete/rewrite decision
- dead or broken surfaces are not blindly preserved during the monolith move
- migration order prioritizes deleting unused code before moving live code

## Phase 1: Collapse Internal Packages

Goal: remove package overhead that does not match real product boundaries.

Move into `src/lib`:

- `packages/core`
- `packages/platform`
- `packages/config`
- shared filesystem and TOML helpers from `packages/state`

Move into `src/features/runtime-state`:

- runtime state persistence from `packages/state`
- policy preview/runtime readiness logic from `packages/policy`

Move into `src/features/*`:

- `packages/control-plane/src/codex-*` -> `src/features/codex`
- `packages/control-plane/src/opencode-*` -> `src/features/opencode`
- `packages/control-plane/src/install-*`, `bundles.ts`, artifact planning, and
  `framework-artifact-plan.ts` -> `src/features/install` and
  `src/features/export`
- `packages/control-plane/src/safety-guard-hooks.ts`, hook matchers, hook
  runtime records, and managed executable hook builders ->
  `src/features/codex` or `src/features/export`, depending on final ownership
- `packages/control-plane/src/status-*`, `inventory.ts`, presenters, and
  `framework-artifacts` manifest status/drift reporting ->
  `src/features/status`
- `packages/control-plane/src/repair-*` -> `src/features/repair`
- `packages/control-plane/src/preferences.ts`, config profile helpers -> `src/features/config`

Decide during the phase:

- keep `packages/framework-assets` only if packaging/build evidence proves it must remain separate
- otherwise move it to `src/framework`

Acceptance:

- remove obsolete `package.json`, `tsconfig.json`, `vitest.config.ts`, and package READMEs for collapsed packages
- remove workspace dependencies on collapsed packages
- imports use local feature/lib paths, not `@sane/*` internal packages
- package count is reduced materially
- focused tests pass for moved behavior
- `framework-artifacts-manifest.json` has an explicit schema/version owner in
  the new structure

Verification:

```bash
rtk grep '@sane/core|@sane/platform|@sane/config|@sane/state|@sane/policy|@sane/control-plane' src apps packages
rtk pnpm test
rtk run 'pnpm typecheck'
```

## Phase 2: Replace The God Control Plane With Features

Goal: make each product capability readable without opening a central backend package.

Tasks:

- Delete or empty the old control-plane barrel after callers migrate.
- Give each feature one public entrypoint and local internals.
- Move fixtures and tests to `tests/features/<feature>` or feature-owned test groups.
- Convert "presenter" and "status" helper names to feature-specific names where useful.
- Remove compatibility aliases unless a script, package export, or public command still needs them.
- Move `framework-artifact-plan`, source-record rendering, inventory exposure,
  repair exposure, and safety guard hook behavior before TUI simplification.
  TUI status rows should consume a stable backend contract, not a moving package
  seam.

Acceptance:

- a maintainer can find install/export/status/repair/config behavior by folder name
- no feature imports another feature's private files
- no central `index.ts` re-exports most of the product
- tests prove CLI/user behavior rather than old package entrypoints
- status/doctor/repair behavior for `framework-artifacts` is feature-owned and
  fixture-backed

## Phase 3: TUI Simplification

Goal: keep the TUI modular, but with fewer and more obvious seams.

Current hotspots:

- `apps/sane-tui/src/ink-terminal.ts`
- `apps/sane-tui/src/text-renderer.ts`
- `apps/sane-tui/src/shell.ts`
- `apps/sane-tui/src/command-registry-commands.ts`
- `apps/sane-tui/src/app-view.ts`
- `apps/sane-tui/src/app-view-helpers.ts`

Target folders:

```text
src/tui/
  model/
  render/
  input/
  actions/
```

Tasks:

- Move command execution from `shell.ts` into domain action handlers.
- Make the command registry a data source, not a policy and help-text framework.
- Split command metadata by product section or generate it from one manifest.
- Extract shared formatting decisions used by Ink and text renderers.
- Delete duplicate compact-label/layout logic.
- Keep render adapters thin: model in, terminal/text output out.

Acceptance:

- `shell` no longer acts as a backend dispatcher
- Ink and text renderers share formatting rules where behavior should match
- command metadata is easy to scan by section
- TUI tests still cover launch modes, editor modal, confirmation modal, and compact/normal/wide text smoke checks

Verification:

```bash
rtk pnpm --filter @sane/sane-tui test
rtk run 'pnpm typecheck'
```

After package collapse, replace the filter with the new root test command.

## Phase 4: Test Diet

Goal: replace broad brittle tests with focused behavior tests.

Current pain:

- `packages/state/test/state-parity.test.ts` is too large and encodes too many
  legacy/current format details in one file.
- `packages/framework-assets/test/framework-assets.test.ts` is growing into a
  giant artifact-shape test.
- `packages/control-plane/test/*` mixes user behavior, package export contracts,
  generated artifact audits, and implementation details.
- `apps/sane-tui/test/*` often tests render-model internals and command metadata
  seams rather than stable user journeys.

Target test taxonomy:

| Test type | Purpose | Preferred size |
| --- | --- | --- |
| Unit behavior | pure functions, parsers, guards, command handlers | tiny, one behavior |
| Feature contract | install/export/status/repair/config behavior at feature boundary | focused, fixture-backed |
| Fixture filesystem | managed writes, uninstall, drift, permissions, ownership | realistic temp roots |
| CLI smoke | installed command paths and high-value user journeys | thin, few cases |
| TUI smoke | launch modes, modals, compact/normal/wide text output | few stable assertions |
| Generated artifact audit | source-to-render drift and shallow-output failures | generated from manifest where possible |

Rules:

- Prefer lowest-level test that proves the behavior.
- One test file should usually own one behavior family, not a whole package.
- Avoid broad snapshots and broad object-shape assertions unless the object is a public contract.
- Avoid tests that only assert package/export boundaries scheduled for deletion.
- Avoid over-mocking. Use real code and fixture roots unless external IO makes that impossible.
- Add a failing focused test before changing behavior; for pure refactors, keep existing behavior tests green and delete only obsolete architecture tests after replacement coverage exists.

Delete or rewrite after corresponding architecture is gone:

- `apps/sane-tui/test/workspace-package-boundaries.test.ts`
- `packages/state/test/state-parity.test.ts`
- `packages/framework-assets/test/framework-assets.test.ts`
- package export and boundary tests for removed packages
- compatibility tests for aliases that no longer exist
- broad tests that only pass because they mirror current implementation structure

Split first, then delete:

- `packages/framework-assets/test/framework-assets.test.ts` into focused files:
  - framework manifest contract
  - source record contract
  - Codex artifact rendering
  - one small end-to-end parity smoke
- `packages/control-plane/test/codex-native-hooks-custom-agents.test.ts` into:
  - managed hook export/install behavior
  - command sanitizer and inline runtime guard helpers
  - safety guard hook behavior
- `packages/control-plane/test/inventory.test.ts`,
  `packages/control-plane/test/repair-status.test.ts`, and
  `packages/control-plane/test/bundles.test.ts` so each asserts
  `framework-artifacts` as one public status/repair contract rather than
  mirroring artifact-plan internals.

Keep or rebuild:

- install/export lifecycle fixture tests
- status and repair behavior tests
- destructive action safety tests
- managed artifact ownership tests
- CLI smoke tests
- TUI launch and rendering smoke tests
- config parsing/coercion tests
- safety hook behavior tests
- source-record/artifact-plan behavior tests, split by artifact family instead of one giant file

Acceptance:

- test LOC drops materially
- tests fail for real user-visible regressions
- tests do not require preserving obsolete package boundaries
- small code changes no longer require editing large unrelated test files
- test names describe behavior, not implementation containers

Verification:

```bash
rtk pnpm test
rtk run 'pnpm typecheck'
rtk pnpm run accept
```

## Phase 5: Instruction Surface Diet

Goal: remove duplicated instruction code and clarify generated vs source surfaces.

Tasks:

- Make `packs/core` the source of truth for distributable skills, overlays, agents, and hooks.
- Treat `.agents` as generated/local output unless a file is explicitly repo-local.
- Keep root `AGENTS.md` small and repo-specific.
- Make `sane-router` only route.
- Make `sane-agent-lanes` own broad-work lane policy.
- Make `continue` own continuation behavior only.
- Make `sane-self-hosting` own Sane-specific product work only.
- Make `sane-caveman` opt-in unless user config explicitly enables it.

Acceptance:

- one owner per rule
- no duplicated lane policy in router/continue/root overlays
- generated surfaces are drift-tested from pack source
- optional packs have clear activation semantics

## Phase 6: Developer Experience

Goal: make the repo easy to operate after the collapse.

Tasks:

- Simplify root scripts to:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm accept
```

- Remove obsolete workspace and package scripts.
- Add one `docs/architecture.md` with current module boundaries and import rules.
- Add an import-boundary check if lightweight enough.
- Update README and package/distribution docs only after behavior is stable.
- Add or document a dead-code check path if a lightweight tool fits the final structure.

Acceptance:

- new contributor can understand code layout from one short architecture doc
- no stale package READMEs remain
- no scripts reference deleted packages
- release gate still works

## Phase 7: Final Docs Audit

Goal: make all docs match the final codebase.

Tasks:

- Audit and update `README.md`, `TODO.md`, `docs/what-sane-does.md`, active specs, active plans, package/app docs, contribution/support docs, and architecture docs.
- Remove or mark stale package-boundary docs.
- Ensure docs describe current behavior and the final source tree, not the old package layout.
- Keep historical specs historical; do not rewrite old decisions as if they were current.
- Confirm all commands, package names, paths, and verification steps exist.

Acceptance:

- all current docs agree on product boundary and repository structure
- no docs point users to deleted packages or old command names
- `TODO.md` is a short current handoff, not a changelog
- `docs/architecture.md` is the main structure reference

## Implementation Order

Recommended order:

1. Phase 0 baseline.
2. Phase 0.5 code reality audit with subagents.
3. Delete confirmed dead or broken surfaces that are not shipped behavior.
4. Collapse `packages/policy` first because it is single-consumer and future-facing.
5. Collapse `core`, `platform`, and `config` into `src/lib`.
6. Collapse `state` into `src/lib` and `src/features/runtime-state`.
7. Move `control-plane` by product capability.
8. Re-home TUI into `src/tui` after backend imports stabilize.
9. Replace broad tests with focused behavior tests.
10. Delete obsolete tests and package configs.
11. Shrink instruction surfaces.
12. Simplify DX scripts and write final architecture doc.
13. Run final docs audit.

Avoid a big-bang rewrite. Use branch-by-abstraction only where needed: keep
temporary re-export shims during a phase, then delete them before phase
acceptance.

## Release And Risk Notes

This is internal architecture work, but it affects packaging, exports, tests,
and generated surfaces. Treat final completion as release-significant even if
behavior is unchanged.

Risks:

- large move-only diffs can hide behavior changes
- TypeScript path and package export changes can break built package smoke tests
- generated/exported surfaces may drift if `framework-assets` moves
- `framework-artifacts-manifest.json` becomes a durable state format alongside
  existing `.sane` state
- source record `sourceId` or `hash` changes can orphan uninstall, repair, and
  stale-manifest behavior if not migrated deliberately
- safety guard hooks can look installed while command builders or matchers do
  not actually run in the expected host payload shape
- TUI tests may churn if render model boundaries change

Mitigations:

- run focused tests after each phase
- keep move-only commits separate from behavior edits
- delete temporary compatibility shims quickly
- preserve fixture-root deploy/uninstall coverage
- keep schema versioning and fixture-root coverage around
  `framework-artifacts-manifest.json`
- require subagent verification lanes for control-plane, framework-assets,
  state helpers, TUI presentation, and test reset before broad edits
- run `rtk pnpm run accept` before declaring the track complete

## Autonomous Goal Prompt

Use this prompt with the experimental `/goal` command:

```text
/goal Make Sane easier to maintain by refactoring it into a smaller modular monolith without changing shipped behavior.

Tasks:
1. Follow docs/plans/2026-05-04-maintainability-architecture-reset.md as the source plan.
2. Always use subagents/lanes for broad work. Main lane coordinates, reviews, integrates, and unblocks only unless main-lane work is crucial and tightly scoped.
3. Record baseline metrics: tracked files, package count, cloc, test LOC, test status, typecheck status, dirty worktree.
4. Launch research subagents for every major area: packages, control-plane, framework assets, TUI, tests, dead/broken code, instruction surfaces, docs.
5. For each area, decide keep/move/delete/rewrite before moving code. Delete confirmed unused or broken surfaces instead of preserving them.
6. Collapse internal packages that do not need independent publishing/build/versioning into one src/ tree.
7. Reorganize backend code by product capability: install, export, status, repair, config, runtime-state, codex, opencode.
8. Remove the control-plane god package/barrel once behavior is feature-owned.
9. Simplify TUI into clear model, render, input, and actions areas.
10. Replace broad brittle tests with small behavior tests, fixture-root tests, thin CLI/TUI smoke tests, and generated-artifact audits.
11. Delete or rewrite tests that only defend obsolete package/export boundaries.
12. Shrink instruction surfaces so each rule has one owner and generated/local outputs are not treated as source.
13. Simplify scripts and write docs/architecture.md for the final structure.
14. At the very end, audit and update all docs so README, TODO, specs, plans, package docs, and architecture docs match the new structure and product behavior.
15. After each phase, run focused tests and typecheck.
16. Before finishing, run rtk pnpm test, rtk run 'pnpm typecheck', and rtk pnpm run accept.

Done means fewer packages/files, smaller public API, feature-owned code, dead/broken code removed, tests easier to maintain, behavior preserved, all docs current, and before/after metrics reported.
```
