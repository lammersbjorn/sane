# ⚖️ What Sane Does

`Sane` helps Codex feel better without forcing you into a new daily workflow.

The framework behavior lives in Codex-native installs and policy. The TUI is the current control surface for setting that up, checking it, and repairing it.

If the README is the short product page, this file is the plain-English walkthrough.

## The Short Version

`Sane` is a framework layer for Codex, with setup and repair as the current user-facing control surface.

You use it when you want to:

- start from better defaults
- preview changes before writing them
- install optional Codex-native helpers
- check what is currently installed
- recover cleanly when something drifts

Then you go back to using Codex normally.

> [!TIP]
> `Sane` is not the place where you do your everyday prompting. It is the place where you set up, check, and repair the Codex environment around that prompting.

## Who It Is For

`Sane` is for Codex users who want stronger behavior with less manual setup.

It is especially useful if you want:

- better defaults without memorizing config details
- optional guidance packs without manually managing every exported file
- clearer setup and repair flows
- a local, readable record of what changed
- a way to share some repo-local guidance without forcing every repo into the same setup

It is not aimed at people looking for:

- a replacement for Codex
- a wrapper command they must use for every request
- a system that silently takes over their repo

## What Changes When You Use It

### 1. You get a guided control surface

Running `Sane` opens a TUI that explains the main choices in plain language:

- what to add to Codex
- what is optional
- what gets written
- how to back up, restore, check status, or uninstall

That matters because the framework is supposed to be understandable before it is powerful.

### 2. You can apply better defaults without broad config surgery

`Sane` can preview and apply a narrow Codex profile for:

- model
- reasoning effort
- hook support

It also keeps recommended integrations separate, so "better defaults" does not have to mean "rewrite everything."

Routing note:
- `Sane` uses task-shaped routing, not one static fallback chain.
- Policy/docs routing classes are: `explorer`, `implementation`, `verifier`, and `realtime` (with coordinator authority kept at session level).
- Documented model availability, picker visibility, and actually spawnable worker support can drift over time; dated research notes capture those moving details.
- Settings shows the configured routing defaults, plan hints, supported reasoning efforts when known, and the capability line behind each selected routing default.

### 3. You can install Codex-native pieces without hand-wiring them

Today, `Sane` can manage:

- the core skills `sane-router`, `sane-bootstrap-research`, `sane-agent-lanes`, `sane-outcome-continuation`, and `continue`
- a fixed built-in pack set: always-on `core` plus optional `caveman`, `rtk`, and `frontend-craft`
- concrete optional skill exports where applicable: `sane-caveman` from `caveman`, `sane-rtk` from `rtk`, plus the Sane-owned frontend skills `sane-frontend-craft`, `sane-frontend-visual-assets`, and `sane-frontend-review` from `frontend-craft`
- optional packs can also change Sane's exported always-on guidance, router guidance, hooks, and custom-agent templates
- installed `caveman` pack guidance is enforced in Sane's exported always-on guidance, not left as an optional soft note
- the separate recommended integrations profile for Codex tools like `Context7`, `Playwright`, and `grep.app`
- structured integrations audit output in add/apply/status flows so recommended adds are reviewable before write without summary-string guessing
- a compact Sane continuity prompt in the managed Codex profile so automatic compaction preserves current objective, verified state, active rules, next actions, and blocker state without turning summaries into repo overviews
- warning-only conflict visibility for invalid Codex config, disabled `features.codex_hooks`, unmanaged `mcp_servers.*`, managed MCP drift, explicit model/reasoning drift, explicit statusline drift, native Codex memories enabled, enabled `plugins.*` entries, and oversized always-loaded guidance files, so users can see possible interference without Sane auto-fixing their setup
- optional repo-local shared skills when a repo actually needs shared targeted behavior
- optional additive guidance blocks in global or repo `AGENTS.md`, with repo `AGENTS.md` reserved for explicit broad guidance
- Sane-managed hook entries
- Sane-managed custom agents
- optional full OpenCode export under `~/.config/opencode/`, with Sane skills, a global guidance block, and Sane agents mapped to OpenCode Go models by task

