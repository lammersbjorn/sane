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
- current policy-preview source of truth is `packages/control-plane/src/policy-preview.ts`; the TS TUI layers consume it directly
- the legacy Rust workspace has been removed; the shipped path is now TS-only
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
- first optional OpenCode-agent compatibility target (`~/.config/opencode/agents/`)
- file-first framework asset rendering through `packages/framework-assets`, sourced from `packs/core/manifest.json` plus checked-in templates under `packs/core`
- read-only inspection of `~/.codex/config.toml`
- opt-in local backup flow for `~/.codex/config.toml`
- read-only preview of recommended core Codex profile changes
- explicit opt-in apply / restore flow for narrow core Codex profile
- explicit opt-in apply flow for separate recommended integrations profile
- explicit opt-in Cloudflare provider profile for Cloudflare MCP tooling
- explicit opt-in Opencode compatibility profile for optional `opensrc` MCP wiring
- explicit opt-in OpenCode-agent export/remove actions kept outside `export_all`
- built-in pack editor in the TUI with local-only optional pack toggles
- built-in pack state exposed in status / doctor inventory
- built-in pack set currently remains fixed: always-on `core` plus optional `caveman`, `rtk`, and `frontend-craft`
- optional pack registry helpers (name/config-key mapping + enabled/disabled selection) now live in `@sane/framework-assets` and are reused by TUI/editor + control-plane inventory/export paths
- optional packs now show `configured` vs `installed` truthfully depending on whether managed user-skill assets were exported
- `frontend-craft` currently exports every pinned upstream `Leonxlnx/taste-skill` skill plus `impeccable`, including `gpt-taste` for ambitious GPT/Codex frontend work and `image-taste-frontend` for image-first art direction
- `rtk` currently stays capability-only (router/overlay behavior, no dedicated skill export directory)
- the fixed `v1` built-in pack set is `core`, `caveman`, `rtk`, and `frontend-craft`; post-`v1` pack changes require a fresh capability audit and do not imply a public plugin API
- default continuity now stays scoped to Codex-native exports plus thin local `.sane` state; Codex native `memories` remain outside the default path
- exported `sane-router` skill and global AGENTS overlay now reflect enabled guidance packs and current routing defaults
- status/doctor now catch drift when exported guidance assets no longer match enabled packs or current routing defaults
- optional pack manifests now carry read-only provenance metadata for curated upstream-derived skills where that source is real and worth tracking
- TUI save flows now warn immediately when config changes leave managed guidance exports stale
- `export all` / `uninstall all` for current managed targets
- pure adaptive policy package with typed obligations and tests
- internal backend policy preview for canonical adaptive scenarios
- internal backend policy preview now shows task-shaped routing classes per scenario and keeps role-default compatibility where still required
- policy explanations now include typed orchestration guidance and stable rule traces for canonical scenarios
- policy explanations now also include typed continuation guidance (`answer_directly`, `continue_until_verified`, `continue_until_blocked`, `self_repair_until_unblocked`, `close_when_verified`) with explicit stop conditions, still internal/inspect-only
- `@sane/policy` now has a pure internal eval harness for fixture-based routing/orchestration/continuation checks, plus a B7 fixture suite for routing, compaction, self-repair, and closing-gate expectations; this is a foundation only, not a shipped self-improvement runner
- `@sane/policy` now also has a B8 preflight fixture suite for later outcome-runner policy shape; this is guardrail coverage only and still does not ship a runner, wrapper, or command ritual
- self-hosting shadow readiness is still read-only and now blocks until canonical handoff layers exist, blocking questions are clear, and current-run verification has passed
- internal backend policy preview now carries typed scenario/orchestration/trace payloads in `OperationResult` and persists them into decision history without changing TUI copy
- policy preview history now has typed shared context helpers, tail-first latest-preview lookup, and runtime-summary plumbing for the latest valid snapshot
- inspect/app-view now surface the latest persisted current-run-derived policy-preview snapshot through a bounded typed read path instead of re-parsing runtime-summary copy, and this remains a read-only Inspect surface
- Inspect/runtime-summary now also surface typed latest-policy input classification lines for that persisted snapshot, still read-only and inspect-only
- inspect/app-view now share one control-plane policy-preview presenter that includes both latest persisted snapshot/input lines and current preview summary/scenario counts (plus scenario detail lines in `preview policy` action view), read-only only
- runtime summary/inspect now surface bounded latest `.sane` history previews for the most recent `event`, `decision`, and `artifact`, plus the underlying `events` / `decisions` / `artifacts` counts, through canonical layered-state bundle `historyCounts`, without adding a new log-browsing surface
- startup last-event reads now go through control-plane history helper instead of direct TUI peek logic, keeping history access on one typed bounded path
- preferences, telemetry presence, and Codex backup-availability reads now go through control-plane snapshot helpers instead of ad hoc TUI file checks
- telemetry file state now syncs downward with privacy consent: `off` removes `.sane/telemetry/`, `local-only` removes stale upload queue state, and config save results report telemetry paths touched
- Codex backup snapshot truth now uses actual backup-file presence, count, and latest path instead of treating backup-directory existence as restore truth
- task-shaped subagent presets now target `explorer`, `implementation`, `verifier`, and `realtime` classes; class candidate ordering remains heuristic and runtime-gated, not benchmark certainty
- task-shaped routing classes are now wired through config + policy preview surfaces (with legacy role-default compatibility kept only where still required)
- Sane now treats documented model availability and spawnable-here runtime support as separate concerns
- research note locked: OpenAI docs publish strong positioning but not one hard benchmark table across these Codex workflow classes
- integrations profile preview/apply now emits structured audit payloads, and install-screen integrations UI consumes that audit directly for read-before-write visibility
- inspect/app-view now also consume typed integrations audit state instead of inferring optional-tool status from preview summary text, and this remains inspect-only visibility
- install/repair overview copy now consumes typed install/repair snapshots directly for integrations status/count, restore status, and removable installs instead of scraping action rows
- codex profile, integrations profile, cloudflare profile, and opencode profile now have typed snapshot helpers so get-started/preferences/install/inspect can reuse one read path per profile family instead of recomputing audit/apply/preview separately
- typed family snapshot helper now exists for Codex profile surfaces, and Preferences uses it for provider-profile state instead of separate provider snapshot reads
- Codex profile family reads now derive from one shared parsed config context in `codex-config.ts`, so family/profile audit/apply/preview helpers stop reparsing the same file repeatedly
- invalid Codex/integrations/cloudflare/opencode previews now say `blocked by invalid config` instead of pretending there are `0 recommended change(s)`
- Canonical status bundles and Inspect overview now surface warning-only Codex config conflict detection for invalid config, disabled `features.codex_hooks`, unmanaged `mcp_servers.*`, and enabled `plugins.*` entries; this is detect-and-warn only and does not add auto-fix behavior
- Start Here onboarding can now derive from a preloaded typed status bundle, and app-view threads shell status bundle through that path instead of forcing a fresh onboarding status-bundle rebuild
- Install can now derive from a preloaded typed status bundle too, and app-view threads shell status bundle through that path instead of forcing a second install status-bundle rebuild
- Repair can now derive from a preloaded typed status bundle too, and app-view threads shell status bundle through that path when the repair section is opened instead of forcing another repair status-bundle rebuild
- Inspect can now derive from a preloaded typed status bundle too, and app-view threads shell status bundle through that path when the inspect section is opened instead of forcing another inspect status-bundle rebuild
- shell status refresh now reads one canonical status bundle and derives `show status` from it instead of rebuilding the same status inventory twice on every refresh
- shell status snapshots now use the shell's captured host platform, so Windows/WSL bundle status and TUI action metadata do not drift across independent platform detection calls
- app-view now threads the shell's captured host platform through Start Here, Inspect, Preferences, and Repair screen loaders, keeping section/action metadata aligned with the same platform snapshot as status inventory
- canonical status bundles now also carry the typed runtime snapshot they already depend on, so shell/inspect can reuse one runtime read instead of reopening `.sane` state separately
- TUI shell status snapshots now also carry the Codex profile family snapshot, so app-view rendering reuses the captured profile read across get-started/install/preferences surfaces instead of reparsing Codex config during each render
- Inspect action details now also reuse the shell-captured Codex profile family snapshot when rendering integrations/statusline profile state instead of triggering a fresh Codex config read during app-view rendering
- Inspect Codex config details now also come from that captured Codex profile family snapshot, so app-view Inspect does not reopen `~/.codex/config.toml` after the shell snapshot is captured
- TUI shell status snapshots now also carry the preferences family snapshot, so app-view Preferences rendering reuses one captured telemetry/model/pack read instead of rebuilding preferences during each render
- Inspect local `show_config` details now reuse the shell-captured preferences family snapshot too, keeping model capability/config explanations consistent across a render
- runtime inspect/summary fields now derive from one `runtime-state.ts` helper that owns layered-state fallback, history preview, latest policy preview, and per-layer presence/invalid/missing truth
- self-hosting shadow inspection can now render from an already-captured runtime snapshot, keeping bundle-based Inspect views aligned with the status snapshot instead of reopening `.sane` handoff files mid-render
- policy preview current-run reads and operation-history summary promotion now also go through that same canonical runtime-state boundary instead of reopening handoff files directly
- operation-history writes now seed or repair the canonical `.sane` handoff baseline before persisting new events/decisions/artifacts, so non-install operations no longer leave `current-run` missing
- no-args TUI boot now also derives its initial last-result line from the canonical runtime-state history preview instead of reopening events JSONL directly
- install/repair action rows now use one shared TUI builder and preserve typed status objects instead of flattening them into strings at screen load time
- native Windows no longer keeps unsupported hooks in onboarding attention items or `export all` touched-file lists once the supported install bundle is satisfied; onboarding now points users at WSL without treating hooks as a blocking bundle requirement
- cross-platform path/install hardening now covers project root discovery, home/Codex/OpenCode path derivation, whitespace-only env fallbacks, native Windows hook exclusion, and preloaded Windows status inference through targeted platform/control-plane tests
- preferences now have a typed family snapshot so show-config, preferences screen, and editable/default config helpers stop rebuilding the same saved-config/env/routing state separately
- preferences/show-config now surface detected Codex model availability, plan hints, reasoning-effort support, and selected routing-capability lines from that same family snapshot, so routing defaults are explainable instead of just final values
- TUI Inspect now shows read-only policy-preview snapshot visibility derived from the latest current run instead of command-only access
- Inspect overview presentation now lives in a shared control-plane presenter, with drift/provenance formatting pulled out of the TUI screen layer
- TUI now requires confirmation for risky apply/restore/uninstall actions
- TUI repair now exposes local telemetry reset as a first-class confirmed action instead of only a privacy-editor shortcut
- privacy-editor telemetry reset now refreshes the TUI status snapshot immediately, so repair/overview state does not stay stale after local telemetry files are deleted
- TUI inspect now exposes read-only runtime handoff state for `current-run`, `summary`, and `brief`
- no-args TUI now opens into section-based onboarding instead of a flat settings/action wall
- `sane settings` is the direct shortcut into configure mode
- TypeScript TUI now has explicit shell, view, editor, and overlay model layers
- public TS TUI now renders as a framed rail + dominant detail pane instead of one long debug-style text dump, with narrow-terminal fallback and Start Here opening on the recommended action for the current state
- TypeScript TUI now also owns pure input/key handling plus internal non-interactive CLI parsing/execution for backend verbs, direct `settings` / `inspect` / `repair` section shortcuts, and `hook session-start`, and the public shipped entrypoint is now TypeScript-owned
- TS runtime resolution now works for internal text and live terminal preview paths via workspace package `exports`, self-package app imports, terminal-loop wiring, and `tsx`; the remaining blockers are real terminal parity plus a deliberate packaged public entrypoint
- internal TS preview launch is now unified through one smart `tsx` entrypoint that chooses live terminal on TTY launch commands and falls back to text for non-TTY or backend command flows
- `@sane/sane-tui` now also exposes a local `sane` bin shim that routes through the smart preview entrypoint; in this workspace the internal root launcher uses `node apps/sane-tui/bin/sane.mjs` directly while the package `bin` metadata stays ready for later packaged cutover work
- `@sane/sane-tui` now also has an internal bundled build lane via `tsup`, emitting `dist/bin/sane.cjs` that can run `inspect` and backend verbs without `tsx` at runtime
- app-local TUI imports now use `@/*`, and workspace package imports now use `@sane/*`
- optional repo-local skill export now exists as an explicit separate target and is not part of `export all`
- optional repo-local AGENTS export now exists as an explicit separate target and is not part of `export all`
- canonical `.sane` layered-state helpers now load config, summary, current run, and brief files in one typed bundle, with runtime-history counts flowing through that same canonical state path
- canonical layered runtime state now also preserves `present` / `missing` / `invalid` truth for `current-run`, `summary`, and `brief`, and runtime-summary/inventory consume that typed status instead of value-truthiness
- typed JSONL history helpers now support full reads plus ordered offset/limit slices for events, decisions, and artifacts
- `@sane/platform` now owns Codex home discovery through explicit env resolution instead of leaving control-plane to call `homedir()` directly
- TypeScript TUI bootstrap can now discover both project root and Codex home through `@sane/platform`
- local config source/current/recommended truth now has a shared family snapshot helper, reused by preferences and install-time config seeding instead of duplicating saved-vs-recommended branching
- TypeScript workspace tests now run on plain `vitest`/`vitest/config` with native `resolve.tsconfigPaths`, not `vite-plus`
- inventory-status labels and runtime-layer present/invalid/missing conversion now go through shared status-presentation helpers instead of repeated inline mapping in control-plane
- canonical state rewrites now create timestamped `.bak` sibling backups before replacing existing JSON/TOML files
- canonical rewrite helpers now expose typed metadata (`rewritten_path`, `backup_path`, `first_write`)
- canonical backup sibling listing helpers now return matching backups newest-first for repair/rollback flows
- latest persisted policy-preview snapshots now preserve compact trace reasons, and inspect/runtime-summary surfaces render those reasons through the existing read-only policy presenter path
- `config` save output now reports canonical rewrite metadata (`rewritten path`, optional `backup path`, `write mode`)
- `install` output now reports per-file rewrite metadata for `config`, `current-run`, and `summary` (including repair rewrites with backups)
- `doctor` summary now reports canonical backup history for local config and summary (`config-backups`, `summary-backups`)

