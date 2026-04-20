# ⚖️ sane-config

The meaning of saved `Sane` settings.

## Why This Crate Exists

When a user changes a setting in `Sane`, the workspace needs one authoritative answer to:

- what that setting means
- what the default should be
- which combinations are valid
- what should be rejected before any file write happens

That authority lives here.

## What Users Feel From It

Users feel this crate whenever `Sane`:

- shows stable defaults
- remembers model-role choices
- tracks enabled built-in packs
- stores privacy and telemetry choices
- rejects invalid combinations before export or apply

If config meaning drifts across the workspace, previews and installs stop being trustworthy.

## What It Owns

- local config structs
- defaults
- model and reasoning enums
- pack settings
- privacy and telemetry settings
- serialization helpers
- validation rules

## What It Must Not Own

- file writes into Codex paths
- TUI behavior
- path discovery
- policy decisions

## When Docs Should Change

Update docs if you change:

- what a saved setting means
- default model or reasoning behavior
- pack configuration semantics
- privacy or telemetry behavior users can select

## Read Alongside

- [root README](../../README.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
- [crates/sane-core/README.md](../sane-core/README.md)
