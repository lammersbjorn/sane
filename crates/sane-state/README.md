# ⚖️ sane-state

Local state and persistence helpers for `Sane`.

## What This Crate Is

This crate defines the small amount of project-local state `Sane` keeps so it can inspect, repair, and summarize its own behavior.

It covers files like:

- current run snapshots
- summary state
- event logs
- decision logs
- artifact logs
- brief handoff state for resuming or understanding recent work

## Why It Exists

`Sane` needs more than one-shot install logic.

It needs enough local memory to answer:

- what changed recently
- what state looks broken
- what can be repaired
- what happened during a longer run

The goal is a thin local recorder, not a second product runtime.

## What It Owns

- typed state records
- JSON and JSONL persistence helpers
- summary and snapshot formats, which are intentionally different

## What It Must Not Own

- global user memory
- Codex config writes
- path discovery
- policy decisions

If this crate starts trying to own workflow logic, it has grown too far.

## Contributor Note

State changes need extra care because they affect:

- repair flows
- summaries
- doctor output
- backward compatibility

If you change a format, document it.

## Read Alongside

- [root README](../../README.md)
- [crates/sane-platform/README.md](../sane-platform/README.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
