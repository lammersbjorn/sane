# Sane Runtime Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real `Sane` runtime layer: project-local `.sane` paths, config/state persistence helpers, and usable `install`, `config`, and `doctor` TUI commands.

**Architecture:** Keep the first runtime slice intentionally small and local-first. The path layer computes a canonical `.sane` directory under the project root. Config and state crates own serialization and file I/O. The TUI becomes a thin command shell over those primitives.

**Tech Stack:** Rust, Cargo workspace, `serde`, `serde_json`, `toml`, standard library filesystem APIs.

---

## File Structure

- Modify: `Cargo.toml`
- Modify: `.gitignore`
- Modify: `crates/sane-config/Cargo.toml`
- Modify: `crates/sane-config/src/lib.rs`
- Modify: `crates/sane-config/tests/local_config.rs`
- Modify: `crates/sane-state/Cargo.toml`
- Modify: `crates/sane-state/src/lib.rs`
- Create: `crates/sane-state/tests/run_persistence.rs`
- Modify: `crates/sane-platform/Cargo.toml`
- Modify: `crates/sane-platform/src/lib.rs`
- Create: `crates/sane-platform/tests/project_paths.rs`
- Modify: `crates/sane-tui/Cargo.toml`
- Modify: `crates/sane-tui/src/main.rs`

## Notes

- Local runtime namespace is `.sane`, not `.betteragents`
- Commit steps remain blocked until the repo is initialized with git
