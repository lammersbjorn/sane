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
- what the current `.sane` layers say right now without hand-parsing each file
- what canonical state file was rewritten, whether it was a first write, and where the backup landed
- what canonical backup siblings exist for a state file, newest first

It powers the local `.sane/` record without turning `.sane/` into a second product runtime.

## What It Owns

- typed state records
- layered state readers for config, summary, current-run, and brief files
- JSON and JSONL persistence helpers
- ordered JSONL slice/query helpers for history files
- canonical rewrite helpers that snapshot existing state into timestamped `.bak` siblings before replacement
- canonical rewrite metadata (`rewritten_path`, `backup_path`, `first_write`) for inspect/repair surfaces
- canonical backup sibling listing helpers that match rewrite backup naming and sort newest-first
- run snapshot and summary formats
- event, decision, and artifact log formats
- compatibility upgrades from older snapshot/event shapes into the typed state model

## What It Must Not Own

- global user memory
- Codex config writes
- path discovery
- policy decisions

## When Docs Should Change

Update docs if you change:

- local state file formats
- what `.sane/` stores
- canonical layered load behavior for `.sane/config.local.toml`, `summary.json`, `current-run.json`, or `BRIEF.md`
- canonical rewrite backup naming/listing semantics for state files (`<name>.bak.<ts>` and `<name>.bak.<ts>.<attempt>`)
- JSONL history read semantics
- backward-compatibility expectations for state files
- repair or summary behavior users will notice

## Read Alongside

- [root README](../../README.md)
- [crates/sane-platform/README.md](../sane-platform/README.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
