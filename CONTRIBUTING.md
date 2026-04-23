# Contributing to Sane

`Sane` is still early. Good contributions usually make it clearer, safer, more reversible, and easier for a new user to trust.

## Read This First

Start with the docs that define product truth:

- [README.md](./README.md)
- [docs/what-sane-does.md](./docs/what-sane-does.md)
- [docs/decisions/2026-04-19-sane-decision-log.md](./docs/decisions/2026-04-19-sane-decision-log.md)
- [docs/specs/2026-04-19-sane-backend-contract.md](./docs/specs/2026-04-19-sane-backend-contract.md)
- [TODO.md](./TODO.md)

Use the decision log to separate:

- locked product direction
- recommended but flexible implementation shape
- open future questions

Do not present an open idea as a shipped fact.

## What You Are Contributing To

`Sane` is a Codex-native setup and repair tool.

In practice:

- the TUI is the user control surface
- the real product effect lands in Codex-native installs and narrow config changes
- `.sane/` is the local runtime for config, state, and backups
- repo mutation is optional
- `AGENTS.md` is optional

If you need the user story first, re-read:

- [README.md](./README.md)
- [docs/what-sane-does.md](./docs/what-sane-does.md)

## First-Time Setup

### Prerequisites

- Node.js
- pnpm
- Git
- a Codex environment if you want to test end-to-end behavior

### Clone and run

```bash
git clone https://github.com/lammersbjorn/sane.git
cd sane
pnpm install
pnpm start
```

That opens the onboarding TUI.

If you want to jump straight into the settings/configure area:

```bash
pnpm run start:settings
```

### Install the git hooks

This repo ships a `commit-msg` hook for Conventional Commits.

```bash
./scripts/install-hooks.sh
```

That sets:

```bash
git config core.hooksPath .githooks
```

## Local Workflow

Use this baseline loop while developing:

```bash
pnpm test
pnpm typecheck
pnpm start
```

Useful commands:

| Command | Why you would run it |
| --- | --- |
| `pnpm start` | Open the onboarding-first TUI. |
| `pnpm run start:settings` | Go straight to settings/configure mode. |
| `pnpm run start:repair` | Go straight to repair/remove mode. |
| `pnpm run start:inspect` | Inspect current managed targets, runtime state, and drift. |

If your change affects repair, preview/apply, export, or uninstall, test that flow directly.

## Repo Map

| Path | Why it exists |
| --- | --- |
| [README.md](./README.md) | Public beginner-first product story. |
| [docs/what-sane-does.md](./docs/what-sane-does.md) | Longer plain-English explainer of what changes in practice. |
| [TODO.md](./TODO.md) | Current state, guardrails, and future-only items. |
| [docs/decisions/2026-04-19-sane-decision-log.md](./docs/decisions/2026-04-19-sane-decision-log.md) | Locked product decisions. |
| [docs/specs/2026-04-19-sane-backend-contract.md](./docs/specs/2026-04-19-sane-backend-contract.md) | Current backend contract the TUI wraps. |
| [apps/sane-tui/README.md](./apps/sane-tui/README.md) | User-facing control surface responsibilities. |
| [packages/control-plane/src](./packages/control-plane/src) | Install/export/inspect/repair behavior the TUI wraps. |
| [packages/config/src](./packages/config/src) | Meaning of saved Sane settings. |
| [packages/platform/src](./packages/platform/src) | Cross-platform path and filesystem layout rules. |
| [packages/state/src](./packages/state/src) | Thin local state and persistence. |
| [packages/policy/src](./packages/policy/src) | Adaptive policy groundwork. |

## Keeping Docs In Sync

Update docs in the same PR when you change:

- what a user sees in the TUI
- what `Sane` writes
- what profiles or exports do
- what is safe, optional, additive, or reversible
- what contributors are expected to verify
- crate responsibilities

Rules for doc updates:

- keep the root README user-facing first
- keep under-the-hood detail in service of the user story
- keep future ideas in `TODO.md` or specs, not in the README as shipped behavior
- keep the BuildStory Hackathon #2 note in the root README project note, not scattered through product explainers
- if a change affects a crate boundary, update that crate's README in the same PR

## Contribution Rules

### Keep user value ahead of architecture

The root docs should always answer:

- what `Sane` is
- who it is for
- what changes in practice
- what users actually get
- what is already real versus planned later

### Preserve the safety model

Prefer:

- preview before apply
- backup before risky writes
- additive changes over clobbering
- uninstall and restore paths that leave unrelated content alone

### Keep it Codex-native

`Sane` should not drift into a mandatory wrapper workflow.
The TUI is a control surface, not the user's daily prompting interface.

## Changes That Need Discussion First

Open an issue first for:

- new public plugin APIs
- new default integrations or provider profiles
- new managed surfaces that write more user files
- broad routing-policy changes
- architecture shifts that weaken the local-first or Codex-native stance

## Pull Request Checklist

Before opening a PR, make sure you can explain:

- the user problem
- the user-facing effect
- what surfaces changed
- what you verified
- which docs changed with it

## Commit Style

This repo uses Conventional Commits through the local `commit-msg` hook.

Examples:

- `feat(tui): add clearer apply confirmation`
- `fix(state): validate malformed summary files`
- `docs(readme): explain Sane to first-time users`

## Need Help?

- [SUPPORT.md](./SUPPORT.md)
- [SECURITY.md](./SECURITY.md)
