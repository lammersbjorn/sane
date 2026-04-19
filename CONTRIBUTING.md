# Contributing to Sane

Thanks for wanting to help.

`Sane` is still early, so good contributions are usually the ones that make the product clearer, safer, or more coherent, not the ones that add the most surface area.

## Before You Start

Please read:

- [README.md](./README.md)
- [Support guide](./SUPPORT.md)
- [Security policy](./SECURITY.md)
- [TODO.md](./TODO.md)

For bigger changes, open an issue first so we can align on direction before you spend time building.

## Good First Contributions

Helpful contributions include:

- fixing confusing docs
- improving onboarding or install flows
- tightening tests around existing behavior
- reporting reproducible bugs
- improving TUI clarity or safety
- closing gaps between the code and the documented product philosophy

## Contributions That Need Discussion First

Please do not open a large PR first for work like this:

- new public plugin APIs
- major architecture changes
- new default integrations or provider profiles
- cross-cutting policy changes
- new exported surfaces that affect user repos by default

These areas are still deliberately being shaped.

## Local Setup

You need:

- Rust toolchain
- Git
- a Codex environment if you want to test Codex-facing flows

Basic loop:

```bash
cargo run -p sane
cargo fmt --check
cargo check
cargo test
```

`cargo run -p sane` launches the TUI, which is the fastest way to manually verify user-facing changes.

## Workflow Expectations

1. Keep changes scoped.
2. Update docs when behavior or UX changes.
3. Add or update tests for behavior changes.
4. Preserve user safety:
   - preview before apply
   - backup before destructive changes
   - additive changes over clobbering
5. Do not silently expand what `Sane` manages.

## Pull Requests

Open a pull request with:

- a clear problem statement
- the user-facing effect of the change
- screenshots or terminal output if the TUI changed
- test coverage notes
- docs updates where relevant

Small, well-scoped PRs are much easier to review than large mixed ones.

## Commit Style

This repository uses a conventional `commit-msg` hook.

Examples:

- `feat(tui): add config backup preview`
- `fix(state): validate malformed summary files`
- `docs(readme): clarify install story`

## Documentation Rule

If your change affects:

- how users understand `Sane`
- how they install it
- what it manages
- how contributors should work in the repo

then the docs should change in the same PR.

## Need Help?

Use the paths in [SUPPORT.md](./SUPPORT.md).
