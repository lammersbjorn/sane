# Sane TODO

High-signal handoff file for continuing `Sane` across agents and sessions.

## Read First

Before changing architecture or product direction, read:

- `docs/decisions/2026-04-19-sane-decision-log.md`
- `docs/plans/2026-04-19-sane-strict-implementation-plan.md`
- `docs/specs/2026-04-19-sane-backend-contract.md`
- `docs/specs/2026-04-19-sane-design.md`
- `docs/specs/2026-04-20-sane-tui-redesign.md`
- `docs/research/2026-04-20-tui-tooling-and-ux-audit.md`

Do not re-litigate already-locked philosophy unless a new decision log explicitly changes it.
Do not skip ahead of the strict implementation plan.

## Hard Guardrails

- Plain-language first
- No required command language
- No required `AGENTS.md`
- `Sane`'s own repo may use a minimal repo-local `AGENTS.md` plus targeted repo skill files for self-hosting/dogfooding
- That self-hosting shape is repo-specific, not a default requirement for other repos
- Keep any root `AGENTS.md` short; push specific guidance into repo skills instead of one giant file
- No repo takeover by default
- TypeScript-first control plane is the thin installer/config/doctor layer
- Codex-native assets are the core product surface
- Local operational state may exist under `.sane`, but it must stay thin
- TUI is for setup/ops, not normal prompting
- no-args TUI should feel like onboarding first, settings second
- repo-local self-hosting docs must not blur the TUI/setup boundary or imply a daily wrapper flow
- migration may be phased, but temporary mixed-stack internals must stay behind stable product behavior and one TypeScript-first target
- onboarding may include optional repo attribution, but only as explicit opt-in with preview and easy removal
- Adaptive workflow policy, not rigid user-facing modes
- Single-agent default
- Subagents only when clearly useful
- Model choice must stay dynamic per task/subagent
- Token/speed optimization is a product feature
- Telemetry only if opt-in and only for improving `Sane`

## Current State

Implemented:

- current implementation base is now TypeScript-first across the active workspace surface
- current TypeScript workspace boundaries exist:
  - `@sane/sane-tui`
  - `@sane/config`
  - `@sane/control-plane`
  - `@sane/core`
  - `@sane/framework-assets`
  - `@sane/platform`
  - `@sane/policy`
  - `@sane/state`
