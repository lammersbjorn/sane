# ⚖️ sane-config

The local config model for `Sane`.

## What This Crate Is

This crate defines what the saved `Sane` settings mean.

When users change things like:

- model-role defaults
- reasoning defaults
- built-in packs
- privacy choices

this crate is where those settings are parsed, assigned defaults, and validated.

## Why It Exists

`Sane` cannot safely preview, apply, or export behavior if configuration semantics are scattered across the app.

This crate gives the workspace one place to answer:

- what a config value means
- what the defaults are
- what combinations are allowed
- what should be rejected as invalid

## What It Owns

- local config structs
- defaults
- model and reasoning enums
- pack settings
- privacy and telemetry levels
- serialization helpers
- validation rules

## What It Must Not Own

- file writes into Codex paths
- TUI behavior
- path discovery
- runtime policy decisions

Those depend on config.
They should not define config.

## Contributor Note

If you change config here, check all dependent surfaces:

- previews
- applies
- exports
- status and doctor output
- docs that describe saved behavior

Config drift is easy to create and hard for users to diagnose.

## Read Alongside

- [root README](../../README.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
- [crates/sane-core/README.md](../sane-core/README.md)
