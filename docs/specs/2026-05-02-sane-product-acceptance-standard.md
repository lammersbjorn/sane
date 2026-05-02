# Sane Product Acceptance Standard

Date: 2026-05-02
Status: active baseline with target-standard backlog
Owner: Sane product and maintenance lanes

Purpose:
- define Sane-owned acceptance standard from current research
- keep product framing accurate: Sane is Codex framework; TUI is maintenance surface
- separate current shipped acceptance gates from target standard not yet shipped

## Product Framing (Current Standard)

- Sane is agent framework for Codex: routing, skills, scoped agents, guidance packs, setup checks, reversible config.
- TUI scope is maintenance and control-plane flows: install, configure, update, export, status, repair, doctor, uninstall.
- TUI is not primary prompting interface.
- Acceptance language in this doc covers maintenance and exported-surface quality, not generic chat UX.

## Acceptance Command Goals

### Current Standard

- Current release-bound acceptance gate is `rtk pnpm run accept`.
- `accept` delegates to `release:verify`, which runs workspace check, TUI smoke build, and packaged CLI pack.
- Narrow non-release slices may use targeted package tests plus typecheck per `TODO.md`.
- Failures must be recorded with exact command and blocker before a release-facing claim is made.

### Target Standard (Backlog)

- Single top-level acceptance entrypoint for all packages and docs/spec contract checks.
- Acceptance command output proves route health, agent contract health, generated/source sync, and fixture lifecycle safety.
- Command produces machine-readable summary artifact plus human-readable failure reasons.
- Failure classing is explicit: `contract`, `fixture`, `manifest`, `drift`, `docs-boundary`, `quality`.
- Command fails hard on invalid artifacts or source drift that changes exported behavior.
- Historical baseline diff mode for release gate deltas.
- Stable acceptance artifact schema versioning with migration notes.

## Artifact Validity Rules

### Current Standard

- Framework asset tests verify manifest-exported paths, optional-pack roster, config-key mapping, and source provenance.
- Generated/exported surfaces that already have provenance seams must keep deterministic source pointers.
- Release-facing docs must not claim backlog-only capabilities as shipped.

### Target Standard (Backlog)

- Every generated artifact used by Sane export or install flows includes deterministic source pointer and timestamp/date context.
- Artifact metadata identifies producer lane/tool and schema version.
- Invalid if artifact is missing owner, source path, or schema version.
- Invalid if artifact claims shipped status while source section marks target/backlog.
- Signed artifact provenance chain for multi-lane generation.
- Cross-repo artifact trust policy with revocation list.

## Manifest Ownership Rules

### Current Standard

- Pack manifest ownership stays inside Sane-owned pack/manifest surfaces; no downstream doc can silently redefine ownership.
- Pack manifest declares exported asset paths, optional packs, config key ownership mapping, and provenance where implemented.
- Manifest updates require paired tests when exported paths, optional packs, config keys, or provenance behavior changes.

### Target Standard (Backlog)

- Manifest declares which items are source-managed vs generated-managed.
- Ownership conflicts are acceptance failures when two sources claim authority for same exported surface.
- Manifest updates require paired acceptance fixture update when lifecycle behavior changes.
- Ownership policy lint with auto-suggested remediation PR chunks.
- Manifest compatibility matrix per Codex runtime channel.

## Fixture Deploy/Uninstall Checks

### Current Standard

- Control-plane tests use temp roots for export/uninstall behavior and must never touch real user home.
- Existing fixture tests cover managed user skills, repo skills, `AGENTS.md` managed blocks, hooks, custom agents, and selected config profile flows.
- Uninstall tests must preserve user-owned files, unmanaged same-name content, and non-managed structured config keys.

### Target Standard (Backlog)

- Dedicated fixture-root acceptance suite covers clean install, idempotent re-run behavior, and expected managed-surface writes only.
- Uninstall fixture verifies full removal of managed artifacts and preserved non-managed user files across the whole bundle.
- Acceptance fails if uninstall leaves stale managed artifacts without explicit compatibility exemption.
- Fixture logs include before/after manifest snapshot references.
- Matrix fixture runs across macOS/Linux variants and multiple shell setups.
- Time-bounded rollback rehearsal fixture for partial-failure uninstall.

## Hook Fixture Rules

### Current Standard

- Hook fixtures cover hook export/uninstall, additive merge behavior, invalid JSON, unsupported shapes, provider-specific deny output, malformed input, allowed input, blocked input, and inline exported command execution.
- Hooks must be deterministic: no hidden network dependency unless explicitly declared and stubbed in fixture.
- Hook side effects must be scoped to declared managed targets.

### Target Standard (Backlog)

