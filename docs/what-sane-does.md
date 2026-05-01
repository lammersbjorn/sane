# What Sane Does

`Sane` gives Codex better defaults, sharper workflows, and cleaner recovery without moving your work into a wrapper.

It does that by installing Codex-native framework pieces: skills, guidance overlays, custom agents, optional hooks, narrow Codex config profiles, and optional packs. The `sane` command is the setup/status/repair service for those pieces, not the place where everyday prompting happens.

## Short Version

Use `Sane` when you want Codex to:

- start from clearer defaults
- route non-trivial work into sharper workflows
- use reusable skills without hand-wiring every repo
- split broad work into scoped agent lanes when helpful
- preview config changes before writing them
- show what is installed, stale, missing, or invalid
- recover cleanly when managed pieces drift

Then use Codex normally.

Sane's job is not to become the main interface. Its job is to make the Codex environment around that interface easier to trust.

## Framework Pieces

### Core Skills

The core pack exports focused workflow skills:

| Skill | Purpose |
| --- | --- |
| `sane-router` | Chooses the next concrete skill, lane, or managed operation for non-trivial work. |
| `sane-bootstrap-research` | Guides new project or stack research before implementation when current choices matter. |
| `sane-agent-lanes` | Splits broad work into owned lanes with boundaries, verification, and review. |
| `sane-outcome-continuation` | Keeps plain-language outcomes moving through plan, implement, verify, repair, and resume loops. |
| `continue` | Handles resume/keep-going requests without losing the active workstream. |

These are installed as Codex skills, so normal Codex task routing can use them.

### Guidance Overlays

Sane can add managed guidance blocks to:

- user-level `~/.codex/AGENTS.md`
- optional repo-level `AGENTS.md`

The overlays stay small. They point Codex toward Sane's skills and packs instead of stuffing every rule into always-loaded prose.

Repo guidance is optional. Sane should not make every repository carry a Sane setup.

### Custom Agents

Sane can install custom agent templates for common work shapes:

- coordinator / primary Sane agent
- read-only explorer
- bounded implementation worker
- read-only reviewer
- fast realtime sidecar

The point is not agent theater. The point is clearer ownership for broad work: inspect, implement, review, and integrate with explicit boundaries.

Enabled pack notes are active instructions inside these custom agents. For example, when the `caveman` pack is enabled, the generated agents are told to use the `sane-caveman` prose rules directly instead of treating the pack as a passive status note.

### Hooks

Sane can manage Codex hook entries for supported environments. Hook export is optional and platform-sensitive: native Windows cannot use Codex hooks, so hook workflows belong in WSL there.

The managed `SessionStart` hook injects a compact Sane obligation receipt. It keeps routing, skill-loading, broad-work lane handoff, blocked-handoff, and optional-pack state visible after long sessions and resumes.

### Codex Config Profiles

Sane can preview, apply, back up, and restore narrow Codex config changes:

- model and reasoning defaults
- task-shaped subagent defaults
- compact continuity prompt with the same Sane obligation receipt for compaction recovery
- recommended integrations profile for `Context7`, `Playwright`, and `grep.app`
- optional Cloudflare profile
- optional native Codex statusline/title profile

These are stable user-level preference surfaces, not broad prompt injection.

These are selective writes. Sane should not replace or own all of a user's Codex config.

### Optional Packs

Current v1 pack set:

| Pack | Exported behavior |
| --- | --- |
| `core` | Required framework skills, overlays, and agents. |
| `caveman` | `sane-caveman` for terse prose routing. |
| `rtk` | `sane-rtk` for RTK-aware shell/search/test/log routing. |
| `frontend-craft` | `sane-frontend-craft`, `sane-frontend-visual-assets`, and `sane-frontend-review`. |
| `docs-craft` | `sane-docs-writing` for source-verified README, user-doc, changelog, release-note, migration-note, support-doc, and product-doc rewrites. |

Optional packs are opt-in additions. They may add skills, overlay guidance, hook behavior, or agent guidance, but they are not the base product.

## Local Runtime

Sane keeps a small `.sane/` folder for operational state:

- local config
- run and status snapshots
- summaries and event/history logs
- brief handoff context
- backups
- policy/readiness metadata

Readiness and blocker checks use this Sane-owned state only. Sane does not mine raw Codex logs.

This state exists for trust and recovery. It is not a second agent runtime and not a replacement for Codex.

## Control Surface

The current control surface is a terminal UI with these jobs:

- install or repair the local `.sane/` runtime
- edit Sane settings and optional packs
- preview config/profile changes
- add Sane framework pieces to Codex
- show status and drift
- restore backups
- uninstall managed surfaces

It is intentionally maintenance-oriented. Once the Codex-native pieces are installed, the framework behavior lives in Codex.

## What Users Get Today

| Need | What Sane provides |
| --- | --- |
| Better agent baseline | Core skills, guidance overlays, and task-shaped agent templates. |
| Safer setup | Preview, backup, apply, restore, status, repair, and uninstall. |
| Optional behavior packs | Caveman, RTK, frontend-craft, and docs-craft packs with concrete exported skills. |
| Config clarity | Narrow Codex profile writes with drift visibility rather than broad config takeover. |
| Local recovery state | Thin `.sane/` state for status, handoff, history, and backups. |
| Optional issue relay | Separate opt-in GitHub issue draft and reviewed submit flow for Sane problems; duplicate checks block submit until reviewed, and telemetry alone never submits reports. |
| Shared repo behavior | Optional repo-local skills and guidance when a repository explicitly needs them. |

## What Sane Is Not

- not a replacement for Codex
- not a daily prompting wrapper
- not a mandatory command ritual
- not a required `AGENTS.md`
- not mandatory repo mutation
- not a full autonomous outcome runner today
- not an owner of every Codex setting

## Current Vs Future

Already in place:

- core Codex-native exports
- optional packs
- local `.sane/` runtime
- preview/apply/backup/restore for narrow Codex profiles
- recommended integrations, Cloudflare, and native statusline/title profiles
- status, repair, and uninstall flows
- optional OpenCode export for skills, guidance, agents, plugin hook, and config entries

OpenCode support is file export scope today: Sane writes managed files, and host OpenCode visibility/load support decides runtime behavior.

Planned later:

- broader adaptive orchestration
- possible pack expansion after a new capability audit
- future end-to-end outcome runner
- channel rollout after tagged release artifacts are stable

The future outcome runner is a boundary, not a shipped claim.

For setup commands and release notes, see the root [README.md](../README.md).
