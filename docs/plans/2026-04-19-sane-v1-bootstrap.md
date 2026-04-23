# Sane V1 Bootstrap Implementation Plan

> Superseded stack note: this file captures the original Rust-first bootstrap. Current implementation direction is TypeScript-first with Rust retained only until public TUI startup/parity is replaced cleanly.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `Sane` repository into a working Rust workspace with durable planning docs, base crate boundaries, config/state foundations, and an initial TUI shell that can grow into the real installer and Codex-native asset manager.

**Architecture:** Start with the smallest cross-platform foundation that matches the design spec: a Rust workspace with clear crate boundaries, typed config/state primitives, and a TUI shell that exposes placeholder install/config/export/doctor screens. Keep repo shape and operational state contracts intentionally small so the next research-backed passes can fill in real Codex-native asset management without large rewrites.

**Tech Stack at time of writing:** Rust, Cargo workspace, `serde`, `toml`, `ratatui` or similar TUI library (final choice during Task 3), JSON/JSONL state files, Markdown docs.

---

## Git Progress Tracking

- Track progress with git throughout plan execution.
- Check `git status --short` and diffs between slices so the worktree reflects real state.
- Make milestone commits only when the task or user explicitly asks for them.

## File Structure

- Create: `Cargo.toml`
- Create: `.gitignore`
- Create: `README.md`
- Create: `crates/sane-core/Cargo.toml`
- Create: `crates/sane-core/src/lib.rs`
- Create: `crates/sane-config/Cargo.toml`
- Create: `crates/sane-config/src/lib.rs`
- Create: `crates/sane-state/Cargo.toml`
- Create: `crates/sane-state/src/lib.rs`
- Create: `crates/sane-platform/Cargo.toml`
- Create: `crates/sane-platform/src/lib.rs`
- Create: `crates/sane-tui/Cargo.toml`
- Create: `crates/sane-tui/src/main.rs`
- Create: `tests/` as needed for focused workspace tests

### Task 1: Bootstrap the Cargo Workspace

**Files:**
- Create: `Cargo.toml`
- Create: `.gitignore`

- [ ] **Step 1: Write the failing workspace validation step**

Expected command:

```bash
cargo metadata --format-version 1
```

Expected: fail because no workspace manifest exists yet.

- [ ] **Step 2: Create the root workspace manifest**

```toml
[workspace]
members = [
  "crates/sane-core",
  "crates/sane-config",
  "crates/sane-state",
  "crates/sane-platform",
  "crates/sane-tui",
]
resolver = "2"

[workspace.package]
edition = "2024"
license = "MIT OR Apache-2.0"
version = "0.1.0"
authors = ["Bjorn"]

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"
thiserror = "2"
```

- [ ] **Step 3: Create a base `.gitignore`**

```gitignore
/target
/.sane
.DS_Store
Thumbs.db
```

- [ ] **Step 4: Run workspace validation**

Run:

```bash
cargo metadata --format-version 1
```

Expected: PASS and list the five workspace members.

- [ ] **Step 5: Commit**

```bash
git add Cargo.toml .gitignore
git commit -m "chore: bootstrap Sane cargo workspace"
```

### Task 2: Create Minimal Foundation Crates

**Files:**
- Create: `crates/sane-core/Cargo.toml`
- Create: `crates/sane-core/src/lib.rs`
- Create: `crates/sane-config/Cargo.toml`
- Create: `crates/sane-config/src/lib.rs`
- Create: `crates/sane-state/Cargo.toml`
- Create: `crates/sane-state/src/lib.rs`
- Create: `crates/sane-platform/Cargo.toml`
- Create: `crates/sane-platform/src/lib.rs`

- [ ] **Step 1: Write a failing build command**

Run:

```bash
cargo check
```

Expected: FAIL because workspace members do not exist yet.

- [ ] **Step 2: Add crate manifests**

Use a consistent pattern:

```toml
[package]
name = "sane-core"
edition.workspace = true
license.workspace = true
version.workspace = true

[dependencies]
```

Repeat for:
- `sane-config`
- `sane-state`
- `sane-platform`

For `sane-config` and `sane-state`, include:

```toml
[dependencies]
serde.workspace = true
serde_json.workspace = true
toml.workspace = true
thiserror.workspace = true
```

- [ ] **Step 3: Add minimal library code**

`crates/sane-core/src/lib.rs`

```rust
pub const NAME: &str = "Sane";
```

`crates/sane-config/src/lib.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LocalConfig {
    pub version: u32,
}

impl Default for LocalConfig {
    fn default() -> Self {
        Self { version: 1 }
    }
}
```

`crates/sane-state/src/lib.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RunSnapshot {
    pub version: u32,
    pub objective: String,
}
```

`crates/sane-platform/src/lib.rs`

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostPlatform {
    MacOs,
    Linux,
    Windows,
}

