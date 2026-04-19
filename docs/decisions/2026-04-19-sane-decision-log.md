# Sane Decision Log

Last updated: 2026-04-19

This file is the durable source of truth for decisions already made in the April 19, 2026 planning session. It exists specifically to stop drift between chat memory and the actual agreed philosophy.

## Source

Primary source session:
- `/Users/bjorn/.codex/sessions/2026/04/19/rollout-2026-04-19T14-42-32-019da5c3-973f-7a62-9339-823069e71ac6.jsonl`

## Locked Decisions

### Product

- Name: `Sane`
- Audience: general Codex users, not just one personal setup
- Positioning: full QoL framework/pack for Codex
- Open source at `v1`
- License: `MIT OR Apache-2.0`

### Core Philosophy

- Plain-language first
- No workflow lock-in
- Commands and skills remain callable, but optional
- Framework should auto-determine when to use skills, hooks, process, and subagents
- Speed and token optimization are first-class concerns
- Avoid useless feature bloat
- Built for long adaptive sessions, including multi-hour one-shot runs
- Behavior should adapt over the session instead of forcing one fixed mode

### Codex / Runtime

- Codex-native
- Must work without `AGENTS.md`
- `AGENTS.md` is optional export only, not a dependency
- No required repo mutation
- No daily wrapper required for prompting
- No command-first UX
- No wrapper-first runtime
- Rust should primarily be the installer / configurator / updater / doctor / asset manager
- Codex-native installation targets are the main product surface
- Local state may exist, but it must stay thin and operational rather than becoming a separate day-to-day runtime

### Workflow / Orchestration

- Hybrid adaptive workflow
- Spec / TDD / review may be skipped for trivial asks and one-liners
- Heavier rigor should appear automatically when useful
- Avoid rigid visible modes
- Use per-turn / per-prompt / per-session adaptive policy
- Single-agent default
- Subagents only when clearly useful
- One central verifier / reviewer authority
- No agent democracy or chatter loops

### Model Policy

- Do not lock `Sane` to one model
- `Sane` should auto-pick the best available models, reasoning settings, and subagent configurations for the task
- Selection should respect the user's subscription and available Codex capabilities
- Fast / cheap sidecar tasks and heavier coordinator tasks may use different model presets

### State / Persistence

- Project-local state by default
- Local-only / gitignored by default
- Zero committed footprint by default
- Avoid interfering with other agent frameworks in cloned repos
- Optional shared / exported layer later
- Local state should balance readability and token efficiency

### TUI / Installation

- Proper install TUI from day one
- TUI is for setup / config / update / export / doctor flows
- TUI is not the normal prompting interface
- Onboarding can borrow from the strongest parts of `openagentsbtw`, without becoming command-first

### Platform / Implementation

- Cross-platform from day one
- Targets: `macOS`, `Linux`, `Windows`
- Rust for implementation
- Architecture should be ready for plugin / pack expansion later
- `v1` does not need a public plugin API yet

### Self-Hosting / Self-Improvement

- `Sane` should eventually help build `Sane`
- Dogfooding should be phased, not immediate
- Self-improvement must be verifier-driven and bounded
- Safe auto-fix classes may exist later
- Evals and verification are mandatory for self-hosting

### Issue Reporting / Telemetry

- GitHub issue relay can exist as an opt-in feature
- Must verify issues before reporting
- Must check duplicates
- Duplicate issues may be enriched instead of duplicated
- Telemetry is opt-in only
- Telemetry exists only to improve `Sane`
- No telemetry repurposing
- No creepy analytics, prompt harvesting, or product-growth misuse

## Strong Recommendations Already Reached

These are not final implementation details, but they are already the preferred direction:

- Thin Rust control plane first, Codex-native asset management as the core product
- Adaptive policy engine over rigid modes
- No numeric scoring engine as the core UX
- Structured machine-readable state plus compact human summaries
- Self-hosting should be milestone-gated, not vibe-gated

## Explicitly Not Yet Decided

- Exact local runtime directory layout and names
- Exact state file formats and compaction strategy
- Exact Rust crate boundaries
- Exact TUI library choice
- Exact `v1` built-in packs
- Exact export surfaces beyond optional `AGENTS.md`
- Exact model preset matrix and routing rules
- Exact self-hosting milestone checklist
- Exact telemetry schema
- Exact GitHub issue relay policy levels
- Final README tagline and marketing copy

## Planning Rule

Future spec and plan docs in this repo should treat this file as authoritative unless a later decision log explicitly supersedes it.
