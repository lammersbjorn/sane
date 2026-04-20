use std::env;
use std::fs;
use std::path::Path;
use std::process::ExitCode;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

use crossterm::event::{self, Event, KeyCode, KeyEventKind};
use crossterm::execute;
use crossterm::terminal::{
    EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode,
};
use ratatui::backend::CrosstermBackend;
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, Clear, List, ListItem, ListState, Paragraph, Tabs, Wrap};
use ratatui::{Frame, Terminal};
use sane_config::{
    AVAILABLE_MODELS, CodexEnvironment, LocalConfig, ModelPreset, ReasoningEffort, TelemetryLevel,
};
use sane_core::{
    GuidancePacks, InventoryItem, InventoryScope, InventoryStatus, ModelRoleGuidance, NAME,
    OperationKind, OperationResult, OperationRewriteMetadata, SANE_AGENT_NAME,
    SANE_EXPLORER_AGENT_NAME, SANE_GLOBAL_AGENTS_BEGIN, SANE_GLOBAL_AGENTS_END,
    SANE_REPO_AGENTS_BEGIN, SANE_REPO_AGENTS_END, SANE_REVIEWER_AGENT_NAME, SANE_ROUTER_SKILL_NAME,
    sane_agent, sane_explorer_agent, sane_global_agents_overlay, sane_optional_pack_skill,
    sane_optional_pack_skill_name, sane_reviewer_agent, sane_router_skill,
};
use sane_platform::{CodexPaths, ProjectPaths, detect_platform};
use sane_policy::{
    Intent, Level, Obligation, Parallelism, PolicyInput, RunState, TaskShape, evaluate,
    recommend_roles,
};
use sane_state::{
    ArtifactRecord, CanonicalRewriteResult, CanonicalStateFormat, CanonicalStatePaths,
    CurrentRunState, DecisionRecord, EventRecord, LayeredStateBundle, RunSummary,
    VerificationStatus, list_canonical_backup_siblings, write_canonical_with_backup_result,
};
use serde_json::{Map, Value, json};
use toml::Value as TomlValue;

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();
    let cwd = match env::current_dir() {
        Ok(cwd) => cwd,
        Err(error) => {
            eprintln!("failed to resolve current directory: {error}");
            return ExitCode::FAILURE;
        }
    };

    let codex_paths = match CodexPaths::discover() {
        Ok(paths) => paths,
        Err(error) => {
            eprintln!("failed to resolve home directory: {error}");
            return ExitCode::FAILURE;
        }
    };

    if args.is_empty() {
        return match run_tui(&cwd, &codex_paths.home_dir, TuiLaunchMode::Onboarding) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => {
                eprintln!("{error}");
                ExitCode::FAILURE
            }
        };
    }

    if args.len() == 1 && args[0] == "settings" {
        return match run_tui(&cwd, &codex_paths.home_dir, TuiLaunchMode::Configure) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => {
                eprintln!("{error}");
                ExitCode::FAILURE
            }
        };
    }

    match run_with_home(
        &args.iter().map(String::as_str).collect::<Vec<_>>(),
        &cwd,
        &codex_paths.home_dir,
    ) {
        Ok(output) => {
            println!("{output}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}

#[derive(Clone, Copy)]
enum TuiLaunchMode {
    Onboarding,
    Configure,
}

fn run_tui(cwd: &Path, home: &Path, launch_mode: TuiLaunchMode) -> Result<(), String> {
    let paths = ProjectPaths::discover(cwd).map_err(|error| error.to_string())?;
    let codex_paths = CodexPaths::new(home);
    let mut app = TuiApp::new(&paths, &codex_paths, launch_mode)?;

    enable_raw_mode().map_err(|error| error.to_string())?;
    let mut stdout = std::io::stdout();
    execute!(stdout, EnterAlternateScreen).map_err(|error| error.to_string())?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend).map_err(|error| error.to_string())?;

    let loop_result = run_tui_loop(&mut terminal, &mut app);

    disable_raw_mode().map_err(|error| error.to_string())?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen).map_err(|error| error.to_string())?;
    terminal.show_cursor().map_err(|error| error.to_string())?;

    loop_result
}

#[cfg(test)]
fn run(args: &[&str], cwd: &Path) -> Result<String, String> {
    let codex_paths = CodexPaths::discover().map_err(|error| error.to_string())?;
    run_with_home(args, cwd, &codex_paths.home_dir)
}

fn run_with_home(args: &[&str], cwd: &Path, home: &Path) -> Result<String, String> {
    let command = Command::from_args(args)?;
    let paths = ProjectPaths::discover(cwd).map_err(|error| error.to_string())?;
    let codex_paths = CodexPaths::new(home);
    run_command(command, &paths, &codex_paths)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Command {
    Summary,
    Install,
    Config,
    CodexConfig,
    BackupCodexConfig,
    Debug,
    DebugPolicyPreview,
    Preview,
    PreviewCodexProfile,
    PreviewIntegrationsProfile,
    PreviewCloudflareProfile,
    Apply,
    ApplyCodexProfile,
    ApplyIntegrationsProfile,
    ApplyCloudflareProfile,
    Restore,
    RestoreCodexConfig,
    Status,
    Doctor,
    HookSessionStart,
    Export,
    ExportAll,
    ExportUserSkills,
    ExportRepoSkills,
    ExportRepoAgents,
    ExportGlobalAgents,
    ExportHooks,
    ExportCustomAgents,
    Uninstall,
    UninstallAll,
    UninstallUserSkills,
    UninstallRepoSkills,
    UninstallRepoAgents,
    UninstallGlobalAgents,
    UninstallHooks,
    UninstallCustomAgents,
}

impl Command {
    fn from_args(args: &[&str]) -> Result<Self, String> {
        match (args.first().copied(), args.get(1).copied()) {
            (None, _) => Ok(Self::Summary),
            (Some("install"), _) => Ok(Self::Install),
            (Some("config"), _) => Ok(Self::Config),
            (Some("codex-config"), _) => Ok(Self::CodexConfig),
            (Some("backup"), Some("codex-config")) => Ok(Self::BackupCodexConfig),
            (Some("debug"), Some("policy-preview")) => Ok(Self::DebugPolicyPreview),
            (Some("debug"), None) => Ok(Self::Debug),
            (Some("preview"), Some("codex-profile")) => Ok(Self::PreviewCodexProfile),
            (Some("preview"), Some("integrations-profile")) => Ok(Self::PreviewIntegrationsProfile),
            (Some("preview"), Some("cloudflare-profile")) => Ok(Self::PreviewCloudflareProfile),
            (Some("preview"), None) => Ok(Self::Preview),
            (Some("apply"), Some("codex-profile")) => Ok(Self::ApplyCodexProfile),
            (Some("apply"), Some("integrations-profile")) => Ok(Self::ApplyIntegrationsProfile),
            (Some("apply"), Some("cloudflare-profile")) => Ok(Self::ApplyCloudflareProfile),
            (Some("apply"), None) => Ok(Self::Apply),
            (Some("restore"), Some("codex-config")) => Ok(Self::RestoreCodexConfig),
            (Some("restore"), None) => Ok(Self::Restore),
            (Some("status"), _) => Ok(Self::Status),
            (Some("doctor"), _) => Ok(Self::Doctor),
            (Some("hook"), Some("session-start")) => Ok(Self::HookSessionStart),
            (Some("export"), Some("all")) => Ok(Self::ExportAll),
            (Some("export"), Some("user-skills")) => Ok(Self::ExportUserSkills),
            (Some("export"), Some("repo-skills")) => Ok(Self::ExportRepoSkills),
            (Some("export"), Some("repo-agents")) => Ok(Self::ExportRepoAgents),
            (Some("export"), Some("global-agents")) => Ok(Self::ExportGlobalAgents),
            (Some("export"), Some("hooks")) => Ok(Self::ExportHooks),
            (Some("export"), Some("custom-agents")) => Ok(Self::ExportCustomAgents),
            (Some("export"), None) => Ok(Self::Export),
            (Some("uninstall"), Some("all")) => Ok(Self::UninstallAll),
            (Some("uninstall"), Some("user-skills")) => Ok(Self::UninstallUserSkills),
            (Some("uninstall"), Some("repo-skills")) => Ok(Self::UninstallRepoSkills),
            (Some("uninstall"), Some("repo-agents")) => Ok(Self::UninstallRepoAgents),
            (Some("uninstall"), Some("global-agents")) => Ok(Self::UninstallGlobalAgents),
            (Some("uninstall"), Some("hooks")) => Ok(Self::UninstallHooks),
            (Some("uninstall"), Some("custom-agents")) => Ok(Self::UninstallCustomAgents),
            (Some("uninstall"), None) => Ok(Self::Uninstall),
            (Some(other), _) => Err(format!("unknown command: {other}")),
        }
    }

    fn static_output(self) -> Option<&'static str> {
        match self {
            Command::Debug => Some("debug: available targets: policy-preview"),
            Command::Export => Some(
                "export: available targets: all, user-skills, repo-skills, repo-agents, global-agents, hooks, custom-agents",
            ),
            Command::Preview => Some(
                "preview: available targets: codex-profile, integrations-profile, cloudflare-profile",
            ),
            Command::Apply => Some(
                "apply: available targets: codex-profile, integrations-profile, cloudflare-profile",
            ),
            Command::Restore => Some("restore: available targets: codex-config"),
            Command::Uninstall => Some(
                "uninstall: available targets: all, user-skills, repo-skills, repo-agents, global-agents, hooks, custom-agents",
            ),
            _ => None,
        }
    }

    fn execute_backend(
        self,
        paths: &ProjectPaths,
        codex_paths: &CodexPaths,
    ) -> Result<OperationResult, String> {
        match self {
            Command::Install => install_runtime(paths, codex_paths),
            Command::Config => show_config(paths),
            Command::CodexConfig => show_codex_config(codex_paths),
            Command::BackupCodexConfig => backup_codex_config(paths, codex_paths),
            Command::DebugPolicyPreview => preview_policy(paths),
            Command::PreviewCodexProfile => preview_codex_profile(codex_paths),
            Command::PreviewIntegrationsProfile => preview_integrations_profile(codex_paths),
            Command::PreviewCloudflareProfile => preview_cloudflare_profile(codex_paths),
            Command::ApplyCodexProfile => apply_codex_profile(paths, codex_paths),
            Command::ApplyIntegrationsProfile => apply_integrations_profile(paths, codex_paths),
            Command::ApplyCloudflareProfile => apply_cloudflare_profile(paths, codex_paths),
            Command::RestoreCodexConfig => restore_codex_config(paths, codex_paths),
            Command::Status => inventory_status(paths, codex_paths),
            Command::Doctor => doctor_runtime(paths, codex_paths),
            Command::HookSessionStart => Err("hook event is not a backend operation".to_string()),
            Command::ExportAll => export_all(paths, codex_paths),
            Command::ExportUserSkills => export_user_skills(paths, codex_paths),
            Command::ExportRepoSkills => export_repo_skills(paths, codex_paths),
            Command::ExportRepoAgents => export_repo_agents(paths, codex_paths),
            Command::ExportGlobalAgents => export_global_agents(paths, codex_paths),
            Command::ExportHooks => export_hooks(codex_paths),
            Command::ExportCustomAgents => export_custom_agents(paths, codex_paths),
            Command::UninstallAll => uninstall_all(codex_paths),
            Command::UninstallUserSkills => uninstall_user_skills(codex_paths),
            Command::UninstallRepoSkills => uninstall_repo_skills(paths),
            Command::UninstallRepoAgents => uninstall_repo_agents(paths),
            Command::UninstallGlobalAgents => uninstall_global_agents(codex_paths),
            Command::UninstallHooks => uninstall_hooks(codex_paths),
            Command::UninstallCustomAgents => uninstall_custom_agents(codex_paths),
            Command::Summary
            | Command::Debug
            | Command::Preview
            | Command::Apply
            | Command::Restore
            | Command::Export
            | Command::Uninstall => Err("backend command not executable".to_string()),
        }
    }
}

fn run_command(
    command: Command,
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<String, String> {
    if let Some(output) = command.static_output() {
        return Ok(output.to_string());
    }

    match command {
        Command::Summary => Ok(render_summary()),
        Command::HookSessionStart => Ok(render_session_start_hook()),
        _ => {
            execute_backend_command(command, paths, codex_paths).map(|result| result.render_text())
        }
    }
}

fn execute_backend_command(
    command: Command,
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    let result = command.execute_backend(paths, codex_paths)?;
    append_operation_event(paths, &result)?;
    Ok(result)
}

#[derive(Clone, Copy)]
struct TuiAction {
    label: &'static str,
    kind: TuiActionKind,
}

#[derive(Clone, Copy)]
struct HomeOption {
    label: &'static str,
    section: TuiSection,
}

#[derive(Clone, Copy)]
enum TuiActionKind {
    Backend(Command),
    OpenConfigEditor,
    OpenPrivacyEditor,
    OpenPackEditor,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum TuiSection {
    StartHere,
    Configure,
    Exports,
    Inspect,
    Repair,
}

impl TuiAction {
    const fn backend(label: &'static str, command: Command) -> Self {
        Self {
            label,
            kind: TuiActionKind::Backend(command),
        }
    }

    const fn config_editor(label: &'static str) -> Self {
        Self {
            label,
            kind: TuiActionKind::OpenConfigEditor,
        }
    }

    const fn pack_editor(label: &'static str) -> Self {
        Self {
            label,
            kind: TuiActionKind::OpenPackEditor,
        }
    }

    const fn privacy_editor(label: &'static str) -> Self {
        Self {
            label,
            kind: TuiActionKind::OpenPrivacyEditor,
        }
    }
}

impl HomeOption {
    const fn new(label: &'static str, section: TuiSection) -> Self {
        Self { label, section }
    }
}

fn section_actions(section: TuiSection) -> Vec<TuiAction> {
    match section {
        TuiSection::StartHere => vec![
            TuiAction::backend("1. Create Sane's local project files", Command::Install),
            TuiAction::backend("2. View your current Codex settings", Command::CodexConfig),
            TuiAction::backend(
                "3. Preview Sane's recommended Codex settings",
                Command::PreviewCodexProfile,
            ),
            TuiAction::backend("4. Back up your Codex settings", Command::BackupCodexConfig),
            TuiAction::backend(
                "5. Apply Sane's recommended Codex settings",
                Command::ApplyCodexProfile,
            ),
            TuiAction::backend("6. Install Sane into Codex", Command::ExportAll),
        ],
        TuiSection::Configure => vec![
            TuiAction::config_editor("Edit default model and reasoning settings"),
            TuiAction::pack_editor("Enable or disable built-in guidance packs"),
            TuiAction::privacy_editor("Choose your telemetry and privacy level"),
            TuiAction::backend("View your current Sane config", Command::Config),
            TuiAction::backend("View your current Codex settings", Command::CodexConfig),
            TuiAction::backend(
                "Preview optional Cloudflare Codex settings",
                Command::PreviewCloudflareProfile,
            ),
            TuiAction::backend(
                "Apply optional Cloudflare Codex settings",
                Command::ApplyCloudflareProfile,
            ),
        ],
        TuiSection::Exports => vec![
            TuiAction::backend(
                "Install Sane user skills for your account",
                Command::ExportUserSkills,
            ),
            TuiAction::backend(
                "Install Sane repo skills for this project",
                Command::ExportRepoSkills,
            ),
            TuiAction::backend(
                "Install Sane guidance block in this repo's AGENTS.md",
                Command::ExportRepoAgents,
            ),
            TuiAction::backend(
                "Install Sane guidance block in global AGENTS.md",
                Command::ExportGlobalAgents,
            ),
            TuiAction::backend("Install Sane Codex hooks", Command::ExportHooks),
            TuiAction::backend(
                "Install Sane custom agents for Codex",
                Command::ExportCustomAgents,
            ),
            TuiAction::backend(
                "Install everything Sane manages in Codex",
                Command::ExportAll,
            ),
        ],
        TuiSection::Inspect => vec![
            TuiAction::backend("Show everything Sane currently manages", Command::Status),
            TuiAction::backend("Run Sane doctor checks for problems", Command::Doctor),
            TuiAction::backend("View your current Sane config", Command::Config),
            TuiAction::backend("View your current Codex settings", Command::CodexConfig),
            TuiAction::backend(
                "Preview optional recommended Codex tools",
                Command::PreviewIntegrationsProfile,
            ),
            TuiAction::backend("Explain Sane's routing policy", Command::DebugPolicyPreview),
        ],
        TuiSection::Repair => vec![
            TuiAction::backend("Repair Sane's local project files", Command::Install),
            TuiAction::backend("Back up your Codex settings", Command::BackupCodexConfig),
            TuiAction::backend(
                "Restore your last Codex backup",
                Command::RestoreCodexConfig,
            ),
            TuiAction::backend(
                "Uninstall Sane repo skills from this project",
                Command::UninstallRepoSkills,
            ),
            TuiAction::backend(
                "Remove Sane block from this repo's AGENTS.md",
                Command::UninstallRepoAgents,
            ),
            TuiAction::backend(
                "Remove everything Sane manages from Codex",
                Command::UninstallAll,
            ),
        ],
    }
}

struct TuiApp {
    paths: ProjectPaths,
    codex_paths: CodexPaths,
    sections: Vec<HomeOption>,
    section_selected: usize,
    action_selected: usize,
    status: OperationResult,
    output: String,
    screen: TuiScreen,
}

enum TuiScreen {
    Dashboard,
    ConfigEditor(ConfigEditor),
    PrivacyEditor(PrivacyEditor),
    PackEditor(PackEditor),
    Confirm(ConfirmScreen),
    Notice(NoticeScreen),
}

struct ConfigEditor {
    config: LocalConfig,
    defaults: LocalConfig,
    selected: usize,
}

struct PrivacyEditor {
    config: LocalConfig,
}

struct PackEditor {
    config: LocalConfig,
    selected: usize,
}

struct ConfirmScreen {
    command: Command,
    label: &'static str,
    section: TuiSection,
}

struct NoticeScreen {
    title: &'static str,
    body: String,
    section: TuiSection,
}

impl ConfigEditor {
    fn new(config: LocalConfig, defaults: LocalConfig) -> Self {
        Self {
            config,
            defaults,
            selected: 0,
        }
    }

    fn next(&mut self) {
        self.selected = (self.selected + 1) % ConfigField::ALL.len();
    }

    fn previous(&mut self) {
        self.selected = if self.selected == 0 {
            ConfigField::ALL.len() - 1
        } else {
            self.selected - 1
        };
    }

    fn cycle_current(&mut self, step: isize) {
        ConfigField::ALL[self.selected].cycle(&mut self.config, step);
    }

    fn reset_defaults(&mut self) {
        self.config = self.defaults.clone();
    }
}

impl PrivacyEditor {
    fn new(config: LocalConfig) -> Self {
        Self { config }
    }

    fn cycle(&mut self, step: isize) {
        let values = TelemetryLevel::all();
        let current = values
            .iter()
            .position(|candidate| *candidate == self.config.privacy.telemetry)
            .unwrap_or(0);
        let next = wrap_index(current, values.len(), step);
        self.config.privacy.telemetry = values[next];
    }

    fn reset(&mut self) {
        self.config.privacy.telemetry = TelemetryLevel::Off;
    }
}

impl PackEditor {
    fn new(config: LocalConfig) -> Self {
        Self {
            config,
            selected: 0,
        }
    }

    fn next(&mut self) {
        self.selected = (self.selected + 1) % PackField::ALL.len();
    }

    fn previous(&mut self) {
        self.selected = if self.selected == 0 {
            PackField::ALL.len() - 1
        } else {
            self.selected - 1
        };
    }

    fn toggle_current(&mut self) {
        PackField::ALL[self.selected].toggle(&mut self.config);
    }

    fn reset_defaults(&mut self) {
        self.config.packs = sane_config::PackConfig::default();
    }
}

#[derive(Clone, Copy)]
enum ConfigField {
    CoordinatorModel,
    CoordinatorReasoning,
    SidecarModel,
    SidecarReasoning,
    VerifierModel,
    VerifierReasoning,
}

#[derive(Clone, Copy)]
enum PackField {
    Caveman,
    Cavemem,
    Rtk,
    FrontendCraft,
}

impl PackField {
    const ALL: [Self; 4] = [Self::Caveman, Self::Cavemem, Self::Rtk, Self::FrontendCraft];

    fn label(self) -> &'static str {
        match self {
            Self::Caveman => "caveman",
            Self::Cavemem => "cavemem",
            Self::Rtk => "rtk",
            Self::FrontendCraft => "frontend-craft",
        }
    }

    fn enabled(self, config: &LocalConfig) -> bool {
        match self {
            Self::Caveman => config.packs.caveman,
            Self::Cavemem => config.packs.cavemem,
            Self::Rtk => config.packs.rtk,
            Self::FrontendCraft => config.packs.frontend_craft,
        }
    }

    fn toggle(self, config: &mut LocalConfig) {
        match self {
            Self::Caveman => config.packs.caveman = !config.packs.caveman,
            Self::Cavemem => config.packs.cavemem = !config.packs.cavemem,
            Self::Rtk => config.packs.rtk = !config.packs.rtk,
            Self::FrontendCraft => config.packs.frontend_craft = !config.packs.frontend_craft,
        }
    }
}

impl ConfigField {
    const ALL: [Self; 6] = [
        Self::CoordinatorModel,
        Self::CoordinatorReasoning,
        Self::SidecarModel,
        Self::SidecarReasoning,
        Self::VerifierModel,
        Self::VerifierReasoning,
    ];

    fn label(self) -> &'static str {
        match self {
            Self::CoordinatorModel => "Coordinator model",
            Self::CoordinatorReasoning => "Coordinator reasoning",
            Self::SidecarModel => "Sidecar model",
            Self::SidecarReasoning => "Sidecar reasoning",
            Self::VerifierModel => "Verifier model",
            Self::VerifierReasoning => "Verifier reasoning",
        }
    }

    fn value(self, config: &LocalConfig) -> String {
        match self {
            Self::CoordinatorModel => config.models.coordinator.model.clone(),
            Self::CoordinatorReasoning => config
                .models
                .coordinator
                .reasoning_effort
                .display_str()
                .to_string(),
            Self::SidecarModel => config.models.sidecar.model.clone(),
            Self::SidecarReasoning => config
                .models
                .sidecar
                .reasoning_effort
                .display_str()
                .to_string(),
            Self::VerifierModel => config.models.verifier.model.clone(),
            Self::VerifierReasoning => config
                .models
                .verifier
                .reasoning_effort
                .display_str()
                .to_string(),
        }
    }

    fn cycle(self, config: &mut LocalConfig, step: isize) {
        match self {
            Self::CoordinatorModel => cycle_model(&mut config.models.coordinator, step),
            Self::CoordinatorReasoning => cycle_reasoning(&mut config.models.coordinator, step),
            Self::SidecarModel => cycle_model(&mut config.models.sidecar, step),
            Self::SidecarReasoning => cycle_reasoning(&mut config.models.sidecar, step),
            Self::VerifierModel => cycle_model(&mut config.models.verifier, step),
            Self::VerifierReasoning => cycle_reasoning(&mut config.models.verifier, step),
        }
    }
}

impl TuiApp {
    fn new(
        paths: &ProjectPaths,
        codex_paths: &CodexPaths,
        launch_mode: TuiLaunchMode,
    ) -> Result<Self, String> {
        let status = inventory_status(paths, codex_paths)?;
        let mut app = Self {
            paths: paths.clone(),
            codex_paths: codex_paths.clone(),
            sections: vec![
                HomeOption::new("Start here", TuiSection::StartHere),
                HomeOption::new("Set up preferences", TuiSection::Configure),
                HomeOption::new("Install to Codex", TuiSection::Exports),
                HomeOption::new("Inspect", TuiSection::Inspect),
                HomeOption::new("Repair or remove", TuiSection::Repair),
            ],
            section_selected: 0,
            action_selected: 0,
            status,
            output: "Ready. Start in `Start here`. Left/right changes section. Up/down changes option. Enter runs the selected step."
                .to_string(),
            screen: TuiScreen::Dashboard,
        };

        if matches!(launch_mode, TuiLaunchMode::Configure) {
            app.select_section(TuiSection::Configure);
        }

        Ok(app)
    }

    fn next_section(&mut self) {
        self.section_selected = (self.section_selected + 1) % self.sections.len();
        self.action_selected = 0;
    }

    fn previous_section(&mut self) {
        self.section_selected = if self.section_selected == 0 {
            self.sections.len() - 1
        } else {
            self.section_selected - 1
        };
        self.action_selected = 0;
    }

    fn select_section(&mut self, section: TuiSection) {
        if let Some(index) = self
            .sections
            .iter()
            .position(|candidate| candidate.section == section)
        {
            self.section_selected = index;
            self.action_selected = 0;
        }
    }
    fn current_section(&self) -> TuiSection {
        self.sections[self.section_selected].section
    }

    fn current_actions(&self) -> Vec<TuiAction> {
        section_actions(self.current_section())
    }

    fn current_action(&self) -> TuiAction {
        self.current_actions()[self.action_selected]
    }

    fn next_action(&mut self) {
        let actions = self.current_actions();
        self.action_selected = (self.action_selected + 1) % actions.len();
    }

    fn previous_action(&mut self) {
        let actions = self.current_actions();
        self.action_selected = if self.action_selected == 0 {
            actions.len() - 1
        } else {
            self.action_selected - 1
        };
    }

    fn run_action(&mut self, action: TuiAction) {
        match action.kind {
            TuiActionKind::Backend(command) => {
                if command_requires_confirmation(command) {
                    self.output = format!(
                        "Review `{}`. Enter or y confirms. Esc or n cancels.",
                        action.label
                    );
                    self.screen = TuiScreen::Confirm(ConfirmScreen {
                        command,
                        label: action.label,
                        section: active_section(self),
                    });
                } else {
                    execute_backend_action(self, action.label, command);
                }
            }
            TuiActionKind::OpenConfigEditor => {
                match load_or_default_config(&self.paths, &self.codex_paths) {
                    Ok(config) => {
                        let defaults = recommended_local_config(&self.codex_paths);
                        self.output =
                            "Config editor open. Left/right cycles values. Enter saves. r resets."
                                .to_string();
                        self.screen = TuiScreen::ConfigEditor(ConfigEditor::new(config, defaults));
                    }
                    Err(error) => {
                        self.output = format!("action failed: {error}");
                    }
                }
            }
            TuiActionKind::OpenPackEditor => {
                match load_or_default_config(&self.paths, &self.codex_paths) {
                    Ok(config) => {
                        self.output = "Pack screen open. Up/down picks pack. Space toggles optional packs. Enter saves. r resets optional packs."
                        .to_string();
                        self.screen = TuiScreen::PackEditor(PackEditor::new(config));
                    }
                    Err(error) => {
                        self.output = format!("action failed: {error}");
                    }
                }
            }
            TuiActionKind::OpenPrivacyEditor => {
                match load_or_default_config(&self.paths, &self.codex_paths) {
                    Ok(config) => {
                        self.output = "Privacy screen open. Left/right cycles telemetry level. Enter saves. d deletes local telemetry data."
                        .to_string();
                        self.screen = TuiScreen::PrivacyEditor(PrivacyEditor::new(config));
                    }
                    Err(error) => {
                        self.output = format!("action failed: {error}");
                    }
                }
            }
        }
    }
}

fn run_tui_loop(
    terminal: &mut Terminal<CrosstermBackend<std::io::Stdout>>,
    app: &mut TuiApp,
) -> Result<(), String> {
    loop {
        terminal
            .draw(|frame| render_tui(frame, app))
            .map_err(|error| error.to_string())?;

        if event::poll(Duration::from_millis(250)).map_err(|error| error.to_string())?
            && let Event::Key(key) = event::read().map_err(|error| error.to_string())?
        {
            if key.kind != KeyEventKind::Press {
                continue;
            }

            match &mut app.screen {
                TuiScreen::Dashboard => match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => return Ok(()),
                    KeyCode::Tab | KeyCode::Right | KeyCode::Char('l') => app.next_section(),
                    KeyCode::BackTab | KeyCode::Left | KeyCode::Char('h') => app.previous_section(),
                    KeyCode::Down | KeyCode::Char('j') => app.next_action(),
                    KeyCode::Up | KeyCode::Char('k') => app.previous_action(),
                    KeyCode::Enter | KeyCode::Char(' ') => {
                        let action = app.current_action();
                        app.run_action(action);
                    }
                    _ => {}
                },
                TuiScreen::ConfigEditor(editor) => match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => {
                        app.screen = TuiScreen::Dashboard;
                        app.select_section(TuiSection::Configure);
                        app.output = "Config editor closed without saving.".to_string();
                    }
                    KeyCode::Down | KeyCode::Char('j') => editor.next(),
                    KeyCode::Up | KeyCode::Char('k') => editor.previous(),
                    KeyCode::Left | KeyCode::Char('h') => editor.cycle_current(-1),
                    KeyCode::Right | KeyCode::Char('l') => editor.cycle_current(1),
                    KeyCode::Char('r') => editor.reset_defaults(),
                    KeyCode::Enter => match save_config(&app.paths, &editor.config) {
                        Ok(result) => {
                            app.output = result.render_text();
                            refresh_status_after_save(app);
                            app.screen = TuiScreen::Notice(NoticeScreen {
                                title: "Saved",
                                body: app.output.clone(),
                                section: TuiSection::Configure,
                            });
                        }
                        Err(error) => app.output = format!("save failed: {error}"),
                    },
                    _ => {}
                },
                TuiScreen::PrivacyEditor(editor) => match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => {
                        app.screen = TuiScreen::Dashboard;
                        app.select_section(TuiSection::Configure);
                        app.output = "Privacy screen closed without saving.".to_string();
                    }
                    KeyCode::Left | KeyCode::Char('h') => editor.cycle(-1),
                    KeyCode::Right | KeyCode::Char('l') => editor.cycle(1),
                    KeyCode::Char('r') => editor.reset(),
                    KeyCode::Char('d') => match reset_telemetry_data(&app.paths) {
                        Ok(result) => app.output = result.render_text(),
                        Err(error) => app.output = format!("reset failed: {error}"),
                    },
                    KeyCode::Enter => match save_config(&app.paths, &editor.config) {
                        Ok(result) => {
                            app.output = result.render_text();
                            refresh_status_after_save(app);
                            app.screen = TuiScreen::Notice(NoticeScreen {
                                title: "Saved",
                                body: app.output.clone(),
                                section: TuiSection::Configure,
                            });
                        }
                        Err(error) => app.output = format!("save failed: {error}"),
                    },
                    _ => {}
                },
                TuiScreen::PackEditor(editor) => match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => {
                        app.screen = TuiScreen::Dashboard;
                        app.select_section(TuiSection::Configure);
                        app.output = "Pack screen closed without saving.".to_string();
                    }
                    KeyCode::Down | KeyCode::Char('j') => editor.next(),
                    KeyCode::Up | KeyCode::Char('k') => editor.previous(),
                    KeyCode::Left | KeyCode::Right | KeyCode::Char(' ') => editor.toggle_current(),
                    KeyCode::Char('r') => editor.reset_defaults(),
                    KeyCode::Enter => match save_config(&app.paths, &editor.config) {
                        Ok(result) => {
                            app.output = result.render_text();
                            refresh_status_after_save(app);
                            app.screen = TuiScreen::Notice(NoticeScreen {
                                title: "Saved",
                                body: app.output.clone(),
                                section: TuiSection::Configure,
                            });
                        }
                        Err(error) => app.output = format!("save failed: {error}"),
                    },
                    _ => {}
                },
                TuiScreen::Confirm(confirm) => match key.code {
                    KeyCode::Char('q') | KeyCode::Esc | KeyCode::Char('n') => {
                        let label = confirm.label;
                        let section = confirm.section;
                        app.screen = TuiScreen::Dashboard;
                        app.select_section(section);
                        app.output = format!("Cancelled `{label}`.");
                    }
                    KeyCode::Enter | KeyCode::Char('y') => {
                        let command = confirm.command;
                        let label = confirm.label;
                        let section = confirm.section;
                        app.screen = TuiScreen::Dashboard;
                        app.select_section(section);
                        execute_backend_action(app, label, command);
                    }
                    _ => {}
                },
                TuiScreen::Notice(notice) => match key.code {
                    KeyCode::Char('q') | KeyCode::Esc | KeyCode::Enter | KeyCode::Char(' ') => {
                        let section = notice.section;
                        app.screen = TuiScreen::Dashboard;
                        app.select_section(section);
                    }
                    _ => {}
                },
            }
        }
    }
}

