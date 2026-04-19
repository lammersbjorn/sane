pub const NAME: &str = "Sane";
pub const SANE_ROUTER_SKILL_NAME: &str = "sane-router";
pub const SANE_REVIEWER_AGENT_NAME: &str = "sane-reviewer";
pub const SANE_EXPLORER_AGENT_NAME: &str = "sane-explorer";
pub const SANE_GLOBAL_AGENTS_BEGIN: &str = "<!-- sane:global-agents:start -->";
pub const SANE_GLOBAL_AGENTS_END: &str = "<!-- sane:global-agents:end -->";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationKind {
    InstallRuntime,
    ShowConfig,
    ShowStatus,
    Doctor,
    ExportUserSkills,
    ExportGlobalAgents,
    ExportHooks,
    ExportCustomAgents,
    ExportAll,
    UninstallUserSkills,
    UninstallGlobalAgents,
    UninstallHooks,
    UninstallCustomAgents,
    UninstallAll,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InventoryStatus {
    Installed,
    Missing,
    Invalid,
    PresentWithoutSaneBlock,
    Removed,
}

impl InventoryStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Installed => "installed",
            Self::Missing => "missing",
            Self::Invalid => "invalid",
            Self::PresentWithoutSaneBlock => "present_without_sane_block",
            Self::Removed => "removed",
        }
    }

    pub fn display_str(self) -> &'static str {
        match self {
            Self::PresentWithoutSaneBlock => "present without Sane block",
            _ => self.as_str(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InventoryScope {
    LocalRuntime,
    CodexNative,
}

impl InventoryScope {
    pub fn display_str(self) -> &'static str {
        match self {
            Self::LocalRuntime => "local runtime",
            Self::CodexNative => "codex-native",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InventoryItem {
    pub name: String,
    pub scope: InventoryScope,
    pub status: InventoryStatus,
    pub path: String,
    pub repair_hint: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperationResult {
    pub kind: OperationKind,
    pub summary: String,
    pub details: Vec<String>,
    pub paths_touched: Vec<String>,
    pub inventory: Vec<InventoryItem>,
}

impl OperationResult {
    pub fn render_text(&self) -> String {
        let mut lines = vec![self.summary.clone()];

        if !self.details.is_empty() {
            lines.extend(self.details.clone());
        }

        if !self.inventory.is_empty() {
            let scopes = [InventoryScope::LocalRuntime, InventoryScope::CodexNative];
            let multiple_scopes = self
                .inventory
                .iter()
                .any(|item| item.scope != self.inventory[0].scope);

            for scope in scopes {
                let items = self
                    .inventory
                    .iter()
                    .filter(|item| item.scope == scope)
                    .collect::<Vec<_>>();
                if items.is_empty() {
                    continue;
                }

                if multiple_scopes {
                    lines.push(format!("{}:", scope.display_str()));
                }

                for item in items {
                    let prefix = if multiple_scopes { "  " } else { "" };
                    let mut line = format!("{prefix}{}: {}", item.name, item.status.display_str());
                    if let Some(repair_hint) = &item.repair_hint {
                        line.push_str(&format!(" ({repair_hint})"));
                    }
                    lines.push(line);
                }
            }
        }

        if !self.paths_touched.is_empty() {
            lines.push(format!("paths: {}", self.paths_touched.join(", ")));
        }

        lines.join("\n")
    }
}

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

pub fn sane_reviewer_agent() -> &'static str {
    r#"name = "sane_reviewer"
description = "Read-only reviewer for Sane. Focus on correctness, regressions, missing tests, and risky assumptions."
sandbox_mode = "read-only"

developer_instructions = """
Review with Sane philosophy:
- findings first
- focus on real bugs, regressions, safety gaps, and missing tests
- be terse and specific
- cite concrete files and behavior
- do not propose speculative churn
"""
"#
}

pub fn sane_explorer_agent() -> &'static str {
    r#"name = "sane_explorer"
description = "Read-only codebase explorer for Sane. Map systems, trace flows, and hand back exact file anchors without changing code."
sandbox_mode = "read-only"

developer_instructions = """
Explore with Sane philosophy:
- map only what the task needs
- prefer concrete file paths and direct evidence
- summarize architecture without fluff
- do not edit files
- keep context tight
"""
"#
}