Current gate:

- `B4` managed Codex surfaces remain additive/reversible only
- `B7` is complete only as internal adaptive policy/state groundwork and inspection surfaces, not user-facing workflow ritual or orchestration runtime
- stack direction is now TypeScript-first; do not add new legacy-stack assumptions to source-of-truth docs

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
- [x] Evaluate optional Codex statusline/status-bar support inspired by `openagentsbtw`
- [x] Add narrow optional native Codex statusline/title profile management over `tui.status_line`, `tui.terminal_title`, and `tui.notification_condition`

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
- [x] `B4` next managed targets, including optional `Opencode` compatibility if it fits the Codex surface map and stays additive/removable
- [x] `B5` model/subagent config surface
- [x] `B6` privacy / telemetry foundation
- [x] `B7` adaptive orchestration engine

## Later

- [x] Self-hosting shadow mode
- [x] Broaden eval harness coverage for routing, compaction, and self-improvement
- [ ] Later end-to-end outcome runner:
  - future only, not part of the current user-facing product surface
  - current allowed work is preflight/eval coverage and readiness docs only
  - guardrail tests pin no runner operation, TUI command, or CLI alias until the B8 runtime actually ships
  - any future one-shot command for idea-to-finished-result work must stay secondary to plain-language invocation
  - plain-language first
  - may ask targeted follow-up questions
  - may research / plan / implement / verify across a long run
  - should keep going until requested result is reached unless blocked
  - optional shortcut name/command still open
