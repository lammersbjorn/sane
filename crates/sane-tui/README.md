# ⚖️ sane-tui

The onboarding-first installer, configurator, diagnostic, and recovery interface for `Sane`.

## What This Crate Is

If someone runs `sane`, this crate is the first thing they see.

It owns the user-facing flows for:

- guided onboarding
- configure/settings
- exports
- inspect
- repair/recovery

It is the bridge between what the user wants to do and the Codex-native pieces `Sane` manages.

## Why It Exists

`Sane` is supposed to feel easy to operate.
That means users need one place to:

- understand what an option does
- inspect current state
- see safe previews
- make reversible changes
- recover cleanly when something drifts

That is this crate.

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

It should do that carefully:

- preview before apply where possible
- preserve unrelated user content
- keep uninstall scoped to Sane-managed content

## What It Owns

- the no-args `sane` onboarding entry point
- the `sane settings` shortcut into configure mode
- action labels and help text
- confirmation flows for risky operations
- command dispatch into backend operations
- user-facing rendering of status, doctor, and output

## What It Does Not Own

- config schema meaning
- path discovery rules
- shared generated content
- pure policy evaluation

Those belong in the lower-level crates.

## Main Invariants

- user-facing actions must be explainable in plain language
- destructive operations need confirmation
- user-visible docs and UI copy should stay aligned
- status and doctor should describe the same world the backend actually manages

## Read Alongside

- [root README](../../README.md)
- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [crates/sane-core/README.md](../sane-core/README.md)
- [crates/sane-config/README.md](../sane-config/README.md)
