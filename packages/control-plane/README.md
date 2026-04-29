# @sane/control-plane

Backend operations for Sane install, status, config preview/apply, export, repair, and uninstall flows.

Public API note:

- prefer root imports from `@sane/control-plane` for stable operations
- subpath exports are explicit compatibility entries used by workspace internals/tests; keep additions review-gated

TOML note: this package uses `smol-toml` for Codex config read/write paths because it needs parse and stringify support while preserving unrelated user config. `@sane/config` uses the typed `toml` parser for Sane's local read-only parse/validate path.

Verify with:

```bash
pnpm --filter @sane/control-plane test
pnpm --filter @sane/control-plane typecheck
```
