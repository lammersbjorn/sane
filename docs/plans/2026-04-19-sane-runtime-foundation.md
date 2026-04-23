# Sane Runtime Foundation Implementation Plan

> Superseded stack note: this file records the original Rust-first runtime bootstrap. Current migration target is TypeScript-first. Use it for historical scope only, not as the active stack decision source of truth.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first thin `Sane` operational layer: project-local `.sane` paths, config/state persistence helpers, and usable `install`, `config`, and `doctor` TUI commands.

**Architecture:** Keep the first operational slice intentionally small and local-first. The path layer computes a canonical `.sane` directory under the project root. Config and state crates own serialization and file I/O for operational metadata only. The TUI remains a thin command shell over those primitives.

**Tech Stack at time of writing:** Rust, Cargo workspace, `serde`, `serde_json`, `toml`, standard library filesystem APIs.

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

- Local operational namespace is `.sane`, not `.betteragents`
- Current active migration reality: runtime-state/control-plane behavior now lives primarily in TypeScript, and there is an internal TS text preview path; the remaining Rust cutover blocker is public terminal parity plus packaged startup, not the local runtime contract itself
- Commit steps remain blocked until the repo is initialized with git
- Track slice progress with git (`git status --short`, diffs, and requested milestone commits) so the plan state is visible in the worktree
- Follow-on slices should keep `.sane` thin and move toward managed Codex-native targets like user skills, optional global overlays, hooks, and custom agents
