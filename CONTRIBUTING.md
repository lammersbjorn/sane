# Contributing to Sane

Thanks for wanting to help.

`Sane` is still early, so the best contributions are usually the ones that make the product clearer, safer, easier to understand, or more correct, not the ones that add the most surface area.

## What You Are Contributing To

`Sane` is not just a Rust TUI.

The TUI is the control surface.
The actual product is the Codex-native behavior it installs and manages:

- the `sane-router` skill
- optional pack skills
- managed `AGENTS.md` guidance
- managed hooks
- managed custom agents
- narrow Codex config profile changes
- local `.sane` state and backups

If you change `Sane`, think about which of those surfaces changed and update docs, tests, and install/repair flows accordingly.

## Before You Start

Please read:

- [README.md](./README.md)
- [SUPPORT.md](./SUPPORT.md)
- [SECURITY.md](./SECURITY.md)
- [TODO.md](./TODO.md)
- [docs/decisions/2026-04-19-sane-decision-log.md](./docs/decisions/2026-04-19-sane-decision-log.md)

For larger changes, open an issue first so work does not drift away from already-locked decisions.

## Local Setup

### Prerequisites

You need:

- Rust toolchain
- Git
- a Codex environment if you want to test Codex-facing flows end to end

### Clone and run

```bash
git clone https://github.com/lammersbjorn/sane.git
cd sane
cargo run -p sane
```

That opens the current TUI.

### Install the git hooks

This repository ships a `commit-msg` hook that enforces Conventional Commits.

Install it once per clone:

```bash
./scripts/install-hooks.sh
```

That sets:

```bash
git config core.hooksPath .githooks
```

## Normal Development Loop

```bash
cargo run -p sane
cargo fmt --check
cargo check
cargo test
```

What each command is for:

- `cargo run -p sane`
  Launch the TUI for manual testing.
- `cargo fmt --check`
  Catch formatting drift before commit.
- `cargo check`
  Fast compile pass.
- `cargo test`
  Verify behavior and guardrails.

## Repo Map

- [`README.md`](./README.md)
  Public landing page.
- [`crates/sane-tui/`](./crates/sane-tui/README.md)
  User-facing TUI and action layer.
- [`crates/sane-core/`](./crates/sane-core/README.md)
  Shared contracts and generated content.
- [`crates/sane-config/`](./crates/sane-config/README.md)
  Config schema and validation.
- [`crates/sane-platform/`](./crates/sane-platform/README.md)
  Paths and platform discovery.
- [`crates/sane-state/`](./crates/sane-state/README.md)
  Local operational state.
- [`crates/sane-policy/`](./crates/sane-policy/README.md)
  Adaptive policy groundwork.

## Good First Contributions

Helpful contributions include:

- fixing confusing docs
- improving onboarding or install flows
- tightening tests around existing behavior
- reporting reproducible bugs
- improving TUI clarity or safety
- making generated skills, hooks, agents, or overlays easier to understand
- closing gaps between the code and the documented philosophy

## Changes That Need Discussion First

Please do not open a large PR first for work like this:

- new public plugin APIs
- major architecture changes
- new default integrations or provider profiles
- cross-cutting policy changes
- new exported surfaces that affect user repos by default

These areas are still being shaped intentionally.

## Workflow Expectations

1. Keep changes scoped.
2. Update docs when behavior or UX changes.
3. Add or update tests for behavior changes.
4. Preserve user safety:
   - preview before apply
   - backup before destructive changes
   - additive changes over clobbering
5. Do not silently expand what `Sane` manages.
6. Keep `Sane` Codex-native.
   The product should not become a separate daily wrapper or command ritual.

## Pull Requests

Open a pull request with:

- a clear problem statement
- the user-facing effect of the change
- screenshots or terminal output if the TUI changed
- test coverage notes
- docs updates where relevant

Small, focused PRs are much easier to review than large mixed ones.

## Commit Style

This repository uses a conventional `commit-msg` hook.

Examples:

- `feat(tui): add clearer action help`
- `fix(state): validate malformed summary files`
- `docs(readme): explain generated codex assets`

## Documentation Rule

If your change affects:

- how users understand `Sane`
- how it installs or repairs itself
- what files it manages
- how contributors should work in the repo

then the docs should change in the same PR.

## Need Help?

Use the paths in [SUPPORT.md](./SUPPORT.md).
