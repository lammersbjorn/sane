# Sane Privacy / Telemetry Schema

Last updated: 2026-04-19

Purpose:
- finish `R5`
- turn the locked telemetry philosophy into an implementation-safe schema
- define what may exist locally before any remote behavior is even considered

Source decisions:
- telemetry is opt-in only
- telemetry exists only to improve `Sane`
- local-first
- inspectable
- resettable
- separate from issue reporting
- no prompt, repo, or code harvesting

## Product Rule

Telemetry in `Sane` exists for product improvement only.

It must never be reused for:
- marketing
- user profiling
- growth optimization
- training on user code by default
- content analytics

## Consent Levels

`Sane` should support these levels:

1. `off`
- default
- no remote sends
- no local telemetry event log required beyond ordinary operational logs

2. `local-only`
- keep local aggregate counters and recent event summaries
- no remote sends
- transparency UI can inspect and clear this data

3. `product-improvement`
- local aggregation first
- explicit remote upload allowed
- aggregate / sanitized only
- still no prompts, code, repo names, or raw file paths

Issue reporting stays separate from telemetry.

## Allowed Data

Allowed local telemetry categories:
- install success / failure
- doctor finding categories
- self-repair success / failure
- managed surface export / uninstall counts
- feature usage counts inside the installer/TUI
- model-role config choices by normalized identifier
- session length buckets
- latency buckets
- token usage buckets when available locally without content capture
- crash / error fingerprints

Allowed remote data:
- aggregate counts
- coarse environment metadata
- normalized failure classes
- sanitized version/platform matrix

## Forbidden Data

Never collect or send:
- prompts
- responses
- source code
- file contents
- secret values
- repo names
- repo paths
- branch names
- raw local logs
- stack traces with unsanitized user paths
- full issue bodies unless the user explicitly approves issue relay

## Local Data Model

`v1` should keep telemetry local in a small, inspectable shape:

- config flag in local config
- local aggregate counters file
- local recent events file
- local upload queue file only when remote telemetry is enabled

Recommended paths under `.sane`:
- `.sane/telemetry/summary.json`
- `.sane/telemetry/events.jsonl`
- `.sane/telemetry/queue.jsonl`

Rules:
- `summary.json` is canonical for counts and last-seen timestamps
- `events.jsonl` is bounded and prunable
- `queue.jsonl` must not exist unless remote telemetry is enabled
- saving `telemetry = "off"` removes `.sane/telemetry/`
- reducing from `product-improvement` to `local-only` removes `queue.jsonl`
- config save results must report telemetry file/directory side effects in `pathsTouched`

## Event Shape

Recommended normalized event fields:
- `ts_bucket`
- `category`
- `action`
- `result`
- `surface`
- `platform`
- `sane_version`
- `codex_surface`
- optional `error_fingerprint`
- optional `duration_bucket`
- optional `token_bucket`

Do not include free-form text payloads by default.

## Transparency UX

`B6` should expose:
- current telemetry consent level
- what categories are stored
- whether any remote queue exists
- count of queued uploads
- reset / delete controls

`B6` should not expose:
- network transport yet
- background upload logic yet

## Issue Reporting Boundary

Issue reporting is not telemetry.

Telemetry:
- aggregate
- product-improvement stats
- no narrative user data

Issue relay:
- explicit verification flow
- duplicate-aware
- user-approved context

These must remain separately configurable.

## Decision

`R5` answer:
- `Sane` should implement a local-first telemetry model with three consent levels: `off`, `local-only`, `product-improvement`.
- remote telemetry must stay aggregate and sanitized.
- issue reporting remains a separate opt-in system.
- `B6` should start with config + transparency + reset, not with remote transport.
