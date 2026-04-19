# ⚖️ sane-policy

Logic for adaptive decision-making in `Sane`.

## What This Crate Is

One of `Sane`'s core promises is that users should not need a fixed sequence of manual commands to get stronger behavior.

This crate is where that promise becomes testable logic.

It models things like:

- task characteristics
- risk
- ambiguity
- parallelism
- run state

and turns them into recommendations or explicit requirements.

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
- role recommendation helpers
- pure evaluation logic

## What It Must Not Own

- prompt parsing
- file writes
- TUI code
- path discovery

It should stay deterministic and explainable.

## Contributor Note

Policy changes are product changes.
If you touch this crate, verify the docs and user-facing explanations still match what the system actually recommends.

## Read Alongside

- [root README](../../README.md)
- [docs/decisions/2026-04-19-sane-decision-log.md](../../docs/decisions/2026-04-19-sane-decision-log.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