- [x] Windows/macOS/Linux path and install hardening passes
- [ ] Packaging/distribution rollout after `v1`:
  - GitHub Releases
  - Homebrew tap
  - winget
  - Scoop
  - direct install/package-manager polish

## Open Research / Decisions

- [x] Exact post-`v1` built-in pack expansion/contraction policy (current built-in set is fixed today; later changes require capability audit, provenance, optional/experimental status first, and install/inspect/uninstall coverage)
- [x] Exact long-term `Opencode` compatibility scope beyond the current optional `opensrc` profile plus optional OpenCode-agent export:
  - keep optional and outside the default Codex install bundle
  - no OpenCode wrapper, launcher, bridge server, or OpenCode-first workflow
  - no automatic project `.opencode/agents/` export; future project-local support must be explicit, reversible, and inspectable
- [x] Exact scope for native Codex statusline/title config helper:
  - keep only the current optional native config profile over `tui.status_line`, `tui.terminal_title`, and `tui.notification_condition`
  - do not build a Sane-owned custom statusline/status-bar system in `v1`
  - keep inspect/apply explicit and reversible through native Codex config only
- [x] Exact explicit preset coverage for `Kimi K2.6` and other newly popular models vs generic fallback-by-capability handling:
  - source quality is acceptable for a documented external candidate
  - runtime/auth support is not present in the Codex picker/runtime surface Sane targets today
  - benchmark/status evidence stays caveated as provider-positioned and not a neutral cross-provider Codex routing table
  - default-tier decision: candidate-only, no active preset
