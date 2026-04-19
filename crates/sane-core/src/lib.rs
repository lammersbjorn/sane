pub const NAME: &str = "Sane";
pub const SANE_ROUTER_SKILL_NAME: &str = "sane-router";
pub const SANE_REVIEWER_AGENT_NAME: &str = "sane-reviewer";
pub const SANE_EXPLORER_AGENT_NAME: &str = "sane-explorer";
pub const SANE_GLOBAL_AGENTS_BEGIN: &str = "<!-- sane:global-agents:start -->";
pub const SANE_GLOBAL_AGENTS_END: &str = "<!-- sane:global-agents:end -->";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct GuidancePacks {
    pub caveman: bool,
    pub cavemem: bool,
    pub rtk: bool,
    pub frontend_craft: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationKind {
    InstallRuntime,
    ShowConfig,
    ShowCodexConfig,
    BackupCodexConfig,
    PreviewCodexProfile,
    PreviewIntegrationsProfile,
    PreviewCloudflareProfile,
    ApplyCodexProfile,
    ApplyIntegrationsProfile,
    ApplyCloudflareProfile,
    RestoreCodexConfig,
    ResetTelemetryData,
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
    Configured,
    Disabled,
    Missing,
    Invalid,
    PresentWithoutSaneBlock,
    Removed,
}

impl InventoryStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Installed => "installed",
            Self::Configured => "configured",
            Self::Disabled => "disabled",
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

pub fn sane_router_skill(packs: GuidancePacks) -> String {
    let mut body = vec![
        "---".to_string(),
        "name: sane-router".to_string(),
        "description: Install and manage Sane's Codex-native plain-language workflow assets, model routing defaults, subagent selection policy, and optional hooks without forcing repo mutation.".to_string(),
        "---".to_string(),
        "".to_string(),
        "# Sane Router".to_string(),
        "".to_string(),
        "Use this managed skill when work touches Sane itself, its Codex-native asset installation, or its plain-language adaptive workflow rules.".to_string(),
        "".to_string(),
        "Prefer this skill for:".to_string(),
        "- installing or uninstalling Sane-managed Codex assets".to_string(),
        "- adjusting plain-language routing and model-role defaults".to_string(),
        "- maintaining user-level skills, hooks, and optional AGENTS overlays".to_string(),
        "- keeping Sane thin, Codex-native, and low-ceremony".to_string(),
        "".to_string(),
        "Keep behavior aligned with Sane philosophy:".to_string(),
        "- plain-language first".to_string(),
        "- commands optional".to_string(),
        "- no required AGENTS.md".to_string(),
        "- no workflow lock-in".to_string(),
        "- model and subagent choice should adapt to task shape".to_string(),
    ];

    if packs.caveman {
        body.push("- caveman pack active: prefer terse, token-efficient prose when normal clarity still holds".to_string());
    }
    if packs.cavemem {
        body.push("- cavemem pack active: keep durable summaries compact and high-signal during long sessions".to_string());
    }
    if packs.rtk {
        body.push("- rtk pack active: if RTK policy is present, route shell work through RTK instead of raw shell".to_string());
    }
    if packs.frontend_craft {
        body.push("- frontend-craft pack active: avoid generic AI frontend output; prefer distinctive, production-grade interface craft".to_string());
    }

    body.push(String::new());
    body.join("\n")
}

pub fn sane_global_agents_overlay(packs: GuidancePacks) -> String {
    let mut body = vec![
        "# Sane".to_string(),
        "".to_string(),
        "- Plain-language first".to_string(),
        "- Commands and skills are optional, not required".to_string(),
        "- Prefer adaptive process over rigid visible modes".to_string(),
        "- Keep repo mutation optional".to_string(),
        "- Use subagents only when the work decomposes cleanly".to_string(),
        "- Choose model and reasoning settings per task when available".to_string(),
    ];

    if packs.caveman {
        body.push("- caveman pack active: default to terse, token-aware prose when it does not reduce correctness".to_string());
    }
    if packs.cavemem {
        body.push(
            "- cavemem pack active: prefer compact durable memory and handoff summaries"
                .to_string(),
        );
    }
    if packs.rtk {
        body.push(
            "- rtk pack active: when RTK policy exists, prefer RTK-routed shell execution"
                .to_string(),
        );
    }
    if packs.frontend_craft {
        body.push("- frontend-craft pack active: for frontend work, avoid generic AI aesthetics and push for stronger craft".to_string());
    }

    body.push(String::new());
    body.join("\n")
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
