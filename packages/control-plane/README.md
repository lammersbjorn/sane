# @sane/control-plane

Backend operations for Sane install, export, status, config preview/apply, repair, restore, and uninstall flows.

Public API note:

- the root `@sane/control-plane` barrel stays small and stable for broad operations
- focused subpaths such as `@sane/control-plane/install-runtime.js` and `@sane/control-plane/inspect-runtime.js` are supported package entrypoints for TUI and tests
- compatibility shims stay thin; keep new subpaths review-gated

TOML note: Codex config read/write paths use `smol-toml` so Sane can parse and stringify while preserving unrelated user config. `@sane/config` uses the typed `toml` parser for Sane's local read-only parse/validate path.

Verify with:

```bash
rtk pnpm --filter @sane/control-plane test
rtk run 'pnpm --filter @sane/control-plane typecheck'
```
