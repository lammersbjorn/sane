# ⚖️ sane-core

Shared names, contracts, and generated managed content for `Sane`.

## Why This Crate Exists

Users experience `Sane` as one product.
Under the hood, that only stays true if every layer agrees on:

- what a managed thing is called
- when it counts as installed versus configured
- what content gets exported
- what uninstall is allowed to remove

This crate keeps that shared vocabulary in one place.

## What Users Feel From It

Most users never think about `sane-core` directly.
They feel it indirectly when:

- the TUI, docs, status, and doctor all describe the same world
- exported skills and overlays use consistent names and markers
- uninstall removes only Sane-managed content
- generated guidance stays aligned with enabled packs and saved model-role defaults
- fixed built-in pack behavior stays coherent across exports/status (`frontend-craft` exports `design-taste-frontend` + `impeccable`; `cavemem`/`rtk` stay capability-only)

## What It Owns

- canonical names for Sane-managed assets
- operation and inventory types
- managed block markers for additive file edits
- generated `sane-router` and related managed content
- fixed built-in pack mapping for managed exports versus capability-only behavior
- shared wording used to keep install/export/uninstall boundaries aligned

## What It Must Not Own

- path discovery
- raw file I/O
- TUI rendering
- config persistence
- policy evaluation

## When Docs Should Change

Update docs if you change:

- a managed asset name
- exported guidance content in a way users will notice
- install/uninstall boundaries
- status or doctor terminology

## Read Alongside

- [root README](../../README.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
- [crates/sane-config/README.md](../sane-config/README.md)