- Rust workspace bootstrap
- public GitHub repo
- dual license
- repo-owned commit-msg hook
- `.sane` operational namespace
- typed config persistence
- built-in pack config persistence
- typed run snapshot persistence
- typed backend operation / inventory result structures
- initial `install`, `config`, `doctor`, `export`, and `uninstall` command shell
- first managed Codex-native user-skill target (`~/.agents/skills/sane-router`)
- optional repo-local shared skill target (`<repo>/.agents/skills/sane-router`)
- optional repo-local shared AGENTS target (`<repo>/AGENTS.md`)
- first optional managed global Codex overlay block (`~/.codex/AGENTS.md`)
- first managed user-level hooks target (`~/.codex/hooks.json`)
- first managed user-level custom agents target (`~/.codex/agents/`)
- file-first framework asset rendering through `packages/framework-assets`, sourced from `packs/core/manifest.json` plus checked-in templates under `packs/core`
- read-only inspection of `~/.codex/config.toml`
- opt-in local backup flow for `~/.codex/config.toml`
- read-only preview of recommended core Codex profile changes
- explicit opt-in apply / restore flow for narrow core Codex profile
- explicit opt-in apply flow for separate recommended integrations profile
- explicit opt-in Cloudflare provider profile for Cloudflare MCP tooling
- explicit opt-in Opencode compatibility profile for optional `opensrc` MCP wiring
- built-in pack editor in the TUI with local-only optional pack toggles
- built-in pack state exposed in status / doctor inventory
- optional packs now show `configured` vs `installed` truthfully depending on whether managed user-skill assets were exported
- exported `sane-router` skill and global AGENTS overlay now reflect enabled guidance packs and current routing defaults
- status/doctor now catch drift when exported guidance assets no longer match enabled packs or current routing defaults
- TUI save flows now warn immediately when config changes leave managed guidance exports stale
- `export all` / `uninstall all` for current managed targets
- pure adaptive policy crate with typed obligations and tests
- internal backend policy preview for canonical adaptive scenarios
- internal backend policy preview now shows task-shaped routing classes per scenario and keeps role-default compatibility where still required
- policy explanations now include typed orchestration guidance and stable rule traces for canonical scenarios
- internal backend policy preview now carries typed scenario/orchestration/trace payloads in `OperationResult` and persists them into decision history without changing TUI copy
- policy preview history now has typed shared context helpers, tail-first latest-preview lookup, and runtime-summary plumbing for the latest valid snapshot
- inspect/app-view now surface the latest persisted policy-preview snapshot through a bounded typed read path instead of re-parsing runtime-summary copy, and this remains an inspect-only read surface
- runtime summary/inspect now surface bounded `.sane` history counts for `events`, `decisions`, and `artifacts` through canonical layered-state bundle `historyCounts`, without adding a new log-browsing surface
- startup last-event reads now go through control-plane history helper instead of direct TUI peek logic, keeping history access on one typed bounded path
- preferences, telemetry presence, and Codex backup-availability reads now go through control-plane snapshot helpers instead of ad hoc TUI file checks
- task-shaped subagent presets now target `explorer`, `implementation`, `verifier`, and `realtime` classes; class candidate ordering remains heuristic and runtime-gated, not benchmark certainty
- task-shaped routing classes are now wired through config + policy preview surfaces (with legacy role-default compatibility kept only where still required)
- Sane now treats documented model availability and spawnable-here runtime support as separate concerns
- research note locked: OpenAI docs publish strong positioning but not one hard benchmark table across these Codex workflow classes
- integrations profile preview/apply now emits structured audit payloads, and install-screen integrations UI consumes that audit directly for read-before-write visibility
- inspect/app-view now also consume typed integrations audit state instead of inferring optional-tool status from preview summary text, and this remains inspect-only visibility
- TUI now exposes adaptive policy inspection directly instead of leaving it command-only
- TUI now requires confirmation for risky apply/restore/uninstall actions
- TUI repair now exposes local telemetry reset as a first-class confirmed action instead of only a privacy-editor shortcut
- TUI inspect now exposes read-only runtime handoff state for `current-run`, `summary`, and `brief`
- no-args TUI now opens into section-based onboarding instead of a flat settings/action wall
- `sane settings` is the direct shortcut into configure mode
- TypeScript TUI now has explicit shell, view, editor, and overlay model layers
- app-local TUI imports now use `@/*`, and workspace package imports now use `@sane/*`
- optional repo-local skill export now exists as an explicit separate target and is not part of `export all`
- optional repo-local AGENTS export now exists as an explicit separate target and is not part of `export all`
- canonical `.sane` layered-state helpers now load config, summary, current run, and brief files in one typed bundle, with runtime-history counts flowing through that same canonical state path
- typed JSONL history helpers now support full reads plus ordered offset/limit slices for events, decisions, and artifacts
- `@sane/platform` now owns Codex home discovery through explicit env resolution instead of leaving control-plane to call `homedir()` directly
- TypeScript TUI bootstrap can now discover both project root and Codex home through `@sane/platform`
- canonical state rewrites now create timestamped `.bak` sibling backups before replacing existing JSON/TOML files
- canonical rewrite helpers now expose typed metadata (`rewritten_path`, `backup_path`, `first_write`)
- canonical backup sibling listing helpers now return matching backups newest-first for repair/rollback flows
- `config` save output now reports canonical rewrite metadata (`rewritten path`, optional `backup path`, `write mode`)
- `install` output now reports per-file rewrite metadata for `config`, `current-run`, and `summary` (including repair rewrites with backups)
- `doctor` summary now reports canonical backup history for local config and summary (`config-backups`, `summary-backups`)

Current gate:

- `B4` managed Codex surfaces remain additive/reversible only
- `B7` may proceed only as internal adaptive policy/state groundwork and inspection surfaces, not user-facing workflow ritual or orchestration runtime
- stack direction is now TypeScript-first; do not add new Rust-first assumptions to source-of-truth docs while migration planning is in flight

Current command examples:

```bash
pnpm check
pnpm typecheck
pnpm test
```

Current verification baseline:

```bash
pnpm check
```

## Now

