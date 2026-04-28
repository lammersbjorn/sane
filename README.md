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
  <img alt="TypeScript" src="https://img.shields.io/badge/built%20with-TypeScript-2563eb?style=flat-square">
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

It is a setup, configuration, status, and recovery layer for Codex. You use `Sane` when you want Codex to start from better defaults, manage a few Codex-native installs for you, or recover cleanly when your setup drifts.

At a high level, `Sane` gives you:

- a guided TUI for Home, Settings, Add to Codex, Status, Repair, and Uninstall
- a thin local `.sane/` runtime for config, state, and backups
- managed Codex-native surfaces such as skills, `AGENTS.md` overlays, hooks, custom agents, and narrow config diffs
- read-only Status visibility for runtime and managed-surface state

> [!TIP]
> The goal is simple: use `Sane` to set things up, then keep using Codex normally.

## Who It's For

`Sane` is for people who use Codex and want a better operating baseline without adding process theater.

Good fit:

- you want better defaults without hand-editing config files
- you want preview, backup, restore, and uninstall paths
- you want optional guidance packs, hooks, or shared repo installs
- you want Codex-native behavior changes, not a new mandatory workflow
- you want long sessions to leave behind a small, readable local record

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
| Skills, hooks, and custom agents drift over time. | `Sane` can install, refresh, check, and remove the pieces it manages. |
| Something breaks and recovery is manual. | Status, setup checks, backups, and uninstall give you a clear repair path. |
| Long runs leave little local context behind. | `.sane/` keeps a thin operational record for status, repair, and handoff. |

## What You Get Today

### User-facing control surface

- no-args control-center TUI, with guided setup on first launch
- `sane settings` shortcut into the settings/configure area
- Home, Settings, Add to Codex, Status, Repair, and Uninstall flows

### Better Codex defaults

`Sane` can preview and apply a narrow Codex profile for:

- model
- reasoning effort
- hook support

When no saved local config exists yet, `Sane` derives recommended defaults from the Codex models it can detect on that machine and falls back to stable defaults when detection is thin.

Routing note:
- `Sane` uses task-shaped model routing, not one static fallback chain.
- Sane separates documented model availability, local picker visibility, and actually spawnable runtime support.
- Dated model availability findings live in `docs/research/2026-04-19-model-subagent-matrix.md`; product docs should stay at the stable routing-class level.

### Recommended integrations

`Sane` can preview and apply a separate recommended integrations profile for:

- `Context7`
- `Playwright`
- `grep.app`

There is also a separate opt-in Cloudflare profile.

And a separate opt-in native Codex statusline/title profile.

### Optional guidance packs

Built-in packs currently exposed in `Sane`:

- `core`
- `caveman`
- `rtk`
- `frontend-craft`

These packs change guidance and behavior. They are not meant to turn the product into a command ritual.
Optional packs export concrete skills where that keeps routing sharp (`sane-caveman`, `sane-rtk`, and the `frontend-craft` skill set today). Packs can also change router, overlay, hook, or agent guidance.

### Codex-native installs

`Sane` can currently manage:

- the user-level core skills `sane-router`, `sane-bootstrap-research`, `sane-agent-lanes`, `sane-outcome-continuation`, and `continue`
- optional repo-local shared skills in `.agents/skills/`
- optional additive repo-local guidance in `AGENTS.md`
- an additive global guidance block in `~/.codex/AGENTS.md`
- Sane-managed entries in `~/.codex/hooks.json`
- Sane-managed custom agents in `~/.codex/agents/`
- optional Sane-managed Codex plugin artifact in `~/.codex/plugins/sane/` with marketplace entry in `~/.agents/plugins/marketplace.json`
- optional full OpenCode export in `~/.config/opencode/`, including Sane skills, a global guidance block, and Sane agents using cost-aware OpenCode Go model IDs

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
| TUI | Gives you one place to understand, preview, add to Codex, check status, repair, and uninstall. |
| Local `.sane/` runtime | Keeps a thin, readable local record instead of hiding state in your head. |
| Codex-native surfaces | These are the actual behavior changes: skills, overlays, hooks, custom agents, and narrow config updates. |

This split matters because it keeps `Sane` useful without making it a wrapper you must live inside.

## Quick Start

Right now, `Sane` still runs from source, but the default repo launcher now goes through the built TypeScript TUI path. The repo already has a local packaged-build path for the TUI (`build:package` / `build:smoke`), while public release automation stays post-`v1`.

```bash
git clone https://github.com/lammersbjorn/sane.git
cd sane
pnpm install
pnpm start
```

That opens the TUI. On first launch, Home walks you through setup. After setup, normal launch opens as the control center.

When using the installed CLI, `sane install` always opens the guided install/tune-up wizard.

If you already know you want the settings/configure area, run:

```bash
pnpm run start:settings
```

Direct shortcuts also exist:

```bash
pnpm run start:status
pnpm run start:repair
```

If you want the longer user-story version, read [docs/what-sane-does.md](./docs/what-sane-does.md).

## Today Vs Later

| Status | Scope |
| --- | --- |
| In place today | Control-center TUI with first-launch setup, local `.sane/` runtime, read-only Status visibility, config preview/apply/restore, recommended integrations profile, opt-in Cloudflare profile, managed skills, additive `AGENTS.md` overlays, hooks, custom agents, optional Codex plugin artifact export, setup checks, and uninstall. |
| Planned later | Public release packaging/distribution automation (GitHub Releases, npm publish, Homebrew, winget, Scoop), broader adaptive orchestration, post-`v1` pack expansion/contraction, and a later end-to-end outcome runner / one-shot flow. |

> [!IMPORTANT]
> The later end-to-end outcome runner is future work. It is not the current product surface.

## What `Sane` Writes

`Sane` is explicit about what it touches.

| Scope | Paths |
| --- | --- |
| Project-local runtime | `.sane/config.local.toml`, `.sane/state/*`, `.sane/BRIEF.md`, `.sane/backups/` |
| Optional repo-local exports | `.agents/skills/`, `AGENTS.md` |
| User-level Codex surfaces | `~/.agents/skills/`, `~/.codex/AGENTS.md`, `~/.codex/hooks.json`, `~/.codex/agents/`, `~/.codex/plugins/sane/`, `~/.agents/plugins/marketplace.json`, `~/.codex/config.toml` |
| Optional OpenCode surfaces | `~/.config/opencode/skills/`, `~/.config/opencode/AGENTS.md`, `~/.config/opencode/agents/` |

Design rules:

- no required `AGENTS.md`
- no required repo mutation
- preserve unrelated user content
- keep uninstall and restore scoped to Sane-managed changes

## Safety And Reversibility

`Sane` should be easy to trust because it is easy to check.

| Action | What it is for |
| --- | --- |
| `preview` | Show what `Sane` would change before writing files. |
| `backup` | Save your current Codex config before a risky write. |
| `apply` | Write the narrow profile or integration changes you chose. |
| `export` | Install or refresh managed Codex-native pieces. |
| `status` / setup check | Show what is installed, missing, stale, or invalid. |
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

- [`apps/sane-tui/README.md`](./apps/sane-tui/README.md)
- [`docs/decisions/2026-04-19-sane-decision-log.md`](./docs/decisions/2026-04-19-sane-decision-log.md)

</details>

## License

Licensed under either Apache-2.0 or MIT, at your option.