- [x] Exact bonus-lane policy for models such as `Codex-Spark` when a user's plan/runtime exposes separate quota:
  - capability-gated only, never assumed
  - prefer only for latency-first `realtime` work where it actually fits
  - preserve normal fallback for `implementation` / `verifier` / unavailable-plan cases
- [x] Exact contents/split of `Sane`'s own minimal self-hosting `AGENTS.md` vs repo skill files:
  - root `AGENTS.md` stays small and durable
  - Sane-building procedure lives in `.agents/skills/sane-self-hosting/SKILL.md`
  - continuation behavior lives in `.agents/skills/continue/SKILL.md`
  - this split is dogfooding only, not a default requirement for user repos
- [x] Exact self-hosting milestone checklist:
  - [x] prove exported `continue` skill installs through Sane, not only local `.agents` (`packs/core/manifest.json`, `@sane/framework-assets`, and `export user-skills` tests cover it)
  - [x] prove exported router/custom-agent guidance uses current model routing and enabled packs (`@sane/framework-assets`, `export user-skills`, `export custom-agents`, and OpenCode-agent tests cover it)
  - [x] prove `.sane` runtime state is enough for handoff without Codex native memories (`inspectRuntimeState` ignores native `features.memories` while Codex config remains read-only)
  - [x] add shadow-mode inspection before any self-improvement/self-heal runner (`inspectSelfHostingShadowSnapshot` is read-only and keeps the runner disabled)
  - [x] keep all self-hosting surfaces reversible and optional outside this repo (`export all` / `uninstall all` exclude repo-local skills and repo `AGENTS.md`; explicit repo export/remove tests cover reversibility)
