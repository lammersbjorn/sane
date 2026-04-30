# @sane/sane-tui

Terminal install/config/status/repair service for Sane's Codex-native framework pieces.

This package owns:

- section/action metadata for Home, Settings, Add to Codex, Status, Repair, and Uninstall
- shell state, editor state, confirmations, notices, and input handling
- render-ready view models plus text and Ink terminal drivers
- CLI parsing that dispatches to `@sane/control-plane`

It should stay thin around backend behavior. Install/export/status/repair logic belongs in `@sane/control-plane`; config, platform, state, policy, and asset logic belong in their packages.

Stable imports should prefer the package barrel:

```ts
import { createSaneTuiApp } from "@sane/sane-tui";
```

Root scripts such as `pnpm start`, `pnpm run start:settings`, and `pnpm run start:status` build and launch this package. Package-local preview scripts are for development.

Verify with:

```bash
pnpm --filter @sane/sane-tui test
pnpm --filter @sane/sane-tui typecheck
pnpm --filter @sane/sane-tui run build:smoke
```

Useful development previews:

```bash
pnpm --filter @sane/sane-tui run preview settings
pnpm --filter @sane/sane-tui run preview update-check
pnpm --filter @sane/sane-tui run preview updates auto
pnpm --filter @sane/sane-tui run preview:terminal status
pnpm --filter @sane/sane-tui run preview:text settings
```
