# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0-beta.7] - 2026-04-30

### Fixed

- Injected a real Node `createRequire` shim into the packaged ESM CLI so Ink's bundled CommonJS dependencies work in interactive Homebrew runs.
- Added a pseudo-TTY package smoke test for the interactive Ink path.

## [1.0.0-beta.6] - 2026-04-30

### Fixed

- Added Node ESM shims to the self-contained CLI bundle so bundled CommonJS dependencies can resolve built-in modules under Homebrew.

## [1.0.0-beta.5] - 2026-04-30

### Fixed

- Switched the packaged CLI to a self-contained ESM bundle so Homebrew installs do not depend on missing runtime `node_modules`.
- Updated packaged smoke commands to execute `dist/bin/sane.js`.

## [1.0.0-beta.4] - 2026-04-30

### Fixed

- Declared runtime package dependencies in the generated `sane-codex` package so package-manager installs can resolve Ink and React.
- Prepared Homebrew packaging to install npm runtime dependencies instead of copying the bare tarball.

## [1.0.0-beta.3] - 2026-04-30

### Changed

- Moved install instructions near the top of the README with Homebrew as the primary macOS/Linux path.
- Clarified npm as the direct `sane-codex` install path instead of future-only wording.
- Hardened release automation so prerelease tags are marked prerelease and are not promoted to GitHub Latest.
- Added npm publish validation to block prerelease tags from using the `latest` dist-tag.

## [1.0.0-beta.2] - 2026-04-30

### Added

- Optional `docs-craft` pack metadata and bundled `sane-docs-writing` skill.
- Opt-in issue relay draft and submission commands with duplicate checks and privacy boundaries.
- Sane CLI update check plus opt-in auto-update setting for supported installs.
- Runtime status signal for recent blockers recorded in Sane-owned state.

### Changed

- Refreshed public docs around Sane's Codex-native framework positioning and current control-surface scope.
- Generalized optional pack metadata so config, exported guidance, and OpenCode continuity use pack manifest truth.

## [1.0.0-beta.1] - 2026-04-29

### Added

- Initial `v1.0.0-beta.1` prerelease of the `sane-codex` CLI package.
- Control surface for installing, configuring, checking, repairing, and removing Sane's Codex-native framework pieces.
- Codex-native managed surfaces for Sane skills, guidance blocks, hooks, custom agents, narrow config profiles, and optional OpenCode export.
- Optional `docs-craft` pack with `sane-docs-writing` for source-verified user-facing documentation work.
- Packaged release verification for npm tarballs plus GitHub Release artifacts and downstream channel planning.
- Public README, support, contribution, package README, and changelog baseline for the beta release.

### Changed

- Deferred Codex plugin artifact packaging from v1; the native Codex install bundle is the supported beta surface.
- Tightened package payload to ship the built CLI, root README, notice/license files, and core pack assets only.
