# ⚖️ Sane

<p align="center">
  <strong>Make Codex feel better without changing how you work.</strong>
</p>

<p align="center">
  A Codex-native quality-of-life layer for setup, defaults, routing, repair, and long-session hygiene.
</p>

<p align="center">
  <img alt="Status" src="https://img.shields.io/badge/status-pre--release-d97706?style=flat-square">
  <img alt="Platforms" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-2563eb?style=flat-square">
  <img alt="Rust" src="https://img.shields.io/badge/built%20with-Rust-b45309?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-15803d?style=flat-square">
</p>

<p align="center">
  <a href="#why-sane">Why Sane</a> •
  <a href="#what-sane-is">What Sane Is</a> •
  <a href="#who-its-for">Who It's For</a> •
  <a href="#how-it-feels">How It Feels</a> •
  <a href="#what-it-manages">What It Manages</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#community">Community</a>
</p>

> [!WARNING]
> `Sane` is still pre-release.
> It is being built in public and actively dogfooded, but the surface area is not stable yet.

## Why Sane

Codex is already powerful. The friction is everything around it:

- repeating the same model, reasoning, and hook setup across machines and repos
- changing Codex config by hand with no clean preview or backup
- letting long sessions get messy with no clear state, summary, or repair flow
- adopting frameworks that replace plain-language work with commands and ritual

`Sane` exists to fix that operational layer without becoming another thing you have to "use correctly."

## What Sane Is

`Sane` is a local-first installer and configuration TUI for Codex.

It helps you:

- keep using plain-language prompting
- manage Codex-native assets safely
- tune model and reasoning defaults
- keep long sessions healthier
- inspect, repair, back up, restore, and uninstall what it manages

`Sane` is not a replacement chat interface and not a wrapper you have to prompt through every day.

Here, "Codex-native assets" means things like:

- skills
- hooks
- custom agents
- managed overlays such as `AGENTS.md` guidance blocks

## Who It's For

`Sane` is for anyone using Codex:

- people with zero custom setup who want a better default experience
- people with highly opinionated setups who want safer management
- solo developers who want cleaner local workflows
- teams that may later want shared Codex-native conventions

If your ideal workflow is "configure once, then just talk to Codex normally," `Sane` is aimed at you.

## How It Feels

1. Open `Sane`.
2. Pick your defaults, packs, and optional profiles.
3. Go back to Codex and work normally.
4. Let `Sane` manage the surrounding setup, safety rails, and local state.

The goal is simple: better behavior, less ceremony.

## What It Manages

| Area | What you get |
| --- | --- |
| Model defaults | Coordinator, sidecar, and verifier presets with reasoning levels |
| Codex config | Safe preview, backup, apply, and restore flows |
| Codex-native assets | Managed user skills, hooks, custom agents, and overlays |
| Local state | Project-local `.sane` state for status, summaries, events, and repair |
| Safety | `doctor`, uninstall, backups, and managed-file boundaries |
| Profiles | Lean default profile plus optional integration and provider profiles |

## What Sane Does Not Require

- `AGENTS.md`
- repo mutation
- command-first workflows
- one fixed development methodology
- a separate daily runtime outside Codex

Repository-level exports may exist later, but they are optional by design.

## How It Works

```mermaid
flowchart LR
    U["You"] --> T["Sane TUI"]
    T --> C["Codex config and assets"]
    T --> S["Local .sane state"]
    U --> X["Codex"]
    C --> X
    S --> T
```

In plain English:

- you keep talking to Codex directly
- `Sane` manages the setup around that workflow
- local state stays local by default
- Codex-native surfaces stay first-class

## Getting Started

Today, `Sane` runs from source.
Packaging for Homebrew, `winget`, and other channels is planned after `v1` stabilizes.

```bash
cargo run -p sane
```

That opens the TUI.

## Project Status

Current public focus:

- a real install and configuration TUI
- safe Codex config inspection and profile application
- managed Codex-native assets
- adaptive model-role groundwork
- local-first state, privacy, and repair flows

## Community

- [Contributing guide](./CONTRIBUTING.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)
- [Support guide](./SUPPORT.md)

<details>
<summary><strong>Contributor map</strong></summary>

If you want to work on `Sane` itself:

- [`crates/sane-tui/README.md`](./crates/sane-tui/README.md) — the user-facing app surface
- [`crates/sane-core/README.md`](./crates/sane-core/README.md) — shared contracts and generated content
- [`crates/sane-config/README.md`](./crates/sane-config/README.md) — config schema and validation
- [`crates/sane-platform/README.md`](./crates/sane-platform/README.md) — path and platform discovery
- [`crates/sane-state/README.md`](./crates/sane-state/README.md) — project-local operational state
- [`crates/sane-policy/README.md`](./crates/sane-policy/README.md) — adaptive routing groundwork

Core project docs:

- [`docs/decisions/2026-04-19-sane-decision-log.md`](./docs/decisions/2026-04-19-sane-decision-log.md)
- [`docs/specs/2026-04-19-sane-design.md`](./docs/specs/2026-04-19-sane-design.md)
- [`TODO.md`](./TODO.md)

</details>

## License

Licensed under either Apache-2.0 or MIT, at your option.
