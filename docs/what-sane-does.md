# ⚖️ What Sane Does

`Sane` is a Codex QoL layer.

It helps Codex feel better without forcing you into a new way of working.

## For Whom

`Sane` is for anyone who uses Codex and wants:

- better default behavior
- cleaner setup
- safer previews before changes
- reversible config changes
- a way to keep long sessions readable
- useful guidance without command rituals

## What It Changes

When you use `Sane`, it can help with:

- model and reasoning defaults
- optional skills
- optional hooks
- optional custom agents
- optional provider integrations like Cloudflare
- small local state for repair, brief handoff, and inspection

It does **not** require `AGENTS.md`.
It does **not** require you to change your workflow just to get value from it.

## How It Works

The shape is simple:

1. You open the TUI.
2. `Sane` explains the main choices in plain language.
3. You preview what will change.
4. You back up before risky writes.
5. You apply only the parts you want.
6. Codex keeps using normal plain-language prompts after that.

Under the hood, `Sane` uses three layers:

- a Rust setup and repair surface
- thin local state under `.sane/`
- Codex-native assets when you explicitly install or export them

That is why it can stay helpful without becoming a wrapper you must live inside.

## What Users Actually Get

### Better defaults

`Sane` can pick model and reasoning defaults from what your Codex environment can actually see.

If that detection is thin, it falls back to stable defaults.

### Optional guidance packs

`Sane` can manage packs like:

- `core`
- `caveman`
- `cavemem`
- `rtk`
- `frontend-craft`

These are meant to change how Codex behaves, not to add ceremony.

### Useful integrations

`Sane` can preview or apply recommended integrations such as:

- `Context7`
- `Playwright`
- `grep.app`

Provider-specific tooling, like Cloudflare, stays separate and opt-in.

### Recovery and trust

`Sane` can:

- preview changes before writing them
- back up Codex config
- inspect current state
- report drift
- uninstall its own managed pieces

## What It Looks Like In Practice

Typical flow:

1. Open `Sane`
2. Read the onboarding
3. Install the local runtime files
4. Preview the recommended profile
5. Apply only what you want
6. Keep using Codex normally

If you later want less, `Sane` should be able to show you what is installed and remove only its own changes.

## BuildStory Note

`Sane` is being built for [Buildstory Hackathon #2](https://www.buildstory.com/projects/sane).

The goal is to ship a real, public, open-source Codex QoL framework during the event and keep the product honest while it is still being built.
