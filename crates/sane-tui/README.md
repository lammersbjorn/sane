# ⚖️ sane-tui

The onboarding-first control surface for `Sane`.

## Why This Crate Exists

If someone runs `sane`, this is what they meet first.

This crate exists so users have one understandable place to:

- learn what `Sane` does
- review what is optional
- preview changes before writing them
- inspect current state
- repair, restore, or uninstall safely

## What Users See Here

This crate owns the user-facing flows for:

- guided onboarding
- settings/configure
- install and export actions
- inspect and doctor output
- repair, restore, and uninstall actions

It is the bridge between plain-language user intent and the Codex-native surfaces `Sane` manages.

## What It Touches

Depending on the action, this crate can coordinate writes to:

- `.sane/`
- `.agents/skills/`
- `AGENTS.md`
- `~/.agents/skills/`
- `~/.codex/AGENTS.md`
- `~/.codex/hooks.json`
- `~/.codex/agents/`
- `~/.codex/config.toml`

That write surface is why the copy, previews, and confirmations here matter.

## What It Owns

- the no-args onboarding entry point
- the `sane settings` shortcut
- action labels and help text
- confirmation flows for risky operations
- command dispatch into backend operations
- user-facing rendering of status, doctor, and result output

## What It Must Not Own

- config schema meaning
- path discovery rules
- shared generated content
- pure policy evaluation

## When Docs Should Change

Update docs if you change:

- what users see in the TUI
- command names or shortcuts
- what install/export/uninstall actions do
- confirmation or repair behavior
- the user-facing explanation of current managed targets

## Read Alongside

- [root README](../../README.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [crates/sane-core/README.md](../sane-core/README.md)
- [crates/sane-config/README.md](../sane-config/README.md)
