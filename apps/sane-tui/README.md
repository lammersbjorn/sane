# Sane TUI (TypeScript)

This package is the TypeScript-side TUI app model for `Sane`.

Current role:

- owns TUI-facing section/action metadata
- owns screen loaders for `Get Started`, `Preferences`, `Install`, `Inspect`, and `Repair`
- owns shell state for section selection, confirmations, notices, and editor flows
- owns render-ready dashboard / overlay / app view models
- does not yet render a real terminal UI by itself

Important files:

- `src/command-registry.ts`
  - normalized command specs plus section placements
- `src/shell.ts`
  - shell state, action dispatch, confirmations, notices, editor save/reset flows
- `src/dashboard.ts`
  - welcome/dashboard view model
- `src/overlay-models.ts`
  - config/privacy/pack/confirm/notice modal view models
- `src/app-view.ts`
  - top-level render-ready view model
- `src/preferences-editor-state.ts`
  - pure editor draft logic for model defaults, packs, and privacy
- `src/main.ts`
  - package bootstrap entry for building the app model from project/home roots

Boundary rules:

- keep this package focused on TUI state and view models
- reuse `packages/control-plane` for backend operations
- reuse `packages/config`, `packages/platform`, and `packages/state` for source-of-truth logic
- do not reintroduce hardcoded Rust-only behavior if the TS layer can own it cleanly
- keep product framing aligned with `docs/decisions/2026-04-19-sane-decision-log.md`

Verification:

```bash
pnpm --filter @sane/sane-tui test
pnpm --filter @sane/sane-tui typecheck
```
