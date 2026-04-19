# Sane Packaging / Distribution Audit

Last updated: 2026-04-19

Purpose:
- decide how `Sane` should become broadly installable once `v1` is stable
- prefer official package-manager paths with low user friction
- keep distribution aligned with Sane's cross-platform and low-ceremony philosophy

## Primary Sources

- Homebrew:
  - [Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
  - [How to Create and Maintain a Tap](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)
  - [Acceptable Formulae](https://docs.brew.sh/Acceptable-Formulae)
- Windows Package Manager:
  - [Create your package manifest](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest)
  - [Submit your manifest to the repository](https://learn.microsoft.com/en-us/windows/package-manager/package/repository)
  - [winget-create](https://github.com/microsoft/winget-create)
- Scoop:
  - [Scoop app manifests](https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests)
- Rust distribution:
  - [Publishing on crates.io](https://doc.rust-lang.org/cargo/reference/publishing.html)
  - [cargo-binstall](https://github.com/cargo-bins/cargo-binstall)

## Audit Rule

Good `Sane` distribution should satisfy most of these:
- one obvious install path per major OS
- low maintenance burden for `v1`
- works with prebuilt Rust binaries
- easy rollback/version pinning
- does not force users to build from source unless they want to

## Recommendation

### Release Base

Use GitHub Releases as the canonical artifact source.

Why:
- every downstream channel needs stable versioned artifacts anyway
- easiest place to attach platform binaries and checksums
- matches Rust binary tooling well

Expected artifacts later:
- macOS Apple Silicon
- macOS Intel
- Linux x86_64
- Linux arm64 if feasible
- Windows x86_64

Important product implication:
- end-user distribution should converge on one public binary name, likely `sane`
- do not ship the end-user product publicly as `sane-tui`

### macOS and Linux

Primary recommendation:
- Homebrew tap

Why:
- official tap flow is straightforward
- works on both macOS and Linux
- very strong fit for CLI/TUI binaries

Recommended shape:
- separate tap repo later, likely `lammersbjorn/homebrew-sane`
- install path:
  - `brew install lammersbjorn/sane/sane`

Why not `homebrew/core` first:
- stricter long-term maintenance bar
- easier to iterate in your own tap first

### Windows

Primary recommendation:
- `winget`

Why:
- official Windows package-manager path
- broadest Windows reach
- clear manifest and submission workflow

Recommended shape:
- publish installer/zip artifacts in GitHub Releases
- submit manifests to `microsoft/winget-pkgs`
- likely automate manifest creation/update with `wingetcreate`

### Windows Secondary Channel

Secondary recommendation:
- Scoop

Why:
- popular with developer/power-user Windows audience
- lightweight for zip-based CLI tools
- good complement to `winget`

Recommended shape:
- own Scoop bucket later if needed
- do not make Scoop the only Windows path

### Rust / Developer Fallback

Recommended fallback:
- publish the end-user crate on `crates.io`
- support `cargo install`
- support `cargo binstall` once release artifacts are predictable

Why:
- strong fit for Rust developer audience
- useful cross-platform fallback
- `cargo-binstall` gives binary installs without local compilation when metadata/artifacts line up

Important caution:
- this should stay fallback, not the only install story
- many non-Rust users should never need a Rust toolchain

## What Not To Do First

Do not make these the first distribution milestone:
- custom curl-pipe installer as the main path
- hand-maintained `.deb` / `.rpm` packaging before the product stabilizes
- MSI-first Windows distribution without `winget`
- package-manager sprawl before release artifacts are stable

## Best `v1.x` Distribution Sequence

1. stable GitHub Release artifacts
2. Homebrew tap
3. winget
4. Scoop
5. crates.io + `cargo install`
6. `cargo-binstall` metadata/artifact polish

Why this order:
- establishes one artifact truth first
- covers macOS/Linux quickly with Homebrew
- covers mainstream Windows with winget
- adds power-user and Rust-native fallbacks after that

## Plan Impact

Add a dedicated post-`v1` packaging track:
- release artifact matrix
- binary naming cleanup
- checksums/signing strategy
- Homebrew tap automation
- winget manifest automation
- optional Scoop bucket automation
- crates.io publish flow
- `cargo-binstall` support validation

## Decision

Best current plan:
- yes, `Sane` should become broadly installable after `v1`
- canonical distribution base should be GitHub Releases
- first package-manager targets should be:
  - Homebrew for macOS/Linux
  - winget for Windows
- secondary channels later:
  - Scoop
  - crates.io / `cargo install`
  - `cargo-binstall`
