# ⚖️ sane-platform

Cross-platform path discovery and filesystem layout rules for `Sane`.

## Why This Crate Exists

`Sane` is meant to work on macOS, Linux, and Windows.
Users should not have to memorize where `.sane`, Codex config, hooks, backups, or managed exports belong on each platform.

This crate answers the filesystem question for the rest of the workspace:

> where should this go?

## What Users Feel From It

Users feel this crate when:

- `Sane` finds the right project root
- local runtime files land in the expected `.sane/` paths
- user-level Codex files are discovered correctly
- backup, uninstall, status, and doctor all point at the right locations

If path rules are wrong here, the rest of the product becomes confusing fast.

## What It Owns

- platform detection
- project-root discovery
- path normalization
- `.sane/` layout helpers
- helper paths for user-level Codex files

## What It Must Not Own

- config meaning
- generated content
- policy logic
- TUI copy

## When Docs Should Change

Update docs if you change:

- any user-visible path
- repo-local versus user-level install targets
- backup locations
- project-root discovery behavior

## Read Alongside

- [root README](../../README.md)
- [crates/sane-state/README.md](../sane-state/README.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
