# Sane TODO

High-signal handoff file for continuing `Sane` across agents and sessions.

## Read First

Before changing architecture or product direction, read:

- `docs/decisions/2026-04-19-sane-decision-log.md`
- `docs/specs/2026-04-19-sane-design.md`

Do not re-litigate already-locked philosophy unless a new decision log explicitly changes it.

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
- initial `install`, `config`, `doctor`, `export`, and `uninstall` command shell
- first managed Codex-native user-skill target (`~/.agents/skills/sane-router`)
- first optional managed global Codex overlay block (`~/.codex/AGENTS.md`)

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
- [ ] Add first-class subagent/model selection config that respects subscription/capability constraints
- [ ] Improve `doctor` with real checks and actionable repair suggestions
- [x] Replace placeholder `export` with the first real Codex-native asset management boundary
- [x] Add symmetric uninstall flow for managed user-skill assets

## Next

- [ ] Add state/event log design using compact machine-readable files
- [ ] Add context compaction / handoff primitives
- [ ] Add next Codex-native asset targets and layout (`hooks`, optional custom agents, future repo overlays)
- [ ] Add better install flow UX in the TUI
- [ ] Add update and rollback flow design
- [ ] Add explicit privacy/telemetry config structures
- [ ] Add issue-relay draft flow design

## Later

- [ ] Optional Codex-native export surfaces
- [ ] Adaptive routing policy engine
- [ ] Built-in pack shortlist and implementation
- [ ] Self-hosting shadow mode
- [ ] Eval harness for routing, compaction, and self-improvement
- [ ] Windows/macOS/Linux path and install hardening passes

## Open Research / Decisions

- [ ] Exact model preset matrix
- [ ] Exact TUI library direction if current shell grows into a richer UI
- [ ] Exact `v1` built-in packs
- [ ] Exact Codex-native asset surfaces to manage at user level vs repo level
- [ ] Exact telemetry schema
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

Recommended next implementation slice:

1. make `doctor` validate config and state properly
2. define the first Codex-native installation targets
3. implement managed asset generation/install for one thin target surface
4. add uninstall + repair flows for each managed target
5. expand to the next safe additive Codex-native target without turning Sane into a wrapper
6. keep the TUI shell thin while the Codex-facing asset manager gets smarter
