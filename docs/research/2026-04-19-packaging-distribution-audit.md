# Sane Packaging / Distribution Audit

Last updated: 2026-04-23

Purpose:
- decide how `Sane` should become broadly installable once `v1` is stable
- keep distribution aligned with the shipped TypeScript CLI/TUI path
- prefer low-friction package-manager installs over bespoke installers

## Primary Sources

- npm:
  - [package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
  - [publishing packages](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages)
  - [npx / npm exec](https://docs.npmjs.com/cli/v11/commands/npx)
- Homebrew:
  - [Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
  - [How to Create and Maintain a Tap](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)
- Windows Package Manager:
  - [Create your package manifest](https://learn.microsoft.com/en-us/windows/package-manager/package/manifest)
  - [Submit your manifest to the repository](https://learn.microsoft.com/en-us/windows/package-manager/package/repository)
  - [winget-create](https://github.com/microsoft/winget-create)
- Scoop:
  - [Scoop app manifests](https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests)

## Audit Rule

Good `Sane` distribution should satisfy most of these:

- one obvious install path per major OS
- low maintenance burden for `v1`
- works with the bundled TypeScript CLI output
- easy rollback/version pinning
- does not force users into source builds unless they want them

## Recommendation

### Release Base

Use GitHub Releases as the canonical artifact source.

Why:

- downstream package-manager channels still need stable versioned artifacts
- release archives and checksums stay useful even when npm is the direct-install path
- Homebrew / winget / Scoop all fit cleanly on top of release artifacts

Important product implication:

- end-user distribution should converge on one public binary name: `sane`
- do not publicly ship the product as `sane-tui`

### Direct Install Fallback

Primary direct install recommendation:

- publish a public npm package for `sane`

Why:

- matches the shipped TypeScript CLI
- fits the current `build:package` / packaged `dist/bin/sane.cjs` path
- gives low-friction install modes:
  - `pnpm dlx sane`
  - `npx sane`
  - `npm i -g sane`

Important caution:

- npm should be the direct-install fallback, not the only install story
- package-manager channels still matter for normal OS-native installs

### macOS and Linux

Primary recommendation:

- Homebrew tap

Why:

- strong fit for CLI/TUI tools
- works across macOS and Linux
- good default for users who want package-manager installs instead of npm globals

Recommended shape:

- separate tap repo later, likely `lammersbjorn/homebrew-sane`
- install path:
  - `brew install lammersbjorn/sane/sane`

### Windows

Primary recommendation:

- `winget`

Why:

- official Windows package-manager path
- broadest Windows reach
- clear manifest and update workflow

Recommended shape:

- publish zip artifacts in GitHub Releases
- submit manifests to `microsoft/winget-pkgs`
- automate manifest creation/update with `wingetcreate` once release shape stabilizes

### Windows Secondary Channel

Secondary recommendation:

- Scoop

Why:

- popular with developer/power-user Windows users
- lightweight for zip-based CLI tools
- good complement to `winget`

Recommended shape:

- own Scoop bucket later if needed
- do not make Scoop the only Windows path

## What Not To Do First

Do not make these the first distribution milestone:

- custom curl-pipe installer as the main path
- hand-maintained `.deb` / `.rpm` packaging before the product stabilizes
- MSI-first Windows distribution without `winget`
- package-manager sprawl before release artifacts are stable

## Best `v1.x` Distribution Sequence

1. stable GitHub Release artifacts
2. npm package for direct install / trial
3. Homebrew tap
4. winget
5. Scoop

Why this order:

- establishes one artifact truth first
- gives the current TypeScript CLI a native distribution path fast
- covers macOS/Linux quickly with Homebrew
- covers mainstream Windows with winget
- adds a power-user Windows fallback after that

## Plan Impact

Keep a dedicated post-`v1` packaging track:

- release artifact matrix
- binary/package naming cleanup
- checksums/signing strategy
- npm publishing automation
- Homebrew tap automation
- winget manifest automation
- optional Scoop bucket automation

## Decision

Best current plan:

- yes, `Sane` should become broadly installable after `v1`
- canonical distribution base should be GitHub Releases
- first direct-install path should be a public npm package
- first package-manager targets should be:
  - Homebrew for macOS/Linux
  - winget for Windows
- secondary channel later:
  - Scoop
