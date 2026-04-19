pub const NAME: &str = "Sane";
pub const SANE_ROUTER_SKILL_NAME: &str = "sane-router";
pub const SANE_CAVEMAN_PACK_SKILL_NAME: &str = "sane-caveman";
pub const SANE_CAVEMEM_PACK_SKILL_NAME: &str = "sane-cavemem";
pub const SANE_RTK_PACK_SKILL_NAME: &str = "sane-rtk";
pub const SANE_FRONTEND_CRAFT_PACK_SKILL_NAME: &str = "sane-frontend-craft";
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelRoleGuidance {
    pub coordinator_model: String,
    pub coordinator_reasoning: String,
    pub sidecar_model: String,
    pub sidecar_reasoning: String,
    pub verifier_model: String,
    pub verifier_reasoning: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationKind {
    InstallRuntime,
    ShowConfig,
    ShowCodexConfig,
    PreviewPolicy,
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
    ExportRepoSkills,
    ExportGlobalAgents,
    ExportHooks,
    ExportCustomAgents,
    ExportAll,
    UninstallUserSkills,
    UninstallRepoSkills,
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

pub fn sane_router_skill(packs: GuidancePacks, roles: &ModelRoleGuidance) -> String {
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
        "".to_string(),
        "Current managed role defaults:".to_string(),
        format!(
            "- coordinator: {} ({})",
            roles.coordinator_model, roles.coordinator_reasoning
        ),
        format!("- sidecar: {} ({})", roles.sidecar_model, roles.sidecar_reasoning),
        format!(
            "- verifier: {} ({})",
            roles.verifier_model, roles.verifier_reasoning
        ),
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

pub fn sane_global_agents_overlay(packs: GuidancePacks, roles: &ModelRoleGuidance) -> String {
    let mut body = vec![
        "# Sane".to_string(),
        "".to_string(),
        "- Plain-language first".to_string(),
        "- Commands and skills are optional, not required".to_string(),
        "- Prefer adaptive process over rigid visible modes".to_string(),
        "- Keep repo mutation optional".to_string(),
        "- Use subagents only when the work decomposes cleanly".to_string(),
        "- Choose model and reasoning settings per task when available".to_string(),
        format!(
            "- Current coordinator default: {} ({})",
            roles.coordinator_model, roles.coordinator_reasoning
        ),
        format!(
            "- Current sidecar default: {} ({})",
            roles.sidecar_model, roles.sidecar_reasoning
        ),
        format!(
            "- Current verifier default: {} ({})",
            roles.verifier_model, roles.verifier_reasoning
        ),
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

pub fn sane_optional_pack_skill_name(pack: &str) -> Option<&'static str> {
    match pack {
        "caveman" => Some(SANE_CAVEMAN_PACK_SKILL_NAME),
        "cavemem" => Some(SANE_CAVEMEM_PACK_SKILL_NAME),
        "rtk" => Some(SANE_RTK_PACK_SKILL_NAME),
        "frontend-craft" => Some(SANE_FRONTEND_CRAFT_PACK_SKILL_NAME),
        _ => None,
    }
}

pub fn sane_optional_pack_skill(pack: &str) -> Option<String> {
    let (name, description, bullets) = match pack {
        "caveman" => (
            SANE_CAVEMAN_PACK_SKILL_NAME,
            "Token-efficiency guidance pack for Sane. Keep prose terse and high-signal without losing technical correctness.",
            vec![
                "- prefer terse, token-efficient prose when clarity survives",
                "- cut filler, hedging, and repeated framing",
                "- keep commands, paths, code, and errors exact",
            ],
        ),
        "cavemem" => (
            SANE_CAVEMEM_PACK_SKILL_NAME,
            "Durable memory guidance pack for Sane. Keep long-session summaries compact, high-signal, and handoff-friendly.",
            vec![
                "- prefer compact durable summaries over long narrative logs",
                "- preserve decisions, risks, and next actions",
                "- keep memory files short enough to stay token-efficient",
            ],
        ),
        "rtk" => (
            SANE_RTK_PACK_SKILL_NAME,
            "Shell-discipline guidance pack for Sane. Prefer RTK-routed command execution when RTK policy is available.",
            vec![
                "- if RTK policy is present, route shell work through RTK",
                "- avoid raw shell when RTK policy expects mediation",
                "- keep command execution auditable and policy-aware",
            ],
        ),
        "frontend-craft" => (
            SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
            "Frontend quality guidance pack for Sane. Push for stronger craft and avoid generic AI frontend output.",
            vec![
                "- avoid generic AI frontend aesthetics",
                "- prefer distinctive, production-grade interface craft",
                "- keep frontend output intentional, polished, and high-signal",
            ],
        ),
        _ => return None,
    };

    let mut body = vec![
        "---".to_string(),
        format!("name: {name}"),
        format!("description: {description}"),
        "---".to_string(),
        "".to_string(),
        format!("# {}", name.replace("sane-", "Sane ").replace('-', " ")),
        "".to_string(),
        "This managed skill is installed by Sane when the matching built-in pack is enabled."
            .to_string(),
        "".to_string(),
    ];
    body.extend(bullets.into_iter().map(str::to_string));
    body.push(String::new());
    Some(body.join("\n"))
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
