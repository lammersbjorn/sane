# Lifecycle Hooks

Date: 2026-04-25

## Scope

B13 adds opt-in managed Codex lifecycle hooks without making Sane a hidden automation layer.

## Config

`[lifecycle-hooks]` supports:

- `tokscale-submit`: disabled by default
- `tokscale-dry-run`: enabled by default
- `rate-limit-resume`: disabled by default

Tokscale hook runs through a Sane-owned command on `SessionEnd` only:

- `sane hook tokscale-submit --event session-end --dry-run`

When dry-run is disabled, Sane runs `tokscale submit --codex`. Tokscale failures, missing binaries, and timeouts return exit code 0 so Codex sessions are not blocked.

## Rate Limit Resume

Sane can now install a managed `SessionEnd` hook with `--rate-limit-resume`. The hook emits explicit context when no reset timestamp is available. Automatic resume scheduling remains blocked until Codex exposes a stable reset timestamp in hook payloads or another local signal.

The B11 outcome loop may preserve objective, next task, verification state, and resume context across rate-limit or interruption stops. It must not claim automatic resume unless that stable reset signal exists.

## Privacy

All lifecycle hooks are opt-in. Tokscale submission is Codex-only and dry-run by default. Sane does not upload prompts or transcripts from these hooks.