fn refresh_status_after_save(app: &mut TuiApp) {
    match inventory_status(&app.paths, &app.codex_paths) {
        Ok(status) => {
            append_export_drift_warnings(&mut app.output, &status);
            app.status = status;
        }
        Err(error) => {
            app.output
                .push_str(&format!("\nstatus refresh failed: {error}"));
        }
    }
}

fn execute_backend_action(app: &mut TuiApp, label: &str, command: Command) {
    match execute_backend_command(command, &app.paths, &app.codex_paths) {
        Ok(result) => {
            app.output = format!("Completed `{label}`.\n\n{}", result.render_text());
            match inventory_status(&app.paths, &app.codex_paths) {
                Ok(status) => app.status = status,
                Err(error) => {
                    app.output
                        .push_str(&format!("\nstatus refresh failed: {error}"));
                }
            }

            if command_shows_success_notice(command) {
                app.screen = TuiScreen::Notice(NoticeScreen {
                    title: success_notice_title(command),
                    body: app.output.clone(),
                    section: app.current_section(),
                });
            }
        }
        Err(error) => {
            app.output = format!("Failed while running `{label}`: {error}");
        }
    }
}

fn active_section(app: &TuiApp) -> TuiSection {
    match &app.screen {
        TuiScreen::Dashboard => app.current_section(),
        TuiScreen::ConfigEditor(_) | TuiScreen::PrivacyEditor(_) | TuiScreen::PackEditor(_) => {
            TuiSection::Configure
        }
        TuiScreen::Confirm(confirm) => confirm.section,
        TuiScreen::Notice(notice) => notice.section,
    }
}

fn command_requires_confirmation(command: Command) -> bool {
    matches!(
        command,
        Command::ApplyCodexProfile
            | Command::ApplyIntegrationsProfile
            | Command::ApplyCloudflareProfile
            | Command::RestoreCodexConfig
            | Command::UninstallAll
            | Command::UninstallUserSkills
            | Command::UninstallRepoSkills
            | Command::UninstallRepoAgents
            | Command::UninstallGlobalAgents
            | Command::UninstallHooks
            | Command::UninstallCustomAgents
    )
}

fn command_shows_success_notice(command: Command) -> bool {
    matches!(
        command,
        Command::Install
            | Command::BackupCodexConfig
            | Command::ApplyCodexProfile
            | Command::ApplyIntegrationsProfile
            | Command::ApplyCloudflareProfile
            | Command::RestoreCodexConfig
            | Command::ExportAll
            | Command::ExportUserSkills
            | Command::ExportRepoSkills
            | Command::ExportRepoAgents
            | Command::ExportGlobalAgents
            | Command::ExportHooks
            | Command::ExportCustomAgents
            | Command::UninstallAll
            | Command::UninstallUserSkills
            | Command::UninstallRepoSkills
            | Command::UninstallRepoAgents
            | Command::UninstallGlobalAgents
            | Command::UninstallHooks
            | Command::UninstallCustomAgents
    )
}

fn success_notice_title(command: Command) -> &'static str {
    match command {
        Command::Install => "Installed",
        Command::BackupCodexConfig => "Backed Up",
        Command::ApplyCodexProfile
        | Command::ApplyIntegrationsProfile
        | Command::ApplyCloudflareProfile => "Applied",
        Command::RestoreCodexConfig => "Restored",
        Command::ExportAll
        | Command::ExportUserSkills
        | Command::ExportRepoSkills
        | Command::ExportRepoAgents
        | Command::ExportGlobalAgents
        | Command::ExportHooks
        | Command::ExportCustomAgents => "Installed",
        Command::UninstallAll
        | Command::UninstallUserSkills
        | Command::UninstallRepoSkills
        | Command::UninstallRepoAgents
        | Command::UninstallGlobalAgents
        | Command::UninstallHooks
        | Command::UninstallCustomAgents => "Uninstalled",
        _ => "Done",
    }
}

fn append_export_drift_warnings(output: &mut String, status: &OperationResult) {
    for item in &status.inventory {
        let warning = match (item.name.as_str(), item.status) {
            ("user-skills", InventoryStatus::Invalid) => {
                Some("warning: exported user-skills stale; rerun `export user-skills`")
            }
            ("repo-skills", InventoryStatus::Invalid) => {
                Some("warning: exported repo-skills stale; rerun `export repo-skills`")
            }
            ("global-agents", InventoryStatus::Invalid) => {
                Some("warning: exported global-agents stale; rerun `export global-agents`")
            }
            _ => None,
        };

        if let Some(warning) = warning {
            output.push('\n');
            output.push_str(warning);
        }
    }
}

fn render_tui(frame: &mut Frame, app: &TuiApp) {
    render_dashboard(frame, app);

    match &app.screen {
        TuiScreen::Dashboard => {}
        TuiScreen::ConfigEditor(editor) => render_config_editor(frame, app, editor),
        TuiScreen::PrivacyEditor(editor) => render_privacy_editor(frame, app, editor),
        TuiScreen::PackEditor(editor) => render_pack_editor(frame, app, editor),
        TuiScreen::Confirm(confirm) => render_confirm(frame, app, confirm),
        TuiScreen::Notice(notice) => render_notice(frame, app, notice),
    }
}

fn render_dashboard(frame: &mut Frame, app: &TuiApp) {
    let current_section = app.current_section();
    let current_actions = app.current_actions();
    let current_action = current_actions[app.action_selected];

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(6),
            Constraint::Length(3),
            Constraint::Min(14),
            Constraint::Length(3),
        ])
        .split(frame.area());

    let header = Paragraph::new(vec![
        Line::from("Sane"),
        Line::from("Codex-native onboarding and setup"),
        Line::from(format!(
            "Project: {}  |  Recommended: {}",
            project_label(&app.paths),
            recommended_next_step(&app.status)
        )),
        Line::from("Left/right changes section. Up/down changes option. Enter runs."),
    ])
    .alignment(Alignment::Center)
    .style(Style::default().fg(Color::Yellow))
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::DarkGray))
            .title("Welcome"),
    )
    .wrap(Wrap { trim: true });
    frame.render_widget(header, chunks[0]);

    render_section_tabs(frame, chunks[1], app);

    if chunks[2].width < 120 {
        if chunks[2].height < 18 {
            let main = Layout::default()
                .direction(Direction::Vertical)
                .constraints([Constraint::Min(9), Constraint::Length(8)])
                .split(chunks[2]);

            render_dashboard_actions(
                frame,
                main[0],
                &current_actions,
                app.action_selected,
                current_section,
            );
            render_compact_dashboard_help(frame, main[1], current_section, &current_action, app);
        } else {
            let main = Layout::default()
                .direction(Direction::Vertical)
                .constraints([Constraint::Percentage(58), Constraint::Percentage(42)])
                .split(chunks[2]);

            render_dashboard_actions(
                frame,
                main[0],
                &current_actions,
                app.action_selected,
                current_section,
            );
            render_compact_dashboard_help(frame, main[1], current_section, &current_action, app);
        }
    } else {
        let main = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Length(48), Constraint::Min(36)])
            .split(chunks[2]);

        render_dashboard_actions(
            frame,
            main[0],
            &current_actions,
            app.action_selected,
            current_section,
        );
        render_dashboard_help(frame, main[1], current_section, &current_action, app);
    }

    let footer = Paragraph::new(home_footer_lines(app))
        .block(Block::default().borders(Borders::ALL).title("Now"))
        .wrap(Wrap { trim: true });
    frame.render_widget(footer, chunks[3]);
}

fn render_compact_dashboard_help(
    frame: &mut Frame,
    area: Rect,
    section: TuiSection,
    action: &TuiAction,
    app: &TuiApp,
) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(8), Constraint::Length(3)])
        .split(area);

    let info_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(6), Constraint::Min(7)])
        .split(chunks[0]);

    let section_help = Paragraph::new(home_option_lines(section, &app.status))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Section Overview")
                .border_style(Style::default().fg(Color::DarkGray)),
        )
        .wrap(Wrap { trim: false });
    frame.render_widget(section_help, info_chunks[0]);

    let selected_help = Paragraph::new(selected_action_help_lines(action))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Selected Step Details")
                .border_style(Style::default().fg(Color::Cyan))
                .style(Style::default().bg(Color::Rgb(14, 18, 24))),
        )
        .wrap(Wrap { trim: false });
    frame.render_widget(selected_help, info_chunks[1]);

    let result = Paragraph::new(tui_output_lines(&app.output))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Latest Status")
                .border_style(Style::default().fg(Color::Green)),
        )
        .wrap(Wrap { trim: false });
    frame.render_widget(result, chunks[1]);
}

fn render_config_editor(frame: &mut Frame, app: &TuiApp, editor: &ConfigEditor) {
    let area = centered_rect(frame.area(), 68, 70);
    let area = render_modal_shell(frame, area, "Model Defaults", Color::Yellow);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(10),
            Constraint::Length(5),
        ])
        .split(area);

    let header = Paragraph::new(vec![
        Line::from("Model Defaults"),
        Line::from(
            "Up/down picks field. Left/right cycles. Enter saves. r resets to this machine's recommended defaults. Esc backs out.",
        ),
    ])
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title("How this works"),
    )
    .wrap(Wrap { trim: true });
    frame.render_widget(header, chunks[0]);

    let main = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Length(46), Constraint::Min(24)])
        .split(chunks[1]);

    render_config_fields(frame, main[0], editor);
    let side = Paragraph::new(config_field_help_lines(editor))
        .block(Block::default().borders(Borders::ALL).title("Field Help"))
        .wrap(Wrap { trim: false });
    frame.render_widget(side, main[1]);

    let output = Paragraph::new(tui_output_lines(&app.output))
        .block(Block::default().borders(Borders::ALL).title("Output"))
        .wrap(Wrap { trim: false });
    frame.render_widget(output, chunks[2]);
}

fn render_privacy_editor(frame: &mut Frame, app: &TuiApp, editor: &PrivacyEditor) {
    let area = centered_rect(frame.area(), 68, 68);
    let area = render_modal_shell(frame, area, "Privacy", Color::Yellow);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),
            Constraint::Min(10),
            Constraint::Length(5),
        ])
        .split(area);

    let header = Paragraph::new(vec![
        Line::from("Privacy / Telemetry"),
        Line::from(
            "Left/right changes consent. Enter saves. d deletes local telemetry data. Esc backs out.",
        ),
        Line::from("Telemetry stays optional and product-improvement-only."),
    ])
    .block(Block::default().borders(Borders::ALL).title("How this works"))
    .wrap(Wrap { trim: true });
    frame.render_widget(header, chunks[0]);

    let main = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Length(42), Constraint::Min(24)])
        .split(chunks[1]);

    let current = Paragraph::new(vec![
        Line::from(format!(
            "Telemetry consent: {}",
            editor.config.privacy.telemetry.display_str()
        )),
        Line::from(""),
        Line::from("Meaning"),
        Line::from(telemetry_level_explanation(editor.config.privacy.telemetry)),
    ])
    .block(Block::default().borders(Borders::ALL).title("Setting"))
    .wrap(Wrap { trim: false });
    frame.render_widget(current, main[0]);

    let details = Paragraph::new(privacy_lines(&app.paths, &editor.config))
        .block(Block::default().borders(Borders::ALL).title("Transparency"))
        .wrap(Wrap { trim: false });
    frame.render_widget(details, main[1]);

    let output = Paragraph::new(tui_output_lines(&app.output))
        .block(Block::default().borders(Borders::ALL).title("Output"))
        .wrap(Wrap { trim: false });
    frame.render_widget(output, chunks[2]);
}

fn render_pack_editor(frame: &mut Frame, app: &TuiApp, editor: &PackEditor) {
    let area = centered_rect(frame.area(), 68, 68);
    let area = render_modal_shell(frame, area, "Built-in Packs", Color::Yellow);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),
            Constraint::Min(10),
            Constraint::Length(5),
        ])
        .split(area);

    let header = Paragraph::new(vec![
        Line::from("Built-in Packs"),
        Line::from("core stays on. Up/down selects. Space toggles optional packs. Enter saves. Esc backs out."),
        Line::from("Packs change local guidance and may make exports stale until you re-export."),
    ])
    .block(Block::default().borders(Borders::ALL).title("How this works"))
    .wrap(Wrap { trim: true });
    frame.render_widget(header, chunks[0]);

    let main = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Length(38), Constraint::Min(24)])
        .split(chunks[1]);

    render_pack_fields(frame, main[0], editor);
    let details = Paragraph::new(pack_lines(editor))
        .block(Block::default().borders(Borders::ALL).title("Pack Summary"))
        .wrap(Wrap { trim: false });
    frame.render_widget(details, main[1]);

    let output = Paragraph::new(tui_output_lines(&app.output))
        .block(Block::default().borders(Borders::ALL).title("Output"))
        .wrap(Wrap { trim: false });
    frame.render_widget(output, chunks[2]);
}

fn render_confirm(frame: &mut Frame, app: &TuiApp, confirm: &ConfirmScreen) {
    let area = centered_rect(frame.area(), 66, 42);
    let area = render_modal_shell(frame, area, "Confirm", Color::LightRed);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(8),
            Constraint::Length(5),
        ])
        .split(area);

    let header = Paragraph::new(vec![
        Line::from("Confirm This Action"),
        Line::from("Enter or y runs it. Esc or n cancels."),
    ])
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::LightRed))
            .title("Before this runs"),
    )
    .wrap(Wrap { trim: true });
    frame.render_widget(header, chunks[0]);

    let body = Paragraph::new(vec![
        Line::from(format!("Selected action: {}", confirm.label)),
        Line::from(""),
        Line::from(confirm_action_context(confirm.command)),
        Line::from("Use preview or backup first when available."),
    ])
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title("Impact")
            .border_style(Style::default().fg(Color::LightRed))
            .style(Style::default().bg(Color::Rgb(30, 16, 18))),
    )
    .wrap(Wrap { trim: false });
    frame.render_widget(body, chunks[1]);

    let output = Paragraph::new(tui_output_lines(&app.output))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Status")
                .border_style(Style::default().fg(Color::Yellow)),
        )
        .wrap(Wrap { trim: false });
    frame.render_widget(output, chunks[2]);
}

fn render_notice(frame: &mut Frame, _app: &TuiApp, notice: &NoticeScreen) {
    let area = centered_rect(frame.area(), 78, 46);
    let area = render_modal_shell(frame, area, notice.title, Color::LightGreen);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(6), Constraint::Length(3)])
        .split(area);

    let body = Paragraph::new(tui_output_lines(&notice.body))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Result")
                .border_style(Style::default().fg(Color::LightGreen))
                .style(Style::default().bg(Color::Rgb(14, 24, 16))),
        )
        .wrap(Wrap { trim: false });
    frame.render_widget(body, chunks[0]);

    let footer = Paragraph::new("Enter, Space, or Esc closes this message.")
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Continue")
                .border_style(Style::default().fg(Color::DarkGray)),
        )
        .alignment(Alignment::Center)
        .wrap(Wrap { trim: true });
    frame.render_widget(footer, chunks[1]);
}

fn render_section_tabs(frame: &mut Frame, area: Rect, app: &TuiApp) {
    let titles = app
        .sections
        .iter()
        .map(|option| Line::from(option.label))
        .collect::<Vec<_>>();
    let tabs = Tabs::new(titles)
        .select(app.section_selected)
        .style(Style::default().fg(Color::Gray))
        .highlight_style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::DarkGray))
                .title("Sections"),
        );
    frame.render_widget(tabs, area);
}

fn render_dashboard_actions(
    frame: &mut Frame,
    area: Rect,
    actions: &[TuiAction],
    selected: usize,
    section: TuiSection,
) {
    let items = actions
        .iter()
        .map(|action| ListItem::new(action.label))
        .collect::<Vec<_>>();
    let list = List::new(items)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Green))
                .title(match section {
                    TuiSection::StartHere => "Steps",
                    _ => "Options",
                }),
        )
        .highlight_style(Style::default().add_modifier(Modifier::REVERSED))
        .highlight_symbol("> ");
    let mut state = ListState::default().with_selected(Some(selected));
    frame.render_stateful_widget(list, area, &mut state);
}

fn render_dashboard_help(
    frame: &mut Frame,
    area: Rect,
    section: TuiSection,
    action: &TuiAction,
    app: &TuiApp,
) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(8),
            Constraint::Min(12),
            Constraint::Length(4),
        ])
        .split(area);

    let section_help = Paragraph::new(home_option_lines(section, &app.status))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Section Overview")
                .border_style(Style::default().fg(Color::DarkGray)),
        )
        .wrap(Wrap { trim: false });
    frame.render_widget(section_help, chunks[0]);

    let help = Paragraph::new(selected_action_help_lines(action))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Selected Step Details")
                .border_style(Style::default().fg(Color::Cyan))
                .style(Style::default().bg(Color::Rgb(14, 18, 24))),
        )
        .wrap(Wrap { trim: false });
    frame.render_widget(help, chunks[1]);

    let snapshot = Paragraph::new(tui_output_lines(&app.output))
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Latest Status")
                .border_style(Style::default().fg(Color::Green)),
        )
        .wrap(Wrap { trim: false });
    frame.render_widget(snapshot, chunks[2]);
}

fn render_config_fields(frame: &mut Frame, area: Rect, editor: &ConfigEditor) {
    let items = ConfigField::ALL
        .iter()
        .enumerate()
        .map(|(index, field)| {
            ListItem::new(format!(
                "{}: {}",
                field.label(),
                field.value(&editor.config)
            ))
            .style(if index == editor.selected {
                Style::default().add_modifier(Modifier::REVERSED)
            } else {
                Style::default()
            })
        })
        .collect::<Vec<_>>();

    let list = List::new(items).block(
        Block::default()
            .borders(Borders::ALL)
            .title("Role Defaults"),
    );
    frame.render_widget(list, area);
}

fn render_pack_fields(frame: &mut Frame, area: Rect, editor: &PackEditor) {
    let mut items = vec![ListItem::new("core: enabled (required)")];
    items.extend(PackField::ALL.iter().enumerate().map(|(index, field)| {
        let state = if field.enabled(&editor.config) {
            "enabled"
        } else {
            "disabled"
        };
        ListItem::new(format!("{}: {state}", field.label())).style(if index == editor.selected {
            Style::default().add_modifier(Modifier::REVERSED)
        } else {
            Style::default()
        })
    }));

    let list = List::new(items).block(Block::default().borders(Borders::ALL).title("Packs"));
    frame.render_widget(list, area);
}

fn privacy_lines(paths: &ProjectPaths, config: &LocalConfig) -> Vec<Line<'static>> {
    let telemetry_dir = paths.telemetry_dir.display().to_string();
    let summary = paths
        .telemetry_dir
        .join("summary.json")
        .display()
        .to_string();
    let events = paths
        .telemetry_dir
        .join("events.jsonl")
        .display()
        .to_string();
    let queue = paths
        .telemetry_dir
        .join("queue.jsonl")
        .display()
        .to_string();

    vec![
        Line::from(format!("consent: {}", config.privacy.telemetry.as_str())),
        Line::from(format!("dir: {}", telemetry_dir)),
        Line::from(format!(
            "summary.json: {}",
            path_state(&paths.telemetry_dir.join("summary.json"))
        )),
        Line::from(format!(
            "events.jsonl: {}",
            path_state(&paths.telemetry_dir.join("events.jsonl"))
        )),
        Line::from(format!(
            "queue.jsonl: {}",
            path_state(&paths.telemetry_dir.join("queue.jsonl"))
        )),
        Line::from(""),
        Line::from("No remote upload logic yet."),
        Line::from("Issue reporting stays separate."),
        Line::from(format!("summary path: {summary}")),
        Line::from(format!("events path: {events}")),
        Line::from(format!("queue path: {queue}")),
    ]
}

fn pack_lines(editor: &PackEditor) -> Vec<Line<'static>> {
    let selected = PackField::ALL[editor.selected];

    vec![
        Line::from(format!(
            "enabled packs: {}",
            editor.config.packs.enabled_names().join(", ")
        )),
        Line::from(""),
        Line::from(format!("selected pack: {}", selected.label())),
        Line::from(pack_field_explanation(selected)),
        Line::from(""),
        Line::from("Effect"),
        Line::from("Updates local pack config first."),
        Line::from("Some exports may need rerunning after save."),
        Line::from("No marketplace or third-party plugin API yet."),
    ]
}

fn home_option_lines(section: TuiSection, status: &OperationResult) -> Vec<Line<'static>> {
    match section {
        TuiSection::StartHere => {
            let mut lines = vec![
                Line::from(format!(
                    "Recommended now: {}",
                    recommended_next_step(status)
                )),
                Line::from(""),
                Line::from("Suggested flow"),
                Line::from("1. Create Sane's local project files"),
                Line::from("2. Review and back up Codex settings"),
                Line::from("3. Apply Sane's recommended Codex settings"),
                Line::from("4. Install Sane into Codex"),
                Line::from("More options live in Set up preferences and Install to Codex."),
            ];

            if has_attention_items(status) {
                lines.push(Line::from("Attention items found in current setup."));
            }

            lines
        }
        TuiSection::Configure => vec![
            Line::from("Change how Sane behaves before installing it into Codex."),
            Line::from(""),
            Line::from("Choose model and reasoning defaults."),
            Line::from("Turn built-in packs on or off."),
            Line::from("Choose telemetry and privacy level."),
            Line::from("Open with `sane settings` if you want to land here directly."),
        ],
        TuiSection::Exports => vec![
            Line::from("Install Sane into Codex on purpose."),
            Line::from(""),
            Line::from("User-level install changes your own Codex setup."),
            Line::from("Repo-level install is explicit and optional."),
            Line::from("Nothing here should silently take over a repo."),
        ],
        TuiSection::Inspect => vec![
            Line::from("Inspect before you change anything."),
            Line::from(""),
            Line::from(
                "Use status and doctor to see what is installed, stale, disabled, or broken.",
            ),
            Line::from("View Sane config and Codex settings before applying changes."),
        ],
        TuiSection::Repair => vec![
            Line::from("Repair, restore, and uninstall tools."),
            Line::from(""),
            Line::from("Use backup and restore when settings changes went wrong."),
            Line::from("Use uninstall when you want Sane removed cleanly."),
        ],
    }
}

fn recommended_next_step(status: &OperationResult) -> &'static str {
    let runtime = find_inventory(&status.inventory, "runtime");
    let config = find_inventory(&status.inventory, "config");
    let codex_config = find_inventory(&status.inventory, "codex-config");
    let user_skills = find_inventory(&status.inventory, "user-skills");

    if matches!(
        runtime.status,
        InventoryStatus::Missing | InventoryStatus::Invalid
    ) || matches!(
        config.status,
        InventoryStatus::Missing | InventoryStatus::Invalid
    ) {
        "Create Sane's local project files first."
    } else if matches!(
        codex_config.status,
        InventoryStatus::Missing | InventoryStatus::Invalid
    ) {
        "Inspect Codex config, then preview the core Codex profile."
    } else if matches!(
        user_skills.status,
        InventoryStatus::Missing | InventoryStatus::Invalid
    ) {
        "Install Sane into Codex so Codex can use Sane's guidance."
    } else {
        "Review configure or inspect sections and change only what you actually want."
    }
}

