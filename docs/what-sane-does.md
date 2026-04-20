# ⚖️ What Sane Does

`Sane` helps Codex feel better without forcing you into a new daily workflow.

If the README is the short product page, this file is the plain-English walkthrough.

## The Short Version

`Sane` is a setup and repair tool for Codex.

You use it when you want to:

- start from better defaults
- preview changes before writing them
- install optional Codex-native helpers
- inspect what is currently installed
- recover cleanly when something drifts

Then you go back to using Codex normally.

> [!TIP]
> `Sane` is not the place where you do your everyday prompting. It is the place where you set up, inspect, and repair the Codex environment around that prompting.

## Who It Is For

`Sane` is for Codex users who want stronger behavior with less manual setup.

It is especially useful if you want:

- better defaults without memorizing config details
- optional guidance packs without manually managing every exported file
- clearer install and repair flows
- a local, inspectable record of what changed
- a way to share some repo-local guidance without forcing every repo into the same setup

It is not aimed at people looking for:

- a replacement for Codex
- a wrapper command they must use for every request
- a system that silently takes over their repo

## What Changes When You Use It

### 1. You get a guided control surface

Running `Sane` opens a TUI that explains the main choices in plain language:

- what to install
- what is optional
- what gets written
- how to back up, restore, inspect, or uninstall

That matters because the product is supposed to be understandable before it is powerful.

### 2. You can apply better defaults without broad config surgery

`Sane` can preview and apply a narrow Codex profile for:

- model
- reasoning effort
- hook support

It also keeps recommended integrations separate, so "better defaults" does not have to mean "rewrite everything."

### 3. You can install Codex-native pieces without hand-wiring them

Today, `Sane` can manage:

- the `sane-router` skill
- optional built-in pack skills
- optional repo-local shared skills
- optional additive guidance blocks in repo or global `AGENTS.md`
- Sane-managed hook entries
- Sane-managed custom agents

Those are the things that actually change Codex behavior.
The TUI is the control surface; the Codex-native exports are the end result.

### 4. You get a thin local runtime for trust and recovery

`Sane` keeps a small `.sane/` folder in the project for:

- local config
- state snapshots
- summaries and event logs
- backup files
- brief handoff context

This is not meant to become a second runtime.
It exists so `Sane` can answer practical questions like:

- what changed
- what looks broken
- what can be repaired
- what can be rolled back

## What Users Actually Get Today

| Need | What `Sane` gives you now |
| --- | --- |
| Better starting defaults | Detection-based recommendations with stable fallback defaults. |
| Safer changes | Preview, backup, apply, restore, uninstall. |
| Optional guidance packs | `core`, `caveman`, `cavemem`, `rtk`, and `frontend-craft`. |
| Useful integrations | Separate recommended integrations profile for `Context7`, `Playwright`, and `grep.app`. |
| Provider-specific add-ons | Separate opt-in Cloudflare profile. |
| Shared or personal installs | User-level exports plus optional repo-local shared installs. |
| Repair visibility | `status` and `doctor` to inspect managed runtime and Codex-native surfaces. |

## How It Works Under The Hood

At a high level, `Sane` has three layers:

| Layer | What it does |
| --- | --- |
| TUI | Explains options, previews changes, and runs install/inspect/repair flows. |
| Local `.sane/` runtime | Stores just enough local config, state, and backups for repair and handoff. |
| Codex-native surfaces | Skills, overlays, hooks, custom agents, and narrow config writes that actually change behavior. |

This structure is what lets `Sane` stay user-facing first without becoming a wrapper-first product.

## What Is Already Real Vs Planned Later

| Already in place | Planned later |
| --- | --- |
| Onboarding-first TUI | Packaging and distribution polish |
| Settings/configure flow | Exact long-term pack set |
| Preview/apply/restore for narrow Codex config | Broader adaptive orchestration |
| Recommended integrations profile | Later end-to-end outcome runner / one-shot flow |
| Cloudflare provider profile | Additional future packaging channels |
| Export, inspect, doctor, uninstall | More post-`v1` expansion work |

The important boundary:

- the later one-shot idea is future work
- it is not the current product surface
- docs should not present it as something users already have

## What Sane Is Not

- not a replacement prompt UI
- not a daily command wrapper
- not a framework that requires `AGENTS.md`
- not a repo takeover mechanism
- not a promise that every future idea is already shipping

For the project note about BuildStory Hackathon #2, see the root [README.md](../README.md).
