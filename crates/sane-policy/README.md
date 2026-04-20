# ⚖️ sane-policy

Adaptive decision logic for `Sane`.

## What This Crate Is

This crate turns a plain-language task into the kinds of obligations `Sane` should follow.

It is the “should I plan, verify, debug, compact, or use a sidecar?” brain.

It models:

- task characteristics
- risk
- ambiguity
- parallelism
- run state

and turns them into recommendations or explicit requirements.

## In Practice

- “simple question” -> stay direct
- “small local edit” -> answer + light verification
- “unknown bug” -> debugging rigor + verification
- “big multi-file feature” -> planning + TDD + review + sidecar eligibility
- “blocked long run” -> compaction + self-repair

## Why It Exists

If adaptive behavior lives only in UI copy or scattered conditionals, it becomes impossible to reason about.

This crate keeps the logic:

- explicit
- typed
- testable
- separate from file writes and UI state

## What It Owns

- policy input types
- policy output types
- typed rule/trace output for obligation explanations
- canonical scenario fixtures for backend inspection
- role recommendation helpers
- pure evaluation logic

## What It Must Not Own

- prompt parsing
- file writes
- TUI code
- path discovery

It should stay deterministic and explainable.

## Key Entry Points

- `evaluate`: compute obligations only
- `explain`: compute obligations, role plan, and typed rule trace
- `canonical_scenarios`: stable fixtures for backend/dev policy previews

`explain` is what the UI and previews should use when they need to show the user why Sane picked a certain path.

## Contributor Note

Policy changes are product changes.
If you touch this crate, verify the docs and user-facing explanations still match what the system actually recommends.

## Read Alongside

- [root README](../../README.md)
- [docs/decisions/2026-04-19-sane-decision-log.md](../../docs/decisions/2026-04-19-sane-decision-log.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
