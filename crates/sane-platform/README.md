# ⚖️ sane-platform

Path discovery and platform layout rules for `Sane`.

## What This Crate Is

This crate answers one question:

> where does this belong?

It finds:

- the project root
- the local `.sane/` directory
- Codex user paths
- backup directories
- other managed filesystem locations

## Why It Exists

`Sane` is meant to work on macOS, Linux, and Windows.
Users should not have to memorize path differences or special cases.

Keeping that logic here makes the rest of the workspace simpler and safer.

## What It Owns

- platform detection
- project-root discovery
- path normalization
- resolution of `.sane/` sub-paths
- helper paths for Codex user-level files

## What It Must Not Own

- config meaning
- generated content
- policy logic
- TUI copy

This crate should say where things live, not what they mean.

## Contributor Note

Path changes are user-facing changes.
If you touch this crate, check:

- docs
- backups
- uninstall
- status and doctor output
- platform tests

## Read Alongside

- [root README](../../README.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
- [crates/sane-state/README.md](../sane-state/README.md)
