# Codex Plugin And Frontend Craft Shape

Date: 2026-04-25

## Sources

- OpenAI Codex skills docs: https://developers.openai.com/codex/skills
- OpenAI Codex plugins docs: https://developers.openai.com/codex/plugins
- OpenAI Codex build plugins docs: https://developers.openai.com/codex/plugins/build
- OpenAI Codex customization docs: https://developers.openai.com/codex/concepts/customization

## Findings

- Skills are the workflow authoring format. They should stay small, task-shaped, and discoverable by concrete descriptions.
- Plugins are the install/distribution unit. They bundle skills, app integrations, and MCP servers.
- Official customization guidance says to use an existing plugin when a reusable workflow already exists, otherwise create a skill and package it as a plugin when sharing.
- Plugin marketplace entries can point at a repo root or a subdirectory, including Git-backed sources with refs.

## Sane Decisions

- Do not switch away from skills for Sane's workflow surface.
- Do package Sane as a Codex plugin alongside the TUI/control plane when ready.
- Do not treat the whole repository as only a plugin. Keep the repo as the product source; add a plugin package or repo-root plugin metadata for Codex distribution.
- Keep the Sane TUI as install/config/update/export/inspect/repair/doctor.
- Keep TUI-managed core install/export as the default setup path.
- Treat the Sane Codex plugin artifact as an optional distribution/install surface, not as the default control plane.
- Leave `export_all` unchanged; plugin artifact installation/export must be an explicit action.
- Keep Sane's internal pack model private for `v1`; no public third-party Sane plugin API promise.

## Frontend Craft Shape

- `frontend-craft` remains a built-in optional pack because frontend output quality is a primary Sane goal.
- The exported `v1` surface should be Sane-owned and compact:
  - `sane-frontend-craft`
  - `sane-frontend-visual-assets`
  - `sane-frontend-review`
- Taste Skill, `impeccable`, and `make-interfaces-feel-better` remain provenance/reference material, not exported mirrors.
- `sane-frontend-review` must specify actual visual evidence tools:
  - in-app browser / Browser Use for browser target inspection
  - Playwright for repeatable screenshots, viewport sweeps, DOM checks, forms, console errors, and interactions
  - screenshot/local image viewing for static assets, generated images, canvas outputs, and before/after evidence
  - terminal checks for build/lint/type/test only as supporting evidence

## Open Build Items

- Decision: use `plugins/sane/` subdirectory packaging so the product repo can keep the TUI/control-plane source at root while the Codex plugin is an installable distribution artifact.
- Local marketplace metadata now lives at `.agents/plugins/marketplace.json`.
- Plugin metadata now lives at `plugins/sane/.codex-plugin/plugin.json`.
- Plugin skill copies now live under `plugins/sane/skills/` and are guarded by framework-assets tests against the manifest-exported skills, including core `sane-bootstrap-research`.
- Active manifest skill/source metadata now excludes stale vendored frontend source entries and pins refreshed upstream provenance for `caveman`, `taste-skill`, and `impeccable`.
- Core Codex-native asset install remains TUI-managed by default; plugin artifact install is optional and explicit.
- Explicit plugin artifact export/install, inspect/doctor, and uninstall/remove awareness now lives outside `export_all`.
- Plugin doctor visibility reports missing/invalid/installed state and the installed plugin version when available.
- `export plugin` writes the installed user marketplace with an absolute `~/.codex/plugins/sane` path; the checked-in `.agents/plugins/marketplace.json` stays repo-local development metadata for `plugins/sane/`.
- Tests cover plugin artifact export/install, inspect/uninstall, preservation of unrelated Codex plugins, malformed manifests, and drift detection.
