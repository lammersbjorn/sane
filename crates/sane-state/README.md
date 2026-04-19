# sane-state

Thin operational state structures and persistence helpers for `Sane`.

Current responsibility:
- run snapshot schema
- run summary schema
- append-only event record schema
- operational state read/write helpers

This crate is for small operational metadata, not a separate product runtime.
