# Sane TODO

High-signal handoff file for continuing `Sane` across agents and sessions.

## Read First

Before changing architecture or product direction, read:

- `docs/decisions/2026-04-19-sane-decision-log.md`
- `docs/plans/2026-04-19-sane-strict-implementation-plan.md`
- `docs/specs/2026-04-19-sane-backend-contract.md`
- `docs/specs/2026-04-19-sane-design.md`

Do not re-litigate already-locked philosophy unless a new decision log explicitly changes it.
Do not skip ahead of the strict implementation plan.

## Hard Guardrails

- Plain-language first
- No required command language
- No required `AGENTS.md`
- No repo takeover by default
- Rust is the thin installer/config/doctor layer
- Codex-native assets are the core product surface
- Local operational state may exist under `.sane`, but it must stay thin
- TUI is for setup/ops, not normal prompting
- Adaptive workflow policy, not rigid user-facing modes
- Single-agent default
- Subagents only when clearly useful
- Model choice must stay dynamic per task/subagent
- Token/speed optimization is a product feature
- Telemetry only if opt-in and only for improving `Sane`

## Current State

Implemented:

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
- first optional managed global Codex overlay block (`~/.codex/AGENTS.md`)
- first managed user-level hooks target (`~/.codex/hooks.json`)
- first managed user-level custom agents target (`~/.codex/agents/`)
- read-only inspection of `~/.codex/config.toml`
- opt-in local backup flow for `~/.codex/config.toml`
- read-only preview of recommended core Codex profile changes
- explicit opt-in apply / restore flow for narrow core Codex profile
- explicit opt-in apply flow for separate recommended integrations profile
- explicit opt-in Cloudflare provider profile for Cloudflare MCP tooling
- built-in pack editor in the TUI with local-only optional pack toggles
- built-in pack state exposed in status / doctor inventory
- optional packs now show `configured` vs `installed` truthfully depending on whether managed user-skill assets were exported
- exported `sane-router` skill and global AGENTS overlay now reflect enabled guidance packs and current model-role defaults
- status/doctor now catch drift when exported guidance assets no longer match enabled packs or model-role defaults
- TUI save flows now warn immediately when config changes leave managed guidance exports stale
- `export all` / `uninstall all` for current managed targets
- pure adaptive policy crate with typed obligations and tests
- internal backend policy preview for canonical adaptive scenarios
- internal backend policy preview now shows configured coordinator / sidecar / verifier roles per scenario
- TUI now exposes adaptive policy inspection directly instead of leaving it command-only
- TUI now requires confirmation for risky apply/restore/uninstall actions
- optional repo-local skill export now exists as an explicit separate target and is not part of `export all`

Current gate:

- `B4` managed Codex surfaces remain additive/reversible only
- `B7` may proceed only as internal adaptive policy groundwork, not user-facing workflow ritual

Current command examples:

```bash
cargo run -p sane
cargo run -p sane -- install
cargo run -p sane -- config
cargo run -p sane -- doctor
```

Current verification baseline:

```bash
cargo fmt --check
cargo check
cargo test
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
- [ ] `B4` next managed targets
- [x] `B5` model/subagent config surface
- [x] `B6` privacy / telemetry foundation
- [ ] `B7` adaptive orchestration engine

## Later

- [ ] Self-hosting shadow mode
- [ ] Eval harness for routing, compaction, and self-improvement
- [ ] Later end-to-end outcome runner:
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
  - crates.io / cargo-binstall polish

## Open Research / Decisions

- [ ] Exact TUI library choice
- [ ] Exact `v1` built-in packs
- [ ] Exact self-hosting milestone checklist
- [ ] Exact post-`v1` packaging automation sequence

## Agent Working Rules

- Make durable decisions in docs, not only in chat
- Prefer small, focused slices with fresh verification
- If you change philosophy or scope, update the decision log first
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
2. otherwise update the actual state files to match `R3`
3. keep TUI first, backend verbs escape hatch only
4. keep merge/preserve/remove behavior additive and reversible
5. keep Codex config writes narrow, explicit opt-in, and backup/restore guarded
6. fold the MCP/default-tool audit into the integrations-profile implementation
7. do not start adaptive orchestration before the `R3` state shape is real in code
8. keep the later end-to-end outcome runner plain-language first, not command-ritual-first
