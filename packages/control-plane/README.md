# @sane/control-plane

Backend operations for Sane install, export, status, config preview/apply, repair, restore, and uninstall flows.

Public API note:

- prefer root imports from `@sane/control-plane` for stable operations
- subpath exports are explicit compatibility entries used by workspace internals/tests; keep additions review-gated

TOML note: Codex config read/write paths use `smol-toml` so Sane can parse and stringify while preserving unrelated user config. `@sane/config` uses the typed `toml` parser for Sane's local read-only parse/validate path.

Verify with:

```bash
pnpm --filter @sane/control-plane test
pnpm --filter @sane/control-plane typecheck
```
