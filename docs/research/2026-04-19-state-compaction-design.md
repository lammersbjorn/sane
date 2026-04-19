# Sane State / Compaction Design

Last updated: 2026-04-19

Purpose:
- finish `R3`
- define exact local state shape for long sessions
- keep state readable enough for humans but cheap enough for agents

Source decisions:
- `.sane` stays thin and operational
- project-local by default
- local-only / gitignored by default
- readability and token efficiency both matter
- long sessions need durable handoff and compaction

## Design Rule

Use layered state, not one giant file.

Split by job:
- stable config
- current run state
- append-only event history
- compacted summaries
- human handoff brief

## Canonical Formats

Use:
- `TOML` for stable config
- `JSON` for current canonical snapshots
- `JSONL` for append-only operational records
- short `Markdown` for human handoff only

Do not use:
- giant markdown memory files as source of truth
- one ever-growing JSON blob

## Recommended `.sane` Layout

```text
.sane/
  config.local.toml
  state/
    current-run.json
    summary.json
    events.jsonl
    decisions.jsonl
    artifacts.jsonl
  telemetry/
    summary.json
    events.jsonl
    queue.jsonl
  cache/
  logs/
  sessions/
  BRIEF.md
```

## File Roles

### `config.local.toml`

Owns:
- model-role defaults
- privacy / telemetry consent
- future local install preferences

### `state/current-run.json`

Owns the current live run:
- current objective
- current phase / run-state
- active tasks
- blocking questions
- verification status
- last compaction pointer

This is the canonical machine-readable live state.

### `state/summary.json`

Owns compacted durable state:
- accepted decisions
- finished milestones
- current known constraints
- last verified outputs
- important files touched

This is what later agents should prefer loading first.

### `state/events.jsonl`

Append-only low-level event stream:
- installs
- exports
- config saves
- doctor runs
- state transitions

Prunable.
Not primary reload target.

### `state/decisions.jsonl`

Append-only durable product/workflow decisions:
- what changed
- why
- when

Useful for self-hosting and audit.

### `state/artifacts.jsonl`

Append-only references to important outputs:
- generated files
- exported assets
- reports
- patches

### `BRIEF.md`

Very short human handoff only:
- current goal
- where to continue
- what not to reopen

Keep tiny.
This is not the full memory system.

## Compaction Rule

Compaction should happen by promotion, not by blind truncation.

Flow:
1. append raw event / decision / artifact records
2. periodically promote stable facts into `summary.json`
3. rewrite `BRIEF.md` from `summary.json` + current run
4. prune old low-level events if they are already represented in summary

## Load Order

Future agents should load in this order:
1. `config.local.toml`
2. `state/summary.json`
3. `state/current-run.json`
4. `BRIEF.md`
5. only then specific JSONL slices if needed

Do not load full raw history by default.

## Migration Rule

State files are versioned.

Each canonical JSON/TOML file should carry:
- `version`

Migration behavior:
- support forward migration from older versions
- do not silently discard unknown fields
- prefer explicit upgrade path over auto-rewrite without backup

## Decision

`R3` answer:
- `.sane` should use a layered state model.
- canonical files should be `config.local.toml`, `state/current-run.json`, `state/summary.json`, and bounded JSONL append logs.
- `BRIEF.md` exists for human handoff, not as the primary machine state.
- compaction should promote stable facts into summary files rather than relying on transcript growth.
