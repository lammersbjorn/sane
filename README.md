# Sane

**Better defaults, sharper workflows, and cleaner recovery for Codex.**

`Sane` is a Codex-native framework for the parts around prompting: task routing, reusable skills, scoped agents, guidance packs, setup checks, and reversible config changes. It gives Codex a stronger operating baseline without making you prompt through a new app, and it leaves enough local state to inspect and repair drift.

The `sane` command installs and maintains those pieces. Use it to choose what to add, preview writes, check status, repair drift, or uninstall. Then keep using Codex normally.

> Public npm package name is `sane-codex` because unscoped `sane` is already occupied. Installed CLI command stays `sane`.

> Project note: `Sane` is being built in public for [BuildStory Hackathon #2](https://www.buildstory.com/projects/sane).

## What Changes

After setup, Codex can lean on Sane for:

- clearer routing when work needs research, implementation, review, or fast sidecars
- reusable skills for broad work, continuation, current-stack research, and optional packs
- scoped custom agents for exploration, implementation, review, and realtime help
- previewable config profiles instead of manual config edits
- status and repair paths when exported guidance, hooks, agents, or settings drift
- a small `.sane/` runtime for handoff, summaries, history, and backups

Under the hood, Sane manages these Codex-native surfaces:

| Surface | What it provides |
| --- | --- |
| User skills | `sane-router`, `sane-bootstrap-research`, `sane-agent-lanes`, `sane-outcome-continuation`, and `continue`. |
| Guidance overlays | Additive global and repo `AGENTS.md` blocks that keep startup guidance small and route task-specific behavior into skills. |
| Custom agents | Sane coordinator, explorer, implementation, reviewer, and realtime agent templates for scoped parallel work. |
| Hooks | Optional Codex hook entries for lifecycle behavior where hooks are supported. Native Windows hook export is blocked; use WSL for hook workflows. |
| Codex config profiles | Previewable model/reasoning, continuity, recommended integrations (`Context7`, `Playwright`, `grep.app`), Cloudflare, and native Codex statusline/title settings. |
| Local runtime | `.sane/` config, state, summaries, brief handoff, history, backups, and repair metadata. |

These surfaces are the framework. The control surface exists so you can install and maintain them safely.

## Optional Packs

`Sane` ships a fixed v1 pack set:

| Pack | What it exports |
| --- | --- |
| `core` | Required router, research, lane, continuation, and continue skills plus overlays and agent templates. |
| `caveman` | Optional `sane-caveman` prose-routing skill. |
| `rtk` | Optional `sane-rtk` skill for RTK-aware shell, search, test, and log routing. |
| `frontend-craft` | Optional `sane-frontend-craft`, `sane-frontend-visual-assets`, and `sane-frontend-review` skills. |
| `docs-craft` | Optional `sane-docs-writing` skill for source-verified README, user-doc, changelog, release-note, migration-note, support-doc, and product-doc rewrites. |

Optional packs change exported guidance and routing. They are not a command ritual and not a separate runtime.

The `rtk` pack expects upstream [`rtk`](https://github.com/rtk-ai/rtk) on `PATH`. Sane checks for it but does not publish or bundle RTK.

```bash
brew install rtk
# or: curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
# or: cargo install --git https://github.com/rtk-ai/rtk
```

## How Sane Works

1. Open the control surface.
2. Choose local settings and optional packs.
3. Preview what Sane would write.
4. Apply only the Codex-native pieces you want.
5. Use Codex normally.
6. Return to Sane for status, repair, restore, export refresh, or uninstall.

Sane's safety model is intentionally boring:

- no required daily wrapper
- no required repo mutation
- no required `AGENTS.md`
- preview before writes
- backups for Codex config changes
- additive managed blocks where possible
- status and uninstall paths for managed surfaces
- unrelated user content preserved

## Install And Run

Requires Node.js 22 or newer.

Packaged CLI usage applies once `sane-codex` is published to npm:

```bash
pnpm dlx sane-codex
# or
npm exec sane-codex
```

Global install after npm publication:

```bash
pnpm add -g sane-codex
sane
```

Source workflow:

```bash
git clone https://github.com/lammersbjorn/sane.git
cd sane
pnpm install
pnpm start
```

Useful commands:

```bash
sane                # open the control surface
sane install        # guided install/tune-up flow
sane settings       # configure defaults and packs
sane status         # inspect managed runtime and Codex surfaces
sane repair         # restore or remove managed pieces
sane update-check   # check registry for a newer sane-codex release
sane updates auto   # toggle opt-in automatic Sane CLI updates
```

Source shortcuts:

```bash
pnpm run start:settings
pnpm run start:status
pnpm run start:repair
```

## What Sane Writes

| Scope | Paths |
| --- | --- |
| Project-local runtime | `.sane/config.local.toml`, `.sane/state/*`, `.sane/BRIEF.md`, `.sane/backups/` |
| Optional repo-local exports | `.agents/skills/`, `AGENTS.md` |
| User-level Codex surfaces | `~/.agents/skills/`, `~/.codex/AGENTS.md`, `~/.codex/hooks.json`, `~/.codex/agents/`, `~/.codex/config.toml` |
| Optional OpenCode export | `~/.config/opencode/skills/`, `~/.config/opencode/AGENTS.md`, `~/.config/opencode/agents/`, `~/.config/opencode/plugins/sane-session-start.js`, `~/.config/opencode/opencode.json` (exported files only; host OpenCode visibility/load support decides runtime effect) |

## Current Vs Later

| Status | Scope |
| --- | --- |
| In place | Core Codex-native installs, optional packs, local `.sane/` runtime, config preview/apply/backup/restore, recommended integrations profile, Cloudflare profile, native Codex statusline/title profile, status, repair, and uninstall. |
| Release track | Verified GitHub Release and npm artifacts for `sane-codex`, followed by Homebrew, winget, and Scoop channel updates from tagged assets and checksums. |
| Planned later | Broader adaptive orchestration and a future end-to-end outcome runner. |

The later end-to-end outcome runner is not the current product surface.

Stable user preferences stay narrow and explicit: model/reasoning defaults, pack toggles, and privacy/update choices in `.sane/config.local.toml`, then preview/apply to supported Codex surfaces.

## Release Operators

- run `rtk pnpm run release:verify` before tagging
- tag `vX.Y.Z` to trigger GitHub Release artifact upload
- use manual `NPM Publish` workflow with `NPM_TOKEN` and protected `npm-publish` environment
- update Homebrew, winget, and Scoop only from tagged GitHub Release asset URLs and checksums

## Privacy Boundary

Telemetry remains aggregate product-improvement signal. GitHub issue relay is separate opt-in reporting: Sane may create a local draft for review, and issue submission requires a separate reviewed action. Telemetry consent alone never submits anything.

## Learn More

- [What Sane does](./docs/what-sane-does.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Support guide](./SUPPORT.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)

## License

Licensed under either Apache-2.0 or MIT, at your option.
