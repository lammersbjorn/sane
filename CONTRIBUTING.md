# Contributing to Sane

`Sane` gives Codex better defaults, sharper workflows, and cleaner recovery by managing Codex-native framework pieces. Good contributions make that baseline clearer, safer, more reversible, and easier to trust.

## Read First

Product truth lives here:

- [README.md](./README.md)
- [docs/what-sane-does.md](./docs/what-sane-does.md)
- [docs/decisions/2026-04-19-sane-decision-log.md](./docs/decisions/2026-04-19-sane-decision-log.md)
- [docs/specs/2026-04-19-sane-backend-contract.md](./docs/specs/2026-04-19-sane-backend-contract.md)
- [TODO.md](./TODO.md)

Use the decision log to separate locked product direction, flexible recommendations, and open future questions. Do not present an open idea as shipped behavior.

## Product Frame

In practice:

- Codex-native exports are the product effect
- the `sane` command is the install/config/status/repair service
- `.sane/` is the local runtime for config, state, handoff, and backups
- repo mutation is optional
- `AGENTS.md` is optional
- Sane is not a daily prompting wrapper

## First-Time Setup

Prerequisites:

- Node.js 22 or newer
- pnpm
- Git
- a Codex environment if you want to test end-to-end behavior

Clone and run:

```bash
git clone https://github.com/lammersbjorn/sane.git
cd sane
pnpm install
pnpm start
```

That opens the onboarding control surface.

Install the local Conventional Commits hook:

```bash
./scripts/install-hooks.sh
```

## Local Workflow

Baseline loop:

```bash
pnpm test
pnpm typecheck
pnpm start
```

Useful commands:

| Command | Why you would run it |
| --- | --- |
| `pnpm start` | Open the onboarding control surface. |
| `pnpm run start:settings` | Go straight to settings/configure mode. |
| `pnpm run start:status` | Show current managed targets, runtime state, and drift. |
| `pnpm run start:repair` | Go straight to repair/remove mode. |
| `pnpm run release:verify` | Run full verification, build the packaged CLI, and produce the npm tarball for release checks. |
| `pnpm run release:npm:dry-run` | Validate npm publish metadata and payload without publishing. |

If your change affects preview, apply, export, status, repair, restore, or uninstall, test that flow directly.

## Repo Map

| Path | Why it exists |
| --- | --- |
| [README.md](./README.md) | Public product story and setup path. |
| [docs/what-sane-does.md](./docs/what-sane-does.md) | Plain-English walkthrough of how Sane changes Codex. |
| [TODO.md](./TODO.md) | Current state, guardrails, and next slices. |
| [docs/decisions/2026-04-19-sane-decision-log.md](./docs/decisions/2026-04-19-sane-decision-log.md) | Locked product decisions. |
| [docs/specs/2026-04-19-sane-backend-contract.md](./docs/specs/2026-04-19-sane-backend-contract.md) | Current backend contract the control surface uses. |
| [apps/sane-tui/README.md](./apps/sane-tui/README.md) | Terminal install/config/status/repair service package. |
| [packages/control-plane/src](./packages/control-plane/src) | Install/export/status/repair behavior the control surface uses. |
| [packages/config/src](./packages/config/src) | Saved Sane settings and Codex environment detection. |
| [packages/framework-assets/src](./packages/framework-assets/src) | Bundled skills, overlays, agents, and pack metadata. |
| [packages/platform/src](./packages/platform/src) | Cross-platform path and filesystem layout rules. |
| [packages/state/src](./packages/state/src) | Thin local state and persistence. |
| [packages/policy/src](./packages/policy/src) | Adaptive policy groundwork. |

## Keeping Docs In Sync

Update docs in the same PR when you change:

- exported skills, overlays, agents, hooks, or config profiles
- optional pack behavior
- what Sane writes or removes
- status, repair, restore, or uninstall behavior
- contributor verification expectations
- package responsibilities

Doc rules:

- lead public docs with user value, then explain Codex framework behavior
- mention terminal UI details only when the install/config/status/repair surface matters
- use `sane-docs-writing` when the docs-craft pack is active
- keep future ideas in `TODO.md` or specs, not as shipped README behavior
- keep model availability claims in dated research when they can drift
- keep package READMEs short and ownership-focused
- if a package boundary changes, update that package README

## Contribution Rules

Preserve the safety model:

- preview before apply
- backup before risky writes
- additive managed blocks over clobbering
- warning-first drift detection
- uninstall and restore paths that leave unrelated content alone

Keep Sane Codex-native:

- no mandatory wrapper workflow
- no command ritual before normal work
- no required repo-local Sane footprint
- no broad config takeover

## Changes That Need Discussion First

Open an issue first for:

- new public plugin APIs
- new default integrations or provider profiles
- new managed surfaces that write more user files
- broad routing-policy changes
- architecture shifts that weaken local-first or Codex-native behavior

## Pull Request Checklist

Before opening a PR, make sure you can explain:

- the user problem
- the Codex-native surface or behavior that changed
- what files Sane writes, if any
- what you verified
- which docs changed with it

## Release Guardrails

- Never enable unattended publish without secrets and environment approval.
- Tag releases as `vX.Y.Z`; this triggers GitHub Release packaging.
- Publish `sane-codex` from `apps/sane-tui/dist` only after `release:verify` passes.
- Use GitHub Release `SHA256SUMS.txt` as source of truth for Homebrew, winget, and Scoop updates.

## Commit Style

This repo uses Conventional Commits through the local `commit-msg` hook.

Examples:

- `feat(tui): add clearer apply confirmation`
- `fix(state): validate malformed summary files`
- `docs(readme): explain framework exports`

## Need Help?

- [SUPPORT.md](./SUPPORT.md)
- [SECURITY.md](./SECURITY.md)