- [x] Exact TypeScript package split and TS-only packaging checklist (`workspace-package-boundaries.test.ts` pins active package names, TS exports/typecheck scripts, packaged TS entrypoint, and no Rust workspace files)
- [x] internal TS launch supports no-args / `settings` / `inspect` / `repair`, backend verbs, and `hook session-start`
- [x] internal TS preview is smart-routed across non-TTY text vs TTY live terminal
- [x] TS terminal preview has visible nav chrome, key parity, viewport fitting, resize redraw, and a local bin shim
- [x] internal TS build can emit a bundled `dist/bin/sane.cjs` and smoke-run it without `tsx`
- [x] switch public root `start` / `start:settings` to the packaged TS entrypoint
  - [x] switch public README/setup docs away from Cargo-first instructions
  - [x] declare the packaged/public CLI story for `@sane/sane-tui`
    current story: root public start uses the built TS path; internal source preview uses `apps/sane-tui/bin/sane.mjs`; internal built preview uses `dist/bin/sane.cjs`; generated distribution metadata lives at `dist/package.json` and points the package CLI at the built output
  - [x] remove the legacy workspace and fallback startup path
- [x] Exact post-`v1` packaging automation sequence (`docs/research/2026-04-19-packaging-distribution-audit.md` pins verify, GitHub Release assets, npm publish, Homebrew, winget, then Scoop)
- [x] Exact default attribution surface if onboarding opt-in ships:
  - default: short README credit line
  - explicit alternates only: README badge, or both

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

1. treat any post-`B4` managed-surface additions as optional and only if clearly justified by the Codex surface map
2. keep `Opencode` compatibility additive/removable and separate from the default core profile if scope widens beyond the current optional profile/export work
3. otherwise wire more backend/status flows through the existing layered `.sane` state shape instead of inventing new ad hoc readers or files
4. keep TUI first, backend verbs escape hatch only
5. keep merge/preserve/remove behavior additive and reversible
6. keep Codex config writes narrow, explicit opt-in, and backup/restore guarded
7. keep newly popular external models such as `Kimi K2.6` candidate-only until they are runtime/auth-proven inside Sane's Codex-first surface
8. keep `B7` on typed policy/state plumbing, traces, and inspectable guidance; do not present it as shipped end-user orchestration
9. keep the later end-to-end outcome runner plain-language first, not command-ritual-first
10. keep `v1` pack behavior inside the fixed built-in set unless a new post-`v1` audit opens an explicit experimental lane
