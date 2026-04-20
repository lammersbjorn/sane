# ⚖️ sane-state

Thin local state and persistence for `Sane`.

## Why This Crate Exists

`Sane` needs a small local memory so it can inspect, repair, summarize, and roll back its own work.

That local memory should stay:

- project-local
- inspectable
- operational
- thin

This crate exists to support that boundary.

## What Users Feel From It

Users feel this crate when `Sane` can answer:

- what changed recently
- what state looks stale or broken
- what can be repaired
- what happened during a longer run

It powers the local `.sane/` record without turning `.sane/` into a second product runtime.

## What It Owns

- typed state records
- JSON and JSONL persistence helpers
- run snapshot and summary formats
- event, decision, and artifact log formats

## What It Must Not Own

- global user memory
- Codex config writes
- path discovery
- policy decisions

## When Docs Should Change

Update docs if you change:

- local state file formats
- what `.sane/` stores
- backward-compatibility expectations for state files
- repair or summary behavior users will notice

## Read Alongside

- [root README](../../README.md)
- [crates/sane-platform/README.md](../sane-platform/README.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
