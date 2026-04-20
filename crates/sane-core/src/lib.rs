pub const NAME: &str = "Sane";
pub const SANE_ROUTER_SKILL_NAME: &str = "sane-router";
pub const SANE_CAVEMAN_PACK_SKILL_NAME: &str = "sane-caveman";
pub const SANE_CAVEMEM_PACK_SKILL_NAME: &str = "sane-cavemem";
pub const SANE_RTK_PACK_SKILL_NAME: &str = "sane-rtk";
pub const SANE_FRONTEND_CRAFT_PACK_SKILL_NAME: &str = "sane-frontend-craft";
pub const SANE_AGENT_NAME: &str = "sane-agent";
pub const SANE_REVIEWER_AGENT_NAME: &str = "sane-reviewer";
pub const SANE_EXPLORER_AGENT_NAME: &str = "sane-explorer";
pub const SANE_GLOBAL_AGENTS_BEGIN: &str = "<!-- sane:global-agents:start -->";
pub const SANE_GLOBAL_AGENTS_END: &str = "<!-- sane:global-agents:end -->";
pub const SANE_REPO_AGENTS_BEGIN: &str = "<!-- sane:repo-agents:start -->";
pub const SANE_REPO_AGENTS_END: &str = "<!-- sane:repo-agents:end -->";

struct OptionalPackSpec {
    key: &'static str,
    skill_name: &'static str,
    heading: &'static str,
    description: &'static str,
    bullets: &'static [&'static str],
    router_note: &'static str,
    overlay_note: &'static str,
}

const OPTIONAL_PACKS: &[OptionalPackSpec] = &[
    OptionalPackSpec {
        key: "caveman",
        skill_name: SANE_CAVEMAN_PACK_SKILL_NAME,
        heading: "Sane caveman",
        description: "Token-efficiency guidance pack for Sane. Keep prose terse and high-signal without losing technical correctness.",
        bullets: &[
            "- prefer terse, token-efficient prose when clarity survives",
            "- cut filler, hedging, and repeated framing",
            "- keep commands, paths, code, and errors exact",
        ],
        router_note: "- caveman pack active: prefer terse, token-efficient prose when normal clarity still holds",
        overlay_note: "- caveman pack active: default to terse, token-aware prose when it does not reduce correctness",
    },
    OptionalPackSpec {
        key: "cavemem",
        skill_name: SANE_CAVEMEM_PACK_SKILL_NAME,
        heading: "Sane cavemem",
        description: "Durable memory guidance pack for Sane. Keep long-session summaries compact, high-signal, and handoff-friendly.",
        bullets: &[
            "- prefer compact durable summaries over long narrative logs",
            "- preserve decisions, risks, and next actions",
            "- keep memory files short enough to stay token-efficient",
        ],
        router_note: "- cavemem pack active: keep durable summaries compact and high-signal during long sessions",
        overlay_note: "- cavemem pack active: prefer compact durable memory and handoff summaries",
    },
    OptionalPackSpec {
        key: "rtk",
        skill_name: SANE_RTK_PACK_SKILL_NAME,
        heading: "Sane rtk",
        description: "Shell-discipline guidance pack for Sane. Prefer RTK-routed command execution when RTK policy is available.",
        bullets: &[
            "- if RTK policy is present, route shell work through RTK",
            "- avoid raw shell when RTK policy expects mediation",
            "- keep command execution auditable and policy-aware",
        ],
        router_note: "- rtk pack active: if RTK policy is present, route shell work through RTK instead of raw shell",
        overlay_note: "- rtk pack active: when RTK policy exists, prefer RTK-routed shell execution",
    },
    OptionalPackSpec {
        key: "frontend-craft",
        skill_name: SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
        heading: "Sane frontend craft",
        description: "Frontend quality guidance pack for Sane. Push for stronger craft and avoid generic AI frontend output.",
        bullets: &[
            "- avoid generic AI frontend aesthetics",
            "- prefer distinctive, production-grade interface craft",
            "- keep frontend output intentional, polished, and high-signal",
        ],
        router_note: "- frontend-craft pack active: avoid generic AI frontend output; prefer distinctive, production-grade interface craft",
        overlay_note: "- frontend-craft pack active: for frontend work, avoid generic AI aesthetics and push for stronger craft",
    },
];

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
    ExportRepoAgents,
    ExportGlobalAgents,
    ExportHooks,
    ExportCustomAgents,
    ExportAll,
    UninstallUserSkills,
    UninstallRepoSkills,
    UninstallRepoAgents,
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
    pub rewrite: Option<OperationRewriteMetadata>,
    pub details: Vec<String>,
    pub paths_touched: Vec<String>,
    pub inventory: Vec<InventoryItem>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperationRewriteMetadata {
    pub rewritten_path: String,
    pub backup_path: Option<String>,
    pub first_write: bool,
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

fn optional_pack_spec(pack: &str) -> Option<&'static OptionalPackSpec> {
    OPTIONAL_PACKS.iter().find(|spec| spec.key == pack)
}

