pub const NAME: &str = "Sane";
pub const SANE_ROUTER_SKILL_NAME: &str = "sane-router";
pub const SANE_GLOBAL_AGENTS_BEGIN: &str = "<!-- sane:global-agents:start -->";
pub const SANE_GLOBAL_AGENTS_END: &str = "<!-- sane:global-agents:end -->";

pub fn sane_router_skill() -> &'static str {
    r#"---
name: sane-router
description: Install and manage Sane's Codex-native plain-language workflow assets, model routing defaults, subagent selection policy, and optional hooks without forcing repo mutation.
---

# Sane Router

Use this managed skill when work touches Sane itself, its Codex-native asset installation, or its plain-language adaptive workflow rules.

Prefer this skill for:
- installing or uninstalling Sane-managed Codex assets
- adjusting plain-language routing and model-role defaults
- maintaining user-level skills, hooks, and optional AGENTS overlays
- keeping Sane thin, Codex-native, and low-ceremony

Keep behavior aligned with Sane philosophy:
- plain-language first
- commands optional
- no required AGENTS.md
- no workflow lock-in
- model and subagent choice should adapt to task shape
"#
}

pub fn sane_global_agents_overlay() -> &'static str {
    r#"# Sane

- Plain-language first
- Commands and skills are optional, not required
- Prefer adaptive process over rigid visible modes
- Keep repo mutation optional
- Use subagents only when the work decomposes cleanly
- Choose model and reasoning settings per task when available
"#
}
