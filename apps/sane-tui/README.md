# Sane TUI (TypeScript)

This package is the TypeScript-side TUI app model for `Sane`.

Current role:

- owns TUI-facing section/action metadata
- owns screen loaders for `Get Started`, `Preferences`, `Install`, `Inspect`, and `Repair`
- owns shell state for section selection, confirmations, notices, and editor flows
- owns pure input/key handling on top of the shell state machine
- owns internal non-interactive TS CLI parsing/execution for backend verbs, section shortcuts, and hook output
- exposes internal smart/text/live preview paths through `tsx`
- exposes an internal bundled build lane that emits `dist/bin/sane.cjs` without needing `tsx` at runtime
- owns render-ready dashboard / overlay / app view models
- owns internal text-frame rendering scaffolding for the future TS terminal driver
- owns internal text-driver glue that wires discovery, shell, input, and text rendering together
- owns terminal-key decoding for the future real TS key loop
- owns terminal-driver glue that maps raw terminal input into the TS runtime
- now owns the shipped public terminal UI path through the built root `pnpm start` flow

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
- `src/input-driver.ts`
  - pure key/input mapping for the TS shell state machine
- `src/cli.ts`
  - internal TS CLI parser/executor for backend commands and `hook session-start`
- `src/text-renderer.ts`
  - internal text-frame renderer for the TS app view
- `src/text-driver.ts`
  - internal runtime glue for discovery + shell + input driver + text rendering
- `src/terminal-keys.ts`
  - terminal escape-sequence decoding into TS TUI input keys
- `src/terminal-driver.ts`
  - raw terminal input -> TS runtime step glue
- `src/terminal-loop.ts`
  - internal live terminal loop for alt-screen preview over the TS runtime

Boundary rules:

- keep this package focused on TUI state and view models
- reuse `packages/control-plane` for backend operations
- reuse `packages/config`, `packages/platform`, and `packages/state` for source-of-truth logic
- do not reintroduce legacy-stack behavior if the TS layer can own it cleanly
- keep product framing aligned with `docs/decisions/2026-04-19-sane-decision-log.md`

Current package story:

- public repo entrypoint now goes through the built root `pnpm start` / `pnpm run start:settings` scripts
- internal source preview path is `apps/sane-tui/bin/sane.mjs`, which shells through `tsx`
- internal built preview path is `apps/sane-tui/dist/bin/sane.cjs`, emitted by `pnpm --filter @sane/sane-tui run build`
- generated distribution metadata now lives in `apps/sane-tui/dist/package.json`, which points the package CLI at the built output

Verification:

```bash
node apps/sane-tui/bin/sane.mjs settings
node apps/sane-tui/bin/sane.mjs inspect
node apps/sane-tui/bin/sane.mjs repair
pnpm --filter @sane/sane-tui run preview settings
pnpm --filter @sane/sane-tui run preview inspect
pnpm --filter @sane/sane-tui run preview:terminal settings
pnpm --filter @sane/sane-tui run preview:text settings
pnpm --filter @sane/sane-tui run build
node apps/sane-tui/dist/bin/sane.cjs inspect
pnpm --filter @sane/sane-tui test
pnpm --filter @sane/sane-tui typecheck
```
