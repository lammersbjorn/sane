# sane-core

Very small shared core values and identifiers for `Sane`.

Current responsibility:
- shared product naming/constants
- tiny built-in managed asset templates shared across installers
- pack-aware guidance template generation for managed skill and AGENTS exports
- managed optional pack-skill templates for `caveman`, `cavemem`, `rtk`, and `frontend-craft`
- tiny built-in managed custom-agent templates shared across installers
- managed block markers for additive Codex-native file edits
- typed backend result and inventory structures shared across surfaces
- backend operation identifiers, including explicit status/inventory inspection
- inventory scope labels for separating local runtime state from Codex-native assets
- inventory status labels including local pack enablement/disablement

Keep this crate tiny. Do not move operational logic here unless it is genuinely cross-cutting.