fn has_attention_items(status: &OperationResult) -> bool {
    status.inventory.iter().any(|item| {
        matches!(
            item.status,
            InventoryStatus::Missing | InventoryStatus::Invalid
        ) && matches!(
            item.scope,
            InventoryScope::CodexNative | InventoryScope::LocalRuntime
        )
    })
}

fn action_help_lines(action: &TuiAction) -> Vec<Line<'static>> {
    let mut lines = match action.kind {
        TuiActionKind::OpenConfigEditor => vec![
            Line::from("Change the default model and reasoning roles Sane works from."),
            Line::from(""),
            Line::from("Coordinator = main high-context worker."),
            Line::from("Sidecar = cheaper bounded helper."),
            Line::from("Verifier = review and checking role."),
            Line::from(""),
            Line::from("Saving here can make managed exports stale until you re-export them."),
        ],
        TuiActionKind::OpenPackEditor => vec![
            Line::from("Enable or disable built-in guidance packs."),
            Line::from(""),
            Line::from("Packs change local config first."),
            Line::from("Some exports will need rerunning after save."),
            Line::from("Core stays enabled because it is the base Sane guidance layer."),
        ],
        TuiActionKind::OpenPrivacyEditor => vec![
            Line::from("Choose how much telemetry state Sane may keep locally."),
            Line::from(""),
            Line::from("off = no optional telemetry files"),
            Line::from("local-only = keep local product-improvement data on this machine only"),
            Line::from("product-improvement = opt in to future product-improvement reporting"),
            Line::from(""),
            Line::from("This does not change issue reporting; that stays separate."),
        ],
        TuiActionKind::Backend(command) => command_help_lines(command),
    };

    if let TuiActionKind::Backend(command) = action.kind
        && command_requires_confirmation(command)
    {
        lines.push(Line::from(""));
        lines.push(Line::from("Safety"));
        lines.push(Line::from("Confirmation required before this action runs."));
    }

    lines
}

fn selected_action_help_lines(action: &TuiAction) -> Vec<Line<'static>> {
    let mut lines = vec![
        Line::from(format!("Selected action: {}", action.label)),
        Line::from(""),
    ];
    let details = action_help_lines(action);
    if details.is_empty() {
        lines.push(Line::from(
            "This action explains what it changes before you run it.",
        ));
    } else {
        lines.extend(details);
    }

    lines
}

fn confirm_action_context(command: Command) -> &'static str {
    match command {
        Command::ApplyCodexProfile
        | Command::ApplyIntegrationsProfile
        | Command::ApplyCloudflareProfile => {
            "This writes changes into your `~/.codex/config.toml`."
        }
        Command::RestoreCodexConfig => {
            "This replaces your current Codex config with the latest backup."
        }
        Command::UninstallAll => "This removes all Sane-managed Codex pieces.",
        Command::UninstallUserSkills => {
            "This removes the Sane user skill from your personal Codex skill folder."
        }
        Command::UninstallRepoSkills => {
            "This removes Sane repo skills from this project's `.agents/skills` folder."
        }
        Command::UninstallRepoAgents => {
            "This removes the Sane-managed block from this project's `AGENTS.md`."
        }
        Command::UninstallGlobalAgents => {
            "This removes the Sane-managed block from your global `AGENTS.md`."
        }
        Command::UninstallHooks => "This removes Sane-managed entries from `~/.codex/hooks.json`.",
        Command::UninstallCustomAgents => {
            "This removes Sane-managed custom agent files from your Codex home."
        }
        _ => "This mutates managed user-level state or Codex config.",
    }
}

fn command_help_lines(command: Command) -> Vec<Line<'static>> {
    match command {
        Command::Install => vec![
            Line::from("Create or repair Sane's local project files in this repo."),
            Line::from(""),
            Line::from("This creates Sane's local config and state files in `.sane/`."),
            Line::from("Use this first in a new repo or if Sane's local files are missing."),
        ],
        Command::Config => vec![
            Line::from("Show the current local Sane config."),
            Line::from(""),
            Line::from(
                "Use this if you want a plain text readout of model defaults, pack choices, and privacy settings.",
            ),
        ],
        Command::CodexConfig => vec![
            Line::from("Read your current `~/.codex/config.toml` without changing it."),
            Line::from(""),
            Line::from(
                "Use this before previewing or applying profiles so you can see the starting point.",
            ),
        ],
        Command::BackupCodexConfig => vec![
            Line::from("Save a timestamped backup of `~/.codex/config.toml` into `.sane/backups`."),
            Line::from(""),
            Line::from(
                "Use this before applying profile changes if you want an easy rollback point.",
            ),
        ],
        Command::PreviewCodexProfile => vec![
            Line::from("Show the Codex settings Sane recommends by default."),
            Line::from(""),
            Line::from("Preview only. No files are changed."),
            Line::from(
                "This shows the model, reasoning, and hook settings Sane recommends from the Codex models it can detect here, with stable fallback when detection is thin.",
            ),
        ],
        Command::PreviewIntegrationsProfile => vec![
            Line::from("Show the optional integrations profile Sane recommends."),
            Line::from(""),
            Line::from("Preview only. No files are changed."),
            Line::from(
                "Today this is where recommended MCP and integration defaults are inspected before apply.",
            ),
        ],
        Command::PreviewCloudflareProfile => vec![
            Line::from("Show the optional Cloudflare provider profile."),
            Line::from(""),
            Line::from("Preview only. No files are changed."),
            Line::from(
                "Use this only if you want Cloudflare-specific tooling added to Codex config.",
            ),
        ],
        Command::ApplyCodexProfile => vec![
            Line::from("Write Sane's recommended core Codex profile into `~/.codex/config.toml`."),
            Line::from(""),
            Line::from("This is a real config mutation."),
            Line::from("Use preview and backup first if you want to compare before writing."),
            Line::from(
                "The written model defaults come from local Codex availability when Sane can detect it.",
            ),
        ],
        Command::ApplyIntegrationsProfile => vec![
            Line::from("Write Sane's recommended Codex tools into `~/.codex/config.toml`."),
            Line::from(""),
            Line::from("Today this adds Context7, Playwright, and grep.app."),
            Line::from("Use preview first if you want to inspect exactly what will be added."),
        ],
        Command::ApplyCloudflareProfile => vec![
            Line::from(
                "Write the optional Cloudflare provider profile into `~/.codex/config.toml`.",
            ),
            Line::from(""),
            Line::from("This is provider-specific and not part of the bare default profile."),
        ],
        Command::RestoreCodexConfig => vec![
            Line::from("Restore the latest saved backup of your Codex config."),
            Line::from(""),
            Line::from("Use this if a profile apply did not give you the result you wanted."),
        ],
        Command::DebugPolicyPreview => vec![
            Line::from("Show Sane's current internal adaptive policy preview."),
            Line::from(""),
            Line::from("This is mostly for development right now."),
            Line::from(
                "It helps inspect how coordinator, sidecar, and verifier roles are being recommended.",
            ),
        ],
        Command::Doctor => vec![
            Line::from("Check Sane's local project files and Codex installs."),
            Line::from(""),
            Line::from("Use this when something feels broken, stale, or only partly installed."),
            Line::from("Doctor points at missing, invalid, or drifted Sane-managed pieces."),
        ],
        Command::ExportUserSkills => vec![
            Line::from("Install the Sane user skill into your personal Codex skills folder."),
            Line::from(""),
            Line::from("This lets Codex load Sane guidance as a user-level skill."),
        ],
        Command::ExportRepoSkills => vec![
            Line::from("Install Sane repo skills into this repo's `.agents/skills` folder."),
            Line::from(""),
            Line::from(
                "Use this when you want repo-local shared skills instead of user-only install.",
            ),
            Line::from(
                "This changes the repo on purpose and is not part of `Install Sane into Codex`.",
            ),
        ],
        Command::ExportRepoAgents => vec![
            Line::from("Add a Sane block to this repo's root `AGENTS.md`."),
            Line::from(""),
            Line::from("Use this only when you want repo-local shared AGENTS guidance."),
            Line::from(
                "This changes the repo on purpose and is not part of `Install Sane into Codex`.",
            ),
        ],
        Command::ExportGlobalAgents => vec![
            Line::from("Add or refresh the Sane block in global `AGENTS.md`."),
            Line::from(""),
            Line::from("This is additive: Sane touches only its own marked block."),
        ],
        Command::ExportHooks => vec![
            Line::from("Add or refresh Sane's entries in `~/.codex/hooks.json`."),
            Line::from(""),
            Line::from("Use this if you want Sane's optional Codex hook behavior enabled."),
        ],
        Command::ExportCustomAgents => vec![
            Line::from("Add or refresh Sane's custom agent files."),
            Line::from(""),
            Line::from("These files support Sane's coordinator, sidecar, and verifier roles."),
        ],
        Command::ExportAll => vec![
            Line::from("Add or refresh everything Sane manages in Codex."),
            Line::from(""),
            Line::from(
                "This installs the Sane user skill, global AGENTS block, hooks, and custom agents.",
            ),
            Line::from(
                "Use this after changing packs or defaults so Codex matches current Sane config.",
            ),
        ],
        Command::UninstallAll => vec![
            Line::from("Remove everything Sane manages in Codex."),
            Line::from(""),
            Line::from(
                "Only Sane-managed content should be removed; unrelated user content should stay.",
            ),
        ],
        Command::UninstallRepoSkills => vec![
            Line::from("Remove Sane repo skills from this repo's `.agents/skills` folder."),
            Line::from(""),
            Line::from("Only Sane-managed repo skill directories should be removed."),
        ],
        Command::UninstallRepoAgents => vec![
            Line::from("Remove the Sane block from this repo's root `AGENTS.md`."),
            Line::from(""),
            Line::from("Only the Sane-managed block should be removed."),
        ],
        _ => vec![Line::from("No help available for this option yet.")],
    }
}

fn config_field_help_lines(editor: &ConfigEditor) -> Vec<Line<'static>> {
    let field = ConfigField::ALL[editor.selected];
    let value = field.value(&editor.config);

    let mut lines = vec![
        Line::from(field.label()),
        Line::from(format!("Current value: {value}")),
        Line::from(""),
        Line::from(config_field_explanation(field)),
        Line::from(""),
        Line::from("Role meanings"),
        Line::from("Coordinator = main top-level worker"),
        Line::from("Sidecar = smaller bounded helper"),
        Line::from("Verifier = review and correctness pass"),
        Line::from(""),
        Line::from("Choices"),
    ];

    match field {
        ConfigField::CoordinatorModel | ConfigField::SidecarModel | ConfigField::VerifierModel => {
            lines.push(Line::from(AVAILABLE_MODELS.join(", ")));
        }
        ConfigField::CoordinatorReasoning
        | ConfigField::SidecarReasoning
        | ConfigField::VerifierReasoning => {
            lines.push(Line::from(
                ReasoningEffort::all()
                    .iter()
                    .map(|value| value.display_str())
                    .collect::<Vec<_>>()
                    .join(", "),
            ));
        }
    }

    lines
}

fn config_field_explanation(field: ConfigField) -> &'static str {
    match field {
        ConfigField::CoordinatorModel => {
            "Main model for the highest-context work: planning, shaping, integration, and hard calls."
        }
        ConfigField::CoordinatorReasoning => {
            "Default reasoning depth for the main coordinator role."
        }
        ConfigField::SidecarModel => {
            "Smaller or faster model for bounded helper work that should not consume coordinator budget."
        }
        ConfigField::SidecarReasoning => {
            "Default reasoning depth for sidecar tasks such as narrow inspections or support work."
        }
        ConfigField::VerifierModel => "Model used when Sane wants a reviewer or checker role.",
        ConfigField::VerifierReasoning => {
            "Default reasoning depth for review, checking, and verification tasks."
        }
    }
}

fn telemetry_level_explanation(level: TelemetryLevel) -> &'static str {
    match level {
        TelemetryLevel::Off => "Do not keep optional telemetry files.",
        TelemetryLevel::LocalOnly => {
            "Keep telemetry locally for inspection and reset, but do not plan for remote reporting."
        }
        TelemetryLevel::ProductImprovement => {
            "Opt in to future product-improvement reporting. Still intended only for improving Sane."
        }
    }
}

fn pack_field_explanation(field: PackField) -> &'static str {
    match field {
        PackField::Caveman => {
            "Compressed communication guidance. Useful when you want less token-heavy prose by default."
        }
        PackField::Cavemem => {
            "Compact durable-memory guidance for long sessions and cleaner handoffs."
        }
        PackField::Rtk => {
            "Shell-routing guidance: if RTK policy exists, prefer RTK-routed command execution."
        }
        PackField::FrontendCraft => {
            "Frontend craft guidance. Biases Sane away from generic AI UI output and toward stronger design quality."
        }
    }
}

fn path_state(path: &Path) -> &'static str {
    if path.exists() { "present" } else { "missing" }
}

fn cycle_model(preset: &mut ModelPreset, step: isize) {
    let current = AVAILABLE_MODELS
        .iter()
        .position(|candidate| *candidate == preset.model)
        .unwrap_or(0);
    let next = wrap_index(current, AVAILABLE_MODELS.len(), step);
    preset.model = AVAILABLE_MODELS[next].to_string();
}

fn cycle_reasoning(preset: &mut ModelPreset, step: isize) {
    let values = ReasoningEffort::all();
    let current = values
        .iter()
        .position(|candidate| *candidate == preset.reasoning_effort)
        .unwrap_or(0);
    let next = wrap_index(current, values.len(), step);
    preset.reasoning_effort = values[next];
}

fn wrap_index(current: usize, len: usize, step: isize) -> usize {
    ((current as isize + step).rem_euclid(len as isize)) as usize
}

fn home_footer_lines(app: &TuiApp) -> Vec<Line<'static>> {
    vec![Line::from(format!(
        "left/right change section  |  up/down change option  |  enter runs  |  {}",
        compact_status_line(&app.status)
    ))]
}

fn compact_status_line(status: &OperationResult) -> String {
    let runtime = find_inventory(&status.inventory, "runtime");
    let codex_config = find_inventory(&status.inventory, "codex-config");
    let user_skills = find_inventory(&status.inventory, "user-skills");
    let hooks = find_inventory(&status.inventory, "hooks");

    format!(
        "runtime {}  codex {}  user {}  hooks {}",
        home_status_label(runtime),
        home_status_label(codex_config),
        home_status_label(user_skills),
        home_status_label(hooks),
    )
}

fn tui_output_lines(text: &str) -> Vec<Line<'static>> {
    reflow_tui_text(text, 56)
        .into_iter()
        .map(Line::from)
        .collect()
}

fn reflow_tui_text(text: &str, width: usize) -> Vec<String> {
    let mut lines = Vec::new();

    for raw_line in text.lines() {
        if raw_line.is_empty() {
            lines.push(String::new());
            continue;
        }

        let mut remaining = raw_line.trim_end();
        while remaining.len() > width {
            let split_at = [' ', '/', '\\', ',', ':']
                .into_iter()
                .find_map(|delimiter| {
                    remaining[..width].rfind(delimiter).map(|index| {
                        if matches!(delimiter, '/' | '\\') {
                            index + 1
                        } else {
                            index
                        }
                    })
                })
                .unwrap_or(width);

            let head = remaining[..split_at].trim_end();
            if head.is_empty() {
                lines.push(remaining[..width].to_string());
                remaining = remaining[width..].trim_start();
            } else {
                lines.push(head.to_string());
                remaining = remaining[split_at..].trim_start();
            }
        }

        lines.push(remaining.to_string());
    }

    if lines.is_empty() {
        lines.push(String::new());
    }

    lines
}

fn project_label(paths: &ProjectPaths) -> String {
    paths
        .project_root
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("current project")
        .to_string()
}

fn centered_rect(area: Rect, width_percent: u16, height_percent: u16) -> Rect {
    let vertical = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - height_percent) / 2),
            Constraint::Percentage(height_percent),
            Constraint::Percentage((100 - height_percent) / 2),
        ])
        .split(area);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - width_percent) / 2),
            Constraint::Percentage(width_percent),
            Constraint::Percentage((100 - width_percent) / 2),
        ])
        .split(vertical[1])[1]
}

fn render_modal_shell(frame: &mut Frame, area: Rect, title: &'static str, accent: Color) -> Rect {
    let shadow_x = area.x.saturating_add(1);
    let shadow_y = area.y.saturating_add(1);
    let frame_area = frame.area();
    if shadow_x < frame_area.width && shadow_y < frame_area.height {
        let shadow = Rect {
            x: shadow_x,
            y: shadow_y,
            width: area.width.min(frame_area.width.saturating_sub(shadow_x)),
            height: area.height.min(frame_area.height.saturating_sub(shadow_y)),
        };
        frame.render_widget(
            Block::default().style(Style::default().bg(Color::Rgb(8, 8, 10))),
            shadow,
        );
    }

    frame.render_widget(Clear, area);

    let shell = Block::default()
        .borders(Borders::ALL)
        .title(title)
        .border_style(Style::default().fg(accent))
        .style(Style::default().bg(Color::Rgb(18, 18, 22)));
    let inner = shell.inner(area);
    frame.render_widget(shell, area);
    inner
}

fn home_status_label(item: &InventoryItem) -> &'static str {
    match item.status {
        InventoryStatus::Installed => "ok",
        InventoryStatus::Configured => "configured",
        InventoryStatus::Disabled => "disabled",
        InventoryStatus::Missing => "missing",
        InventoryStatus::Invalid => "repair",
        InventoryStatus::PresentWithoutSaneBlock => "non-Sane",
        InventoryStatus::Removed => "removed",
    }
}

fn render_summary() -> String {
    format!(
        "{NAME}\nplatform: {:?}\ncommands: settings, install, config, codex-config, preview, backup, apply, restore, status, export, uninstall, doctor, hook, debug",
        detect_platform()
    )
}

fn ensure_file_with_default(path: &Path, default_contents: &str) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    fs::write(path, default_contents).map_err(|error| error.to_string())
}

fn canonical_state_paths(paths: &ProjectPaths) -> CanonicalStatePaths {
    CanonicalStatePaths::new(
        &paths.config_path,
        &paths.summary_path,
        &paths.current_run_path,
        &paths.brief_path,
    )
}

fn load_layered_state(paths: &ProjectPaths) -> Result<LayeredStateBundle, String> {
    LayeredStateBundle::load(&canonical_state_paths(paths)).map_err(|error| error.to_string())
}

fn append_operation_event(paths: &ProjectPaths, result: &OperationResult) -> Result<(), String> {
    let current = current_run_state(paths);
    let summary = persist_operation_state(paths, result)?;
    refresh_brief(paths, &current, &summary)
}

fn persist_operation_state(
    paths: &ProjectPaths,
    result: &OperationResult,
) -> Result<RunSummary, String> {
    append_operation_record(paths, result)?;
    append_decision_record(paths, result)?;
    append_artifact_records(paths, result)?;
    promote_operation_summary(paths, result)
}

fn append_operation_record(paths: &ProjectPaths, result: &OperationResult) -> Result<(), String> {
    operation_event_record(result)
        .append_jsonl(&paths.events_path)
        .map_err(|error| error.to_string())
}

fn operation_event_record(result: &OperationResult) -> EventRecord {
    EventRecord::new(
        "operation",
        operation_kind_label(result.kind),
        "ok",
        result.summary.clone(),
        result.paths_touched.clone(),
    )
}

fn operation_kind_label(kind: OperationKind) -> &'static str {
    match kind {
        OperationKind::InstallRuntime => "install_runtime",
        OperationKind::ShowConfig => "show_config",
        OperationKind::ShowCodexConfig => "show_codex_config",
        OperationKind::PreviewPolicy => "preview_policy",
        OperationKind::BackupCodexConfig => "backup_codex_config",
        OperationKind::PreviewCodexProfile => "preview_codex_profile",
        OperationKind::PreviewIntegrationsProfile => "preview_integrations_profile",
        OperationKind::PreviewCloudflareProfile => "preview_cloudflare_profile",
        OperationKind::ApplyCodexProfile => "apply_codex_profile",
        OperationKind::ApplyIntegrationsProfile => "apply_integrations_profile",
        OperationKind::ApplyCloudflareProfile => "apply_cloudflare_profile",
        OperationKind::RestoreCodexConfig => "restore_codex_config",
        OperationKind::ResetTelemetryData => "reset_telemetry_data",
        OperationKind::ShowStatus => "show_status",
        OperationKind::Doctor => "doctor",
        OperationKind::ExportUserSkills => "export_user_skills",
        OperationKind::ExportRepoSkills => "export_repo_skills",
        OperationKind::ExportRepoAgents => "export_repo_agents",
        OperationKind::ExportGlobalAgents => "export_global_agents",
        OperationKind::ExportHooks => "export_hooks",
        OperationKind::ExportCustomAgents => "export_custom_agents",
        OperationKind::ExportAll => "export_all",
        OperationKind::UninstallUserSkills => "uninstall_user_skills",
        OperationKind::UninstallRepoSkills => "uninstall_repo_skills",
        OperationKind::UninstallRepoAgents => "uninstall_repo_agents",
        OperationKind::UninstallGlobalAgents => "uninstall_global_agents",
        OperationKind::UninstallHooks => "uninstall_hooks",
        OperationKind::UninstallCustomAgents => "uninstall_custom_agents",
        OperationKind::UninstallAll => "uninstall_all",
    }
}

fn preview_policy(paths: &ProjectPaths) -> Result<OperationResult, String> {
    let config = LocalConfig::read_from_path(&paths.config_path).unwrap_or_default();
    let details = policy_preview_scenarios()
        .into_iter()
        .map(|(label, input)| render_policy_preview_line(&config, label, input))
        .collect::<Vec<_>>();

    Ok(OperationResult {
        kind: OperationKind::PreviewPolicy,
        summary: "policy preview: rendered adaptive obligation scenarios".to_string(),
        rewrite: None,
        details,
        paths_touched: Vec::new(),
        inventory: Vec::new(),
    })
}

fn policy_preview_scenarios() -> [(&'static str, PolicyInput); 5] {
    [
        (
            "simple-question",
            PolicyInput {
                intent: Intent::Question,
                task_shape: TaskShape::Trivial,
                risk: Level::Low,
                ambiguity: Level::Low,
                parallelism: Parallelism::None,
                context_pressure: Level::Low,
                run_state: RunState::Exploring,
            },
        ),
        (
            "local-edit",
            PolicyInput {
                intent: Intent::Edit,
                task_shape: TaskShape::Local,
                risk: Level::Low,
                ambiguity: Level::Low,
                parallelism: Parallelism::None,
                context_pressure: Level::Low,
                run_state: RunState::Executing,
            },
        ),
        (
            "unknown-bug",
            PolicyInput {
                intent: Intent::Debug,
                task_shape: TaskShape::Local,
                risk: Level::Medium,
                ambiguity: Level::Medium,
                parallelism: Parallelism::None,
                context_pressure: Level::Low,
                run_state: RunState::Executing,
            },
        ),
        (
            "multi-file-feature",
            PolicyInput {
                intent: Intent::Edit,
                task_shape: TaskShape::Architectural,
                risk: Level::High,
                ambiguity: Level::Medium,
                parallelism: Parallelism::Clear,
                context_pressure: Level::Medium,
                run_state: RunState::Executing,
            },
        ),
        (
            "blocked-long-run",
            PolicyInput {
                intent: Intent::Orchestrate,
                task_shape: TaskShape::LongRunning,
                risk: Level::Medium,
                ambiguity: Level::High,
                parallelism: Parallelism::Possible,
                context_pressure: Level::High,
                run_state: RunState::Blocked,
            },
        ),
    ]
}

fn render_policy_preview_line(config: &LocalConfig, label: &str, input: PolicyInput) -> String {
    let decision = evaluate(input);
    let roles = recommend_roles(&decision);
    let obligations = decision
        .obligations
        .into_iter()
        .map(obligation_label)
        .collect::<Vec<_>>();
    format!(
        "{label}: {} | {}",
        obligations.join(", "),
        render_role_plan(config, roles)
    )
}

fn obligation_label(obligation: Obligation) -> &'static str {
    match obligation {
        Obligation::DirectAnswer => "direct_answer",
        Obligation::VerifyLight => "verify_light",
        Obligation::Planning => "planning",
        Obligation::DebugRigor => "debug_rigor",
        Obligation::Tdd => "tdd",
        Obligation::Review => "review",
        Obligation::SubagentEligible => "subagent_eligible",
        Obligation::ContextCompaction => "context_compaction",
        Obligation::SelfRepair => "self_repair",
    }
}

fn render_role_plan(config: &LocalConfig, roles: sane_policy::RolePlan) -> String {
    let mut parts = Vec::new();

    if roles.coordinator {
        parts.push(format!(
            "coordinator={}/{}",
            config.models.coordinator.model,
            config.models.coordinator.reasoning_effort.as_str()
        ));
    }
    if roles.sidecar {
        parts.push(format!(
            "sidecar={}/{}",
            config.models.sidecar.model,
            config.models.sidecar.reasoning_effort.as_str()
        ));
    }
    if roles.verifier {
        parts.push(format!(
            "verifier={}/{}",
            config.models.verifier.model,
            config.models.verifier.reasoning_effort.as_str()
        ));
    }

    parts.join(", ")
}

fn promote_operation_summary(
    paths: &ProjectPaths,
    result: &OperationResult,
) -> Result<RunSummary, String> {
    let mut summary = RunSummary::read_optional_from_path(&paths.summary_path)
        .unwrap_or_default()
        .unwrap_or_default();

    for path in &result.paths_touched {
        if !summary.files_touched.contains(path) {
            summary.files_touched.push(path.clone());
        }
    }
    summary.files_touched.sort();

    if let Some(milestone) = operation_milestone(result.kind)
        && !summary
            .completed_milestones
            .iter()
            .any(|item| item == milestone)
    {
        summary.completed_milestones.push(milestone.to_string());
    }

    summary
        .write_to_path(&paths.summary_path)
        .map_err(|error| error.to_string())?;
    Ok(summary)
}

fn operation_milestone(kind: OperationKind) -> Option<&'static str> {
    match kind {
        OperationKind::InstallRuntime => Some("runtime installed"),
        OperationKind::ExportUserSkills => Some("user skills exported"),
        OperationKind::ExportRepoSkills => Some("repo skills exported"),
        OperationKind::ExportRepoAgents => Some("repo AGENTS exported"),
        OperationKind::ExportGlobalAgents => Some("global agents exported"),
        OperationKind::ExportHooks => Some("hooks exported"),
        OperationKind::ExportCustomAgents => Some("custom agents exported"),
        OperationKind::ExportAll => Some("Sane installed into Codex"),
        OperationKind::UninstallRepoSkills => Some("repo skills removed"),
        OperationKind::UninstallRepoAgents => Some("repo AGENTS removed"),
        OperationKind::UninstallAll => Some("Sane removed from Codex"),
        _ => None,
    }
}

fn append_decision_record(paths: &ProjectPaths, result: &OperationResult) -> Result<(), String> {
    let Some(milestone) = operation_milestone(result.kind) else {
        return Ok(());
    };

    let rationale = result
        .details
        .first()
        .cloned()
        .unwrap_or_else(|| operation_kind_label(result.kind).to_string());

    DecisionRecord::new(milestone, rationale, result.paths_touched.clone())
        .append_jsonl(&paths.decisions_path)
        .map_err(|error| error.to_string())
}

