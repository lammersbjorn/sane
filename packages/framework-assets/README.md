# @sane/framework-assets

Checked-in Sane framework assets and helpers.

This package owns:

- Core pack manifest access and bundled asset reads.
- Source records for exported Sane files, including provenance and ownership metadata.
- Render helpers for skills, overlays, agent templates, profile fragments, hooks, and Codex artifacts.
- Drift tests that compare rendered output, manifest metadata, and checked-in pack assets.

Verify with:

```bash
rtk pnpm --filter @sane/framework-assets test
rtk run 'pnpm --filter @sane/framework-assets typecheck'
```
