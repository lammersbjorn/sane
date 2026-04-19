# ⚖️ sane-core

Shared names, contracts, and generated content for `Sane`.

## What This Crate Is

This crate holds the pieces that need to stay stable across the workspace.

That includes things like:

- managed asset names
- typed operation results
- inventory contracts
- generated skill and overlay content
- markers used for additive edits in user files

## Why It Exists

Without a shared core, the workspace drifts fast:

- one layer says something is installed
- another says it is only configured
- generated content no longer matches what the UI claims
- uninstall boundaries stop lining up with export boundaries

This crate keeps the shared vocabulary in one place.

## What It Owns

- operation and inventory types
- canonical names for Sane-managed assets
- managed block markers
- reusable generated text for Sane-managed surfaces

## What It Must Not Own

- path lookup
- raw file I/O
- TUI rendering
- config persistence
- policy decisions

It should remain minimal, stable, and predictable.

## Contributor Note

Changes here often ripple everywhere.
If you rename a managed file block, asset name, or result contract, verify:

- status
- doctor
- export
- uninstall
- docs

## Read Alongside

- [root README](../../README.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
- [crates/sane-platform/README.md](../sane-platform/README.md)
