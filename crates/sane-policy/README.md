# ⚖️ sane-policy

Adaptive decision logic groundwork for `Sane`.

## Why This Crate Exists

`Sane` is meant to adapt its rigor to the task instead of forcing one visible mode on everyone.

That only works if the decision logic is:

- explicit
- typed
- testable
- separate from UI and file writes

This crate holds that logic.

## What Users Feel From It

Today, users mostly feel this crate indirectly.

It supports:

- consistent explanations of why `Sane` recommends a path
- internal previews of adaptive behavior
- future policy-driven decisions that stay understandable instead of becoming hidden magic

Important current boundary:

- this crate is groundwork
- it is not a shipped user-facing orchestration runtime yet

## What It Owns

- policy input types
- policy output types
- typed rule and trace output
- canonical scenarios for policy previews
- role recommendation helpers
- pure evaluation logic

## What It Must Not Own

- prompt parsing
- file writes
- TUI code
- path discovery

## When Docs Should Change

Update docs if you change:

- the meaning of policy outputs users can inspect
- the current scope boundary between internal groundwork and shipped product behavior
- any user-facing explanation of how `Sane` adapts rigor

## Read Alongside

- [root README](../../README.md)
- [docs/decisions/2026-04-19-sane-decision-log.md](../../docs/decisions/2026-04-19-sane-decision-log.md)
- [crates/sane-tui/README.md](../sane-tui/README.md)
