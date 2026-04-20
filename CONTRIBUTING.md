# Contributing to Sane

Thanks for helping.

`Sane` is still early, so good contributions are usually the ones that make it clearer, safer, more reversible, and easier to trust.

## Start Here

Read these first:

- [README.md](./README.md)
- [SUPPORT.md](./SUPPORT.md)
- [SECURITY.md](./SECURITY.md)
- [docs/decisions/2026-04-19-sane-decision-log.md](./docs/decisions/2026-04-19-sane-decision-log.md)
- [docs/plans/2026-04-19-sane-strict-implementation-plan.md](./docs/plans/2026-04-19-sane-strict-implementation-plan.md)

The decision log matters.
Consult it to distinguish stabilized architecture from experimental areas.
If the docs or code drift away from a locked decision, fix the drift before adding new functionality.

## What You Are Contributing To

`Sane` is a Codex-native QoL framework with a Rust control surface.

In practice that means:

- the TUI is how users configure and repair things
- the real effect lands in Codex-native assets and narrow config changes
- `.sane/` exists to keep local config, state, and backups inspectable

If you need the product story first, read:

- [README.md](./README.md)
- [docs/what-sane-does.md](./docs/what-sane-does.md)

If your change affects user behavior, think in terms of these surfaces:

- local `.sane/` runtime and state
- user skills in `~/.agents/skills/`
- managed `AGENTS.md` guidance
- managed hooks
- managed custom agents
- managed Codex config profiles

## Local Setup

### Prerequisites

- Rust toolchain
- Git
- a Codex environment if you want to test end-to-end flows

### Clone and run

```bash
git clone https://github.com/lammersbjorn/sane.git
cd sane
cargo run -p sane
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

The hook is there to keep history readable, not to slow you down.

## Normal Dev Loop

```bash
cargo check
cargo fmt --check
cargo test
cargo run -p sane
```

Use:

- `cargo check`
  Fast compile pass.
- `cargo fmt --check`
  Formatting guard.
- `cargo test`
  Behavior and regression checks.
- `cargo run -p sane`
  Manual TUI and behavior checks.

## Repo Map

| Path | Purpose |
| --- | --- |
| [`README.md`](./README.md) | Public product docs. |
| [`crates/sane-tui/`](./crates/sane-tui/README.md) | Installer, configurator, doctor, preview/apply/export UI. |
| [`crates/sane-core/`](./crates/sane-core/README.md) | Shared names, generated content, operation contracts. |
| [`crates/sane-config/`](./crates/sane-config/README.md) | Local config schema and validation. |
| [`crates/sane-platform/`](./crates/sane-platform/README.md) | Path discovery and platform-specific layout. |
| [`crates/sane-state/`](./crates/sane-state/README.md) | Local state files and persistence helpers. |
| [`crates/sane-policy/`](./crates/sane-policy/README.md) | Adaptive policy groundwork. |

## Rules For Good Contributions

### Keep user value ahead of architecture

The root docs should answer:

- what `Sane` does
- who it is for
- what changes after install
- how it stays safe and reversible

Do not turn internal crate structure into the product pitch.
If the change affects users, the user docs should explain it in plain language.

### Do not turn open decisions into facts

Some things are still intentionally open.
If the decision log says something is still open, docs should not present it as settled product truth.

### Preserve the safety model

Prefer:

- preview before apply
- backup before destructive changes
- additive changes over clobbering
- uninstall and restore paths that leave unrelated user content alone

### Keep it Codex-native

`Sane` should not drift into a mandatory wrapper workflow.
The TUI is a control surface, not the only way users should be able to benefit from it.

## When Docs Must Change In The Same PR

Update docs in the same PR if you change:

- what users see in the TUI
- what files `Sane` writes
- what profiles or exports do
- what contributors are expected to verify
- what is safe, optional, or reversible

If the change would confuse someone reading the README after pulling `main`, the docs are part of the code change.

## Changes That Need Discussion First

Open an issue first for:

- new public plugin APIs
- new default integrations or provider profiles
- new managed surfaces that write more user files
- broad routing-policy changes
- architecture changes that alter the local-first or Codex-native stance

## Pull Request Checklist

Before opening a PR, make sure you can explain:

- the user problem
- the user-facing effect
- what surfaces changed
- what was verified
- what docs changed with it

Good PRs here are usually small, obvious, and easy to reverse if needed.

## Commit Style

This repo uses Conventional Commits through the local `commit-msg` hook.

Examples:

- `feat(tui): add clearer apply confirmation`
- `fix(state): validate malformed summary files`
- `docs(readme): explain packs in plain language`

## Need Help?

Use [SUPPORT.md](./SUPPORT.md).
