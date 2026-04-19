# sane-policy

Pure adaptive policy engine for `Sane`.

Current responsibility:
- encode Sane's adaptive obligation philosophy in typed form
- evaluate task traits into obligations like planning, review, TDD, subagent eligibility, and compaction
- derive a thin role plan for coordinator / sidecar / verifier usage
- stay pure and testable

This crate should not know about file I/O, Codex paths, or terminal UI.
