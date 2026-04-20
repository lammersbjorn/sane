<h1 align="center">⚖️ Sane</h1>

<p align="center">
  <strong>Make Codex easier to trust, easier to tune, and easier to recover.</strong>
</p>

<p align="center">
  <code>Sane</code> is an onboarding-first setup and repair tool for Codex. It helps you install better defaults, manage optional guidance packs, preview narrow config changes, and keep a reversible local record of what changed.
</p>

<p align="center">
  <img alt="Status" src="https://img.shields.io/badge/status-pre--release-d97706?style=flat-square">
  <img alt="Platforms" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-2563eb?style=flat-square">
  <img alt="Rust" src="https://img.shields.io/badge/built%20with-Rust-b45309?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-15803d?style=flat-square">
</p>

<p align="center">
  <a href="#what-sane-is">What Sane Is</a> •
  <a href="#who-its-for">Who It's For</a> •
  <a href="#what-changes-in-practice">What Changes</a> •
  <a href="#what-you-get-today">What You Get</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#today-vs-later">Today vs Later</a>
</p>

> [!WARNING]
> `Sane` is pre-release. The product direction is locked. The exact surface is still being refined.

> [!NOTE]
> Project note: `Sane` is being built in public for [BuildStory Hackathon #2](https://www.buildstory.com/projects/sane). This belongs here as project context, not as the main product story.

## What Sane Is

`Sane` is not another chat app and not a daily wrapper you have to prompt through.

It is a setup, configuration, inspection, and recovery layer for Codex. You use `Sane` when you want Codex to start from better defaults, manage a few Codex-native installs for you, or recover cleanly when your setup drifts.

At a high level, `Sane` gives you:

- a guided TUI for onboarding, settings, install, inspection, and repair
- a thin local `.sane/` runtime for config, state, and backups
- managed Codex-native surfaces such as skills, `AGENTS.md` overlays, hooks, custom agents, and narrow config diffs

> [!TIP]
> The goal is simple: use `Sane` to set things up, then keep using Codex normally.

## Who It's For

`Sane` is for people who use Codex and want a better operating baseline without adding process theater.

Good fit:

- you want better defaults without hand-editing config files
- you want preview, backup, restore, and uninstall paths
- you want optional guidance packs, hooks, or shared repo installs
- you want Codex-native behavior changes, not a new mandatory workflow
- you want long sessions to leave behind a small, inspectable local record

Not the point:

- replacing Codex with a separate runtime
- forcing `AGENTS.md` on every repo
- making repo mutation mandatory
- adding a command ritual before normal work can begin

## What Changes In Practice

| Without `Sane` | With `Sane` |
| --- | --- |
| You hand-edit Codex settings and hope you remember what changed. | You can preview, back up, apply, restore, and uninstall managed changes. |
| Good defaults live in scattered notes or muscle memory. | `Sane` saves local settings and can export them into Codex-native surfaces. |
| Skills, hooks, and custom agents drift over time. | `Sane` can install, refresh, inspect, and remove the pieces it manages. |
| Something breaks and recovery is manual. | `status`, `doctor`, backups, and uninstall give you a clear repair path. |
| Long runs leave little local context behind. | `.sane/` keeps a thin operational record for inspection, repair, and handoff. |

## What You Get Today

### User-facing control surface

- no-args onboarding TUI
- `sane settings` shortcut into the settings/configure area
- install, inspect, repair, export, and uninstall flows

### Better Codex defaults

`Sane` can preview and apply a narrow Codex profile for:

- model
- reasoning effort
- hook support

When no saved local config exists yet, `Sane` derives recommended defaults from the Codex models it can detect on that machine and falls back to stable defaults when detection is thin.

### Recommended integrations

`Sane` can preview and apply a separate recommended integrations profile for:

- `Context7`
- `Playwright`
- `grep.app`

There is also a separate opt-in Cloudflare profile.

### Optional guidance packs

Built-in packs currently exposed in `Sane`:

- `core`
- `caveman`
- `cavemem`
- `rtk`
- `frontend-craft`

These packs change guidance and behavior. They are not meant to turn the product into a command ritual.

### Codex-native installs

`Sane` can currently manage:

- the user-level `sane-router` skill
- optional repo-local shared skills in `.agents/skills/`
- optional additive repo-local guidance in `AGENTS.md`
- an additive global guidance block in `~/.codex/AGENTS.md`
- Sane-managed entries in `~/.codex/hooks.json`
- Sane-managed custom agents in `~/.codex/agents/`

### Local runtime and repair tools

`Sane` keeps a small local runtime under `.sane/` for:

- local config
- run snapshot and summary files
- event, decision, and artifact logs
- a brief handoff file
- Codex config backups

## How It Works

The short version:

1. Open `Sane`.
2. Review the onboarding and settings in plain language.
3. Preview the changes you want.
4. Apply only the pieces you choose.
5. Keep using Codex normally.

Under the hood, `Sane` has three layers:

| Layer | Why users should care |
| --- | --- |
| TUI | Gives you one place to understand, preview, install, inspect, and repair. |
| Local `.sane/` runtime | Keeps a thin, inspectable local record instead of hiding state in your head. |
| Codex-native surfaces | These are the actual behavior changes: skills, overlays, hooks, custom agents, and narrow config updates. |

This split matters because it keeps `Sane` useful without making it a wrapper you must live inside.

## Quick Start

Right now, `Sane` runs from source. Packaged installs come later.

```bash
git clone https://github.com/lammersbjorn/sane.git
cd sane
cargo run -p sane
```

That opens the onboarding TUI.

If you already know you want the settings/configure area, run:

```bash
cargo run -p sane -- settings
```

If you want the longer user-story version, read [docs/what-sane-does.md](./docs/what-sane-does.md).

## Today Vs Later

| Status | Scope |
| --- | --- |
| In place today | Onboarding-first TUI, local `.sane/` runtime, config preview/apply/restore, recommended integrations profile, opt-in Cloudflare profile, managed skills, additive `AGENTS.md` overlays, hooks, custom agents, status/doctor, uninstall. |
| Planned later | Packaging and distribution polish, broader adaptive orchestration, exact long-term pack set, and a later end-to-end outcome runner / one-shot flow. |

> [!IMPORTANT]
> The later end-to-end outcome runner is future work. It is not the current product surface.

## What `Sane` Writes

`Sane` is explicit about what it touches.

| Scope | Paths |
| --- | --- |
| Project-local runtime | `.sane/config.local.toml`, `.sane/state/*`, `.sane/BRIEF.md`, `.sane/backups/` |
| Optional repo-local exports | `.agents/skills/`, `AGENTS.md` |
| User-level Codex surfaces | `~/.agents/skills/`, `~/.codex/AGENTS.md`, `~/.codex/hooks.json`, `~/.codex/agents/`, `~/.codex/config.toml` |

Design rules:

- no required `AGENTS.md`
- no required repo mutation
- preserve unrelated user content
- keep uninstall and restore scoped to Sane-managed changes

## Safety And Reversibility

`Sane` should be easy to trust because it is easy to inspect.

| Action | What it is for |
| --- | --- |
| `preview` | Show what `Sane` would change before writing files. |
| `backup` | Save your current Codex config before a risky write. |
| `apply` | Write the narrow profile or integration changes you chose. |
| `export` | Install or refresh managed Codex-native pieces. |
| `status` / `doctor` | Show what is installed, missing, stale, or invalid. |
| `restore` | Roll back to the latest local backup. |
| `uninstall` | Remove only Sane-managed content while leaving unrelated content alone. |

## Learn More

- [What Sane Does](./docs/what-sane-does.md)
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