fn enabled_pack_specs(packs: GuidancePacks) -> Vec<&'static OptionalPackSpec> {
    OPTIONAL_PACKS
        .iter()
        .filter(|spec| spec.enabled(packs))
        .collect()
}

impl OptionalPackSpec {
    fn enabled(&self, packs: GuidancePacks) -> bool {
        match self.key {
            "caveman" => packs.caveman,
            "cavemem" => packs.cavemem,
            "rtk" => packs.rtk,
            "frontend-craft" => packs.frontend_craft,
            _ => false,
        }
    }

    fn skill_body(&self) -> String {
        let mut body = vec![
            "---".to_string(),
            format!("name: {}", self.skill_name),
            format!("description: {}", self.description),
            "---".to_string(),
            "".to_string(),
            format!("# {}", self.heading),
            "".to_string(),
            "This managed skill is installed by Sane when the matching built-in pack is enabled."
                .to_string(),
            "".to_string(),
        ];
        body.extend(self.bullets.iter().map(|bullet| bullet.to_string()));
        body.push(String::new());
        body.join("\n")
    }
}

fn push_router_role_defaults(body: &mut Vec<String>, roles: &ModelRoleGuidance) {
    body.push("Current managed role defaults:".to_string());
    body.push(format!(
        "- coordinator: {} ({})",
        roles.coordinator_model, roles.coordinator_reasoning
    ));
    body.push(format!(
        "- sidecar: {} ({})",
        roles.sidecar_model, roles.sidecar_reasoning
    ));
    body.push(format!(
        "- verifier: {} ({})",
        roles.verifier_model, roles.verifier_reasoning
    ));
}

fn push_overlay_role_defaults(body: &mut Vec<String>, roles: &ModelRoleGuidance) {
    body.push(format!(
        "- Current coordinator default: {} ({})",
        roles.coordinator_model, roles.coordinator_reasoning
    ));
    body.push(format!(
        "- Current sidecar default: {} ({})",
        roles.sidecar_model, roles.sidecar_reasoning
    ));
    body.push(format!(
        "- Current verifier default: {} ({})",
        roles.verifier_model, roles.verifier_reasoning
    ));
}

pub fn sane_router_skill(packs: GuidancePacks, roles: &ModelRoleGuidance) -> String {
    let mut body = vec![
        "---".to_string(),
        "name: sane-router".to_string(),
        "description: Install and update Sane-managed Codex assets, routing defaults, and optional hooks without forcing repo mutation.".to_string(),
        "---".to_string(),
        "".to_string(),
        "# Sane Router".to_string(),
        "".to_string(),
        "Use this managed skill when work touches Sane's installed Codex assets, adaptive workflow rules, or config-backed routing defaults.".to_string(),
        "".to_string(),
        "Prefer this skill for:".to_string(),
        "- installing or uninstalling Sane-managed Codex assets".to_string(),
        "- adjusting config-backed routing and model-role defaults".to_string(),
        "- maintaining Sane-managed skills, hooks, custom agents, and optional AGENTS overlays".to_string(),
        "- keeping Sane additive, low-ceremony, and easy to undo".to_string(),
        "".to_string(),
        "Keep behavior aligned with Sane philosophy:".to_string(),
        "- plain-language first".to_string(),
        "- commands optional".to_string(),
        "- no required AGENTS.md".to_string(),
        "- no workflow lock-in".to_string(),
        "- model and subagent choice should adapt to task shape".to_string(),
        "".to_string(),
    ];
    push_router_role_defaults(&mut body, roles);
    body.extend(
        enabled_pack_specs(packs)
            .into_iter()
            .map(|spec| spec.router_note.to_string()),
    );

    body.push(String::new());
    body.join("\n")
}

pub fn sane_global_agents_overlay(packs: GuidancePacks, roles: &ModelRoleGuidance) -> String {
    let mut body = vec![
        "# Sane".to_string(),
        "".to_string(),
        "- Plain-language first".to_string(),
        "- Commands and skills stay optional".to_string(),
        "- Prefer adaptive process over rigid visible modes".to_string(),
        "- Keep repo mutation explicit and optional".to_string(),
        "- Use subagents only when the work splits cleanly".to_string(),
        "- Prefer task-shaped model and reasoning choices when available".to_string(),
    ];
    push_overlay_role_defaults(&mut body, roles);
    body.extend(
        enabled_pack_specs(packs)
            .into_iter()
            .map(|spec| spec.overlay_note.to_string()),
    );

    body.push(String::new());
    body.join("\n")
}