- [x] Add project-root detection instead of assuming the current working directory is the project root
- [x] Expand `LocalConfig` into a real runtime config schema
- [x] Add model preset structures for coordinator, sidecar, and verifier roles
- [x] Add typed backend operation / inventory structures for the future TUI to wrap
- [x] Improve `doctor` with real checks and actionable repair suggestions
- [x] Replace placeholder `export` with the first real Codex-native asset management boundary
- [x] Add symmetric uninstall flow for managed user-skill assets
- [x] Finish `B1`: explicit inventory/status read on top of current typed backend layer
- [x] Finish `B1`: tighten touched-path reporting and backend contract docs/tests
- [x] Add canonical rewrite backups for explicit state migrations/upgrades
- [x] Add canonical rewrite metadata plumbing (`rewritten_path`, `backup_path`, `first_write`)
- [x] Add canonical backup sibling listing helpers sorted newest-first
- [x] Surface save-config rewrite metadata in user-facing output
- [x] Surface install-runtime rewrite reporting for config/current-run/summary
- [x] Surface doctor backup history for config/summary canonical files
- [x] Align docs/TODO wording on task-shaped subagent presets (`explorer` / `implementation` / `verifier` / `realtime`) with explicit non-benchmark language

## Research Gates

- [x] `R1` builtin pack capability audit
- [x] `R2` model / subagent preset matrix
- [x] `R3` state / compaction design
- [x] `R4` Codex-native surface map
- [x] `R5` privacy / telemetry schema
- [x] `R6` packaging / distribution audit

## Build Gates

- [x] `B2` proper install TUI foundation
- [x] `B3` asset inventory / auditability surface
- [ ] `B4` next managed targets, including optional `Opencode` compatibility if it fits the Codex surface map and stays additive/removable
- [x] `B5` model/subagent config surface
- [x] `B6` privacy / telemetry foundation
- [ ] `B7` adaptive orchestration engine

## Later

- [ ] Self-hosting shadow mode
- [ ] Eval harness for routing, compaction, and self-improvement
- [ ] Later end-to-end outcome runner:
  - future only, not part of the current user-facing product surface
  - a user-facing one-shot command for idea-to-finished-result work
  - plain-language first
  - may ask targeted follow-up questions
  - may research / plan / implement / verify across a long run
  - should keep going until requested result is reached unless blocked
  - optional shortcut name/command still open
- [ ] Windows/macOS/Linux path and install hardening passes
- [ ] Packaging/distribution rollout after `v1`:
  - GitHub Releases
  - Homebrew tap
  - winget
  - Scoop
  - direct install/package-manager polish

## Open Research / Decisions

- [ ] Exact `v1` built-in packs
- [ ] Exact `Opencode` compatibility scope and install/apply shape
- [ ] Exact explicit preset coverage for `Kimi K2.6` and other newly popular models vs generic fallback-by-capability handling:
  - source quality acceptable
  - runtime/auth support on the actual Sane surface
  - benchmark evidence status recorded
  - default-tier vs candidate-only decision recorded
- [ ] Exact contents/split of `Sane`'s own minimal self-hosting `AGENTS.md` vs repo skill files
- [ ] Exact self-hosting milestone checklist
- [ ] Exact TypeScript package split and Rust retirement/cutover checklist
- [ ] Exact post-`v1` packaging automation sequence
- [ ] Exact default attribution surface if onboarding opt-in ships:
  - README badge
  - README credits line
  - both

## Agent Working Rules

- Make durable decisions in docs, not only in chat
- Prefer small, focused slices with fresh verification
- If you change philosophy or scope, update the decision log first
- If you touch repo-local self-hosting guidance, keep root `AGENTS.md` minimal and move specifics into targeted repo skills
- Never describe repo-local self-hosting on `Sane`'s own repo as a universal requirement for repos using `Sane`
- Keep README public-facing and short
- Keep internal planning detail in `docs/` and this file
- Keep subfolder `README.md` files current when responsibilities change
- Do not add heavy dependencies without clear justification
- Do not turn `Sane` into a daily wrapper or command ritual
- Do not let `.sane` grow into the primary product runtime

## Suggested Next Slice

See:

- `docs/plans/2026-04-19-sane-strict-implementation-plan.md`

Current allowed next slice:

1. finish `B4` only if adding another managed surface is clearly justified by the Codex surface map
2. if `B4` moves, evaluate optional `Opencode` compatibility as a separate additive/removable profile rather than widening the default core profile
3. otherwise wire more backend/status flows through the existing layered `.sane` state shape instead of inventing new ad hoc readers or files
4. keep TUI first, backend verbs escape hatch only
5. keep merge/preserve/remove behavior additive and reversible
6. keep Codex config writes narrow, explicit opt-in, and backup/restore guarded
7. refresh the model preset matrix for `Kimi K2.6` and other newly popular models without regressing the capability-class fallback approach or the non-benchmark caveat language
8. keep `B7` on typed policy/state plumbing, traces, and inspectable guidance; do not present it as shipped end-user orchestration
9. keep the later end-to-end outcome runner plain-language first, not command-ritual-first