- Hook fixtures cover pre-install, post-install, pre-uninstall, post-uninstall lifecycle boundaries where Sane owns those phases.
- Hook failure maps to actionable class and includes exact failing hook name.
- Hook sandbox policy checks for path escape and unexpected binary execution.
- Hook replay debugger artifact for reproducible CI triage.
- Safety hook backlog covers destructive command guards, secret and credential guards, protected branch guards, environment-file read guards, unsafe git operation guards, and generated-file edit guards. Each guard needs an explicit bypass policy and fixture before it can move to current standard.

## Route/Agent Contract Quality

### Current Standard

- TUI CLI tests validate backend command routing for profiles, exports, status, hooks, and compatibility aliases.
- Command metadata tests validate impact copy and backend-kind contracts for profile/export/uninstall commands.
- Workspace boundary tests validate public package exports and root entrypoint boundaries.
- Framework asset tests validate router, overlay, and agent template rendering.

### Target Standard (Backlog)

- Route contracts define required inputs, owned outputs, and explicit stop/blocked conditions.
- Agent handoff contracts include ownership boundary, verify command, and failure escalation path.
- Acceptance fails when route path can mutate outside declared boundary.
- Completion gates reject explanation-only completion on edit-required routes, reject execution-required routes without evidence, reject weak `BLOCKED` payloads unless attempted/evidence/need are present, and surface repeated failure circuits, large diffs, and test failure loops.
- Quality gate requires no ambiguous state labels in contract artifacts (`done`, `pending`, `blocked` only where schema allows).
- Contract fuzz tests for malformed route payloads.
- Automatic contract drift alerts against stable baseline snapshots.

## Config And Capability Policy

### Current Standard

- Sane-managed Codex profile keys are limited to `model`, `model_reasoning_effort`, `compact_prompt`, and `features.codex_hooks`.
- Sane-managed integration keys are limited to `mcp_servers.context7`, `mcp_servers.playwright`, `mcp_servers.grep_app`, and optional `mcp_servers.cloudflare-api`.
- Sane-managed statusline keys are limited to `tui.notification_condition`, `tui.status_line`, and `tui.terminal_title`.
- `features.memories`, enabled `plugins.*`, unmanaged `mcp_servers.*`, and `tui.theme` are warning-only or display-only surfaces; Sane does not auto-apply or auto-remove them.
- `tools_view_image`, broader hook/profile feature flags, and a separate long-runtime profile are not shipped Sane-managed config surfaces.
- Default continuity stays in `.sane` state and exported Codex-native guidance; native memory systems are not the default continuity path.

### Target Standard (Backlog)

- Key-level Codex config schema validation for every managed and warning-only surface.
- Capability report that explains why each supported key is enabled and why each adjacent native capability remains unmanaged.

## Generated/Source Drift Standard

### Current Standard

- Current drift checks cover framework asset source provenance, manifest-exported skill paths, optional-pack provenance, and selected OpenCode rendered assets.
- Drift is hard failure in covered tests when generated/exported files differ from current source-of-truth fixtures.
- Docs/spec drift checks apply only to surfaces marked current; target/backlog text is excluded from shipped parity checks.

### Target Standard (Backlog)

- Single drift check compares generated outputs against source-of-truth manifests/specs for all current shipped surfaces.
- Acceptance reports minimal diff path list and ownership of each drifted file.
- Continuous drift dashboard with severity ranking.
- Auto-generated remediation patch suggestions for low-risk drift classes.

## Future vs Current Boundary Rules

### Current Standard

- Any unimplemented capability must be tagged `Target Standard (Backlog)`.
- `Current Standard` sections describe only behaviors verifiable today in repo checks or fixtures.
- Release-facing docs and acceptance output must never present backlog items as shipped.
- If verification cannot confirm shipped status, item must move to backlog label until implemented and tested.

### Target Standard (Backlog)

- Enforced doc-lint rule that blocks merge when future language appears in current sections.
- Acceptance report split views: shipped guarantees vs planned upgrades.

## Acceptance Evidence Requirements

### Current Standard

- Current evidence is command output from `accept` or targeted package tests plus exact blocker notes in handoff docs.
- Test names and file anchors are the current trace from acceptance claim to repo behavior.

### Target Standard (Backlog)

- Evidence bundle includes: acceptance summary, fixture logs, manifest snapshot refs, drift path list, and contract validation results.
- Each failed rule shows owner lane and next required fix action.
- Evidence retention is long enough for release triage and postmortem replay.
- Structured evidence API for external audit tools.
- Automatic issue filing with prefilled ownership metadata.

## Non-Goals

- does not redefine Codex runtime product policy
- does not expand TUI into primary prompting channel
- does not require external comparison or outside provenance references

## Adoption Notes

- Use this spec as acceptance baseline for docs/spec and maintenance-surface lanes.
- When backlog item ships, move it from target section to current section in dated follow-up spec update with verification evidence.
