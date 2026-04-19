<h1 align="center">⚖️ Sane</h1>

<p align="center">
  <strong>Make Codex feel better without changing how you work.</strong>
</p>

<p align="center">
  Codex-native quality of life for better defaults, safer setup, optional packs, and cleaner long sessions.
</p>

<p align="center">
  <img alt="Status" src="https://img.shields.io/badge/status-pre--release-d97706?style=flat-square">
  <img alt="Platforms" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-2563eb?style=flat-square">
  <img alt="Rust" src="https://img.shields.io/badge/built%20with-Rust-b45309?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-15803d?style=flat-square">
</p>

<p align="center">
  <a href="#why-sane">Why Sane</a> •
  <a href="#immediate-impact">Immediate Impact</a> •
  <a href="#install">Install</a> •
  <a href="#how-sane-works">How It Works</a> •
  <a href="#what-ships-today">What Ships Today</a> •
  <a href="#safety-and-reversibility">Safety</a> •
  <a href="#community">Community</a>
</p>

> [!WARNING]
> `Sane` is pre-release. The direction is locked. The exact surface is not.

> [!NOTE]
> `Sane` is being built in public for [Buildstory Hackathon #2](https://www.buildstory.com/projects/sane): ship a real open-source Codex QoL framework during the event, dogfood it hard, and make the rough edges visible while it is still early enough to fix properly.

## Why Sane

Codex is already good at the hard part.
What often feels bad is everything around it:

- defaults scattered across config
- hooks, skills, and agents installed by hand
- too much manual setup to get good behavior
- no clean recovery story when config drifts
- long sessions getting messy with no local handoff state
- agent frameworks that force commands, wrappers, or rituals before you can do normal work

`Sane` is for people who want stronger Codex behavior without turning daily work into framework ceremony.

## Immediate Impact

| Before `Sane` | After `Sane` |
| --- | --- |
| You hand-edit Codex config and hope you remember what changed. | You can preview, back up, apply, restore, and uninstall managed changes. |
| Skills, hooks, and custom agents are easy to forget or drift. | `Sane` can install and refresh the Codex-native pieces it manages. |
| Good defaults live in your head or in scattered notes. | `Sane` keeps a local config and can export that into native Codex surfaces. |
| Recovery is manual. | `doctor`, backups, and uninstall give you a clean way back out. |
| Long sessions lose shape. | Local `.sane` state gives `Sane` enough context to inspect, repair, and summarize what it changed. |

## What Sane Is

- a setup and config TUI for Codex
- a manager for Codex-native skills, hooks, custom agents, and optional config profiles
- a local-first layer that keeps just enough project state for repair, inspection, and handoff
- a way to add stronger defaults without forcing a command-first workflow

## What Sane Is Not

- not a replacement chat interface
- not a daily wrapper you must prompt through
- not a framework that requires `AGENTS.md`
- not a tool that should silently take over your repo
- not a plugin marketplace in `v1`

## Install

Right now, `Sane` runs from source.
Packaged install targets like Homebrew and `winget` are planned after `v1` stabilizes.

```bash
git clone https://github.com/lammersbjorn/sane.git
cd sane
cargo run -p sane
```

That opens the TUI.

## How People Actually Use It

### I want better defaults

1. Open `Sane`
2. Preview the core Codex profile
3. Back up config
4. Apply the profile
5. Keep using Codex normally

### I want useful integrations without editing config by hand

1. Preview the integrations profile
2. See what `Sane` wants to add
3. Apply it only if you want it

### I want different behavior from Codex, not more commands

1. Turn packs on or off in `Sane`
2. Export the managed assets you actually want
3. Choose user-level install or optional repo-local shared skills
4. Keep prompting in plain language

### Something feels broken

1. Run `status`
2. Run `doctor`
3. Restore or uninstall if needed

## How Sane Works

`Sane` has three layers.

### 1. The TUI

This is the control surface.
It is where you install, preview, apply, export, back up, restore, diagnose, and uninstall.

### 2. Local project state

`Sane` keeps a small local `.sane/` directory so it can remember what it configured, what happened recently, and how to repair or roll back managed changes.

This is not meant to become a second runtime you have to live inside.
It is there so `Sane` can stay inspectable and reversible.

### 3. Codex-native assets

This is the part that actually changes Codex behavior.

`Sane` can manage:

- a router skill that keeps the workflow plain-language first
- optional built-in packs that optimize model behavior for specific tasks
- optional hooks
- optional custom agents
- narrow Codex config profiles

So the TUI is the place you configure things.
The actual effect shows up in normal Codex sessions.

## What Ships Today

### Current built-in packs

These are current built-in packs, not a frozen long-term public API:

- `core`
  Base Sane guidance. Always on.
- `caveman`
  Shorter, more token-efficient communication bias.
- `cavemem`
  Better compact session memory and handoff bias.
- `rtk`
  Prefer RTK-routed shell execution when RTK policy exists.
- `frontend-craft`
  Stronger frontend quality and anti-generic-UI bias.

### Current Codex-facing surfaces

- router skill export
- optional repo-local skill export into `.agents/skills/`
- managed `AGENTS.md` block export
- managed hook export
- managed custom-agent export
- core Codex profile preview and apply
- integrations profile preview and apply
- optional Cloudflare profile preview and apply

### Recommended integrations today

The current recommended general integrations profile is centered on:

- `Context7`
- `Playwright`
- `grep.app`

Provider-specific profiles stay separate.

## What Gets Written Where

`Sane` is local-first and explicit about what it touches.

### Project-local

`Sane` creates and manages `.sane/` in the project for local config, state, and backups.

It can also optionally write shared repo skills into:

- `.agents/skills/`

### User-level Codex surfaces

When you explicitly export or apply things, `Sane` may update:

- `~/.agents/skills/`
- `~/.codex/AGENTS.md`
- `~/.codex/hooks.json`
- `~/.codex/agents/`
- `~/.codex/config.toml`

By design:

- `AGENTS.md` is optional
- repo mutation is optional
- unrelated user config should be preserved

<details>
<summary><strong>Exact managed paths today</strong></summary>

- `.sane/config.local.toml`
- `.sane/state/current-run.json`
- `.sane/state/summary.json`
- `.sane/state/events.jsonl`
- `.sane/state/decisions.jsonl`
- `.sane/state/artifacts.jsonl`
- `.sane/BRIEF.md`
- `.sane/backups/`
- `.agents/skills/sane-router/`
- `~/.agents/skills/sane-router/`
- optional pack skill directories exported by `Sane`
- a Sane-managed block inside `~/.codex/AGENTS.md`
- Sane-managed entries inside `~/.codex/hooks.json`
- Sane-managed custom agent files inside `~/.codex/agents/`
- narrow diffs to `~/.codex/config.toml` when you apply profiles

</details>

## Safety And Reversibility

`Sane` is supposed to be easy to trust because it is easy to inspect.

| Action | What it means |
| --- | --- |
| `preview` | Show what `Sane` wants to do without writing files. |
| `backup` | Save the current Codex config before a risky change. |
| `apply` | Write a managed config profile. |
| `export` | Install or refresh Codex-native assets like skills, hooks, or custom agents. |
| `doctor` | Inspect local runtime and managed Codex surfaces for missing, invalid, or stale state. |
| `restore` | Roll Codex config back to a previous backup. |
| `uninstall` | Remove Sane-managed assets while leaving unrelated user content alone. |

## What Is Still Moving

Some things are intentionally still in motion:

- the exact long-term built-in pack set
- broader model and subagent routing policy
- distribution channels after `v1`
- later one-shot and self-improvement workflows

The stable direction is already locked:

- Codex-native
- no required `AGENTS.md`
- no required repo mutation
- local-first
- reversible
- adaptive, not rigid

## Community

- [Contributing guide](./CONTRIBUTING.md)
- [Support guide](./SUPPORT.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)

<details>
<summary><strong>Workspace docs</strong></summary>

- [`crates/sane-tui/README.md`](./crates/sane-tui/README.md)
- [`crates/sane-core/README.md`](./crates/sane-core/README.md)
- [`crates/sane-config/README.md`](./crates/sane-config/README.md)
- [`crates/sane-platform/README.md`](./crates/sane-platform/README.md)
- [`crates/sane-state/README.md`](./crates/sane-state/README.md)
- [`crates/sane-policy/README.md`](./crates/sane-policy/README.md)
- [`docs/decisions/2026-04-19-sane-decision-log.md`](./docs/decisions/2026-04-19-sane-decision-log.md)

</details>

## License

Licensed under either Apache-2.0 or MIT, at your option.
