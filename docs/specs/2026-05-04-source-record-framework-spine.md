# Source-Record Framework Spine

Date: 2026-05-04
Status: current implementation slice active; source-record and manifest-backed
framework-artifact visibility are now backend surfaces
Owner: Sane framework and control-plane lanes

Purpose:
- move Sane framework truth from scattered templates, constants, and prose into typed source records
- keep Codex as primary provider and preserve low-friction setup/status/repair/export flows
- make generated artifacts disposable, manifest-owned, and acceptance-gated

## Product Boundary

Sane remains a Codex-native framework. It installs and maintains Codex-native guidance pieces, then the user works in Codex normally. The TUI remains the install, configure, update, export, status, repair, doctor, and uninstall surface.

This spine does not add daily wrapper behavior, a normal prompting interface, broad provider parity, or Claude provider support.

## Current Baseline

Current framework source lives across:
- `packs/core/manifest.json` for core asset paths, optional pack metadata, provenance, and asset ownership
- `packs/core/skills/*`, `packs/core/overlays/*`, and `packs/core/agents/*` for authored or template assets
- `packages/framework-assets/src/index.ts` for render functions and constants
- `packages/control-plane/src/codex-native.ts` for skill and `AGENTS.md` export/uninstall
- `packages/control-plane/src/hooks-custom-agents.ts` for hook and custom-agent export/uninstall
- `packages/control-plane/src/core-install-bundle-targets.ts` for bundle target ordering
- `packages/control-plane/test/*` and `packages/framework-assets/test/framework-assets.test.ts` for fixture and asset checks

Current ownership is marker and block based. Skills use `.sane-owned`, `AGENTS.md` overlays use managed block markers, custom agents use a managed file prefix, and hooks use managed command matchers inside `hooks.json`.

## Target Spine

Typed source records become the authored product truth:
- `skill` records: id, provider support, source asset path, target skill name, render variables, resources, and ownership policy
- `agent` records: id, provider support, source template path, target custom-agent file, role model bindings, and ownership policy
- `hook` records: id, provider support, event, matcher, command builder, structured key path, executable expectation, and ownership policy
- `route` and `prompt-contract` records: id, trigger, required evidence, blocked format, verifier expectations, and owned outputs
- `pack` records: id, config key, enabled policy lines, optional skills/resources, provenance, and dependencies
- `provider-surface` records: provider id, supported artifact modes, target path rules, unsupported capability policy, and installer support

Provider renderers turn source records into artifact objects. Codex renderer is first and primary.

Artifact object fields:
- `provider`
- `path`
- `mode`: `file`, `block`, or `config`
- `ownershipMode`: `source-managed`, `generated-managed`, or `config-managed`
- `content` or structured patch payload
- `hash`
- `sourceId`
- `executable`
- `structuredKeys`
- `blockMarker`
- `provenance`

Artifact plans group rendered artifacts by lifecycle action:
- `preview` renders and reports planned writes without touching user files
- `deploy` writes only manifest-owned file, block, or config entries
- `uninstall` removes only manifest-owned artifacts and preserves user-owned content
- `inspect` compares installed artifacts with current render output and manifest ownership

Manifest ownership v2 tracks deployed artifacts by provider, path, mode, hash, sourceId, executable, structuredKeys, blockMarker, and provenance. It must be sufficient to answer: "Can Sane update or remove this exact thing without deleting user-owned content?"

## Current Vertical Slice

The first slice proves the chain without changing public TUI behavior:
- source records: all core skills, `sane-router`, `sane-bootstrap-research`,
  `sane-agent-lanes`, `sane-outcome-continuation`, and `continue`
- source records: all Sane custom agents, `sane-agent`, `sane-reviewer`,
  `sane-explorer`, `sane-implementation`, and `sane-realtime`
- source records: global and repo `AGENTS.md` managed blocks
- source records: optional pack skills and support-file targets when a pack is
  enabled
- source records: Codex config fragments for `codex-profile` and
  `integrations-profile`
- optional source records: Codex config fragments for `cloudflare-profile` and
  `statusline-profile` when explicitly enabled in artifact-plan options
- source record: managed `SessionStart` hook
- source records: hook runtime guards for command safety, generated-surface
  edits, weak `BLOCKED` responses, and optional RTK command routing
- Codex artifact renderer outputs artifact objects for those records
- fixture deploy/uninstall path consumes artifact plan for those records
- tests prove render, deploy, manifest metadata, optional pack enablement,
  structured-key config preservation including optional Cloudflare/statusline
  keys, uninstall preservation, same-name overwrite blocking, stale manifest
  preservation, hook execution, manifest status visibility, and per-artifact
  drift diagnostics for the slice

Current implementation keeps existing public TUI behavior unchanged. The
artifact-plan path is backend-internal; Status, Doctor, and Repair backend
snapshots now surface the manifest-owned artifact plan as `framework-artifacts`.
When installed artifacts drift, the backend inventory repair hint names the
affected artifact class and path or source id, including changed files, missing
hooks, changed config keys, stale entries, and manifest hash drift.

## Hook Runtime V2

Hook guards stay narrow and executable. First-class records should cover:
- route/evidence contract guard
- generated-surface edit guard
- weak `BLOCKED` guard
- RTK command guard
- destructive, secret, and unsafe-git guards where Codex hook support allows them

Current guard slice covers generated-surface edits, weak `BLOCKED`, optional
RTK command routing, and destructive/secret/unsafe-git command safety with
source records, renderer output, managed hook commands, and fixture payloads.
Route/evidence contract guard beyond weak `BLOCKED` remains a future verifier
contract slice because Codex hook payload support does not expose a stable
route record today.

## Acceptance Gates

`rtk pnpm run accept` proves the current source-record slice:
- typed source record loading
- Codex rendering
- fixture deploy
- hook execution
- uninstall preservation
- fixture drift diagnostics for manifest-owned files, hooks, and config keys
- generated/source drift checks covered by framework asset parity and existing
  acceptance suites
- unsupported provider rejection in Codex artifact rendering
- no shallow or disconnected framework assets

Unsupported model rejection remains enforced in config/model selection tests,
not in the artifact renderer.

## Non-Goals

- no Claude support
- no provider-parity matrix beyond Codex-first records and optional OpenCode export architecture
- no TUI prompting workflow
- no broad outcome runner claim
- no generated artifact that lacks source linkage and lifecycle ownership

## Expansion Rule

Expand records only after the first vertical slice passes focused package tests and the release-bound acceptance gate. New surfaces need source records, renderer output, artifact-plan lifecycle, manifest ownership, and acceptance coverage in the same slice.
