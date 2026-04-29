# Lifecycle Hooks

Date: 2026-04-25

## Scope

B13 adds opt-in managed Codex lifecycle hooks without making Sane a hidden automation layer.

## Config

`[lifecycle-hooks]` supports:

- `tokscale-submit`: disabled by default
- `tokscale-dry-run`: enabled by default
- `rate-limit-resume`: disabled by default

Tokscale hook runs through a Sane-owned command on Codex `Stop` only:

- `sane hook tokscale-submit --event stop --dry-run`

When dry-run is disabled, Sane runs `tokscale submit --codex`. Tokscale failures, missing binaries, and timeouts return exit code 0 so Codex sessions are not blocked.
The hook stdout is minimal valid Codex Stop hook JSON (`{}`) so submission status never contaminates Stop hook validation.

## Rate Limit Resume

Sane can now install a managed `Stop` hook with `--rate-limit-resume`. The hook emits explicit context when no reset timestamp is available. Automatic resume scheduling remains blocked until Codex exposes a stable reset timestamp in hook payloads or another local signal.

The B11 outcome loop may preserve objective, next task, verification state, and resume context across rate-limit or interruption stops. It must not claim automatic resume unless that stable reset signal exists.

## RTK Command Hook

When the RTK pack is active, managed hooks include a Codex `PreToolUse` Bash guard. The guard is best-effort and local-only: commands already using `rtk` pass through, missing `rtk` or no rewrite passes through, and `rtk rewrite` suggestions deny the raw command with the suggested RTK command.

Status and Doctor now surface the companion binary separately as `rtk-binary`. Sane does not own or publish RTK, so it should not name a pnpm package. Upstream RTK install paths are Homebrew (`brew install rtk`), the upstream install script, Cargo, or release binaries. When Sane ships through Homebrew, the Sane formula should depend on upstream `rtk` so RTK hook enforcement is not silently degraded.

This keeps enforcement in a hook instead of adding more always-loaded prose.

## Privacy

All lifecycle hooks are opt-in. Tokscale submission is Codex-only and dry-run by default. Sane does not upload prompts or transcripts from these hooks.