Those are the things that actually change Codex behavior.
The TUI is the control surface; the framework behavior lives in the Codex-native exports.

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

Important continuity boundary:

- `Sane` does not depend on a third-party memory layer
- `Sane` also does not currently depend on Codex native `memories` for default continuity
- default continuity comes from thin local `.sane` state plus scoped Codex-native exports

## What Users Actually Get Today

| Need | What `Sane` gives you |
| --- | --- |
| Better starting defaults | Task-shaped routing classes (`explorer` / `implementation` / `verifier` / `realtime`) with configured defaults and capability constraints shown in Settings; dated research tracks fast-moving model availability details. |
| Safer changes | Preview, backup, apply, restore, uninstall, and local telemetry reset. |
| Runtime and surface truth | Read-only Status view for managed runtime and Codex-native surfaces. |
| Optional guidance packs | Fixed built-in set today: `core` + optional `caveman`, `rtk`, `frontend-craft`. `caveman` exports `sane-caveman`, `rtk` exports `sane-rtk`, and `frontend-craft` exports compact Sane-owned build, visual-assets, and review skills. When `rtk` is enabled, Status also checks for the companion `rtk` binary on `PATH`. |
| Useful integrations | Separate recommended integrations profile for `Context7`, `Playwright`, and `grep.app`, with structured audit details shown before apply. |
| Native Codex TUI polish | Optional native Codex statusline/title profile over `tui.status_line`, `tui.terminal_title`, and `tui.notification_condition`. |
| Provider-specific add-ons | Separate opt-in Cloudflare profile. |
| Shared or personal installs | Mostly user-level exports, plus explicit repo-local installs when needed and optional OpenCode export. |
| Repair visibility | Status and setup checks for managed runtime and Codex-native surfaces, plus explicit repair/remove actions in the TUI. |

What `Sane` does not currently try to own:
- Codex native `memories` as the canonical continuity layer
- a custom status-bar system on top of Codex
- RTK binary distribution; Sane checks for upstream [`rtk`](https://github.com/rtk-ai/rtk) on `PATH`, but does not own or publish RTK. Upstream install paths are Homebrew, install script, Cargo, or release binaries. Future Sane Homebrew packaging should depend on upstream `rtk`.

## How It Works Under The Hood

At a high level, `Sane` has three layers:

| Layer | What it does |
| --- | --- |
| TUI | Current control surface for Home, Settings, Add to Codex, Status, Repair, and Uninstall flows. |
| Local `.sane/` runtime | Stores just enough local config, state, and backups for repair and handoff. |
| Codex-native surfaces | Skills, overlays, hooks, custom agents, and narrow config writes that carry the framework behavior. |

This structure is what lets `Sane` stay framework-first without becoming a wrapper-first product.

## What Is Already Real Vs Planned Later

| Already in place | Planned later |
| --- | --- |
| Control-center TUI with first-launch setup | Homebrew, winget, and Scoop rollout after the `v1` artifact shape is stable |
| Settings flow | Post-`v1` pack expansion/contraction execution |
| Preview/apply/restore for narrow Codex config | Broader adaptive orchestration |
| Recommended integrations profile | Broader adaptive orchestration beyond the current framework state transition |
| Cloudflare provider profile | Additional future packaging channels |
| Add to Codex, Status, setup checks, Uninstall | More post-`v1` expansion work |

The important boundary:

- the later end-to-end outcome runner is future work
- it is not the current product surface
- docs should not present it as something users already have

## What Sane Is Not

- not a replacement prompt UI
- not a daily command wrapper
- not a framework that requires `AGENTS.md`
- not a repo takeover mechanism
- not a promise that every future idea is already shipping

For the project note about BuildStory Hackathon #2, see the root [README.md](../README.md).