fn append_artifact_records(paths: &ProjectPaths, result: &OperationResult) -> Result<(), String> {
    for artifact_path in &result.paths_touched {
        ArtifactRecord::new(
            operation_kind_label(result.kind),
            artifact_path.clone(),
            result.summary.clone(),
            result.paths_touched.clone(),
        )
        .append_jsonl(&paths.artifacts_path)
        .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn current_run_state(paths: &ProjectPaths) -> CurrentRunState {
    if paths.current_run_path.exists() {
        CurrentRunState::read_from_path(&paths.current_run_path)
            .unwrap_or_else(|_| fallback_current_run_state("unknown"))
    } else {
        fallback_current_run_state("unknown")
    }
}

fn fallback_current_run_state(objective: impl Into<String>) -> CurrentRunState {
    CurrentRunState {
        version: 2,
        objective: objective.into(),
        phase: "unknown".to_string(),
        active_tasks: vec![],
        blocking_questions: vec![],
        verification: VerificationStatus {
            status: "unknown".to_string(),
            summary: None,
        },
        last_compaction_ts_unix: None,
        extra: Default::default(),
    }
}

fn refresh_brief(
    paths: &ProjectPaths,
    current: &CurrentRunState,
    summary: &RunSummary,
) -> Result<(), String> {
    let body = build_brief_body(summary, current);
    ensure_file_with_default(&paths.brief_path, "")?;
    fs::write(&paths.brief_path, body).map_err(|error| error.to_string())
}

fn build_brief_body(summary: &RunSummary, current: &CurrentRunState) -> String {
    summary.build_brief(current)
}

fn install_runtime(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    paths
        .ensure_runtime_dirs()
        .map_err(|error| error.to_string())?;
    let canonical_rewrites = ensure_install_runtime_baseline(paths, codex_paths)?;

    let layered = load_layered_state(paths).ok();
    let current = if let Some(current) = layered
        .as_ref()
        .and_then(|bundle| bundle.current_run.clone())
    {
        current
    } else {
        CurrentRunState::read_from_path(&paths.current_run_path)
            .map_err(|error| error.to_string())?
    };
    let summary = layered
        .as_ref()
        .and_then(|bundle| bundle.summary.clone())
        .unwrap_or_else(|| RunSummary::read_from_path(&paths.summary_path).unwrap_or_default());
    ensure_file_with_default(&paths.brief_path, &summary.build_brief(&current))?;

    let mut details = Vec::new();
    for rewrite in &canonical_rewrites {
        append_named_rewrite_details(&mut details, rewrite.name, &rewrite.metadata);
    }
    details.extend([
        format!("config: {}", paths.config_path.display()),
        format!("current-run: {}", paths.current_run_path.display()),
        format!("summary: {}", paths.summary_path.display()),
        format!("brief: {}", paths.brief_path.display()),
    ]);

    let mut paths_touched = install_paths_touched(paths);
    for rewrite in &canonical_rewrites {
        paths_touched.push(rewrite.metadata.rewritten_path.clone());
        if let Some(backup_path) = &rewrite.metadata.backup_path {
            paths_touched.push(backup_path.clone());
        }
    }
    paths_touched.sort();
    paths_touched.dedup();

    Ok(OperationResult {
        kind: OperationKind::InstallRuntime,
        summary: format!("installed runtime at {}", paths.runtime_root.display()),
        rewrite: canonical_rewrites
            .first()
            .map(|rewrite| rewrite.metadata.clone()),
        details,
        paths_touched,
        inventory: vec![],
    })
}

#[derive(Clone)]
struct InstallCanonicalRewrite {
    name: &'static str,
    metadata: OperationRewriteMetadata,
}

fn ensure_install_runtime_baseline(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<Vec<InstallCanonicalRewrite>, String> {
    let mut rewrites = Vec::new();
    if let Some(metadata) = ensure_install_config(paths, codex_paths)? {
        rewrites.push(InstallCanonicalRewrite {
            name: "config",
            metadata,
        });
    }
    if let Some(metadata) = ensure_install_current_run(paths)? {
        rewrites.push(InstallCanonicalRewrite {
            name: "current-run",
            metadata,
        });
    }
    if let Some(metadata) = ensure_install_summary(paths)? {
        rewrites.push(InstallCanonicalRewrite {
            name: "summary",
            metadata,
        });
    }
    ensure_file_with_default(&paths.events_path, "")?;
    ensure_file_with_default(&paths.decisions_path, "")?;
    ensure_file_with_default(&paths.artifacts_path, "")?;
    Ok(rewrites)
}

fn ensure_install_config(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<Option<OperationRewriteMetadata>, String> {
    let should_rewrite =
        !paths.config_path.exists() || LocalConfig::read_from_path(&paths.config_path).is_err();
    if should_rewrite {
        let rewrite_result = write_canonical_with_backup_result(
            &paths.config_path,
            &recommended_local_config(codex_paths),
            CanonicalStateFormat::Toml,
        )
        .map_err(|error| error.to_string())?;
        return Ok(Some(operation_rewrite_metadata(rewrite_result)));
    }

    Ok(None)
}

fn ensure_install_current_run(
    paths: &ProjectPaths,
) -> Result<Option<OperationRewriteMetadata>, String> {
    let should_rewrite = !paths.current_run_path.exists()
        || CurrentRunState::read_from_path(&paths.current_run_path).is_err();
    if should_rewrite {
        let rewrite_result = write_canonical_with_backup_result(
            &paths.current_run_path,
            &install_current_run_state(),
            CanonicalStateFormat::Json,
        )
        .map_err(|error| error.to_string())?;
        return Ok(Some(operation_rewrite_metadata(rewrite_result)));
    }

    Ok(None)
}

fn install_current_run_state() -> CurrentRunState {
    let mut state = fallback_current_run_state("initialize sane runtime");
    state.phase = "setup".to_string();
    state.active_tasks = vec!["install sane runtime".to_string()];
    state.verification = VerificationStatus {
        status: "pending".to_string(),
        summary: Some("runtime scaffolding created".to_string()),
    };
    state
}

fn ensure_install_summary(
    paths: &ProjectPaths,
) -> Result<Option<OperationRewriteMetadata>, String> {
    let should_rewrite =
        !paths.summary_path.exists() || RunSummary::read_from_path(&paths.summary_path).is_err();
    if should_rewrite {
        let rewrite_result = write_canonical_with_backup_result(
            &paths.summary_path,
            &RunSummary::default(),
            CanonicalStateFormat::Json,
        )
        .map_err(|error| error.to_string())?;
        return Ok(Some(operation_rewrite_metadata(rewrite_result)));
    }

    Ok(None)
}

fn install_paths_touched(paths: &ProjectPaths) -> Vec<String> {
    vec![
        paths.runtime_root.display().to_string(),
        paths.config_path.display().to_string(),
        paths.current_run_path.display().to_string(),
        paths.summary_path.display().to_string(),
        paths.events_path.display().to_string(),
        paths.decisions_path.display().to_string(),
        paths.artifacts_path.display().to_string(),
        paths.brief_path.display().to_string(),
    ]
}

fn show_config(paths: &ProjectPaths) -> Result<OperationResult, String> {
    if !paths.config_path.exists() {
        return Ok(OperationResult {
            kind: OperationKind::ShowConfig,
            summary: format!("config: missing at {}", paths.config_path.display()),
            rewrite: None,
            details: vec![],
            paths_touched: vec![paths.config_path.display().to_string()],
            inventory: vec![InventoryItem {
                name: "config".to_string(),
                scope: InventoryScope::LocalRuntime,
                status: InventoryStatus::Missing,
                path: paths.config_path.display().to_string(),
                repair_hint: Some("run `install`".to_string()),
            }],
        });
    }

    let config =
        LocalConfig::read_from_path(&paths.config_path).map_err(|error| error.to_string())?;
    Ok(OperationResult {
        kind: OperationKind::ShowConfig,
        summary: format!("config: ok at {}", paths.config_path.display()),
        rewrite: None,
        details: config_details(&config),
        paths_touched: vec![paths.config_path.display().to_string()],
        inventory: vec![InventoryItem {
            name: "config".to_string(),
            scope: InventoryScope::LocalRuntime,
            status: InventoryStatus::Installed,
            path: paths.config_path.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn show_codex_config(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let inventory = inspect_codex_config_inventory(codex_paths)?;

    if inventory.status == InventoryStatus::Missing {
        return Ok(OperationResult {
            kind: OperationKind::ShowCodexConfig,
            summary: format!(
                "codex-config: missing at {}",
                codex_paths.config_toml.display()
            ),
            rewrite: None,
            details: vec![
                "no user Codex config exists yet".to_string(),
                "use `apply codex-profile` or `apply integrations-profile` to create one"
                    .to_string(),
            ],
            paths_touched: vec![codex_paths.config_toml.display().to_string()],
            inventory: vec![inventory],
        });
    }

    let config = read_codex_config(&codex_paths.config_toml)?;
    Ok(OperationResult {
        kind: OperationKind::ShowCodexConfig,
        summary: format!("codex-config: ok at {}", codex_paths.config_toml.display()),
        rewrite: None,
        details: codex_config_details(&config),
        paths_touched: vec![codex_paths.config_toml.display().to_string()],
        inventory: vec![inventory],
    })
}

fn backup_codex_config(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    paths
        .ensure_runtime_dirs()
        .map_err(|error| error.to_string())?;

    let inventory = inspect_codex_config_inventory(codex_paths)?;
    if inventory.status == InventoryStatus::Missing {
        return Ok(OperationResult {
            kind: OperationKind::BackupCodexConfig,
            summary: format!(
                "codex-config backup: nothing to back up at {}",
                codex_paths.config_toml.display()
            ),
            rewrite: None,
            details: vec!["no ~/.codex/config.toml exists yet".to_string()],
            paths_touched: vec![codex_paths.config_toml.display().to_string()],
            inventory: vec![inventory],
        });
    }

    if inventory.status == InventoryStatus::Invalid {
        return Ok(OperationResult {
            kind: OperationKind::BackupCodexConfig,
            summary: "codex-config backup: skipped because config is invalid".to_string(),
            rewrite: None,
            details: vec!["repair ~/.codex/config.toml first".to_string()],
            paths_touched: vec![codex_paths.config_toml.display().to_string()],
            inventory: vec![inventory],
        });
    }

    let backup_path = write_codex_config_backup(paths, codex_paths)?;

    Ok(OperationResult {
        kind: OperationKind::BackupCodexConfig,
        summary: format!("codex-config backup: wrote {}", backup_path.display()),
        rewrite: None,
        details: vec![
            format!("source: {}", codex_paths.config_toml.display()),
            "future managed profile writes must preview diff before applying".to_string(),
        ],
        paths_touched: vec![
            codex_paths.config_toml.display().to_string(),
            backup_path.display().to_string(),
        ],
        inventory: vec![inventory],
    })
}

fn preview_codex_profile(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let recommended = recommended_local_config(codex_paths);
    let inventory = inspect_codex_config_inventory(codex_paths)?;
    let details = match inventory.status {
        InventoryStatus::Missing => vec![
            format!(
                "model: <missing> -> {}",
                recommended.models.coordinator.model
            ),
            format!(
                "reasoning: <missing> -> {}",
                recommended.models.coordinator.reasoning_effort.as_str()
            ),
            "codex hooks: <missing> -> enabled".to_string(),
            "note: integrations stay outside bare core profile".to_string(),
        ],
        InventoryStatus::Invalid => vec![
            "cannot preview managed profile until ~/.codex/config.toml parses cleanly".to_string(),
            "repair current config first".to_string(),
        ],
        _ => codex_profile_preview_details(
            &read_codex_config(&codex_paths.config_toml)?,
            &recommended,
        ),
    };

    let change_count = details.iter().filter(|line| line.contains("->")).count();
    Ok(OperationResult {
        kind: OperationKind::PreviewCodexProfile,
        summary: format!("codex-profile preview: {change_count} recommended change(s)"),
        rewrite: None,
        details,
        paths_touched: vec![codex_paths.config_toml.display().to_string()],
        inventory: vec![inventory],
    })
}

fn preview_integrations_profile(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let inventory = inspect_codex_config_inventory(codex_paths)?;
    let details = match inventory.status {
        InventoryStatus::Missing => vec![
            "context7: missing -> recommended".to_string(),
            "playwright: missing -> recommended".to_string(),
            "grep.app: missing -> recommended".to_string(),
            "opensrc: optional, not in default recommended profile".to_string(),
        ],
        InventoryStatus::Invalid => vec![
            "cannot preview integrations profile until ~/.codex/config.toml parses cleanly"
                .to_string(),
            "repair current config first".to_string(),
        ],
        _ => integration_profile_preview_details(&read_codex_config(&codex_paths.config_toml)?),
    };
    let change_count = details.iter().filter(|line| line.contains("->")).count();

    Ok(OperationResult {
        kind: OperationKind::PreviewIntegrationsProfile,
        summary: format!("integrations-profile preview: {change_count} recommended change(s)"),
        rewrite: None,
        details,
        paths_touched: vec![codex_paths.config_toml.display().to_string()],
        inventory: vec![inventory],
    })
}

fn preview_cloudflare_profile(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let inventory = inspect_codex_config_inventory(codex_paths)?;
    let details = match inventory.status {
        InventoryStatus::Missing => vec![
            "cloudflare-api: missing -> optional provider profile".to_string(),
            "oauth and permissions stay explicit at connect time".to_string(),
            "note: not part of the broad recommended integrations profile".to_string(),
        ],
        InventoryStatus::Invalid => vec![
            "cannot preview cloudflare profile until ~/.codex/config.toml parses cleanly"
                .to_string(),
            "repair current config first".to_string(),
        ],
        _ => cloudflare_profile_preview_details(&read_codex_config(&codex_paths.config_toml)?),
    };
    let change_count = details.iter().filter(|line| line.contains("->")).count();

    Ok(OperationResult {
        kind: OperationKind::PreviewCloudflareProfile,
        summary: format!("cloudflare-profile preview: {change_count} recommended change(s)"),
        rewrite: None,
        details,
        paths_touched: vec![codex_paths.config_toml.display().to_string()],
        inventory: vec![inventory],
    })
}

fn apply_codex_profile(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    paths
        .ensure_runtime_dirs()
        .map_err(|error| error.to_string())?;

    let recommended = recommended_local_config(codex_paths);
    let inventory = inspect_codex_config_inventory(codex_paths)?;
    if inventory.status == InventoryStatus::Invalid {
        return Ok(OperationResult {
            kind: OperationKind::ApplyCodexProfile,
            summary: "codex-profile apply: blocked by invalid config".to_string(),
            rewrite: None,
            details: vec![
                "repair ~/.codex/config.toml first".to_string(),
                "Sane only writes after a clean parse".to_string(),
            ],
            paths_touched: vec![codex_paths.config_toml.display().to_string()],
            inventory: vec![inventory],
        });
    }

    let backup_path = if inventory.status == InventoryStatus::Installed {
        Some(write_codex_config_backup(paths, codex_paths)?)
    } else {
        None
    };

    let mut config = if inventory.status == InventoryStatus::Installed {
        read_codex_config(&codex_paths.config_toml)?
    } else {
        TomlValue::Table(toml::map::Map::new())
    };

    let before_details = if inventory.status == InventoryStatus::Installed {
        codex_profile_preview_details(&config, &recommended)
    } else {
        vec![
            format!(
                "model: <missing> -> {}",
                recommended.models.coordinator.model
            ),
            format!(
                "reasoning: <missing> -> {}",
                recommended.models.coordinator.reasoning_effort.as_str()
            ),
            "codex hooks: <missing> -> enabled".to_string(),
        ]
    };
    apply_core_codex_profile_to_value(&mut config, &recommended)?;
    write_codex_config(&codex_paths.config_toml, &config)?;

    let mut details = before_details;
    details.push("applied keys: model, model_reasoning_effort, features.codex_hooks".to_string());
    if let Some(path) = &backup_path {
        details.push(format!("backup: {}", path.display()));
    } else {
        details.push("backup: skipped (no prior config existed)".to_string());
    }

    let mut paths_touched = vec![codex_paths.config_toml.display().to_string()];
    if let Some(path) = &backup_path {
        paths_touched.push(path.display().to_string());
    }

    Ok(OperationResult {
        kind: OperationKind::ApplyCodexProfile,
        summary: "codex-profile apply: wrote recommended core profile".to_string(),
        rewrite: None,
        details,
        paths_touched,
        inventory: vec![InventoryItem {
            name: "codex-config".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: codex_paths.config_toml.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn apply_integrations_profile(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    paths
        .ensure_runtime_dirs()
        .map_err(|error| error.to_string())?;

    let inventory = inspect_codex_config_inventory(codex_paths)?;
    if inventory.status == InventoryStatus::Invalid {
        return Ok(OperationResult {
            kind: OperationKind::ApplyIntegrationsProfile,
            summary: "integrations-profile apply: blocked by invalid config".to_string(),
            rewrite: None,
            details: vec![
                "repair ~/.codex/config.toml first".to_string(),
                "Sane only writes after a clean parse".to_string(),
            ],
            paths_touched: vec![codex_paths.config_toml.display().to_string()],
            inventory: vec![inventory],
        });
    }

    let current_config = if inventory.status == InventoryStatus::Installed {
        read_codex_config(&codex_paths.config_toml)?
    } else {
        TomlValue::Table(toml::map::Map::new())
    };
    let before_details = if inventory.status == InventoryStatus::Installed {
        integration_profile_preview_details(&current_config)
    } else {
        vec![
            "context7: missing -> recommended".to_string(),
            "playwright: missing -> recommended".to_string(),
            "grep.app: missing -> recommended".to_string(),
            "opensrc: optional, not in default recommended profile".to_string(),
        ]
    };

    let mut updated_config = current_config.clone();
    let applied_keys = apply_integrations_profile_to_value(&mut updated_config)?;

    if applied_keys.is_empty() {
        return Ok(OperationResult {
            kind: OperationKind::ApplyIntegrationsProfile,
            summary: "integrations-profile apply: already satisfied".to_string(),
            rewrite: None,
            details: before_details,
            paths_touched: vec![codex_paths.config_toml.display().to_string()],
            inventory: vec![inventory],
        });
    }

    let backup_path = if inventory.status == InventoryStatus::Installed {
        Some(write_codex_config_backup(paths, codex_paths)?)
    } else {
        None
    };

    write_codex_config(&codex_paths.config_toml, &updated_config)?;

    let mut details = before_details;
    details.push(format!("applied keys: {}", applied_keys.join(", ")));
    details.push("opensrc left untouched".to_string());
    if let Some(path) = &backup_path {
        details.push(format!("backup: {}", path.display()));
    } else {
        details.push("backup: skipped (no prior config existed)".to_string());
    }

    let mut paths_touched = vec![codex_paths.config_toml.display().to_string()];
    if let Some(path) = &backup_path {
        paths_touched.push(path.display().to_string());
    }

    Ok(OperationResult {
        kind: OperationKind::ApplyIntegrationsProfile,
        summary: "integrations-profile apply: wrote recommended integrations".to_string(),
        rewrite: None,
        details,
        paths_touched,
        inventory: vec![InventoryItem {
            name: "codex-config".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: codex_paths.config_toml.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn apply_cloudflare_profile(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    paths
        .ensure_runtime_dirs()
        .map_err(|error| error.to_string())?;

    let inventory = inspect_codex_config_inventory(codex_paths)?;
    if inventory.status == InventoryStatus::Invalid {
        return Ok(OperationResult {
            kind: OperationKind::ApplyCloudflareProfile,
            summary: "cloudflare-profile apply: blocked by invalid config".to_string(),
            rewrite: None,
            details: vec![
                "repair ~/.codex/config.toml first".to_string(),
                "Sane only writes after a clean parse".to_string(),
            ],
            paths_touched: vec![codex_paths.config_toml.display().to_string()],
            inventory: vec![inventory],
        });
    }

    let current_config = if inventory.status == InventoryStatus::Installed {
        read_codex_config(&codex_paths.config_toml)?
    } else {
        TomlValue::Table(toml::map::Map::new())
    };
    let before_details = if inventory.status == InventoryStatus::Installed {
        cloudflare_profile_preview_details(&current_config)
    } else {
        vec![
            "cloudflare-api: missing -> optional provider profile".to_string(),
            "oauth and permissions stay explicit at connect time".to_string(),
            "note: not part of the broad recommended integrations profile".to_string(),
        ]
    };

    let mut updated_config = current_config.clone();
    let applied_keys = apply_cloudflare_profile_to_value(&mut updated_config)?;

    if applied_keys.is_empty() {
        return Ok(OperationResult {
            kind: OperationKind::ApplyCloudflareProfile,
            summary: "cloudflare-profile apply: already satisfied".to_string(),
            rewrite: None,
            details: before_details,
            paths_touched: vec![codex_paths.config_toml.display().to_string()],
            inventory: vec![inventory],
        });
    }

    let backup_path = if inventory.status == InventoryStatus::Installed {
        Some(write_codex_config_backup(paths, codex_paths)?)
    } else {
        None
    };

    write_codex_config(&codex_paths.config_toml, &updated_config)?;

    let mut details = before_details;
    details.push(format!("applied keys: {}", applied_keys.join(", ")));
    details.push("cloudflare stays outside broad recommended-integrations".to_string());
    if let Some(path) = &backup_path {
        details.push(format!("backup: {}", path.display()));
    } else {
        details.push("backup: skipped (no prior config existed)".to_string());
    }

    let mut paths_touched = vec![codex_paths.config_toml.display().to_string()];
    if let Some(path) = &backup_path {
        paths_touched.push(path.display().to_string());
    }

    Ok(OperationResult {
        kind: OperationKind::ApplyCloudflareProfile,
        summary: "cloudflare-profile apply: wrote optional provider profile".to_string(),
        rewrite: None,
        details,
        paths_touched,
        inventory: vec![InventoryItem {
            name: "codex-config".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: codex_paths.config_toml.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn restore_codex_config(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    let Some(backup_path) = latest_codex_config_backup(paths)? else {
        return Ok(OperationResult {
            kind: OperationKind::RestoreCodexConfig,
            summary: "codex-config restore: no backup available".to_string(),
            rewrite: None,
            details: vec![format!(
                "expected backups under {}",
                paths.codex_config_backups_dir.display()
            )],
            paths_touched: vec![paths.codex_config_backups_dir.display().to_string()],
            inventory: vec![inspect_codex_config_inventory(codex_paths)?],
        });
    };

    if let Some(parent) = codex_paths.config_toml.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::copy(&backup_path, &codex_paths.config_toml).map_err(|error| error.to_string())?;

    Ok(OperationResult {
        kind: OperationKind::RestoreCodexConfig,
        summary: format!(
            "codex-config restore: restored from {}",
            backup_path.display()
        ),
        rewrite: None,
        details: vec![format!("target: {}", codex_paths.config_toml.display())],
        paths_touched: vec![
            backup_path.display().to_string(),
            codex_paths.config_toml.display().to_string(),
        ],
        inventory: vec![InventoryItem {
            name: "codex-config".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: codex_paths.config_toml.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn config_details(config: &LocalConfig) -> Vec<String> {
    vec![
        format!("version: {}", config.version),
        format!(
            "coordinator: {} ({})",
            config.models.coordinator.model,
            config.models.coordinator.reasoning_effort.as_str()
        ),
        format!(
            "sidecar: {} ({})",
            config.models.sidecar.model,
            config.models.sidecar.reasoning_effort.as_str()
        ),
        format!(
            "verifier: {} ({})",
            config.models.verifier.model,
            config.models.verifier.reasoning_effort.as_str()
        ),
        format!("telemetry: {}", config.privacy.telemetry.as_str()),
        format!("packs: {}", config.packs.enabled_names().join(", ")),
    ]
}

fn active_guidance_packs(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<GuidancePacks, String> {
    let config = load_or_default_config(paths, codex_paths)?;
    Ok(GuidancePacks {
        caveman: config.packs.caveman,
        cavemem: config.packs.cavemem,
        rtk: config.packs.rtk,
        frontend_craft: config.packs.frontend_craft,
    })
}

fn active_model_role_guidance(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<ModelRoleGuidance, String> {
    let config = load_or_default_config(paths, codex_paths)?;
    Ok(model_role_guidance_from_config(&config))
}

fn model_role_guidance_from_config(config: &LocalConfig) -> ModelRoleGuidance {
    ModelRoleGuidance {
        coordinator_model: config.models.coordinator.model.clone(),
        coordinator_reasoning: config
            .models
            .coordinator
            .reasoning_effort
            .as_str()
            .to_string(),
        sidecar_model: config.models.sidecar.model.clone(),
        sidecar_reasoning: config.models.sidecar.reasoning_effort.as_str().to_string(),
        verifier_model: config.models.verifier.model.clone(),
        verifier_reasoning: config.models.verifier.reasoning_effort.as_str().to_string(),
    }
}

fn format_guidance_packs(packs: GuidancePacks) -> String {
    let mut enabled = vec!["core"];
    if packs.caveman {
        enabled.push("caveman");
    }
    if packs.cavemem {
        enabled.push("cavemem");
    }
    if packs.rtk {
        enabled.push("rtk");
    }
    if packs.frontend_craft {
        enabled.push("frontend-craft");
    }
    enabled.join(", ")
}

fn enabled_optional_pack_skills(packs: GuidancePacks) -> Vec<(&'static str, String)> {
    ["caveman", "cavemem", "rtk", "frontend-craft"]
        .into_iter()
        .filter(|name| match *name {
            "caveman" => packs.caveman,
            "cavemem" => packs.cavemem,
            "rtk" => packs.rtk,
            "frontend-craft" => packs.frontend_craft,
            _ => false,
        })
        .filter_map(|name| sane_optional_pack_skill(name).map(|body| (name, body)))
        .collect()
}

fn disabled_optional_pack_names(packs: GuidancePacks) -> Vec<&'static str> {
    ["caveman", "cavemem", "rtk", "frontend-craft"]
        .into_iter()
        .filter(|name| match *name {
            "caveman" => !packs.caveman,
            "cavemem" => !packs.cavemem,
            "rtk" => !packs.rtk,
            "frontend-craft" => !packs.frontend_craft,
            _ => false,
        })
        .collect()
}

fn save_config(paths: &ProjectPaths, config: &LocalConfig) -> Result<OperationResult, String> {
    paths
        .ensure_runtime_dirs()
        .map_err(|error| error.to_string())?;
    ensure_telemetry_files(paths, config.privacy.telemetry)?;
    let rewrite_result =
        write_canonical_with_backup_result(&paths.config_path, config, CanonicalStateFormat::Toml)
            .map_err(|error| error.to_string())?;

    let rewrite = operation_rewrite_metadata(rewrite_result);

    let mut details = Vec::new();
    append_rewrite_details(&mut details, &rewrite);

    let mut paths_touched = vec![rewrite.rewritten_path.clone()];
    if let Some(backup_path) = &rewrite.backup_path {
        paths_touched.push(backup_path.clone());
    }

    paths_touched.sort();
    paths_touched.dedup();

    Ok(OperationResult {
        kind: OperationKind::ShowConfig,
        summary: format!("config: saved at {}", paths.config_path.display()),
        rewrite: Some(rewrite),
        details,
        paths_touched,
        inventory: vec![InventoryItem {
            name: "config".to_string(),
            scope: InventoryScope::LocalRuntime,
            status: InventoryStatus::Installed,
            path: paths.config_path.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn operation_rewrite_metadata(rewrite_result: CanonicalRewriteResult) -> OperationRewriteMetadata {
    OperationRewriteMetadata {
        rewritten_path: rewrite_result.rewritten_path.display().to_string(),
        backup_path: rewrite_result
            .backup_path
            .as_ref()
            .map(|path| path.display().to_string()),
        first_write: rewrite_result.first_write,
    }
}

fn rewrite_mode(first_write: bool) -> &'static str {
    if first_write {
        "first write"
    } else {
        "rewrite"
    }
}

fn append_rewrite_details(details: &mut Vec<String>, rewrite: &OperationRewriteMetadata) {
    details.push(format!("rewritten path: {}", rewrite.rewritten_path));
    if let Some(backup_path) = &rewrite.backup_path {
        details.push(format!("backup path: {backup_path}"));
    }
    details.push(format!("write mode: {}", rewrite_mode(rewrite.first_write)));
}

fn append_named_rewrite_details(
    details: &mut Vec<String>,
    name: &str,
    rewrite: &OperationRewriteMetadata,
) {
    details.push(format!("{name} rewritten path: {}", rewrite.rewritten_path));
    if let Some(backup_path) = &rewrite.backup_path {
        details.push(format!("{name} backup path: {backup_path}"));
    }
    details.push(format!(
        "{name} write mode: {}",
        rewrite_mode(rewrite.first_write)
    ));
}

fn ensure_telemetry_files(paths: &ProjectPaths, level: TelemetryLevel) -> Result<(), String> {
    if level == TelemetryLevel::Off {
        return Ok(());
    }

    fs::create_dir_all(&paths.telemetry_dir).map_err(|error| error.to_string())?;
    ensure_file_with_default(
        &paths.telemetry_dir.join("summary.json"),
        "{\n  \"version\": 1\n}\n",
    )?;
    ensure_file_with_default(&paths.telemetry_dir.join("events.jsonl"), "")?;

    if level == TelemetryLevel::ProductImprovement {
        ensure_file_with_default(&paths.telemetry_dir.join("queue.jsonl"), "")?;
    }

    Ok(())
}

fn load_or_default_config(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<LocalConfig, String> {
    if paths.config_path.exists() {
        LocalConfig::read_from_path(&paths.config_path).map_err(|error| error.to_string())
    } else {
        Ok(recommended_local_config(codex_paths))
    }
}

fn recommended_local_config(codex_paths: &CodexPaths) -> LocalConfig {
    let environment =
        CodexEnvironment::detect(&codex_paths.models_cache_json, &codex_paths.auth_json)
            .unwrap_or_default();
    LocalConfig::recommended_for_environment(&environment)
}

fn reset_telemetry_data(paths: &ProjectPaths) -> Result<OperationResult, String> {
    if !paths.telemetry_dir.exists() {
        return Ok(OperationResult {
            kind: OperationKind::ResetTelemetryData,
            summary: "telemetry reset: no local telemetry data present".to_string(),
            rewrite: None,
            details: vec![],
            paths_touched: vec![paths.telemetry_dir.display().to_string()],
            inventory: vec![],
        });
    }

    fs::remove_dir_all(&paths.telemetry_dir).map_err(|error| error.to_string())?;
    Ok(OperationResult {
        kind: OperationKind::ResetTelemetryData,
        summary: "telemetry reset: removed local telemetry data".to_string(),
        rewrite: None,
        details: vec![],
        paths_touched: vec![paths.telemetry_dir.display().to_string()],
        inventory: vec![],
    })
}

fn inventory_status(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    let inventory = inspect_inventory(paths, codex_paths)?;

    Ok(OperationResult {
        kind: OperationKind::ShowStatus,
        summary: format!("status: {} managed targets inspected", inventory.len()),
        rewrite: None,
        details: vec![],
        paths_touched: collect_paths_touched(&inventory),
        inventory,
    })
}

fn render_session_start_hook() -> String {
    json!({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": "Sane active for this session: plain-language first, commands optional, avoid workflow lock-in, adapt model and subagent use to the task."
        }
    })
    .to_string()
}

fn doctor_runtime(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    let inventory = inspect_inventory(paths, codex_paths)?;
    let config_backups =
        list_canonical_backup_siblings(&paths.config_path).map_err(|error| error.to_string())?;
    let summary_backups =
        list_canonical_backup_siblings(&paths.summary_path).map_err(|error| error.to_string())?;
    let runtime = find_inventory(&inventory, "runtime");
    let config = find_inventory(&inventory, "config");
    let current_run = find_inventory(&inventory, "current-run");
    let summary = find_inventory(&inventory, "summary");
    let brief = find_inventory(&inventory, "brief");
    let pack_core = find_inventory(&inventory, "pack-core");
    let pack_caveman = find_inventory(&inventory, "pack-caveman");
    let pack_cavemem = find_inventory(&inventory, "pack-cavemem");
    let pack_rtk = find_inventory(&inventory, "pack-rtk");
    let pack_frontend_craft = find_inventory(&inventory, "pack-frontend-craft");
    let codex_config = find_inventory(&inventory, "codex-config");
    let user_skills = find_inventory(&inventory, "user-skills");
    let repo_skills = find_inventory(&inventory, "repo-skills");
    let repo_agents = find_inventory(&inventory, "repo-agents");
    let global_agents = find_inventory(&inventory, "global-agents");
    let hooks = find_inventory(&inventory, "hooks");
    let custom_agents = find_inventory(&inventory, "custom-agents");

    Ok(OperationResult {
        kind: OperationKind::Doctor,
        summary: format!(
            "runtime: {}\nconfig: {}\nconfig-backups: {}\ncurrent-run: {}\nsummary: {}\nsummary-backups: {}\nbrief: {}\npack-core: {}\npack-caveman: {}\npack-cavemem: {}\npack-rtk: {}\npack-frontend-craft: {}\ncodex-config: {}\nuser-skills: {}\nrepo-skills: {}\nrepo-agents: {}\nglobal-agents: {}\nhooks: {}\ncustom-agents: {}\nroot: {}\ncodex-home: {}",
            doctor_status(runtime),
            doctor_status(config),
            canonical_backup_history_summary(&config_backups),
            doctor_status(current_run),
            doctor_status(summary),
            canonical_backup_history_summary(&summary_backups),
            doctor_status(brief),
            doctor_status(pack_core),
            doctor_status(pack_caveman),
            doctor_status(pack_cavemem),
            doctor_status(pack_rtk),
            doctor_status(pack_frontend_craft),
            doctor_status(codex_config),
            doctor_status(user_skills),
            doctor_status(repo_skills),
            doctor_status(repo_agents),
            doctor_status(global_agents),
            doctor_status(hooks),
            doctor_status(custom_agents),
            paths.runtime_root.display(),
            codex_paths.codex_home.display()
        ),
        rewrite: None,
        details: vec![],
        paths_touched: collect_paths_touched(&inventory),
        inventory,
    })
}

fn canonical_backup_history_summary(backups: &[std::path::PathBuf]) -> String {
    if backups.is_empty() {
        return "none".to_string();
    }

    let shown = backups
        .iter()
        .take(3)
        .map(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| path.display().to_string())
        })
        .collect::<Vec<_>>();
    let remaining = backups.len().saturating_sub(shown.len());
    if remaining == 0 {
        format!("{} ({})", backups.len(), shown.join(", "))
    } else {
        format!(
            "{} ({} +{} more)",
            backups.len(),
            shown.join(", "),
            remaining
        )
    }
}

fn inspect_inventory(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<Vec<InventoryItem>, String> {
    let user_skill_path = codex_paths
        .user_skills_dir
        .join(SANE_ROUTER_SKILL_NAME)
        .join("SKILL.md");
    let repo_skill_path = paths
        .repo_skills_dir
        .join(SANE_ROUTER_SKILL_NAME)
        .join("SKILL.md");
    let codex_config_inventory = inspect_codex_config_inventory(codex_paths)?;
    let hooks_inventory = inspect_hooks_inventory(codex_paths)?;
    let pack_inventory = inspect_pack_inventory(paths, codex_paths);
    let expected_guidance = load_or_default_config(paths, codex_paths)
        .ok()
        .map(|config| {
            (
                GuidancePacks {
                    caveman: config.packs.caveman,
                    cavemem: config.packs.cavemem,
                    rtk: config.packs.rtk,
                    frontend_craft: config.packs.frontend_craft,
                },
                model_role_guidance_from_config(&config),
            )
        });
    let expected_user_skill = expected_guidance
        .as_ref()
        .map(|(packs, roles)| sane_router_skill(*packs, roles));
    let expected_global_agents = expected_guidance
        .as_ref()
        .map(|(packs, roles)| sane_global_agents_overlay(*packs, roles));
    let expected_custom_agents = expected_guidance
        .as_ref()
        .map(|(_, roles)| expected_custom_agent_files(roles));
    let custom_agents_inventory =
        inspect_custom_agents_inventory(codex_paths, expected_custom_agents.as_ref());

    let repo_agents_inventory = inspect_agents_block(
        &paths.repo_agents_md,
        "repo-agents",
        SANE_REPO_AGENTS_BEGIN,
        SANE_REPO_AGENTS_END,
        expected_global_agents.as_ref(),
        true,
        "export repo-agents",
    )
    .map_err(|error| error.to_string())?;
    let global_agents_inventory = inspect_agents_block(
        &codex_paths.global_agents_md,
        "global-agents",
        SANE_GLOBAL_AGENTS_BEGIN,
        SANE_GLOBAL_AGENTS_END,
        expected_global_agents.as_ref(),
        false,
        "export global-agents",
    )
    .map_err(|error| error.to_string())?;
    let layered_state = load_layered_state(paths).ok();
    let current_run_status = if !paths.state_dir.exists() {
        InventoryStatus::Missing
    } else if let Some(bundle) = layered_state.as_ref() {
        if bundle.current_run.is_some() {
            InventoryStatus::Installed
        } else {
            InventoryStatus::Missing
        }
    } else if !paths.current_run_path.exists() {
        InventoryStatus::Missing
    } else if CurrentRunState::read_from_path(&paths.current_run_path).is_ok() {
        InventoryStatus::Installed
    } else {
        InventoryStatus::Invalid
    };
    let current_run_repair_hint = match current_run_status {
        InventoryStatus::Installed => None,
        _ => Some("rerun `install`".to_string()),
    };
    let summary_status = if !paths.state_dir.exists() {
        InventoryStatus::Missing
    } else if let Some(bundle) = layered_state.as_ref() {
        if bundle.summary.is_some() {
            InventoryStatus::Installed
        } else {
            InventoryStatus::Missing
        }
    } else if !paths.summary_path.exists() {
        InventoryStatus::Missing
    } else if RunSummary::read_from_path(&paths.summary_path).is_ok() {
        InventoryStatus::Installed
    } else {
        InventoryStatus::Invalid
    };
    let summary_repair_hint = match summary_status {
        InventoryStatus::Installed => None,
        _ => Some("rerun `install`".to_string()),
    };
    let brief_status = if let Some(bundle) = layered_state.as_ref() {
        if bundle.brief.is_some() {
            InventoryStatus::Installed
        } else {
            InventoryStatus::Missing
        }
    } else if paths.brief_path.exists() {
        InventoryStatus::Installed
    } else {
        InventoryStatus::Missing
    };
    let brief_repair_hint = match brief_status {
        InventoryStatus::Installed => None,
        _ => Some("rerun `install`".to_string()),
    };

    let mut inventory = vec![
        InventoryItem {
            name: "runtime".to_string(),
            scope: InventoryScope::LocalRuntime,
            status: if paths.runtime_root.exists() {
                InventoryStatus::Installed
            } else {
                InventoryStatus::Missing
            },
            path: paths.runtime_root.display().to_string(),
            repair_hint: if paths.runtime_root.exists() {
                None
            } else {
                Some("run `install`".to_string())
            },
        },
        InventoryItem {
            name: "config".to_string(),
            scope: InventoryScope::LocalRuntime,
            status: if !paths.config_path.exists() {
                InventoryStatus::Missing
            } else if LocalConfig::read_from_path(&paths.config_path).is_ok() {
                InventoryStatus::Installed
            } else {
                InventoryStatus::Invalid
            },
            path: paths.config_path.display().to_string(),
            repair_hint: if !paths.config_path.exists() {
                Some("run `install`".to_string())
            } else if LocalConfig::read_from_path(&paths.config_path).is_ok() {
                None
            } else {
                Some("rerun `install`".to_string())
            },
        },
        InventoryItem {
            name: "current-run".to_string(),
            scope: InventoryScope::LocalRuntime,
            status: current_run_status,
            path: paths.current_run_path.display().to_string(),
            repair_hint: current_run_repair_hint,
        },
        InventoryItem {
            name: "summary".to_string(),
            scope: InventoryScope::LocalRuntime,
            status: summary_status,
            path: paths.summary_path.display().to_string(),
            repair_hint: summary_repair_hint,
        },
        InventoryItem {
            name: "brief".to_string(),
            scope: InventoryScope::LocalRuntime,
            status: brief_status,
            path: paths.brief_path.display().to_string(),
            repair_hint: brief_repair_hint,
        },
    ];
    inventory.extend(pack_inventory);
    inventory.extend([
        InventoryItem {
            name: "codex-config".to_string(),
            scope: InventoryScope::CodexNative,
            status: codex_config_inventory.status,
            path: codex_config_inventory.path,
            repair_hint: codex_config_inventory.repair_hint,
        },
        InventoryItem {
            name: "user-skills".to_string(),
            scope: InventoryScope::CodexNative,
            status: skill_target_status(&user_skill_path, expected_user_skill.as_ref(), false)
                .map_err(|error| error.to_string())?,
            path: user_skill_path.display().to_string(),
            repair_hint: skill_target_hint(
                &user_skill_path,
                expected_user_skill.as_ref(),
                false,
                "export user-skills",
            )
            .map_err(|error| error.to_string())?,
        },
        InventoryItem {
            name: "repo-skills".to_string(),
            scope: InventoryScope::CodexNative,
            status: skill_target_status(&repo_skill_path, expected_user_skill.as_ref(), true)
                .map_err(|error| error.to_string())?,
            path: repo_skill_path.display().to_string(),
            repair_hint: skill_target_hint(
                &repo_skill_path,
                expected_user_skill.as_ref(),
                true,
                "export repo-skills",
            )
            .map_err(|error| error.to_string())?,
        },
        repo_agents_inventory,
        global_agents_inventory,
        hooks_inventory,
        custom_agents_inventory,
    ]);
    Ok(inventory)
}

fn inspect_pack_inventory(paths: &ProjectPaths, codex_paths: &CodexPaths) -> Vec<InventoryItem> {
    enum ConfigState {
        Missing,
        Invalid,
        Loaded(LocalConfig),
    }

    let config_state = if !paths.config_path.exists() {
        ConfigState::Missing
    } else if let Ok(config) = LocalConfig::read_from_path(&paths.config_path) {
        ConfigState::Loaded(config)
    } else {
        ConfigState::Invalid
    };

    let names = [
        ("pack-core", "core"),
        ("pack-caveman", "caveman"),
        ("pack-cavemem", "cavemem"),
        ("pack-rtk", "rtk"),
        ("pack-frontend-craft", "frontend-craft"),
    ];

    names
        .into_iter()
        .map(|(inventory_name, pack_name)| InventoryItem {
            name: inventory_name.to_string(),
            scope: InventoryScope::LocalRuntime,
            status: match &config_state {
                ConfigState::Missing => InventoryStatus::Missing,
                ConfigState::Invalid => InventoryStatus::Invalid,
                ConfigState::Loaded(config) => match pack_name {
                    "core" if config.packs.core => InventoryStatus::Installed,
                    "caveman" if config.packs.caveman => {
                        pack_skill_status(paths, codex_paths, "caveman")
                    }
                    "cavemem" if config.packs.cavemem => {
                        pack_skill_status(paths, codex_paths, "cavemem")
                    }
                    "rtk" if config.packs.rtk => pack_skill_status(paths, codex_paths, "rtk"),
                    "frontend-craft" if config.packs.frontend_craft => {
                        pack_skill_status(paths, codex_paths, "frontend-craft")
                    }
                    _ => InventoryStatus::Disabled,
                },
            },
            path: paths.config_path.display().to_string(),
            repair_hint: match &config_state {
                ConfigState::Missing => Some("run `install`".to_string()),
                ConfigState::Invalid => Some("repair config first".to_string()),
                ConfigState::Loaded(_) => match pack_name {
                    "core" => None,
                    _ => match pack_skill_status(paths, codex_paths, pack_name) {
                        InventoryStatus::Installed => None,
                        InventoryStatus::Configured => {
                            Some("run `export user-skills` or `export repo-skills`".to_string())
                        }
                        _ => None,
                    },
                },
            },
        })
        .collect()
}

fn pack_skill_status(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
    pack_name: &str,
) -> InventoryStatus {
    let Some(skill_name) = sane_optional_pack_skill_name(pack_name) else {
        return InventoryStatus::Configured;
    };
    let Some(expected) = sane_optional_pack_skill(pack_name) else {
        return InventoryStatus::Configured;
    };
    let user_skill_path = codex_paths
        .user_skills_dir
        .join(skill_name)
        .join("SKILL.md");
    let repo_skill_path = paths.repo_skills_dir.join(skill_name).join("SKILL.md");

    for skill_path in [&user_skill_path, &repo_skill_path] {
        if !skill_path.exists() {
            continue;
        }

        match fs::read_to_string(skill_path) {
            Ok(body) if body == expected => return InventoryStatus::Installed,
            Ok(_) | Err(_) => return InventoryStatus::Configured,
        }
    }

    InventoryStatus::Configured
}

fn skill_target_status(
    skill_path: &Path,
    expected: Option<&String>,
    optional_when_missing: bool,
) -> std::io::Result<InventoryStatus> {
    if !skill_path.exists() {
        return Ok(if optional_when_missing {
            InventoryStatus::Disabled
        } else {
            InventoryStatus::Missing
        });
    }

    if let Some(expected) = expected {
        let body = fs::read_to_string(skill_path)?;
        if body == *expected {
            Ok(InventoryStatus::Installed)
        } else {
            Ok(InventoryStatus::Invalid)
        }
    } else {
        Ok(InventoryStatus::Installed)
    }
}

fn skill_target_hint(
    skill_path: &Path,
    expected: Option<&String>,
    optional_when_missing: bool,
    export_command: &str,
) -> std::io::Result<Option<String>> {
    if !skill_path.exists() {
        return Ok(if optional_when_missing {
            Some("optional repo export".to_string())
        } else {
            Some(format!("run `{export_command}`"))
        });
    }

    if let Some(expected) = expected {
        let body = fs::read_to_string(skill_path)?;
        if body == *expected {
            Ok(None)
        } else {
            Ok(Some(format!("rerun `{export_command}`")))
        }
    } else {
        Ok(None)
    }
}

fn inspect_agents_block(
    path: &Path,
    inventory_name: &str,
    begin: &str,
    end: &str,
    expected: Option<&String>,
    optional_when_missing: bool,
    export_command: &str,
) -> std::io::Result<InventoryItem> {
    if !path.exists() {
        return Ok(InventoryItem {
            name: inventory_name.to_string(),
            scope: InventoryScope::CodexNative,
            status: if optional_when_missing {
                InventoryStatus::Disabled
            } else {
                InventoryStatus::Missing
            },
            path: path.display().to_string(),
            repair_hint: if optional_when_missing {
                Some("optional repo export".to_string())
            } else {
                Some(format!("run `{export_command}`"))
            },
        });
    }

    let body = fs::read_to_string(path)?;
    if body.contains(begin) && body.contains(end) {
        let status = if let Some(expected) = expected {
            let rendered = upsert_managed_block(&body, begin, end, expected);
            if rendered == body {
                InventoryStatus::Installed
            } else {
                InventoryStatus::Invalid
            }
        } else {
            InventoryStatus::Installed
        };

        return Ok(InventoryItem {
            name: inventory_name.to_string(),
            scope: InventoryScope::CodexNative,
            status,
            path: path.display().to_string(),
            repair_hint: if status == InventoryStatus::Invalid {
                Some(format!("rerun `{export_command}`"))
            } else {
                None
            },
        });
    }

    Ok(InventoryItem {
        name: inventory_name.to_string(),
        scope: InventoryScope::CodexNative,
        status: InventoryStatus::PresentWithoutSaneBlock,
        path: path.display().to_string(),
        repair_hint: Some(format!("run `{export_command}`")),
    })
}

fn find_inventory<'a>(inventory: &'a [InventoryItem], name: &str) -> &'a InventoryItem {
    inventory
        .iter()
        .find(|item| item.name == name)
        .expect("inventory item missing")
}

fn doctor_status(item: &InventoryItem) -> String {
    match item.name.as_str() {
        "config" => match item.status {
            InventoryStatus::Installed => "ok".to_string(),
            InventoryStatus::Missing => "missing".to_string(),
            InventoryStatus::Invalid => "invalid (rerun install)".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "current-run" => match item.status {
            InventoryStatus::Installed => "ok".to_string(),
            InventoryStatus::Missing => "missing current-run.json (rerun install)".to_string(),
            InventoryStatus::Invalid => "invalid current-run.json (rerun install)".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "summary" => match item.status {
            InventoryStatus::Installed => "ok".to_string(),
            InventoryStatus::Missing => "missing summary.json (rerun install)".to_string(),
            InventoryStatus::Invalid => "invalid summary.json (rerun install)".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "brief" => match item.status {
            InventoryStatus::Installed => "ok".to_string(),
            InventoryStatus::Missing => "missing BRIEF.md (rerun install)".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "pack-core" | "pack-caveman" | "pack-cavemem" | "pack-rtk" | "pack-frontend-craft" => {
            match item.status {
                InventoryStatus::Installed => "enabled".to_string(),
                InventoryStatus::Configured => "enabled (config only)".to_string(),
                InventoryStatus::Disabled => "disabled".to_string(),
                InventoryStatus::Missing => "missing config (run `install`)".to_string(),
                InventoryStatus::Invalid => "invalid config (repair config first)".to_string(),
                _ => item.status.as_str().to_string(),
            }
        }
        "runtime" => match item.status {
            InventoryStatus::Installed => "ok".to_string(),
            InventoryStatus::Missing => "missing".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "user-skills" => match item.status {
            InventoryStatus::Installed => "installed".to_string(),
            InventoryStatus::Missing => "missing (run `export user-skills`)".to_string(),
            InventoryStatus::Invalid => "invalid (rerun `export user-skills`)".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "repo-skills" => match item.status {
            InventoryStatus::Installed => "installed".to_string(),
            InventoryStatus::Disabled => "disabled (optional repo export)".to_string(),
            InventoryStatus::Invalid => "invalid (rerun `export repo-skills`)".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "repo-agents" => match item.status {
            InventoryStatus::Installed => "installed".to_string(),
            InventoryStatus::Disabled => "disabled (optional repo export)".to_string(),
            InventoryStatus::Invalid => "invalid (rerun `export repo-agents`)".to_string(),
            InventoryStatus::PresentWithoutSaneBlock => "present without Sane block".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "codex-config" => match item.status {
            InventoryStatus::Installed => "installed".to_string(),
            InventoryStatus::Missing => "missing (run `apply codex-profile`)".to_string(),
            InventoryStatus::Invalid => "invalid (repair ~/.codex/config.toml)".to_string(),
            _ => item.status.display_str().to_string(),
        },
        "global-agents" => match item.status {
            InventoryStatus::Installed => "installed".to_string(),
            InventoryStatus::Missing => "missing (run `export global-agents`)".to_string(),
            InventoryStatus::Invalid => "invalid (rerun `export global-agents`)".to_string(),
            InventoryStatus::PresentWithoutSaneBlock => "present without Sane block".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "hooks" => match item.status {
            InventoryStatus::Installed => "installed".to_string(),
            InventoryStatus::Missing => "missing (run `export hooks`)".to_string(),
            InventoryStatus::Invalid => "invalid (repair ~/.codex/hooks.json)".to_string(),
            _ => item.status.display_str().to_string(),
        },
        "custom-agents" => match item.status {
            InventoryStatus::Installed => "installed".to_string(),
            InventoryStatus::Missing => "missing (run `export custom-agents`)".to_string(),
            InventoryStatus::Invalid => "invalid (rerun `export custom-agents`)".to_string(),
            _ => item.status.display_str().to_string(),
        },
        _ => item.status.as_str().to_string(),
    }
}

fn collect_paths_touched(inventory: &[InventoryItem]) -> Vec<String> {
    let mut paths = inventory
        .iter()
        .map(|item| item.path.clone())
        .collect::<Vec<_>>();
    paths.sort();
    paths.dedup();
    paths
}

fn export_user_skills(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    export_skills_target(
        paths,
        codex_paths,
        &codex_paths.user_skills_dir,
        OperationKind::ExportUserSkills,
        "user-skills",
        "export user-skills",
    )
}

fn export_repo_skills(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    export_skills_target(
        paths,
        codex_paths,
        &paths.repo_skills_dir,
        OperationKind::ExportRepoSkills,
        "repo-skills",
        "export repo-skills",
    )
}

fn export_skills_target(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
    skills_root: &Path,
    kind: OperationKind,
    inventory_name: &str,
    summary_prefix: &str,
) -> Result<OperationResult, String> {
    let skill_dir = skills_root.join(SANE_ROUTER_SKILL_NAME);
    fs::create_dir_all(&skill_dir).map_err(|error| error.to_string())?;
    let skill_path = skill_dir.join("SKILL.md");
    let packs = active_guidance_packs(paths, codex_paths)?;
    let roles = active_model_role_guidance(paths, codex_paths)?;
    fs::write(&skill_path, sane_router_skill(packs, &roles)).map_err(|error| error.to_string())?;
    let mut paths_touched = vec![skill_path.display().to_string()];

    for (pack_name, content) in enabled_optional_pack_skills(packs) {
        let skill_name = sane_optional_pack_skill_name(pack_name).expect("pack skill name");
        let pack_dir = skills_root.join(skill_name);
        fs::create_dir_all(&pack_dir).map_err(|error| error.to_string())?;
        let pack_path = pack_dir.join("SKILL.md");
        fs::write(&pack_path, content).map_err(|error| error.to_string())?;
        paths_touched.push(pack_path.display().to_string());
    }

    for pack_name in disabled_optional_pack_names(packs) {
        let skill_name = sane_optional_pack_skill_name(pack_name).expect("pack skill name");
        let pack_dir = skills_root.join(skill_name);
        if pack_dir.exists() {
            fs::remove_dir_all(&pack_dir).map_err(|error| error.to_string())?;
            paths_touched.push(pack_dir.display().to_string());
        }
    }

    Ok(OperationResult {
        kind,
        summary: format!("{summary_prefix}: installed {}", SANE_ROUTER_SKILL_NAME),
        rewrite: None,
        details: vec![
            format!("path: {}", skill_path.display()),
            format!("packs: {}", format_guidance_packs(packs)),
        ],
        paths_touched,
        inventory: vec![InventoryItem {
            name: inventory_name.to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: skill_path.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn export_repo_agents(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    export_agents_target(
        paths,
        codex_paths,
        &paths.repo_agents_md,
        SANE_REPO_AGENTS_BEGIN,
        SANE_REPO_AGENTS_END,
        OperationKind::ExportRepoAgents,
        "repo-agents",
        "export repo-agents",
    )
}

fn export_all(paths: &ProjectPaths, codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let user_skills = export_user_skills(paths, codex_paths)?;
    let global_agents = export_global_agents(paths, codex_paths)?;
    let hooks = export_hooks(codex_paths)?;
    let custom_agents = export_custom_agents(paths, codex_paths)?;

    Ok(merge_results(
        OperationKind::ExportAll,
        "export all: installed managed targets",
        vec![user_skills, global_agents, hooks, custom_agents],
    ))
}

fn export_global_agents(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    export_agents_target(
        paths,
        codex_paths,
        &codex_paths.global_agents_md,
        SANE_GLOBAL_AGENTS_BEGIN,
        SANE_GLOBAL_AGENTS_END,
        OperationKind::ExportGlobalAgents,
        "global-agents",
        "export global-agents",
    )
}

fn export_agents_target(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
    agents_path: &Path,
    begin: &str,
    end: &str,
    kind: OperationKind,
    inventory_name: &str,
    summary_prefix: &str,
) -> Result<OperationResult, String> {
    if let Some(parent) = agents_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let existing = if agents_path.exists() {
        fs::read_to_string(agents_path).map_err(|error| error.to_string())?
    } else {
        String::new()
    };

    let packs = active_guidance_packs(paths, codex_paths)?;
    let roles = active_model_role_guidance(paths, codex_paths)?;
    let updated = upsert_managed_block(
        &existing,
        begin,
        end,
        &sane_global_agents_overlay(packs, &roles),
    );
    fs::write(agents_path, updated).map_err(|error| error.to_string())?;

    Ok(OperationResult {
        kind,
        summary: format!("{summary_prefix}: installed managed block"),
        rewrite: None,
        details: vec![
            format!("path: {}", agents_path.display()),
            format!("packs: {}", format_guidance_packs(packs)),
        ],
        paths_touched: vec![agents_path.display().to_string()],
        inventory: vec![InventoryItem {
            name: inventory_name.to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: agents_path.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn uninstall_user_skills(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    uninstall_skills_target(
        &codex_paths.user_skills_dir,
        OperationKind::UninstallUserSkills,
        "user-skills",
        false,
        "uninstall user-skills",
    )
}

fn uninstall_repo_skills(paths: &ProjectPaths) -> Result<OperationResult, String> {
    uninstall_skills_target(
        &paths.repo_skills_dir,
        OperationKind::UninstallRepoSkills,
        "repo-skills",
        true,
        "uninstall repo-skills",
    )
}

fn uninstall_repo_agents(paths: &ProjectPaths) -> Result<OperationResult, String> {
    uninstall_agents_target(
        &paths.repo_agents_md,
        SANE_REPO_AGENTS_BEGIN,
        SANE_REPO_AGENTS_END,
        OperationKind::UninstallRepoAgents,
        "repo-agents",
        true,
        "uninstall repo-agents",
    )
}

fn uninstall_skills_target(
    skills_root: &Path,
    kind: OperationKind,
    inventory_name: &str,
    optional_when_missing: bool,
    summary_prefix: &str,
) -> Result<OperationResult, String> {
    let skill_dir = skills_root.join(SANE_ROUTER_SKILL_NAME);
    let skill_path = skill_dir.join("SKILL.md");
    let optional_dirs = ["caveman", "cavemem", "rtk", "frontend-craft"]
        .into_iter()
        .filter_map(sane_optional_pack_skill_name)
        .map(|name| skills_root.join(name))
        .collect::<Vec<_>>();

    if !skill_dir.exists() && optional_dirs.iter().all(|dir| !dir.exists()) {
        return Ok(OperationResult {
            kind,
            summary: format!("{summary_prefix}: {} not installed", SANE_ROUTER_SKILL_NAME),
            rewrite: None,
            details: vec![],
            paths_touched: vec![skill_path.display().to_string()],
            inventory: vec![InventoryItem {
                name: inventory_name.to_string(),
                scope: InventoryScope::CodexNative,
                status: if optional_when_missing {
                    InventoryStatus::Disabled
                } else {
                    InventoryStatus::Missing
                },
                path: skill_path.display().to_string(),
                repair_hint: None,
            }],
        });
    }

    let mut paths_touched = vec![];
    if skill_dir.exists() {
        fs::remove_dir_all(&skill_dir).map_err(|error| error.to_string())?;
        paths_touched.push(skill_dir.display().to_string());
    }
    for dir in optional_dirs {
        if dir.exists() {
            fs::remove_dir_all(&dir).map_err(|error| error.to_string())?;
            paths_touched.push(dir.display().to_string());
        }
    }

    Ok(OperationResult {
        kind,
        summary: format!("{summary_prefix}: removed {}", SANE_ROUTER_SKILL_NAME),
        rewrite: None,
        details: vec![],
        paths_touched,
        inventory: vec![InventoryItem {
            name: inventory_name.to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Removed,
            path: skill_path.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn uninstall_global_agents(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    uninstall_agents_target(
        &codex_paths.global_agents_md,
        SANE_GLOBAL_AGENTS_BEGIN,
        SANE_GLOBAL_AGENTS_END,
        OperationKind::UninstallGlobalAgents,
        "global-agents",
        false,
        "uninstall global-agents",
    )
}

fn uninstall_agents_target(
    agents_path: &Path,
    begin: &str,
    end: &str,
    kind: OperationKind,
    inventory_name: &str,
    optional_when_missing: bool,
    summary_prefix: &str,
) -> Result<OperationResult, String> {
    if !agents_path.exists() {
        return Ok(OperationResult {
            kind,
            summary: format!("{summary_prefix}: not installed"),
            rewrite: None,
            details: vec![],
            paths_touched: vec![agents_path.display().to_string()],
            inventory: vec![InventoryItem {
                name: inventory_name.to_string(),
                scope: InventoryScope::CodexNative,
                status: if optional_when_missing {
                    InventoryStatus::Disabled
                } else {
                    InventoryStatus::Missing
                },
                path: agents_path.display().to_string(),
                repair_hint: None,
            }],
        });
    }

    let existing = fs::read_to_string(agents_path).map_err(|error| error.to_string())?;
    let updated = remove_managed_block(&existing, begin, end);

    if updated == existing {
        return Ok(OperationResult {
            kind,
            summary: format!("{summary_prefix}: not installed"),
            rewrite: None,
            details: vec![],
            paths_touched: vec![agents_path.display().to_string()],
            inventory: vec![InventoryItem {
                name: inventory_name.to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::PresentWithoutSaneBlock,
                path: agents_path.display().to_string(),
                repair_hint: None,
            }],
        });
    }

    if updated.trim().is_empty() {
        fs::remove_file(agents_path).map_err(|error| error.to_string())?;
    } else {
        fs::write(agents_path, updated).map_err(|error| error.to_string())?;
    }

    Ok(OperationResult {
        kind,
        summary: format!("{summary_prefix}: removed managed block"),
        rewrite: None,
        details: vec![],
        paths_touched: vec![agents_path.display().to_string()],
        inventory: vec![InventoryItem {
            name: inventory_name.to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Removed,
            path: agents_path.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn uninstall_all(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let user_skills = uninstall_user_skills(codex_paths)?;
    let global_agents = uninstall_global_agents(codex_paths)?;
    let hooks = uninstall_hooks(codex_paths)?;
    let custom_agents = uninstall_custom_agents(codex_paths)?;

    Ok(merge_results(
        OperationKind::UninstallAll,
        "uninstall all: removed Sane's Codex changes",
        vec![user_skills, global_agents, hooks, custom_agents],
    ))
}

fn export_custom_agents(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    export_custom_agents_target(
        &active_model_role_guidance(paths, codex_paths)?,
        &codex_paths.custom_agents_dir,
        OperationKind::ExportCustomAgents,
        "custom-agents",
        "export custom-agents",
    )
}

fn uninstall_custom_agents(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    uninstall_custom_agents_target(
        &codex_paths.custom_agents_dir,
        OperationKind::UninstallCustomAgents,
        "custom-agents",
        "uninstall custom-agents",
    )
}

fn export_custom_agents_target(
    roles: &ModelRoleGuidance,
    agents_dir: &Path,
    kind: OperationKind,
    inventory_name: &str,
    summary_prefix: &str,
) -> Result<OperationResult, String> {
    fs::create_dir_all(agents_dir).map_err(|error| error.to_string())?;
    let agent_path = agents_dir.join(format!("{SANE_AGENT_NAME}.toml"));
    let reviewer_path = agents_dir.join(format!("{SANE_REVIEWER_AGENT_NAME}.toml"));
    let explorer_path = agents_dir.join(format!("{SANE_EXPLORER_AGENT_NAME}.toml"));

    fs::write(&agent_path, sane_agent(roles)).map_err(|error| error.to_string())?;
    fs::write(&reviewer_path, sane_reviewer_agent(roles)).map_err(|error| error.to_string())?;
    fs::write(&explorer_path, sane_explorer_agent(roles)).map_err(|error| error.to_string())?;

    Ok(OperationResult {
        kind,
        summary: format!(
            "{summary_prefix}: installed {SANE_AGENT_NAME}, {SANE_REVIEWER_AGENT_NAME}, and {SANE_EXPLORER_AGENT_NAME}"
        ),
        rewrite: None,
        details: vec![
            format!("path: {}", agent_path.display()),
            format!("path: {}", reviewer_path.display()),
            format!("path: {}", explorer_path.display()),
        ],
        paths_touched: vec![
            agent_path.display().to_string(),
            reviewer_path.display().to_string(),
            explorer_path.display().to_string(),
        ],
        inventory: vec![InventoryItem {
            name: inventory_name.to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: agents_dir.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn uninstall_custom_agents_target(
    agents_dir: &Path,
    kind: OperationKind,
    inventory_name: &str,
    summary_prefix: &str,
) -> Result<OperationResult, String> {
    let agent_path = agents_dir.join(format!("{SANE_AGENT_NAME}.toml"));
    let reviewer_path = agents_dir.join(format!("{SANE_REVIEWER_AGENT_NAME}.toml"));
    let explorer_path = agents_dir.join(format!("{SANE_EXPLORER_AGENT_NAME}.toml"));
    let managed_paths = [&agent_path, &reviewer_path, &explorer_path];

    let had_any = managed_paths.iter().any(|path| path.exists());
    if !had_any {
        return Ok(OperationResult {
            kind,
            summary: format!("{summary_prefix}: not installed"),
            rewrite: None,
            details: vec![],
            paths_touched: vec![agents_dir.display().to_string()],
            inventory: vec![InventoryItem {
                name: inventory_name.to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::Missing,
                path: agents_dir.display().to_string(),
                repair_hint: None,
            }],
        });
    }

    for path in managed_paths {
        if path.exists() {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }

    if agents_dir.exists()
        && fs::read_dir(agents_dir)
            .map_err(|error| error.to_string())?
            .next()
            .is_none()
    {
        fs::remove_dir(agents_dir).map_err(|error| error.to_string())?;
    }

    Ok(OperationResult {
        kind,
        summary: format!(
            "{summary_prefix}: removed {SANE_AGENT_NAME}, {SANE_REVIEWER_AGENT_NAME}, and {SANE_EXPLORER_AGENT_NAME}"
        ),
        rewrite: None,
        details: vec![],
        paths_touched: vec![
            agent_path.display().to_string(),
            reviewer_path.display().to_string(),
            explorer_path.display().to_string(),
        ],
        inventory: vec![InventoryItem {
            name: inventory_name.to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Removed,
            path: agents_dir.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn export_hooks(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let command = managed_session_start_hook_command()?;
    let hook_entry = json!({
        "matcher": "startup|resume",
        "hooks": [
            {
                "type": "command",
                "command": command,
                "statusMessage": "Loading Sane session defaults"
            }
        ]
    });

    if let Some(parent) = codex_paths.hooks_json.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mut root = read_hooks_json(&codex_paths.hooks_json)?;
    let hooks = root
        .as_object_mut()
        .ok_or_else(|| "hooks.json root must be an object".to_string())?
        .entry("hooks")
        .or_insert_with(|| Value::Object(Map::new()));
    let hooks_object = hooks
        .as_object_mut()
        .ok_or_else(|| "hooks.json `hooks` must be an object".to_string())?;
    let session_start = hooks_object
        .entry("SessionStart")
        .or_insert_with(|| Value::Array(Vec::new()));
    let session_start_array = session_start
        .as_array_mut()
        .ok_or_else(|| "hooks.json `hooks.SessionStart` must be an array".to_string())?;

    if !session_start_array
        .iter()
        .any(contains_managed_session_start_hook)
    {
        session_start_array.push(hook_entry);
    }

    write_hooks_json(&codex_paths.hooks_json, &root)?;

    Ok(OperationResult {
        kind: OperationKind::ExportHooks,
        summary: "export hooks: installed managed SessionStart hook".to_string(),
        rewrite: None,
        details: vec![format!("path: {}", codex_paths.hooks_json.display())],
        paths_touched: vec![codex_paths.hooks_json.display().to_string()],
        inventory: vec![InventoryItem {
            name: "hooks".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: codex_paths.hooks_json.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn uninstall_hooks(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    if !codex_paths.hooks_json.exists() {
        return Ok(OperationResult {
            kind: OperationKind::UninstallHooks,
            summary: "uninstall hooks: not installed".to_string(),
            rewrite: None,
            details: vec![],
            paths_touched: vec![codex_paths.hooks_json.display().to_string()],
            inventory: vec![InventoryItem {
                name: "hooks".to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::Missing,
                path: codex_paths.hooks_json.display().to_string(),
                repair_hint: None,
            }],
        });
    }

    let mut root = read_hooks_json(&codex_paths.hooks_json)?;
    let mut removed = false;

    if let Some(hooks) = root.get_mut("hooks").and_then(Value::as_object_mut)
        && let Some(session_start) = hooks.get_mut("SessionStart").and_then(Value::as_array_mut)
    {
        let before = session_start.len();
        session_start.retain(|entry| !contains_managed_session_start_hook(entry));
        removed = session_start.len() != before;

        if session_start.is_empty() {
            hooks.remove("SessionStart");
        }
        if hooks.is_empty() {
            root.as_object_mut().expect("root object").remove("hooks");
        }
    }

    if !removed {
        return Ok(OperationResult {
            kind: OperationKind::UninstallHooks,
            summary: "uninstall hooks: not installed".to_string(),
            rewrite: None,
            details: vec![],
            paths_touched: vec![codex_paths.hooks_json.display().to_string()],
            inventory: vec![InventoryItem {
                name: "hooks".to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::Missing,
                path: codex_paths.hooks_json.display().to_string(),
                repair_hint: None,
            }],
        });
    }

    if root
        .as_object()
        .map(|object| object.is_empty())
        .unwrap_or(false)
    {
        fs::remove_file(&codex_paths.hooks_json).map_err(|error| error.to_string())?;
    } else {
        write_hooks_json(&codex_paths.hooks_json, &root)?;
    }

    Ok(OperationResult {
        kind: OperationKind::UninstallHooks,
        summary: "uninstall hooks: removed managed SessionStart hook".to_string(),
        rewrite: None,
        details: vec![],
        paths_touched: vec![codex_paths.hooks_json.display().to_string()],
        inventory: vec![InventoryItem {
            name: "hooks".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Removed,
            path: codex_paths.hooks_json.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn inspect_hooks_inventory(codex_paths: &CodexPaths) -> Result<InventoryItem, String> {
    if detect_platform() == sane_platform::HostPlatform::Windows {
        return Ok(InventoryItem {
            name: "hooks".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Invalid,
            path: codex_paths.hooks_json.display().to_string(),
            repair_hint: Some("Codex hooks are currently disabled on Windows".to_string()),
        });
    }

    if !codex_paths.hooks_json.exists() {
        return Ok(InventoryItem {
            name: "hooks".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Missing,
            path: codex_paths.hooks_json.display().to_string(),
            repair_hint: Some("run `export hooks`".to_string()),
        });
    }

    let root = match read_hooks_json(&codex_paths.hooks_json) {
        Ok(root) => root,
        Err(_) => {
            return Ok(InventoryItem {
                name: "hooks".to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::Invalid,
                path: codex_paths.hooks_json.display().to_string(),
                repair_hint: Some(
                    "repair ~/.codex/hooks.json or remove conflicting JSON".to_string(),
                ),
            });
        }
    };
    let status = if root
        .get("hooks")
        .and_then(Value::as_object)
        .and_then(|hooks| hooks.get("SessionStart"))
        .and_then(Value::as_array)
        .map(|entries| entries.iter().any(contains_managed_session_start_hook))
        .unwrap_or(false)
    {
        InventoryStatus::Installed
    } else {
        InventoryStatus::Missing
    };

    Ok(InventoryItem {
        name: "hooks".to_string(),
        scope: InventoryScope::CodexNative,
        status,
        path: codex_paths.hooks_json.display().to_string(),
        repair_hint: if status == InventoryStatus::Installed {
            None
        } else {
            Some("run `export hooks`".to_string())
        },
    })
}

fn expected_custom_agent_files(roles: &ModelRoleGuidance) -> [(String, &'static str); 3] {
    [
        (sane_agent(roles), SANE_AGENT_NAME),
        (sane_reviewer_agent(roles), SANE_REVIEWER_AGENT_NAME),
        (sane_explorer_agent(roles), SANE_EXPLORER_AGENT_NAME),
    ]
}

fn inspect_custom_agents_inventory(
    codex_paths: &CodexPaths,
    expected: Option<&[(String, &'static str); 3]>,
) -> InventoryItem {
    let agent_path = codex_paths
        .custom_agents_dir
        .join(format!("{SANE_AGENT_NAME}.toml"));
    let reviewer_path = codex_paths
        .custom_agents_dir
        .join(format!("{SANE_REVIEWER_AGENT_NAME}.toml"));
    let explorer_path = codex_paths
        .custom_agents_dir
        .join(format!("{SANE_EXPLORER_AGENT_NAME}.toml"));
    let managed_paths = [&agent_path, &reviewer_path, &explorer_path];
    let missing_count = managed_paths.iter().filter(|path| !path.exists()).count();

    let status = match missing_count {
        3 => InventoryStatus::Missing,
        0 => {
            if let Some(expected) = expected {
                let actual = [
                    fs::read_to_string(&agent_path),
                    fs::read_to_string(&reviewer_path),
                    fs::read_to_string(&explorer_path),
                ];
                if actual
                    .iter()
                    .zip(expected.iter())
                    .all(|(actual, (expected_body, _))| {
                        actual
                            .as_ref()
                            .ok()
                            .is_some_and(|body| body == expected_body)
                    })
                {
                    InventoryStatus::Installed
                } else {
                    InventoryStatus::Invalid
                }
            } else {
                InventoryStatus::Installed
            }
        }
        _ => InventoryStatus::Invalid,
    };

    InventoryItem {
        name: "custom-agents".to_string(),
        scope: InventoryScope::CodexNative,
        status,
        path: codex_paths.custom_agents_dir.display().to_string(),
        repair_hint: match status {
            InventoryStatus::Installed => None,
            InventoryStatus::Missing => Some("run `export custom-agents`".to_string()),
            InventoryStatus::Invalid => Some("rerun `export custom-agents`".to_string()),
            _ => None,
        },
    }
}

fn inspect_codex_config_inventory(codex_paths: &CodexPaths) -> Result<InventoryItem, String> {
    let status = if !codex_paths.config_toml.exists() {
        InventoryStatus::Missing
    } else if read_codex_config(&codex_paths.config_toml).is_ok() {
        InventoryStatus::Installed
    } else {
        InventoryStatus::Invalid
    };

    Ok(InventoryItem {
        name: "codex-config".to_string(),
        scope: InventoryScope::CodexNative,
        status,
        path: codex_paths.config_toml.display().to_string(),
        repair_hint: match status {
            InventoryStatus::Installed => None,
            InventoryStatus::Missing => Some(
                "use `apply codex-profile` or `apply integrations-profile` to create it"
                    .to_string(),
            ),
            InventoryStatus::Invalid => Some("repair ~/.codex/config.toml first".to_string()),
            _ => None,
        },
    })
}

fn write_codex_config(path: &Path, config: &TomlValue) -> Result<(), String> {
    let body = toml::to_string_pretty(config).map_err(|error| error.to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, format!("{body}\n")).map_err(|error| error.to_string())
}

fn read_codex_config(path: &Path) -> Result<TomlValue, String> {
    let body = fs::read_to_string(path).map_err(|error| error.to_string())?;
    body.parse::<TomlValue>()
        .map_err(|error| format!("invalid config.toml: {error}"))
}

fn write_codex_config_backup(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<std::path::PathBuf, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs();
    let backup_path = paths
        .codex_config_backups_dir
        .join(format!("config-{timestamp}.toml"));
    fs::copy(&codex_paths.config_toml, &backup_path).map_err(|error| error.to_string())?;
    Ok(backup_path)
}

fn latest_codex_config_backup(paths: &ProjectPaths) -> Result<Option<std::path::PathBuf>, String> {
    if !paths.codex_config_backups_dir.exists() {
        return Ok(None);
    }

    let mut backups = fs::read_dir(&paths.codex_config_backups_dir)
        .map_err(|error| error.to_string())?
        .filter_map(|entry| entry.ok().map(|value| value.path()))
        .filter(|path| path.is_file())
        .collect::<Vec<_>>();
    backups.sort();
    Ok(backups.pop())
}

fn apply_core_codex_profile_to_value(
    config: &mut TomlValue,
    recommended: &LocalConfig,
) -> Result<(), String> {
    let table = config
        .as_table_mut()
        .ok_or_else(|| "config.toml root must be a table".to_string())?;
    table.insert(
        "model".to_string(),
        TomlValue::String(recommended.models.coordinator.model.clone()),
    );
    table.insert(
        "model_reasoning_effort".to_string(),
        TomlValue::String(
            recommended
                .models
                .coordinator
                .reasoning_effort
                .as_str()
                .to_string(),
        ),
    );

    let features = table
        .entry("features".to_string())
        .or_insert_with(|| TomlValue::Table(toml::map::Map::new()));
    let features_table = features
        .as_table_mut()
        .ok_or_else(|| "[features] must be a table".to_string())?;
    features_table.insert("codex_hooks".to_string(), TomlValue::Boolean(true));
    Ok(())
}

fn apply_integrations_profile_to_value(config: &mut TomlValue) -> Result<Vec<String>, String> {
    let table = config
        .as_table_mut()
        .ok_or_else(|| "config.toml root must be a table".to_string())?;
    let mcp_servers = table
        .entry("mcp_servers".to_string())
        .or_insert_with(|| TomlValue::Table(toml::map::Map::new()));
    let mcp_table = mcp_servers
        .as_table_mut()
        .ok_or_else(|| "[mcp_servers] must be a table".to_string())?;

    let mut applied_keys = Vec::new();

    if !mcp_table.contains_key("context7") {
        let mut context7 = toml::map::Map::new();
        context7.insert(
            "url".to_string(),
            TomlValue::String("https://mcp.context7.com/mcp".to_string()),
        );
        mcp_table.insert("context7".to_string(), TomlValue::Table(context7));
        applied_keys.push("mcp_servers.context7".to_string());
    }

    if !mcp_table.contains_key("playwright") {
        let mut playwright = toml::map::Map::new();
        playwright.insert("command".to_string(), TomlValue::String("npx".to_string()));
        playwright.insert(
            "args".to_string(),
            TomlValue::Array(vec![TomlValue::String(
                "@playwright/mcp@latest".to_string(),
            )]),
        );
        mcp_table.insert("playwright".to_string(), TomlValue::Table(playwright));
        applied_keys.push("mcp_servers.playwright".to_string());
    }

    if !mcp_table.contains_key("grep") && !mcp_table.contains_key("grep_app") {
        let mut grep_app = toml::map::Map::new();
        grep_app.insert(
            "url".to_string(),
            TomlValue::String("https://mcp.grep.app".to_string()),
        );
        mcp_table.insert("grep_app".to_string(), TomlValue::Table(grep_app));
        applied_keys.push("mcp_servers.grep_app".to_string());
    }

    Ok(applied_keys)
}

fn apply_cloudflare_profile_to_value(config: &mut TomlValue) -> Result<Vec<String>, String> {
    let table = config
        .as_table_mut()
        .ok_or_else(|| "config.toml root must be a table".to_string())?;
    let mcp_servers = table
        .entry("mcp_servers".to_string())
        .or_insert_with(|| TomlValue::Table(toml::map::Map::new()));
    let mcp_table = mcp_servers
        .as_table_mut()
        .ok_or_else(|| "[mcp_servers] must be a table".to_string())?;

    if mcp_table.contains_key("cloudflare-api") {
        return Ok(Vec::new());
    }

    let mut cloudflare = toml::map::Map::new();
    cloudflare.insert(
        "url".to_string(),
        TomlValue::String("https://mcp.cloudflare.com/mcp".to_string()),
    );
    mcp_table.insert("cloudflare-api".to_string(), TomlValue::Table(cloudflare));
    Ok(vec!["mcp_servers.cloudflare-api".to_string()])
}

fn codex_config_details(config: &TomlValue) -> Vec<String> {
    let model = config
        .get("model")
        .and_then(TomlValue::as_str)
        .unwrap_or("unset");
    let reasoning = config
        .get("model_reasoning_effort")
        .and_then(TomlValue::as_str)
        .unwrap_or("unset");
    let hooks_enabled = config
        .get("features")
        .and_then(TomlValue::as_table)
        .and_then(|table| table.get("codex_hooks"))
        .and_then(TomlValue::as_bool);
    let mcp_server_names = config
        .get("mcp_servers")
        .and_then(TomlValue::as_table)
        .map(|table| {
            let mut names = table.keys().cloned().collect::<Vec<_>>();
            names.sort();
            names
        })
        .unwrap_or_default();
    let trusted_projects = config
        .get("projects")
        .and_then(TomlValue::as_table)
        .map(|table| table.len())
        .unwrap_or(0);
    let theme = config
        .get("tui")
        .and_then(TomlValue::as_table)
        .and_then(|table| table.get("theme"))
        .and_then(TomlValue::as_str)
        .unwrap_or("unset");
    let enabled_plugins = config
        .get("plugins")
        .and_then(TomlValue::as_table)
        .map(|table| {
            let mut names = table
                .iter()
                .filter(|(_, value)| {
                    value
                        .as_table()
                        .and_then(|plugin| plugin.get("enabled"))
                        .and_then(TomlValue::as_bool)
                        .unwrap_or(false)
                })
                .map(|(name, _)| name.clone())
                .collect::<Vec<_>>();
            names.sort();
            names
        })
        .unwrap_or_default();

    vec![
        format!("model: {model}"),
        format!("reasoning: {reasoning}"),
        format!(
            "codex hooks: {}",
            hooks_enabled
                .map(|value| if value { "enabled" } else { "disabled" })
                .unwrap_or("unset")
        ),
        format!("mcp servers: {}", mcp_server_names.len()),
        format!(
            "mcp server names: {}",
            if mcp_server_names.is_empty() {
                "none".to_string()
            } else {
                mcp_server_names.join(", ")
            }
        ),
        format!("enabled plugins: {}", enabled_plugins.len()),
        format!(
            "plugin names: {}",
            if enabled_plugins.is_empty() {
                "none".to_string()
            } else {
                enabled_plugins.join(", ")
            }
        ),
        format!("trusted projects: {trusted_projects}"),
        format!("tui theme: {theme}"),
    ]
}

fn codex_profile_preview_details(config: &TomlValue, recommended: &LocalConfig) -> Vec<String> {
    let current_model = config
        .get("model")
        .and_then(TomlValue::as_str)
        .unwrap_or("unset");
    let current_reasoning = config
        .get("model_reasoning_effort")
        .and_then(TomlValue::as_str)
        .unwrap_or("unset");
    let current_hooks = config
        .get("features")
        .and_then(TomlValue::as_table)
        .and_then(|table| table.get("codex_hooks"))
        .and_then(TomlValue::as_bool);

    let mut details = Vec::new();
    push_profile_change(
        &mut details,
        "model",
        current_model,
        &recommended.models.coordinator.model,
    );
    push_profile_change(
        &mut details,
        "reasoning",
        current_reasoning,
        recommended.models.coordinator.reasoning_effort.as_str(),
    );
    push_profile_change(
        &mut details,
        "codex hooks",
        current_hooks
            .map(|value| if value { "enabled" } else { "disabled" })
            .unwrap_or("unset"),
        "enabled",
    );

    if !details.iter().any(|line| line.contains("->")) {
        details.push("core profile already matches current recommendation".to_string());
    }
    details.push("note: integrations stay outside bare core profile".to_string());
    details
}

fn integration_profile_preview_details(config: &TomlValue) -> Vec<String> {
    let mcp_servers = config.get("mcp_servers").and_then(TomlValue::as_table);
    let has_context7 = mcp_servers
        .map(|table| table.contains_key("context7"))
        .unwrap_or(false);
    let has_playwright = mcp_servers
        .map(|table| table.contains_key("playwright"))
        .unwrap_or(false);
    let has_opensrc = mcp_servers
        .map(|table| table.contains_key("opensrc"))
        .unwrap_or(false);
    let has_grep = mcp_servers
        .map(|table| table.contains_key("grep") || table.contains_key("grep_app"))
        .unwrap_or(false);

    let mut details = Vec::new();
    if has_context7 {
        details.push("context7: keep installed".to_string());
    } else {
        details.push("context7: missing -> recommended".to_string());
    }
    if has_playwright {
        details.push("playwright: keep installed".to_string());
    } else {
        details.push("playwright: missing -> recommended".to_string());
    }
    if has_grep {
        details.push("grep.app: keep installed".to_string());
    } else {
        details.push("grep.app: missing -> recommended".to_string());
    }
    if has_opensrc {
        details
            .push("opensrc: installed but stays outside default recommended profile".to_string());
    } else {
        details.push("opensrc: optional, not in default recommended profile".to_string());
    }
    details
}

fn cloudflare_profile_preview_details(config: &TomlValue) -> Vec<String> {
    let mcp_servers = config.get("mcp_servers").and_then(TomlValue::as_table);
    let has_cloudflare = mcp_servers
        .map(|table| table.contains_key("cloudflare-api"))
        .unwrap_or(false);

    let mut details = Vec::new();
    if has_cloudflare {
        details.push("cloudflare-api: keep installed".to_string());
    } else {
        details.push("cloudflare-api: missing -> optional provider profile".to_string());
    }
    details.push("oauth and permissions stay explicit at connect time".to_string());
    details.push("note: not part of the broad recommended integrations profile".to_string());
    details
}

fn push_profile_change(details: &mut Vec<String>, label: &str, current: &str, recommended: &str) {
    if current == recommended {
        details.push(format!("{label}: keep {recommended}"));
    } else {
        details.push(format!("{label}: {current} -> {recommended}"));
    }
}

fn read_hooks_json(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(json!({}));
    }

    let body = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&body).map_err(|error| format!("invalid hooks.json: {error}"))
}

fn write_hooks_json(path: &Path, value: &Value) -> Result<(), String> {
    let body = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, format!("{body}\n")).map_err(|error| error.to_string())
}

fn managed_session_start_hook_command() -> Result<String, String> {
    let exe = env::current_exe().map_err(|error| error.to_string())?;
    Ok(format!(
        "{} hook session-start",
        shell_quote(exe.to_string_lossy().as_ref())
    ))
}

fn contains_managed_session_start_hook(entry: &Value) -> bool {
    entry
        .get("hooks")
        .and_then(Value::as_array)
        .map(|hooks| {
            hooks.iter().any(|hook| {
                hook.get("command")
                    .and_then(Value::as_str)
                    .map(is_managed_session_start_hook_command)
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

fn is_managed_session_start_hook_command(command: &str) -> bool {
    command.contains("hook session-start")
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn merge_results(
    kind: OperationKind,
    summary: &str,
    results: Vec<OperationResult>,
) -> OperationResult {
    let mut details = Vec::new();
    let mut paths_touched = Vec::new();
    let mut inventory = Vec::new();

    for result in results {
        details.push(result.summary);
        details.extend(result.details);
        paths_touched.extend(result.paths_touched);
        inventory.extend(result.inventory);
    }

    paths_touched.sort();
    paths_touched.dedup();

    OperationResult {
        kind,
        summary: summary.to_string(),
        rewrite: None,
        details,
        paths_touched,
        inventory,
    }
}

fn upsert_managed_block(existing: &str, begin: &str, end: &str, body: &str) -> String {
    let managed = format!("{begin}\n{body}\n{end}\n");
    let stripped = remove_managed_block(existing, begin, end);

    if stripped.trim().is_empty() {
        managed
    } else {
        format!("{}\n\n{}", stripped.trim_end(), managed)
    }
}

fn remove_managed_block(existing: &str, begin: &str, end: &str) -> String {
    match (existing.find(begin), existing.find(end)) {
        (Some(start), Some(end_index)) if end_index >= start => {
            let end_exclusive = end_index + end.len();
            let before = existing[..start].trim_end();
            let after = existing[end_exclusive..].trim_start();

            match (before.is_empty(), after.is_empty()) {
                (true, true) => String::new(),
                (false, true) => format!("{before}\n"),
                (true, false) => format!("{after}\n"),
                (false, false) => format!("{before}\n\n{after}\n"),
            }
        }
        _ => existing.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use sane_state::CurrentRunState;
    use tempfile::tempdir;

    use super::{run, run_with_home};

    #[test]
    fn install_creates_dot_sane_runtime() {
        let dir = tempdir().unwrap();
        let output = run(&["install"], dir.path()).unwrap();

        assert!(output.contains(".sane"));
        assert!(dir.path().join(".sane").exists());
        assert!(dir.path().join(".sane").join("config.local.toml").exists());
        assert!(dir.path().join(".sane").join("state").exists());
        assert!(
            dir.path()
                .join(".sane")
                .join("state")
                .join("current-run.json")
                .exists()
        );
        assert!(
            dir.path()
                .join(".sane")
                .join("state")
                .join("summary.json")
                .exists()
        );
        assert!(
            dir.path()
                .join(".sane")
                .join("state")
                .join("events.jsonl")
                .exists()
        );
        assert!(dir.path().join(".sane").join("BRIEF.md").exists());
    }

    #[test]
    fn install_writes_current_run_state() {
        let dir = tempdir().unwrap();
        let _ = run(&["install"], dir.path()).unwrap();

        let body = std::fs::read_to_string(
            dir.path()
                .join(".sane")
                .join("state")
                .join("current-run.json"),
        )
        .unwrap();

        assert!(body.contains("\"phase\""));
        assert!(body.contains("\"verification\""));

        let state = CurrentRunState::read_from_path(
            dir.path()
                .join(".sane")
                .join("state")
                .join("current-run.json"),
        )
        .unwrap();
        assert_eq!(state.objective, "initialize sane runtime");
    }

    #[test]
    fn install_reports_canonical_first_write_details() {
        let dir = tempdir().unwrap();
        let output = run(&["install"], dir.path()).unwrap();

        assert!(output.contains(&format!(
            "config rewritten path: {}",
            dir.path().join(".sane").join("config.local.toml").display()
        )));
        assert!(output.contains(&format!(
            "current-run rewritten path: {}",
            dir.path()
                .join(".sane")
                .join("state")
                .join("current-run.json")
                .display()
        )));
        assert!(output.contains(&format!(
            "summary rewritten path: {}",
            dir.path().join(".sane").join("state").join("summary.json").display()
        )));
        assert!(output.contains("config write mode: first write"));
        assert!(output.contains("current-run write mode: first write"));
        assert!(output.contains("summary write mode: first write"));
    }

    #[test]
    fn install_repairs_invalid_canonical_files_and_reports_rewrite_details() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let _ = run_with_home(&["install"], project.path(), home.path()).unwrap();

        let config_path = project.path().join(".sane").join("config.local.toml");
        let current_run_path = project
            .path()
            .join(".sane")
            .join("state")
            .join("current-run.json");
        let summary_path = project
            .path()
            .join(".sane")
            .join("state")
            .join("summary.json");

        std::fs::write(&config_path, "not = [valid").unwrap();
        std::fs::write(&current_run_path, "{").unwrap();
        std::fs::write(&summary_path, "{").unwrap();

        let output = run_with_home(&["install"], project.path(), home.path()).unwrap();

        assert!(output.contains("config write mode: rewrite"));
        assert!(output.contains("current-run write mode: rewrite"));
        assert!(output.contains("summary write mode: rewrite"));
        assert!(output.contains("config.local.toml.bak."));
        assert!(output.contains("current-run.json.bak."));
        assert!(output.contains("summary.json.bak."));
        assert!(sane_config::LocalConfig::read_from_path(&config_path).is_ok());
        assert!(sane_state::CurrentRunState::read_from_path(&current_run_path).is_ok());
        assert!(sane_state::RunSummary::read_from_path(&summary_path).is_ok());
    }

    #[test]
    fn config_reports_missing_before_install() {
        let dir = tempdir().unwrap();
        let output = run(&["config"], dir.path()).unwrap();

        assert!(output.contains("missing"));
        assert!(output.contains(".sane/config.local.toml"));
    }

    #[test]
    fn install_uses_detected_codex_models_for_initial_defaults() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::create_dir_all(home.path().join(".codex")).unwrap();
        std::fs::write(
            home.path().join(".codex").join("models_cache.json"),
            r#"{
  "models": [
    {
      "slug": "gpt-5.4",
      "supported_reasoning_levels": [
        { "effort": "low" },
        { "effort": "medium" },
        { "effort": "high" },
        { "effort": "xhigh" }
      ]
    },
    {
      "slug": "gpt-5.2-codex",
      "supported_reasoning_levels": [
        { "effort": "low" },
        { "effort": "medium" },
        { "effort": "high" },
        { "effort": "xhigh" }
      ]
    },
    {
      "slug": "gpt-5.4-mini",
      "supported_reasoning_levels": [
        { "effort": "low" },
        { "effort": "medium" },
        { "effort": "high" },
        { "effort": "xhigh" }
      ]
    }
  ]
}"#,
        )
        .unwrap();
        std::fs::write(
            home.path().join(".codex").join("auth.json"),
            r#"{ "chatgpt_plan_type": "prolite" }"#,
        )
        .unwrap();

        let _ = run_with_home(&["install"], project.path(), home.path()).unwrap();
        let config = sane_config::LocalConfig::read_from_path(
            project.path().join(".sane").join("config.local.toml"),
        )
        .unwrap();

        assert_eq!(config.models.coordinator.model, "gpt-5.4");
        assert_eq!(
            config.models.coordinator.reasoning_effort,
            sane_config::ReasoningEffort::High
        );
        assert_eq!(config.models.sidecar.model, "gpt-5.4-mini");
        assert_eq!(
            config.models.sidecar.reasoning_effort,
            sane_config::ReasoningEffort::Medium
        );
        assert_eq!(config.models.verifier.model, "gpt-5.4");
        assert_eq!(
            config.models.verifier.reasoning_effort,
            sane_config::ReasoningEffort::XHigh
        );
    }

    #[test]
    fn doctor_reports_runtime_status() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();
        let _ = run_with_home(&["install"], dir.path(), home.path()).unwrap();
        let output = run_with_home(&["doctor"], dir.path(), home.path()).unwrap();

        assert!(output.contains("runtime: ok"));
        assert!(output.contains("config: ok"));
        assert!(output.contains("current-run: ok"));
        assert!(output.contains("summary: ok"));
        assert!(output.contains("brief: ok"));
        assert!(output.contains("pack-core: enabled"));
        assert!(output.contains("pack-caveman: disabled"));
        assert!(output.contains("pack-cavemem: disabled"));
        assert!(output.contains("pack-rtk: disabled"));
        assert!(output.contains("pack-frontend-craft: disabled"));
        assert!(output.contains("codex-config: missing (run `apply codex-profile`)"));
        assert!(output.contains("user-skills: missing"));
        assert!(output.contains("repo-skills: disabled"));
        assert!(output.contains("repo-agents: disabled"));
        assert!(output.contains("global-agents: missing"));
        assert!(output.contains("hooks: missing"));
        assert!(output.contains("custom-agents: missing"));
    }

    #[test]
    fn doctor_reports_invalid_config() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();
        let _ = run_with_home(&["install"], dir.path(), home.path()).unwrap();
        std::fs::write(
            dir.path().join(".sane").join("config.local.toml"),
            "not = [valid",
        )
        .unwrap();

        let output = run_with_home(&["doctor"], dir.path(), home.path()).unwrap();

        assert!(output.contains("config: invalid"));
        assert!(output.contains("rerun install"));
    }

    #[test]
    fn doctor_reports_missing_current_run_snapshot() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();
        let _ = run_with_home(&["install"], dir.path(), home.path()).unwrap();
        std::fs::remove_file(
            dir.path()
                .join(".sane")
                .join("state")
                .join("current-run.json"),
        )
        .unwrap();

        let output = run_with_home(&["doctor"], dir.path(), home.path()).unwrap();

        assert!(output.contains("current-run: missing current-run.json"));
        assert!(output.contains("rerun install"));
    }

    #[test]
    fn doctor_reports_missing_summary_file() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();
        let _ = run_with_home(&["install"], dir.path(), home.path()).unwrap();
        std::fs::remove_file(dir.path().join(".sane").join("state").join("summary.json")).unwrap();

        let output = run_with_home(&["doctor"], dir.path(), home.path()).unwrap();

        assert!(output.contains("summary: missing summary.json"));
        assert!(output.contains("rerun install"));
    }

    #[test]
    fn doctor_reports_canonical_backup_history_for_config_and_summary() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let _ = run_with_home(&["install"], project.path(), home.path()).unwrap();
        std::fs::write(
            project.path().join(".sane").join("config.local.toml"),
            "invalid = [toml",
        )
        .unwrap();
        std::fs::write(
            project
                .path()
                .join(".sane")
                .join("state")
                .join("summary.json"),
            "{ invalid json",
        )
        .unwrap();
        let _ = run_with_home(&["install"], project.path(), home.path()).unwrap();

        let output = run_with_home(&["doctor"], project.path(), home.path()).unwrap();

        assert!(output.contains("config-backups: 1 (config.local.toml.bak."));
        assert!(output.contains("summary-backups: 1 (summary.json.bak."));
    }

    #[test]
    fn backend_operations_append_event_records() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();

        let _ = run_with_home(&["install"], dir.path(), home.path()).unwrap();
        let _ = run_with_home(&["doctor"], dir.path(), home.path()).unwrap();

        let events_path = dir.path().join(".sane").join("state").join("events.jsonl");
        let body = std::fs::read_to_string(events_path).unwrap();

        assert!(body.contains("\"action\":\"install_runtime\""));
        assert!(body.contains("\"action\":\"doctor\""));
    }

    #[test]
    fn backend_operations_promote_summary_state() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();

        let _ = run_with_home(&["install"], dir.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "user-skills"], dir.path(), home.path()).unwrap();

        let summary_path = dir.path().join(".sane").join("state").join("summary.json");
        let body = std::fs::read_to_string(summary_path).unwrap();

        assert!(body.contains("runtime installed"));
        assert!(body.contains("user skills exported"));
        assert!(body.contains("config.local.toml"));
    }

    #[test]
    fn backend_operations_refresh_brief_from_summary() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();

        let _ = run_with_home(&["install"], dir.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "user-skills"], dir.path(), home.path()).unwrap();

        let brief = std::fs::read_to_string(dir.path().join(".sane").join("BRIEF.md")).unwrap();

        assert!(brief.contains("Objective:"), "brief was:\n{brief}");
        assert!(brief.contains("Phase: setup"));
        assert!(brief.contains("user skills exported"));
    }

    #[test]
    fn backend_operations_append_decisions_and_artifacts() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();

        let _ = run_with_home(&["install"], dir.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "user-skills"], dir.path(), home.path()).unwrap();

        let decisions = std::fs::read_to_string(
            dir.path()
                .join(".sane")
                .join("state")
                .join("decisions.jsonl"),
        )
        .unwrap();
        let artifacts = std::fs::read_to_string(
            dir.path()
                .join(".sane")
                .join("state")
                .join("artifacts.jsonl"),
        )
        .unwrap();

        assert!(decisions.contains("\"version\":1"));
        assert!(decisions.contains("user skills exported"));
        assert!(artifacts.contains("\"version\":1"));
        assert!(artifacts.contains("config.local.toml"));
    }

    #[test]
    fn backend_operations_write_typed_decision_and_artifact_records() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();

        let _ = run_with_home(&["install"], dir.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "user-skills"], dir.path(), home.path()).unwrap();

        let decisions = std::fs::read_to_string(
            dir.path()
                .join(".sane")
                .join("state")
                .join("decisions.jsonl"),
        )
        .unwrap();
        let artifacts = std::fs::read_to_string(
            dir.path()
                .join(".sane")
                .join("state")
                .join("artifacts.jsonl"),
        )
        .unwrap();

        let decision_line = decisions.lines().last().unwrap();
        let artifact_line = artifacts.lines().last().unwrap();

        assert!(decision_line.contains("\"version\":1"));
        assert!(decision_line.contains("\"summary\":\"user skills exported\""));
        assert!(decision_line.contains("\"rationale\""));
        assert!(!decision_line.contains("\"category\""));
        assert!(!decision_line.contains("\"action\""));
        assert!(!decision_line.contains("\"result\""));

        assert!(artifact_line.contains("\"version\":1"));
        assert!(artifact_line.contains("\"kind\""));
        assert!(artifact_line.contains("\"path\""));
        assert!(artifact_line.contains("SKILL.md"));
        assert!(!artifact_line.contains("\"category\""));
        assert!(!artifact_line.contains("\"action\""));
        assert!(!artifact_line.contains("\"result\""));
    }

    #[test]
    fn summary_lists_commands() {
        let output = run(&[], Path::new(".")).unwrap();

        assert!(output.contains("install"));
        assert!(output.contains("config"));
        assert!(output.contains("codex-config"));
        assert!(output.contains("preview"));
        assert!(output.contains("backup"));
        assert!(output.contains("apply"));
        assert!(output.contains("restore"));
        assert!(output.contains("status"));
        assert!(output.contains("export"));
        assert!(output.contains("uninstall"));
        assert!(output.contains("doctor"));
        assert!(output.contains("hook"));
        assert!(output.contains("debug"));
    }

    #[test]
    fn debug_policy_preview_renders_adaptive_scenarios() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();

        let output = run_with_home(&["debug", "policy-preview"], dir.path(), home.path()).unwrap();

        assert!(output.contains("policy preview: rendered adaptive obligation scenarios"));
        assert!(output.contains("simple-question: direct_answer | coordinator=gpt-5.4/high"));
        assert!(output.contains(
            "unknown-bug: debug_rigor, verify_light | coordinator=gpt-5.4/high, verifier=gpt-5.4/medium"
        ));
        assert!(output.contains(
            "multi-file-feature: planning, tdd, review, subagent_eligible | coordinator=gpt-5.4/high, sidecar=gpt-5.4-mini/medium, verifier=gpt-5.4/medium"
        ));
        assert!(output.contains(
            "blocked-long-run: planning, review, context_compaction, self_repair | coordinator=gpt-5.4/high, verifier=gpt-5.4/medium"
        ));
    }

    #[test]
    fn install_from_nested_directory_uses_discovered_project_root() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let nested = dir.path().join("crates").join("sane-tui").join("src");
        std::fs::create_dir_all(&nested).unwrap();

        let output = run(&["install"], &nested).unwrap();

        assert!(output.contains(dir.path().join(".sane").to_string_lossy().as_ref()));
        assert!(dir.path().join(".sane").join("config.local.toml").exists());
        assert!(dir.path().join(".sane").join("BRIEF.md").exists());
    }

    #[test]
    fn export_user_skills_installs_managed_sane_skill_pack() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let output =
            run_with_home(&["export", "user-skills"], project.path(), home.path()).unwrap();

        let skill_path = home
            .path()
            .join(".agents")
            .join("skills")
            .join("sane-router")
            .join("SKILL.md");

        assert!(output.contains("user-skills"));
        assert!(skill_path.exists());
        let body = std::fs::read_to_string(skill_path).unwrap();
        assert!(body.contains("name: sane-router"));
        assert!(body.contains("plain-language"));
        assert!(body.contains("coordinator: gpt-5.4 (high)"));
        assert!(body.contains("sidecar: gpt-5.4-mini (medium)"));
        assert!(body.contains("verifier: gpt-5.4 (medium)"));
    }

    #[test]
    fn export_user_skills_reflects_enabled_guidance_packs() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let mut config = sane_config::LocalConfig::default();
        config.packs.caveman = true;
        config.packs.rtk = true;
        config.packs.frontend_craft = true;
        config.models.coordinator.model = "gpt-5.2-codex".to_string();
        config.models.coordinator.reasoning_effort = sane_config::ReasoningEffort::XHigh;
        let _ = super::save_config(&paths, &config).unwrap();

        let _ = run_with_home(&["export", "user-skills"], project.path(), home.path()).unwrap();

        let skill_path = home
            .path()
            .join(".agents")
            .join("skills")
            .join("sane-router")
            .join("SKILL.md");
        let caveman_path = home
            .path()
            .join(".agents")
            .join("skills")
            .join("sane-caveman")
            .join("SKILL.md");
        let rtk_path = home
            .path()
            .join(".agents")
            .join("skills")
            .join("sane-rtk")
            .join("SKILL.md");
        let frontend_craft_path = home
            .path()
            .join(".agents")
            .join("skills")
            .join("sane-frontend-craft")
            .join("SKILL.md");
        let body = std::fs::read_to_string(skill_path).unwrap();

        assert!(body.contains("caveman pack active"));
        assert!(body.contains("rtk pack active"));
        assert!(body.contains("frontend-craft pack active"));
        assert!(body.contains("coordinator: gpt-5.2-codex (xhigh)"));
        assert!(caveman_path.exists());
        assert!(rtk_path.exists());
        assert!(frontend_craft_path.exists());
    }

    #[test]
    fn export_repo_skills_installs_managed_repo_skill_pack() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let output =
            run_with_home(&["export", "repo-skills"], project.path(), home.path()).unwrap();

        let skill_path = project
            .path()
            .join(".agents")
            .join("skills")
            .join("sane-router")
            .join("SKILL.md");

        assert!(output.contains("repo-skills"));
        assert!(skill_path.exists());
        let body = std::fs::read_to_string(skill_path).unwrap();
        assert!(body.contains("name: sane-router"));
        assert!(body.contains("plain-language"));
    }

    #[test]
    fn export_global_agents_installs_managed_overlay() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let output =
            run_with_home(&["export", "global-agents"], project.path(), home.path()).unwrap();
        let agents_path = home.path().join(".codex").join("AGENTS.md");

        assert!(output.contains("global-agents"));
        assert!(agents_path.exists());
        let body = std::fs::read_to_string(agents_path).unwrap();
        assert!(body.contains("<!-- sane:global-agents:start -->"));
        assert!(body.contains("Plain-language first"));
        assert!(body.contains("Current coordinator default: gpt-5.4 (high)"));
    }

    #[test]
    fn export_repo_agents_installs_managed_overlay() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let output =
            run_with_home(&["export", "repo-agents"], project.path(), home.path()).unwrap();
        let agents_path = project.path().join("AGENTS.md");

        assert!(output.contains("repo-agents"));
        assert!(agents_path.exists());
        let body = std::fs::read_to_string(agents_path).unwrap();
        assert!(body.contains("<!-- sane:repo-agents:start -->"));
        assert!(body.contains("Plain-language first"));
    }

    #[test]
    fn export_global_agents_reflects_enabled_guidance_packs() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let mut config = sane_config::LocalConfig::default();
        config.packs.cavemem = true;
        config.packs.rtk = true;
        config.models.sidecar.model = "gpt-5.3-codex-spark".to_string();
        config.models.sidecar.reasoning_effort = sane_config::ReasoningEffort::Low;
        let _ = super::save_config(&paths, &config).unwrap();

        let _ = run_with_home(&["export", "global-agents"], project.path(), home.path()).unwrap();
        let body = std::fs::read_to_string(home.path().join(".codex").join("AGENTS.md")).unwrap();

        assert!(body.contains("cavemem pack active"));
        assert!(body.contains("rtk pack active"));
        assert!(body.contains("Current sidecar default: gpt-5.3-codex-spark (low)"));
    }

    #[test]
    fn status_reports_pack_drift_for_exported_guidance_assets() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();

        let base = sane_config::LocalConfig::default();
        let _ = super::save_config(&paths, &base).unwrap();
        let _ = run_with_home(&["export", "user-skills"], project.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "global-agents"], project.path(), home.path()).unwrap();

        let mut changed = sane_config::LocalConfig::default();
        changed.models.verifier.model = "gpt-5.2".to_string();
        let _ = super::save_config(&paths, &changed).unwrap();

        let status = run_with_home(&["status"], project.path(), home.path()).unwrap();
        let doctor = run_with_home(&["doctor"], project.path(), home.path()).unwrap();

        assert!(status.contains("user-skills: invalid (rerun `export user-skills`)"));
        assert!(status.contains("global-agents: invalid (rerun `export global-agents`)"));
        assert!(doctor.contains("user-skills: invalid (rerun `export user-skills`)"));
        assert!(doctor.contains("global-agents: invalid (rerun `export global-agents`)"));
    }

    #[test]
    fn export_global_agents_preserves_existing_content() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(codex_dir.join("AGENTS.md"), "existing rules\n").unwrap();

        let _ = run_with_home(&["export", "global-agents"], project.path(), home.path()).unwrap();

        let body = std::fs::read_to_string(codex_dir.join("AGENTS.md")).unwrap();
        assert!(body.contains("existing rules"));
        assert!(body.contains("<!-- sane:global-agents:start -->"));
    }

    #[test]
    fn export_all_installs_all_current_managed_targets() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let output = run_with_home(&["export", "all"], project.path(), home.path()).unwrap();

        assert!(output.contains("export user-skills"));
        assert!(output.contains("export global-agents"));
        assert!(output.contains("export hooks"));
        assert!(output.contains("export custom-agents"));
        assert!(
            home.path()
                .join(".agents")
                .join("skills")
                .join("sane-router")
                .join("SKILL.md")
                .exists()
        );
        assert!(home.path().join(".codex").join("AGENTS.md").exists());
        assert!(home.path().join(".codex").join("hooks.json").exists());
        assert!(
            home.path()
                .join(".codex")
                .join("agents")
                .join("sane-reviewer.toml")
                .exists()
        );
    }

    #[test]
    fn uninstall_user_skills_removes_managed_sane_skill_pack() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let mut config = sane_config::LocalConfig::default();
        config.packs.caveman = true;
        let _ = super::save_config(&paths, &config).unwrap();

        let _ = run_with_home(&["export", "user-skills"], project.path(), home.path()).unwrap();
        let output =
            run_with_home(&["uninstall", "user-skills"], project.path(), home.path()).unwrap();

        let skill_path = home
            .path()
            .join(".agents")
            .join("skills")
            .join("sane-router");
        let caveman_path = home
            .path()
            .join(".agents")
            .join("skills")
            .join("sane-caveman");

        assert!(output.contains("uninstall user-skills"));
        assert!(!skill_path.exists());
        assert!(!caveman_path.exists());
    }

    #[test]
    fn uninstall_repo_skills_removes_managed_repo_skill_pack() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let _ = run_with_home(&["export", "repo-skills"], project.path(), home.path()).unwrap();
        let output =
            run_with_home(&["uninstall", "repo-skills"], project.path(), home.path()).unwrap();

        let skill_path = project
            .path()
            .join(".agents")
            .join("skills")
            .join("sane-router");

        assert!(output.contains("uninstall repo-skills"));
        assert!(!skill_path.exists());
    }

    #[test]
    fn uninstall_repo_agents_removes_only_managed_repo_block() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(project.path().join("AGENTS.md"), "existing repo rules\n").unwrap();

        let _ = run_with_home(&["export", "repo-agents"], project.path(), home.path()).unwrap();
        let output =
            run_with_home(&["uninstall", "repo-agents"], project.path(), home.path()).unwrap();

        let body = std::fs::read_to_string(project.path().join("AGENTS.md")).unwrap();
        assert!(output.contains("uninstall repo-agents"));
        assert_eq!(body, "existing repo rules\n");
    }

    #[test]
    fn uninstall_global_agents_removes_only_managed_block() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(codex_dir.join("AGENTS.md"), "existing rules\n").unwrap();

        let _ = run_with_home(&["export", "global-agents"], project.path(), home.path()).unwrap();
        let output =
            run_with_home(&["uninstall", "global-agents"], project.path(), home.path()).unwrap();

        let body = std::fs::read_to_string(codex_dir.join("AGENTS.md")).unwrap();
        assert!(output.contains("uninstall global-agents"));
        assert_eq!(body, "existing rules\n");
    }

    #[test]
    fn uninstall_all_removes_all_current_managed_targets() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let _ = run_with_home(&["export", "all"], project.path(), home.path()).unwrap();
        let output = run_with_home(&["uninstall", "all"], project.path(), home.path()).unwrap();

        assert!(output.contains("uninstall user-skills"));
        assert!(output.contains("uninstall global-agents"));
        assert!(
            !home
                .path()
                .join(".agents")
                .join("skills")
                .join("sane-router")
                .exists()
        );
        assert!(!home.path().join(".codex").join("AGENTS.md").exists());
        assert!(!home.path().join(".codex").join("hooks.json").exists());
        assert!(!home.path().join(".codex").join("agents").exists());
    }

    #[test]
    fn doctor_reports_installed_managed_assets() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let _ = run_with_home(&["install"], project.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "user-skills"], project.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "global-agents"], project.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "hooks"], project.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "custom-agents"], project.path(), home.path()).unwrap();

        let output = run_with_home(&["doctor"], project.path(), home.path()).unwrap();

        assert!(output.contains("user-skills: installed"));
        assert!(output.contains("global-agents: installed"));
        assert!(output.contains("hooks: installed"));
        assert!(output.contains("custom-agents: installed"));
    }

    #[test]
    fn tui_app_exposes_required_foundation_actions() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let codex_paths = sane_platform::CodexPaths::new(home.path());

        let app =
            super::TuiApp::new(&paths, &codex_paths, super::TuiLaunchMode::Onboarding).unwrap();
        let home_labels = app
            .sections
            .iter()
            .map(|option| option.label)
            .collect::<Vec<_>>();

        assert_eq!(
            home_labels,
            vec![
                "Start here",
                "Set up preferences",
                "Install to Codex",
                "Inspect",
                "Repair or remove",
            ]
        );

        let start_here = super::section_actions(super::TuiSection::StartHere)
            .iter()
            .map(|action| action.label)
            .collect::<Vec<_>>();
        assert_eq!(
            start_here,
            vec![
                "1. Create Sane's local project files",
                "2. View your current Codex settings",
                "3. Preview Sane's recommended Codex settings",
                "4. Back up your Codex settings",
                "5. Apply Sane's recommended Codex settings",
                "6. Install Sane into Codex",
            ]
        );
    }

    #[test]
    fn codex_profile_preview_help_stays_non_destructive() {
        let body = super::command_help_lines(super::Command::PreviewCodexProfile)
            .into_iter()
            .map(|line| line.to_string())
            .collect::<Vec<_>>()
            .join("\n");

        assert!(body.contains("Preview only. No files are changed."));
        assert!(body.contains("model, reasoning, and hook settings"));
        assert!(body.contains("Codex models it can detect here"));
    }

    #[test]
    fn selected_action_help_starts_with_explicit_selected_label() {
        let action = super::section_actions(super::TuiSection::StartHere)[0];
        let body = super::selected_action_help_lines(&action)
            .into_iter()
            .map(|line| line.to_string())
            .collect::<Vec<_>>()
            .join("\n");

        assert!(body.contains("Selected action: 1. Create Sane's local project files"));
        assert!(body.contains("Use this first in a new repo"));
    }

    #[test]
    fn confirmation_feedback_mentions_keys_and_impact() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let codex_paths = sane_platform::CodexPaths::new(home.path());
        let mut app =
            super::TuiApp::new(&paths, &codex_paths, super::TuiLaunchMode::Onboarding).unwrap();

        let action = super::section_actions(super::TuiSection::StartHere)[4];
        app.run_action(action);

        assert!(matches!(app.screen, super::TuiScreen::Confirm(_)));
        assert!(
            app.output
                .contains("Enter or y confirms. Esc or n cancels.")
        );
        assert!(
            super::confirm_action_context(super::Command::ApplyCodexProfile)
                .contains("writes changes into your `~/.codex/config.toml`")
        );
    }

    #[test]
    fn onboarding_recommends_export_when_user_skill_missing() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::create_dir_all(home.path().join(".codex")).unwrap();
        std::fs::write(
            home.path().join(".codex").join("config.toml"),
            "model = \"gpt-5.4\"\nmodel_reasoning_effort = \"high\"\n",
        )
        .unwrap();

        let _ = run_with_home(&["install"], project.path(), home.path()).unwrap();

        let status = run_with_home(&["status"], project.path(), home.path()).unwrap();

        assert!(status.contains("user-skills: missing"));

        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let codex_paths = sane_platform::CodexPaths::new(home.path());
        let app =
            super::TuiApp::new(&paths, &codex_paths, super::TuiLaunchMode::Onboarding).unwrap();
        let body = super::home_option_lines(super::TuiSection::StartHere, &app.status)
            .into_iter()
            .map(|line| line.to_string())
            .collect::<Vec<_>>()
            .join("\n");

        assert!(body.contains("Recommended now: Install Sane into Codex"));
    }

    #[test]
    fn config_field_help_explains_role_meaning() {
        let editor = super::ConfigEditor::new(
            sane_config::LocalConfig::default(),
            sane_config::LocalConfig::default(),
        );
        let body = super::config_field_help_lines(&editor)
            .into_iter()
            .map(|line| line.to_string())
            .collect::<Vec<_>>()
            .join("\n");

        assert!(body.contains("Coordinator model"));
        assert!(body.contains("main top-level worker"));
        assert!(body.contains("Sidecar = smaller bounded helper"));
        assert!(body.contains("Verifier = review and correctness pass"));
    }

    #[test]
    fn pack_help_explains_selected_pack() {
        let editor = super::PackEditor::new(sane_config::LocalConfig::default());
        let body = super::pack_lines(&editor)
            .into_iter()
            .map(|line| line.to_string())
            .collect::<Vec<_>>()
            .join("\n");

        assert!(body.contains("selected pack: caveman"));
        assert!(body.contains("Compressed communication guidance"));
        assert!(body.contains("Some exports may need rerunning after save."));
    }

    #[test]
    fn risky_backend_actions_require_confirmation() {
        assert!(super::command_requires_confirmation(
            super::Command::ApplyCodexProfile
        ));
        assert!(super::command_requires_confirmation(
            super::Command::ApplyIntegrationsProfile
        ));
        assert!(super::command_requires_confirmation(
            super::Command::RestoreCodexConfig
        ));
        assert!(super::command_requires_confirmation(
            super::Command::UninstallAll
        ));
        assert!(!super::command_requires_confirmation(
            super::Command::PreviewCodexProfile
        ));
        assert!(!super::command_requires_confirmation(
            super::Command::ExportAll
        ));
    }

    #[test]
    fn save_config_persists_supported_model_defaults() {
        let project = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let config = sane_config::LocalConfig {
            version: 1,
            models: sane_config::ModelRolePresets {
                coordinator: sane_config::ModelPreset {
                    model: "gpt-5.3-codex".to_string(),
                    reasoning_effort: sane_config::ReasoningEffort::XHigh,
                },
                sidecar: sane_config::ModelPreset {
                    model: "gpt-5.1-codex-mini".to_string(),
                    reasoning_effort: sane_config::ReasoningEffort::Low,
                },
                verifier: sane_config::ModelPreset {
                    model: "gpt-5.4".to_string(),
                    reasoning_effort: sane_config::ReasoningEffort::High,
                },
            },
            privacy: sane_config::PrivacyConfig::default(),
            packs: sane_config::PackConfig {
                core: true,
                caveman: true,
                cavemem: false,
                rtk: true,
                frontend_craft: false,
            },
        };

        let result = super::save_config(&paths, &config).unwrap();
        let saved = sane_config::LocalConfig::read_from_path(&paths.config_path).unwrap();

        assert!(result.summary.contains("config: saved"));
        assert_eq!(saved, config);
        let rewrite = result.rewrite.expect("rewrite metadata missing");
        assert_eq!(
            rewrite.rewritten_path,
            paths.config_path.display().to_string()
        );
        assert!(rewrite.backup_path.is_none());
        assert!(rewrite.first_write);
        assert!(result.details.iter().any(|line| {
            line == format!("rewritten path: {}", paths.config_path.display()).as_str()
        }));
        assert!(
            result
                .details
                .iter()
                .any(|line| line == "write mode: first write")
        );
    }

    #[test]
    fn save_config_reports_rewrite_with_backup_after_first_write() {
        let project = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let base = sane_config::LocalConfig::default();
        let mut changed = sane_config::LocalConfig::default();
        changed.models.verifier.model = "gpt-5.2".to_string();

        let _ = super::save_config(&paths, &base).unwrap();
        let result = super::save_config(&paths, &changed).unwrap();

        let rewrite = result.rewrite.expect("rewrite metadata missing");
        assert!(!rewrite.first_write);
        let backup_path = rewrite.backup_path.expect("backup path missing");
        assert!(backup_path.contains("config.local.toml.bak."));
        assert!(std::path::Path::new(&backup_path).exists());
        assert!(
            result
                .details
                .iter()
                .any(|line| line == format!("backup path: {backup_path}").as_str())
        );
        assert!(
            result
                .details
                .iter()
                .any(|line| line == "write mode: rewrite")
        );
    }

    #[test]
    fn status_reports_enabled_optional_packs_as_configured() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let mut config = sane_config::LocalConfig::default();
        config.packs.caveman = true;
        config.packs.rtk = true;
        let _ = super::save_config(&paths, &config).unwrap();

        let output = run_with_home(&["status"], project.path(), home.path()).unwrap();
        let doctor = run_with_home(&["doctor"], project.path(), home.path()).unwrap();

        assert!(output.contains("pack-caveman: configured"));
        assert!(output.contains("pack-rtk: configured"));
        assert!(doctor.contains("pack-caveman: enabled (config only)"));
        assert!(doctor.contains("pack-rtk: enabled (config only)"));
    }

    #[test]
    fn status_reports_enabled_optional_packs_as_installed_after_export() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let mut config = sane_config::LocalConfig::default();
        config.packs.caveman = true;
        let _ = super::save_config(&paths, &config).unwrap();
        let _ = run_with_home(&["export", "user-skills"], project.path(), home.path()).unwrap();

        let output = run_with_home(&["status"], project.path(), home.path()).unwrap();
        let doctor = run_with_home(&["doctor"], project.path(), home.path()).unwrap();

        assert!(output.contains("pack-caveman: installed"));
        assert!(doctor.contains("pack-caveman: enabled"));
    }

    #[test]
    fn save_config_creates_local_telemetry_dir_when_enabled() {
        let project = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let mut config = sane_config::LocalConfig::default();
        config.privacy.telemetry = sane_config::TelemetryLevel::LocalOnly;

        let _ = super::save_config(&paths, &config).unwrap();

        assert!(paths.telemetry_dir.exists());
        assert!(paths.telemetry_dir.join("summary.json").exists());
        assert!(paths.telemetry_dir.join("events.jsonl").exists());
        assert!(!paths.telemetry_dir.join("queue.jsonl").exists());
    }

    #[test]
    fn save_config_creates_queue_when_product_improvement_enabled() {
        let project = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        let mut config = sane_config::LocalConfig::default();
        config.privacy.telemetry = sane_config::TelemetryLevel::ProductImprovement;

        let _ = super::save_config(&paths, &config).unwrap();

        assert!(paths.telemetry_dir.join("queue.jsonl").exists());
    }

    #[test]
    fn append_export_drift_warnings_flags_stale_guidance_exports() {
        let mut output = "config: saved".to_string();
        let status = sane_core::OperationResult {
            kind: sane_core::OperationKind::ShowStatus,
            summary: "status: ok".to_string(),
            rewrite: None,
            details: vec![],
            paths_touched: vec![],
            inventory: vec![
                sane_core::InventoryItem {
                    name: "user-skills".to_string(),
                    scope: sane_core::InventoryScope::CodexNative,
                    status: sane_core::InventoryStatus::Invalid,
                    path: "/tmp/user-skills".to_string(),
                    repair_hint: Some("rerun `export user-skills`".to_string()),
                },
                sane_core::InventoryItem {
                    name: "global-agents".to_string(),
                    scope: sane_core::InventoryScope::CodexNative,
                    status: sane_core::InventoryStatus::Invalid,
                    path: "/tmp/AGENTS.md".to_string(),
                    repair_hint: Some("rerun `export global-agents`".to_string()),
                },
            ],
        };

        super::append_export_drift_warnings(&mut output, &status);

        assert!(output.contains("warning: exported user-skills stale; rerun `export user-skills`"));
        assert!(
            output.contains("warning: exported global-agents stale; rerun `export global-agents`")
        );
    }

    #[test]
    fn reset_telemetry_data_removes_local_telemetry_dir() {
        let project = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let paths = sane_platform::ProjectPaths::discover(project.path()).unwrap();
        std::fs::create_dir_all(&paths.telemetry_dir).unwrap();
        std::fs::write(paths.telemetry_dir.join("summary.json"), "{}").unwrap();

        let result = super::reset_telemetry_data(&paths).unwrap();

        assert!(result.summary.contains("removed local telemetry data"));
        assert!(!paths.telemetry_dir.exists());
    }

    #[test]
    fn tui_output_reflows_long_paths_for_small_panels() {
        let lines = super::reflow_tui_text(
            "installed runtime at /Users/bjorn/Code/labs/betteragents/.sane/config.local.toml",
            28,
        );

        assert!(lines.len() > 2);
        assert!(lines.iter().all(|line| line.len() <= 28));
        assert!(lines.join("\n").contains("/Users/bjorn/"));
    }

    #[test]
    fn milestone_summary_uses_codex_install_wording() {
        let export = super::operation_milestone(sane_core::OperationKind::ExportAll);
        let uninstall = super::operation_milestone(sane_core::OperationKind::UninstallAll);

        assert_eq!(export, Some("Sane installed into Codex"));
        assert_eq!(uninstall, Some("Sane removed from Codex"));
    }

    #[test]
    fn status_reports_all_managed_targets() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let _ = run_with_home(&["install"], project.path(), home.path()).unwrap();
        let output = run_with_home(&["status"], project.path(), home.path()).unwrap();

        assert!(output.contains("status: 17 managed targets inspected"));
        assert!(output.contains("local runtime:"));
        assert!(output.contains("codex-native:"));
        assert!(output.contains("runtime: installed"));
        assert!(output.contains("config: installed"));
        assert!(output.contains("current-run: installed"));
        assert!(output.contains("summary: installed"));
        assert!(output.contains("brief: installed"));
        assert!(output.contains("pack-core: installed"));
        assert!(output.contains("pack-caveman: disabled"));
        assert!(output.contains("pack-cavemem: disabled"));
        assert!(output.contains("pack-rtk: disabled"));
        assert!(output.contains("pack-frontend-craft: disabled"));
        assert!(output.contains("codex-config: missing (use `apply codex-profile` or `apply integrations-profile` to create it)"));
        assert!(output.contains("user-skills: missing (run `export user-skills`)"));
        assert!(output.contains("repo-skills: disabled (optional repo export)"));
        assert!(output.contains("repo-agents: disabled (optional repo export)"));
        assert!(output.contains("global-agents: missing (run `export global-agents`)"));
        assert!(output.contains("hooks: missing (run `export hooks`)"));
        assert!(output.contains("custom-agents: missing (run `export custom-agents`)"));
    }

    #[test]
    fn codex_config_reports_current_settings_summary() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"model = "gpt-5.4"
model_reasoning_effort = "high"

[features]
codex_hooks = true

[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"

[mcp_servers.playwright]
command = "bunx"
args = ["@playwright/mcp@latest"]

[projects."/tmp/example"]
trust_level = "trusted"

[tui]
theme = "zenburn"

[plugins."superpowers@openai-curated"]
enabled = true
"#,
        )
        .unwrap();

        let output = run_with_home(&["codex-config"], project.path(), home.path()).unwrap();

        assert!(output.contains("codex-config: ok"));
        assert!(output.contains("model: gpt-5.4"));
        assert!(output.contains("reasoning: high"));
        assert!(output.contains("codex hooks: enabled"));
        assert!(output.contains("mcp servers: 2"));
        assert!(output.contains("mcp server names: context7, playwright"));
        assert!(output.contains("enabled plugins: 1"));
        assert!(output.contains("plugin names: superpowers@openai-curated"));
        assert!(output.contains("trusted projects: 1"));
        assert!(output.contains("tui theme: zenburn"));
    }

    #[test]
    fn backup_codex_config_copies_current_user_config() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            "model = \"gpt-5.4\"\nmodel_reasoning_effort = \"high\"\n",
        )
        .unwrap();

        let output =
            run_with_home(&["backup", "codex-config"], project.path(), home.path()).unwrap();
        let backup_dir = project
            .path()
            .join(".sane")
            .join("backups")
            .join("codex-config");
        let backups = std::fs::read_dir(&backup_dir)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .collect::<Vec<_>>();

        assert!(output.contains("codex-config backup: wrote"));
        assert_eq!(backups.len(), 1);
        let backup_body = std::fs::read_to_string(&backups[0]).unwrap();
        assert!(backup_body.contains("model = \"gpt-5.4\""));
    }

    #[test]
    fn preview_codex_profile_reports_core_recommendations() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"model = "gpt-5.3-codex"
model_reasoning_effort = "medium"

[features]
codex_hooks = false
"#,
        )
        .unwrap();

        let output =
            run_with_home(&["preview", "codex-profile"], project.path(), home.path()).unwrap();

        assert!(output.contains("codex-profile preview: 3 recommended change(s)"));
        assert!(output.contains("model: gpt-5.3-codex -> gpt-5.4"));
        assert!(output.contains("reasoning: medium -> high"));
        assert!(output.contains("codex hooks: disabled -> enabled"));
        assert!(output.contains("integrations stay outside bare core profile"));
    }

    #[test]
    fn preview_codex_profile_uses_detected_recommendations_when_available() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("models_cache.json"),
            r#"{
  "models": [
    {
      "slug": "gpt-5.4",
      "supported_reasoning_levels": [{ "effort": "high" }]
    },
    {
      "slug": "gpt-5.2-codex",
      "supported_reasoning_levels": [{ "effort": "xhigh" }]
    },
    {
      "slug": "gpt-5.4-mini",
      "supported_reasoning_levels": [{ "effort": "medium" }]
    }
  ]
}"#,
        )
        .unwrap();
        std::fs::write(
            codex_dir.join("auth.json"),
            r#"{ "chatgpt_plan_type": "prolite" }"#,
        )
        .unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"model = "gpt-5.3-codex"
model_reasoning_effort = "medium"

[features]
codex_hooks = false
"#,
        )
        .unwrap();

        let output =
            run_with_home(&["preview", "codex-profile"], project.path(), home.path()).unwrap();

        assert!(output.contains("model: gpt-5.3-codex -> gpt-5.4"));
        assert!(output.contains("reasoning: medium -> high"));
        assert!(output.contains("codex hooks: disabled -> enabled"));
    }

    #[test]
    fn preview_integrations_profile_reports_recommended_integrations_only() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"[mcp_servers.opensrc]
command = "bunx"
args = ["opensrc-mcp"]
"#,
        )
        .unwrap();

        let output = run_with_home(
            &["preview", "integrations-profile"],
            project.path(),
            home.path(),
        )
        .unwrap();

        assert!(output.contains("integrations-profile preview: 3 recommended change(s)"));
        assert!(output.contains("context7: missing -> recommended"));
        assert!(output.contains("playwright: missing -> recommended"));
        assert!(output.contains("grep.app: missing -> recommended"));
        assert!(
            output.contains("opensrc: installed but stays outside default recommended profile")
        );
    }

    #[test]
    fn apply_codex_profile_updates_only_core_keys_and_preserves_other_content() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"model = "gpt-5.3-codex"
model_reasoning_effort = "medium"

[features]
codex_hooks = false

[tui]
theme = "zenburn"

[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"
"#,
        )
        .unwrap();

        let output =
            run_with_home(&["apply", "codex-profile"], project.path(), home.path()).unwrap();
        let body = std::fs::read_to_string(codex_dir.join("config.toml")).unwrap();
        let backup_dir = project
            .path()
            .join(".sane")
            .join("backups")
            .join("codex-config");

        assert!(output.contains("codex-profile apply: wrote recommended core profile"));
        assert!(body.contains("model = \"gpt-5.4\""));
        assert!(body.contains("model_reasoning_effort = \"high\""));
        assert!(body.contains("codex_hooks = true"));
        assert!(body.contains("theme = \"zenburn\""));
        assert!(body.contains("[mcp_servers.context7]"));
        assert!(backup_dir.exists());
    }

    #[test]
    fn apply_codex_profile_uses_detected_recommendations_when_available() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("models_cache.json"),
            r#"{
  "models": [
    {
      "slug": "gpt-5.2",
      "supported_reasoning_levels": [{ "effort": "high" }]
    },
    {
      "slug": "gpt-5.3-codex-spark",
      "supported_reasoning_levels": [{ "effort": "medium" }]
    }
  ]
}"#,
        )
        .unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"model = "gpt-5.3-codex"
model_reasoning_effort = "medium"

[features]
codex_hooks = false
"#,
        )
        .unwrap();

        let _ = run_with_home(&["apply", "codex-profile"], project.path(), home.path()).unwrap();
        let body = std::fs::read_to_string(codex_dir.join("config.toml")).unwrap();

        assert!(body.contains("model = \"gpt-5.3-codex-spark\""));
        assert!(body.contains("model_reasoning_effort = \"medium\""));
        assert!(body.contains("codex_hooks = true"));
    }

    #[test]
    fn apply_integrations_profile_adds_only_recommended_entries() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"

[mcp_servers.opensrc]
command = "bunx"
args = ["opensrc-mcp"]
"#,
        )
        .unwrap();

        let output = run_with_home(
            &["apply", "integrations-profile"],
            project.path(),
            home.path(),
        )
        .unwrap();
        let body = std::fs::read_to_string(codex_dir.join("config.toml")).unwrap();
        let backup_dir = project
            .path()
            .join(".sane")
            .join("backups")
            .join("codex-config");

        assert!(output.contains("integrations-profile apply: wrote recommended integrations"));
        assert!(output.contains("applied keys: mcp_servers.playwright, mcp_servers.grep_app"));
        assert!(output.contains("opensrc left untouched"));
        assert!(body.contains("[mcp_servers.context7]"));
        assert!(body.contains("[mcp_servers.playwright]"));
        assert!(body.contains("command = \"npx\""));
        assert!(body.contains("\"@playwright/mcp@latest\""));
        assert!(body.contains("[mcp_servers.grep_app]"));
        assert!(body.contains("url = \"https://mcp.grep.app\""));
        assert!(body.contains("[mcp_servers.opensrc]"));
        assert!(backup_dir.exists());
    }

    #[test]
    fn apply_integrations_profile_noops_when_recommendations_already_exist() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"

[mcp_servers.playwright]
command = "npx"
args = ["@playwright/mcp@latest"]

[mcp_servers.grep_app]
url = "https://mcp.grep.app"
"#,
        )
        .unwrap();

        let output = run_with_home(
            &["apply", "integrations-profile"],
            project.path(),
            home.path(),
        )
        .unwrap();

        assert!(output.contains("integrations-profile apply: already satisfied"));
        assert!(output.contains("context7: keep installed"));
        assert!(output.contains("playwright: keep installed"));
        assert!(output.contains("grep.app: keep installed"));
    }

    #[test]
    fn preview_cloudflare_profile_reports_optional_provider_profile() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"
"#,
        )
        .unwrap();

        let output = run_with_home(
            &["preview", "cloudflare-profile"],
            project.path(),
            home.path(),
        )
        .unwrap();

        assert!(output.contains("cloudflare-profile preview: 1 recommended change(s)"));
        assert!(output.contains("cloudflare-api: missing -> optional provider profile"));
        assert!(output.contains("oauth and permissions stay explicit at connect time"));
    }

    #[test]
    fn apply_cloudflare_profile_adds_optional_provider_server_only() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        std::fs::write(
            codex_dir.join("config.toml"),
            r#"[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"
"#,
        )
        .unwrap();

        let output = run_with_home(
            &["apply", "cloudflare-profile"],
            project.path(),
            home.path(),
        )
        .unwrap();
        let body = std::fs::read_to_string(codex_dir.join("config.toml")).unwrap();

        assert!(output.contains("cloudflare-profile apply: wrote optional provider profile"));
        assert!(output.contains("applied keys: mcp_servers.cloudflare-api"));
        assert!(body.contains("[mcp_servers.context7]"));
        assert!(body.contains("[mcp_servers.cloudflare-api]"));
        assert!(body.contains("url = \"https://mcp.cloudflare.com/mcp\""));
    }

    #[test]
    fn restore_codex_config_restores_latest_backup() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let config_path = codex_dir.join("config.toml");
        std::fs::write(&config_path, "model = \"gpt-5.3-codex\"\n").unwrap();

        let _ = run_with_home(&["backup", "codex-config"], project.path(), home.path()).unwrap();
        std::fs::write(&config_path, "model = \"gpt-5.4\"\n").unwrap();

        let output =
            run_with_home(&["restore", "codex-config"], project.path(), home.path()).unwrap();
        let restored = std::fs::read_to_string(&config_path).unwrap();

        assert!(output.contains("codex-config restore: restored from"));
        assert!(restored.contains("model = \"gpt-5.3-codex\""));
    }

    #[test]
    fn export_all_reports_deduplicated_paths() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let output = run_with_home(&["export", "all"], project.path(), home.path()).unwrap();
        let paths_line = output
            .lines()
            .find(|line| line.starts_with("paths: "))
            .unwrap();
        let paths = paths_line
            .trim_start_matches("paths: ")
            .split(", ")
            .collect::<Vec<_>>();

        assert_eq!(paths.len(), 6);
    }

    #[test]
    fn export_hooks_installs_managed_session_start_hook() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let output = run_with_home(&["export", "hooks"], project.path(), home.path()).unwrap();
        let hooks_path = home.path().join(".codex").join("hooks.json");
        let body = std::fs::read_to_string(&hooks_path).unwrap();

        assert!(output.contains("export hooks"));
        assert!(body.contains("SessionStart"));
        assert!(body.contains("hook session-start"));
        assert!(body.contains("Loading Sane session defaults"));
    }

    #[test]
    fn export_custom_agents_installs_managed_agent_files() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let output =
            run_with_home(&["export", "custom-agents"], project.path(), home.path()).unwrap();
        let agents_dir = home.path().join(".codex").join("agents");
        let agent = std::fs::read_to_string(agents_dir.join("sane-agent.toml")).unwrap();
        let reviewer = std::fs::read_to_string(agents_dir.join("sane-reviewer.toml")).unwrap();
        let explorer = std::fs::read_to_string(agents_dir.join("sane-explorer.toml")).unwrap();

        assert!(output.contains("export custom-agents"));
        assert!(agent.contains("name = \"sane_agent\""));
        assert!(agent.contains("sandbox_mode = \"workspace-write\""));
        assert!(reviewer.contains("name = \"sane_reviewer\""));
        assert!(reviewer.contains("sandbox_mode = \"read-only\""));
        assert!(explorer.contains("name = \"sane_explorer\""));
    }

    #[test]
    fn uninstall_custom_agents_preserves_unrelated_agent_files() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let agents_dir = home.path().join(".codex").join("agents");
        std::fs::create_dir_all(&agents_dir).unwrap();
        std::fs::write(agents_dir.join("other-agent.toml"), "name = \"other\"\n").unwrap();

        let _ = run_with_home(&["export", "custom-agents"], project.path(), home.path()).unwrap();
        let output =
            run_with_home(&["uninstall", "custom-agents"], project.path(), home.path()).unwrap();

        assert!(output.contains("uninstall custom-agents"));
        assert!(agents_dir.join("other-agent.toml").exists());
        assert!(!agents_dir.join("sane-agent.toml").exists());
        assert!(!agents_dir.join("sane-reviewer.toml").exists());
        assert!(!agents_dir.join("sane-explorer.toml").exists());
    }

    #[test]
    fn uninstall_hooks_preserves_unrelated_entries() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();
        let codex_dir = home.path().join(".codex");
        std::fs::create_dir_all(&codex_dir).unwrap();
        std::fs::write(
            codex_dir.join("hooks.json"),
            r#"{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo existing"
          }
        ]
      }
    ]
  }
}
"#,
        )
        .unwrap();

        let _ = run_with_home(&["export", "hooks"], project.path(), home.path()).unwrap();
        let output = run_with_home(&["uninstall", "hooks"], project.path(), home.path()).unwrap();
        let body = std::fs::read_to_string(codex_dir.join("hooks.json")).unwrap();

        assert!(output.contains("uninstall hooks"));
        assert!(body.contains("\"Stop\""));
        assert!(body.contains("echo existing"));
        assert!(!body.contains("hook session-start"));
    }

    #[test]
    fn hook_session_start_emits_context_json() {
        let output =
            run_with_home(&["hook", "session-start"], Path::new("."), Path::new(".")).unwrap();

        assert!(output.contains("\"hookEventName\":\"SessionStart\""));
        assert!(output.contains("Sane active for this session"));
    }
}