pub fn sane_optional_pack_skill_name(pack: &str) -> Option<&'static str> {
    optional_pack_spec(pack).map(|spec| spec.skill_name)
}

pub fn sane_optional_pack_skill(pack: &str) -> Option<String> {
    optional_pack_spec(pack).map(OptionalPackSpec::skill_body)
}

pub fn sane_reviewer_agent(roles: &ModelRoleGuidance) -> String {
    format!(
        r#"name = "sane_reviewer"
description = "Read-only reviewer for Sane. Inspect correctness, regressions, missing tests, and risky assumptions."
model = "{model}"
model_reasoning_effort = "{reasoning}"
sandbox_mode = "read-only"

developer_instructions = """
Review with Sane philosophy:
- findings first
- focus on real bugs, regressions, safety gaps, and missing tests
- be terse and specific
- cite concrete files and behavior
- do not propose speculative churn
"""
"#,
        model = roles.verifier_model,
        reasoning = roles.verifier_reasoning,
    )
}

pub fn sane_agent(roles: &ModelRoleGuidance) -> String {
    format!(
        r#"name = "sane_agent"
description = "Primary Sane agent for Codex. Plain-language first, adaptive, low-ceremony, and expected to carry work through to a verified result."
model = "{model}"
model_reasoning_effort = "{reasoning}"
sandbox_mode = "workspace-write"

developer_instructions = """
Work with Sane philosophy:
- plain-language first
- commands and rituals optional
- prefer the lightest process that still gets the result done
- adapt model/subagent use to the task
- keep repo mutation explicit
- verify meaningful changes before claiming success
"""
"#,
        model = roles.coordinator_model,
        reasoning = roles.coordinator_reasoning,
    )
}

pub fn sane_explorer_agent(roles: &ModelRoleGuidance) -> String {
    format!(
        r#"name = "sane_explorer"
description = "Read-only codebase explorer for Sane. Trace the relevant paths and return exact file anchors without editing code."
model = "{model}"
model_reasoning_effort = "{reasoning}"
sandbox_mode = "read-only"

developer_instructions = """
Explore with Sane philosophy:
- map only what the task needs
- prefer concrete file paths and direct evidence
- summarize architecture without fluff
- do not edit files
- keep context tight
"""
"#,
        model = roles.sidecar_model,
        reasoning = roles.sidecar_reasoning,
    )
}

#[cfg(test)]
mod tests {
    use super::{
        GuidancePacks, ModelRoleGuidance, OPTIONAL_PACKS, sane_global_agents_overlay,
        sane_optional_pack_skill, sane_optional_pack_skill_name, sane_router_skill,
    };

    fn role_guidance() -> ModelRoleGuidance {
        ModelRoleGuidance {
            coordinator_model: "gpt-5.4".into(),
            coordinator_reasoning: "high".into(),
            sidecar_model: "gpt-5.4-mini".into(),
            sidecar_reasoning: "medium".into(),
            verifier_model: "gpt-5.4".into(),
            verifier_reasoning: "medium".into(),
        }
    }

    #[test]
    fn router_skill_mentions_custom_agents_in_managed_surfaces() {
        let body = sane_router_skill(GuidancePacks::default(), &role_guidance());

        assert!(body.contains("custom agents"));
    }

    #[test]
    fn global_overlay_only_lists_enabled_packs() {
        let body = sane_global_agents_overlay(
            GuidancePacks {
                cavemem: true,
                frontend_craft: true,
                ..GuidancePacks::default()
            },
            &role_guidance(),
        );

        assert!(body.contains("cavemem pack active"));
        assert!(body.contains("frontend-craft pack active"));
        assert!(!body.contains("caveman pack active"));
        assert!(!body.contains("rtk pack active"));
    }

    #[test]
    fn optional_pack_skill_uses_stable_heading() {
        for spec in OPTIONAL_PACKS {
            let body = sane_optional_pack_skill(spec.key).expect("known pack");

            assert_eq!(
                sane_optional_pack_skill_name(spec.key),
                Some(spec.skill_name)
            );
            assert!(body.contains(&format!("# {}", spec.heading)));
            assert!(body.contains(spec.description));
            assert!(body.contains(spec.bullets[0]));
        }
    }
}