pub fn detect_platform() -> HostPlatform {
    match std::env::consts::OS {
        "macos" => HostPlatform::MacOs,
        "windows" => HostPlatform::Windows,
        _ => HostPlatform::Linux,
    }
}
```

- [ ] **Step 4: Run the build**

Run:

```bash
cargo check
```

Expected: PASS for all library crates.

- [ ] **Step 5: Commit**

```bash
git add crates/sane-core crates/sane-config crates/sane-state crates/sane-platform
git commit -m "feat: add Sane foundation crates"
```

### Task 3: Add the Initial TUI Shell

**Files:**
- Create: `crates/sane-tui/Cargo.toml`
- Create: `crates/sane-tui/src/main.rs`

- [ ] **Step 1: Write a failing run command**

Run:

```bash
cargo run -p sane-tui
```

Expected: FAIL because the binary crate does not exist yet.

- [ ] **Step 2: Create the TUI crate manifest**

```toml
[package]
name = "sane-tui"
edition.workspace = true
license.workspace = true
version.workspace = true

[dependencies]
sane-core = { path = "../sane-core" }
sane-platform = { path = "../sane-platform" }
```

If choosing `ratatui` immediately, add it here in the same task. If not, keep `v1` bootstrap to a text shell first and add the full TUI dependency in the next plan slice.

- [ ] **Step 3: Create the binary entrypoint**

```rust
use sane_core::NAME;
use sane_platform::detect_platform;

fn main() {
    println!("{NAME}");
    println!("platform: {:?}", detect_platform());
    println!("commands: install, config, export, doctor");
}
```

- [ ] **Step 4: Run the binary**

Run:

```bash
cargo run -p sane-tui
```

Expected output:
- line containing `Sane`
- line containing detected platform
- line containing `install, config, export, doctor`

- [ ] **Step 5: Commit**

```bash
git add crates/sane-tui
git commit -m "feat: add initial Sane TUI shell"
```

### Task 4: Add Config and State Serialization Tests

**Files:**
- Create: `crates/sane-config/tests/local_config.rs`
- Create: `crates/sane-state/tests/run_snapshot.rs`

- [ ] **Step 1: Write the config serialization test**

```rust
use sane_config::LocalConfig;

#[test]
fn local_config_round_trips_through_toml() {
    let config = LocalConfig::default();
    let encoded = toml::to_string(&config).unwrap();
    let decoded: LocalConfig = toml::from_str(&encoded).unwrap();
    assert_eq!(decoded, config);
}
```

- [ ] **Step 2: Write the state serialization test**

```rust
use sane_state::RunSnapshot;

#[test]
fn run_snapshot_round_trips_through_json() {
    let snapshot = RunSnapshot {
        version: 1,
        objective: "bootstrap sane".to_string(),
    };
    let encoded = serde_json::to_string(&snapshot).unwrap();
    let decoded: RunSnapshot = serde_json::from_str(&encoded).unwrap();
    assert_eq!(decoded, snapshot);
}
```

- [ ] **Step 3: Run the tests**

Run:

```bash
cargo test -p sane-config -p sane-state
```

Expected: PASS with 2 passing tests.

- [ ] **Step 4: Run full workspace test pass**

Run:

```bash
cargo test
```

Expected: PASS for the full workspace.

- [ ] **Step 5: Commit**

```bash
git add crates/sane-config/tests crates/sane-state/tests
git commit -m "test: verify Sane config and state serialization"
```

### Task 5: Add Bootstrap README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

Include:
- one-paragraph project summary
- current status as bootstrap / planning phase
- link to decision log
- link to design spec
- link to implementation plan
- short local run instructions

Use this skeleton:

```md
# Sane

Sane is a Codex-native QoL framework for plain-language, adaptive, high-signal development work.

## Status

Bootstrap phase. See:

- `docs/decisions/2026-04-19-sane-decision-log.md`
- `docs/specs/2026-04-19-sane-design.md`
- `docs/plans/2026-04-19-sane-v1-bootstrap.md`

## Run

```bash
cargo run -p sane-tui
```
```

- [ ] **Step 2: Run a final workspace verification pass**

Run:

```bash
cargo fmt --check
cargo check
cargo test
```

Expected: PASS on all three commands.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Sane bootstrap README"
```

## Self-Review

Spec coverage:
- Workspace bootstrap covered
- Core crate boundaries covered
- Initial TUI shell covered
- State/config serialization foundations covered
- Bootstrap README covered

Known deliberate gaps for next plan:
- real installer behavior
- model preset routing
- project-local runtime directory implementation
- export layer
- doctor / repair logic
- telemetry / issue relay implementation
- self-hosting infrastructure

Placeholder scan:
- No `TODO` or `TBD` steps in the executable tasks above

Type consistency:
- `LocalConfig` and `RunSnapshot` are the canonical first typed config/state structures
- crate names and commands match the workspace manifest
