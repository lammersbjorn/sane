# Sane Packaging / Distribution Audit

Last updated: 2026-04-29

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

- npm package name should be `sane-codex` because unscoped `sane` is occupied
- installed public command should remain `sane`
- do not publicly ship the product as `sane-tui`

### Direct Install Fallback

Primary direct install recommendation:

- publish a public npm package for `sane-codex`

Why:

- matches the shipped TypeScript CLI
- fits the current `build:package` / packaged `dist/bin/sane.cjs` path
- gives low-friction install modes:
  - `pnpm dlx sane-codex`
  - `npm exec sane-codex`
  - `npm i -g sane-codex`

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

Keep a dedicated release packaging track:

- release artifact matrix
- binary/package naming cleanup
- checksums/signing strategy
- npm publishing automation
- Homebrew tap automation
- winget manifest automation
- optional Scoop bucket automation

`v1` should not wait for every package-manager channel to be live, but it should
ship with a verified artifact path. That means `release:verify`, a packaged
`sane-codex` tarball, checksums, and a clear manual gate before npm publish or
downstream package-manager updates.

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

## Post-v1 Automation Sequence

Do not add release automation before the packaged CLI shape is stable. Once `v1`
is cut-ready, automate in this order:

1. `release:verify`
   - run the root verification baseline
   - run `pnpm --filter @sane/sane-tui run build:smoke`
   - run `pnpm pack` from `apps/sane-tui/dist`
   - assert the package exposes only the public `sane` bin and no workspace-only metadata
2. GitHub Release artifact job
   - build from the tagged commit only
   - upload the npm tarball plus checksum files as release assets
   - keep GitHub Releases as the canonical artifact source for downstream package managers
3. npm publish job
   - publish the generated `apps/sane-tui/dist` package, not the workspace package
   - keep public package name `sane-codex` and public bin name `sane`
   - require provenance/2FA-compatible release credentials before enabling unattended publish
4. Homebrew tap update
   - consume the versioned GitHub Release artifact and checksum
   - run `brew audit --strict` and formula install/test in CI before opening or merging the tap update
5. winget manifest update
   - consume the versioned GitHub Release zip/tarball and checksums
   - generate/update manifests with `wingetcreate` or equivalent only after the Windows artifact URL is stable
   - submit to `microsoft/winget-pkgs`; do not treat this repo as the winget manifest source of truth
6. Scoop bucket update
   - consume the same versioned GitHub Release artifact
   - include autoupdate metadata only after release URL and checksum naming are stable
   - keep Scoop secondary to winget for Windows

Current source re-check on 2026-04-23:

- GitHub release assets remain the right base for versioned downloadable artifacts.
- Homebrew still expects maintainable formulae and strict audit/test discipline.
- Microsoft still routes winget submissions through `microsoft/winget-pkgs`.
- Scoop manifests still fit zip-based CLI tools and can later use autoupdate metadata.

## Repo Rollout Status (2026-04-29)

Packaging/distribution rollout scaffolding now present in-repo:

- `.github/workflows/release-artifacts.yml`
  - builds/verifies with `release:verify` on tags
  - uploads release artifacts (`sane-codex-*.tgz`, `sane-codex-*.zip`, `SHA256SUMS.txt`)
  - attaches same artifacts to GitHub Release for tagged versions
- `.github/workflows/npm-publish.yml`
  - manual-only npm publish gate for `sane-codex`
  - requires `NPM_TOKEN` and protected `npm-publish` environment
  - publishes only from built `apps/sane-tui/dist` package
- `.github/workflows/distribution-channel-plan.yml`
  - manual plan/checklist stub for Homebrew tap, winget, Scoop updates
  - builds channel update URLs from tagged GitHub Release assets/checksums

Non-goal (intended):
- no unattended downstream channel publishing in this repo without explicit secrets + approval gates.
