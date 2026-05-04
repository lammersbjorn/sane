# Architecture

Sane is a Codex-native framework. The repo builds the install, configuration,
status, repair, export, and uninstall surfaces that manage Sane's Codex assets.
The terminal UI is the control surface for those flows. It is not the normal
prompting interface.

## Workspace Layout

The current workspace has five app/package manifests under `apps/` and
`packages/`:

| Path | Package | Responsibility |
| --- | --- | --- |
| `apps/sane-tui` | `@sane/sane-tui` | Terminal control surface, command routing, view models, text/Ink rendering, input handling, and CLI dispatch into the control plane. |
| `packages/control-plane` | `@sane/control-plane` | Backend behavior for install, config, status, doctor, repair, export, uninstall, runtime summaries, Codex/OpenCode asset operations, platform path discovery, policy preview, and small shared runtime primitives. |
| `packages/config` | `@sane/config` | Broad shared configuration contracts: saved Sane settings, model/reasoning defaults, optional pack toggles, privacy/update preferences, and Codex environment detection. |
| `packages/framework-assets` | `@sane/framework-assets` | Checked-in pack assets, source records, manifest metadata, render helpers, and drift checks for skills, overlays, agents, hooks, profile fragments, and Codex/OpenCode artifacts. |
| `packages/state` | `@sane/state` | Thin local persistence helpers for `.sane` state, summaries, history, backups, JSONL records, and layered state loading. |

The `core`, `policy`, and `platform` packages are collapsed into
`@sane/control-plane`. Their current homes are:

- `packages/control-plane/src/core.ts`
- `packages/control-plane/src/platform.ts`
- `packages/control-plane/src/policy/`

Compatibility shims remain where existing imports or package subpaths need them.
New code should use the feature-owned modules and explicit package subpaths
described below.

## Control Plane

`packages/control-plane/src/features/*` owns user-facing backend behavior by
feature:

| Feature folder | Owns |
| --- | --- |
| `codex/` | Codex-native exports, hooks, custom agents, skills, and managed Codex surfaces. |
| `config/` | Local config, preferences, Codex config profiles, telemetry settings, and issue relay helpers. |
| `export/` | Install/export bundle assembly and core bundle target selection. |
| `framework-artifacts/` | Framework artifact planning, source-record status, and repair metadata. |
| `install/` | Install status and runtime installation behavior. |
| `opencode/` | OpenCode-native asset rendering and export helpers. |
| `repair/` | Repair status and remove/restore support. |
| `runtime-state/` | Runtime state, readiness, rescue signals, policy preview runtime data, and history support. |
| `status/` | Status, doctor, inventory, update checks, worktree readiness, and read-only presenters. |

Top-level files in `packages/control-plane/src` are either stable package
entrypoints, compatibility shims, or collapsed shared primitives. Keep broad
backend logic in feature folders. Keep only deliberate public exports in
`src/index.ts` and package `exports`.

## Import Rules

- TUI code imports backend behavior from explicit `@sane/control-plane/*`
  subpaths when a focused subpath exists.
- Avoid new root `@sane/control-plane` imports in TUI code unless the symbol is
  intentionally part of the stable package barrel.
- Do not import from another package's `src/features/*` internals across package
  boundaries. Add a package export or use an existing subpath instead.
- `@sane/framework-assets` remains the source for pack manifests, source
  records, asset reads, and render helpers. Do not duplicate pack metadata in
  TUI or control-plane code.
- `@sane/config` and `@sane/state` remain separate broad shared contracts. Do
  not fold their ownership into feature code without a narrower API migration.
- Keep compatibility shims thin: re-export feature modules, do not add behavior.

## Feature Folder Rules

- Put behavior beside the feature that owns it, with focused tests in
  `packages/control-plane/test`.
- Prefer small public subpaths for cross-package use, such as
  `@sane/control-plane/install-runtime.js` or
  `@sane/control-plane/inspect-runtime.js`.
- Keep status/presenter code read-only. Writes belong in install, export,
  config, repair, runtime-state, Codex, or OpenCode feature modules.
- Keep framework artifact planning tied to source records and manifest metadata.
  Status, doctor, and repair surfaces should report that evidence instead of
  inventing parallel ownership rules.
- Keep `.sane` state thin: local config, runtime state, summaries, history,
  backups, telemetry state, and repair metadata.
- Treat `.sane/state/framework-artifacts-manifest.json` as a durable state
  format owned by `features/framework-artifacts`. Changes to artifact
  `sourceId`, hash, path, or ownership metadata must preserve deploy,
  uninstall, status, and repair fixture coverage.

## Documentation Map

- `README.md` is public product framing and install path.
- `CONTRIBUTING.md` is contributor workflow, repo map, and release guardrails.
- `TODO.md` is live handoff state, not an architecture history.
- `docs/what-sane-does.md` explains the user-visible framework behavior.
- `docs/architecture.md` is the current package and import map.
- Dated files under `docs/specs/`, `docs/plans/`, `docs/decisions/`, and
  `docs/research/` are traceability records. They do not override current code.

## Verification

Use RTK in this repo.

Narrow package checks:

```bash
rtk pnpm --filter @sane/control-plane test
rtk run 'pnpm --filter @sane/control-plane typecheck'
rtk pnpm --filter @sane/sane-tui test
rtk run 'pnpm --filter @sane/sane-tui typecheck'
rtk pnpm --filter @sane/framework-assets test
rtk run 'pnpm --filter @sane/framework-assets typecheck'
```

Whole-repo checks:

```bash
rtk pnpm test
rtk run 'pnpm typecheck'
```

Release-bound gate:

```bash
rtk pnpm run accept
```

Current RTK native typecheck routing can false-exit while reporting no
TypeScript errors, so use `rtk run 'pnpm typecheck'` until that wrapper is
repaired.
