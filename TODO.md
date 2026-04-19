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
- typed run snapshot persistence
- typed backend operation / inventory result structures
- initial `install`, `config`, `doctor`, `export`, and `uninstall` command shell
- first managed Codex-native user-skill target (`~/.agents/skills/sane-router`)
- first optional managed global Codex overlay block (`~/.codex/AGENTS.md`)
- first managed user-level hooks target (`~/.codex/hooks.json`)
- `export all` / `uninstall all` for current managed targets

Current gate:

- `B1` thin backend contract

Current command examples:

```bash
cargo run -p sane-tui
cargo run -p sane-tui -- install
cargo run -p sane-tui -- config
cargo run -p sane-tui -- doctor
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

- [ ] `R1` builtin pack capability audit
- [ ] `R2` model / subagent preset matrix
- [ ] `R3` state / compaction design
- [ ] `R4` Codex-native surface map
- [ ] `R5` privacy / telemetry schema

## Build Gates

- [x] `B2` proper install TUI foundation
- [x] `B3` asset inventory / auditability surface
- [ ] `B4` next managed targets
- [ ] `B5` model/subagent config surface
- [ ] `B6` privacy / telemetry foundation
- [ ] `B7` adaptive orchestration engine

## Later

- [ ] Self-hosting shadow mode
- [ ] Eval harness for routing, compaction, and self-improvement
- [ ] Windows/macOS/Linux path and install hardening passes

## Open Research / Decisions

- [ ] Exact TUI library choice
- [ ] Exact `v1` built-in packs
- [ ] Exact self-hosting milestone checklist

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

1. continue `B4`
2. hooks shipped first
3. next candidate is optional custom agents
4. keep merge/preserve/remove behavior additive and reversible
5. extend inventory/doctor coverage for each new target before moving on
