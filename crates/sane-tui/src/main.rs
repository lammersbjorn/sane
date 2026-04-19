use std::env;
use std::fs;
use std::path::Path;
use std::process::ExitCode;
use std::time::Duration;

use crossterm::event::{self, Event, KeyCode, KeyEventKind};
use crossterm::execute;
use crossterm::terminal::{
    EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode,
};
use ratatui::backend::CrosstermBackend;
use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Modifier, Style};
use ratatui::text::Line;
use ratatui::widgets::{Block, Borders, List, ListItem, ListState, Paragraph, Wrap};
use ratatui::{Frame, Terminal};
use sane_config::LocalConfig;
use sane_core::{
    InventoryItem, InventoryScope, InventoryStatus, NAME, OperationKind, OperationResult,
    SANE_EXPLORER_AGENT_NAME, SANE_GLOBAL_AGENTS_BEGIN, SANE_GLOBAL_AGENTS_END,
    SANE_REVIEWER_AGENT_NAME, SANE_ROUTER_SKILL_NAME, sane_explorer_agent,
    sane_global_agents_overlay, sane_reviewer_agent, sane_router_skill,
};
use sane_platform::{CodexPaths, ProjectPaths, detect_platform};
use sane_state::RunSnapshot;
use serde_json::{Map, Value, json};

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
        return match run_tui(&cwd, &codex_paths.home_dir) {
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

fn run_tui(cwd: &Path, home: &Path) -> Result<(), String> {
    let paths = ProjectPaths::discover(cwd).map_err(|error| error.to_string())?;
    let codex_paths = CodexPaths::new(home);
    let mut app = TuiApp::new(&paths, &codex_paths)?;

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

    match command {
        Command::Summary => Ok(render_summary()),
        Command::HookSessionStart => Ok(render_session_start_hook()),
        Command::Install
        | Command::Config
        | Command::Status
        | Command::Doctor
        | Command::ExportAll
        | Command::ExportUserSkills
        | Command::ExportGlobalAgents
        | Command::ExportHooks
        | Command::ExportCustomAgents
        | Command::UninstallAll
        | Command::UninstallUserSkills
        | Command::UninstallGlobalAgents
        | Command::UninstallHooks
        | Command::UninstallCustomAgents => execute_backend_command(command, &paths, &codex_paths)
            .map(|result| result.render_text()),
        Command::Export => Ok(
            "export: available targets: all, user-skills, global-agents, hooks, custom-agents"
                .to_string(),
        ),
        Command::Uninstall => Ok(
            "uninstall: available targets: all, user-skills, global-agents, hooks, custom-agents"
                .to_string(),
        ),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Command {
    Summary,
    Install,
    Config,
    Status,
    Doctor,
    HookSessionStart,
    Export,
    ExportAll,
    ExportUserSkills,
    ExportGlobalAgents,
    ExportHooks,
    ExportCustomAgents,
    Uninstall,
    UninstallAll,
    UninstallUserSkills,
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
            (Some("status"), _) => Ok(Self::Status),
            (Some("doctor"), _) => Ok(Self::Doctor),
            (Some("hook"), Some("session-start")) => Ok(Self::HookSessionStart),
            (Some("export"), Some("all")) => Ok(Self::ExportAll),
            (Some("export"), Some("user-skills")) => Ok(Self::ExportUserSkills),
            (Some("export"), Some("global-agents")) => Ok(Self::ExportGlobalAgents),
            (Some("export"), Some("hooks")) => Ok(Self::ExportHooks),
            (Some("export"), Some("custom-agents")) => Ok(Self::ExportCustomAgents),
            (Some("export"), None) => Ok(Self::Export),
            (Some("uninstall"), Some("all")) => Ok(Self::UninstallAll),
            (Some("uninstall"), Some("user-skills")) => Ok(Self::UninstallUserSkills),
            (Some("uninstall"), Some("global-agents")) => Ok(Self::UninstallGlobalAgents),
            (Some("uninstall"), Some("hooks")) => Ok(Self::UninstallHooks),
            (Some("uninstall"), Some("custom-agents")) => Ok(Self::UninstallCustomAgents),
            (Some("uninstall"), None) => Ok(Self::Uninstall),
            (Some(other), _) => Err(format!("unknown command: {other}")),
        }
    }
}

fn execute_backend_command(
    command: Command,
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    match command {
        Command::Install => install_runtime(paths),
        Command::Config => show_config(paths),
        Command::Status => inventory_status(paths, codex_paths),
        Command::Doctor => doctor_runtime(paths, codex_paths),
        Command::HookSessionStart => Err("hook event is not a backend operation".to_string()),
        Command::ExportAll => export_all(codex_paths),
        Command::ExportUserSkills => export_user_skills(codex_paths),
        Command::ExportGlobalAgents => export_global_agents(codex_paths),
        Command::ExportHooks => export_hooks(codex_paths),
        Command::ExportCustomAgents => export_custom_agents(codex_paths),
        Command::UninstallAll => uninstall_all(codex_paths),
        Command::UninstallUserSkills => uninstall_user_skills(codex_paths),
        Command::UninstallGlobalAgents => uninstall_global_agents(codex_paths),
        Command::UninstallHooks => uninstall_hooks(codex_paths),
        Command::UninstallCustomAgents => uninstall_custom_agents(codex_paths),
        Command::Summary | Command::Export | Command::Uninstall => {
            Err("backend command not executable".to_string())
        }
    }
}

#[derive(Clone, Copy)]
struct TuiAction {
    label: &'static str,
    command: Command,
}

impl TuiAction {
    const fn new(label: &'static str, command: Command) -> Self {
        Self { label, command }
    }
}

struct TuiApp {
    paths: ProjectPaths,
    codex_paths: CodexPaths,
    actions: Vec<TuiAction>,
    selected: usize,
    status: OperationResult,
    output: String,
}

impl TuiApp {
    fn new(paths: &ProjectPaths, codex_paths: &CodexPaths) -> Result<Self, String> {
        let status = inventory_status(paths, codex_paths)?;
        Ok(Self {
            paths: paths.clone(),
            codex_paths: codex_paths.clone(),
            actions: vec![
                TuiAction::new("Install runtime", Command::Install),
                TuiAction::new("Inspect config", Command::Config),
                TuiAction::new("Doctor", Command::Doctor),
                TuiAction::new("Export user skill", Command::ExportUserSkills),
                TuiAction::new("Export global agents", Command::ExportGlobalAgents),
                TuiAction::new("Export hooks", Command::ExportHooks),
                TuiAction::new("Export custom agents", Command::ExportCustomAgents),
                TuiAction::new("Export all", Command::ExportAll),
                TuiAction::new("Uninstall all", Command::UninstallAll),
            ],
            selected: 0,
            status,
            output: "Ready. Use arrows or j/k. Enter runs action. q quits.".to_string(),
        })
    }

    fn next(&mut self) {
        self.selected = (self.selected + 1) % self.actions.len();
    }

    fn previous(&mut self) {
        self.selected = if self.selected == 0 {
            self.actions.len() - 1
        } else {
            self.selected - 1
        };
    }

    fn run_selected(&mut self) {
        let action = self.actions[self.selected];
        match execute_backend_command(action.command, &self.paths, &self.codex_paths) {
            Ok(result) => {
                self.output = result.render_text();
                match inventory_status(&self.paths, &self.codex_paths) {
                    Ok(status) => self.status = status,
                    Err(error) => {
                        self.output
                            .push_str(&format!("\nstatus refresh failed: {error}"));
                    }
                }
            }
            Err(error) => {
                self.output = format!("action failed: {error}");
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

            match key.code {
                KeyCode::Char('q') | KeyCode::Esc => return Ok(()),
                KeyCode::Down | KeyCode::Char('j') => app.next(),
                KeyCode::Up | KeyCode::Char('k') => app.previous(),
                KeyCode::Enter | KeyCode::Char(' ') => app.run_selected(),
                _ => {}
            }
        }
    }
}

fn render_tui(frame: &mut Frame, app: &TuiApp) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(11),
            Constraint::Min(10),
        ])
        .split(frame.area());

    let header = Paragraph::new(vec![
        Line::from(NAME),
        Line::from("Installer/config TUI. Backend verbs stay escape hatch only."),
    ])
    .block(Block::default().borders(Borders::ALL).title("Home"))
    .wrap(Wrap { trim: true });
    frame.render_widget(header, chunks[0]);

    let status = Paragraph::new(status_lines(&app.status))
        .block(Block::default().borders(Borders::ALL).title("Status"))
        .wrap(Wrap { trim: false });
    frame.render_widget(status, chunks[1]);

    let main = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Length(28), Constraint::Min(20)])
        .split(chunks[2]);

    render_actions(frame, main[0], app);
    let output = Paragraph::new(app.output.as_str())
        .block(Block::default().borders(Borders::ALL).title("Output"))
        .wrap(Wrap { trim: false });
    frame.render_widget(output, main[1]);
}

fn render_actions(frame: &mut Frame, area: Rect, app: &TuiApp) {
    let items = app
        .actions
        .iter()
        .map(|action| ListItem::new(action.label))
        .collect::<Vec<_>>();
    let list = List::new(items)
        .block(Block::default().borders(Borders::ALL).title("Actions"))
        .highlight_style(Style::default().add_modifier(Modifier::REVERSED))
        .highlight_symbol("> ");
    let mut state = ListState::default().with_selected(Some(app.selected));
    frame.render_stateful_widget(list, area, &mut state);
}

fn status_lines(status: &OperationResult) -> Vec<Line<'static>> {
    let mut lines = Vec::new();

    for scope in [InventoryScope::LocalRuntime, InventoryScope::CodexNative] {
        let items = status
            .inventory
            .iter()
            .filter(|item| item.scope == scope)
            .collect::<Vec<_>>();
        if items.is_empty() {
            continue;
        }

        lines.push(Line::from(scope.display_str().to_uppercase()));
        for item in items {
            lines.push(Line::from(format!("  {}", inventory_detail_line(item))));
        }
    }

    lines
}

fn inventory_detail_line(item: &InventoryItem) -> String {
    let mut line = format!("{}: {}", item.name, inventory_status_label(item));
    if let Some(repair_hint) = &item.repair_hint {
        line.push_str(&format!(" ({repair_hint})"));
    }
    line
}

fn inventory_status_label(item: &InventoryItem) -> &'static str {
    item.status.display_str()
}

fn render_summary() -> String {
    format!(
        "{NAME}\nplatform: {:?}\ncommands: install, config, status, export, uninstall, doctor, hook",
        detect_platform()
    )
}

fn install_runtime(paths: &ProjectPaths) -> Result<OperationResult, String> {
    paths
        .ensure_runtime_dirs()
        .map_err(|error| error.to_string())?;

    if !paths.config_path.exists() {
        LocalConfig::default()
            .write_to_path(&paths.config_path)
            .map_err(|error| error.to_string())?;
    }

    let snapshot_path = paths.state_dir.join("current-run.json");
    if !snapshot_path.exists() {
        let snapshot = RunSnapshot {
            version: 1,
            objective: "initialize sane runtime".to_string(),
        };
        snapshot
            .write_to_path(&snapshot_path)
            .map_err(|error| error.to_string())?;
    }

    Ok(OperationResult {
        kind: OperationKind::InstallRuntime,
        summary: format!("installed runtime at {}", paths.runtime_root.display()),
        details: vec![
            format!("config: {}", paths.config_path.display()),
            format!("state: {}", snapshot_path.display()),
        ],
        paths_touched: vec![
            paths.runtime_root.display().to_string(),
            paths.config_path.display().to_string(),
            snapshot_path.display().to_string(),
        ],
        inventory: vec![],
    })
}

fn show_config(paths: &ProjectPaths) -> Result<OperationResult, String> {
    if !paths.config_path.exists() {
        return Ok(OperationResult {
            kind: OperationKind::ShowConfig,
            summary: format!("config: missing at {}", paths.config_path.display()),
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
        details: vec![
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
        ],
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

fn inventory_status(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    let inventory = inspect_inventory(paths, codex_paths)?;

    Ok(OperationResult {
        kind: OperationKind::ShowStatus,
        summary: format!("status: {} managed targets inspected", inventory.len()),
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
    let runtime = find_inventory(&inventory, "runtime");
    let config = find_inventory(&inventory, "config");
    let state = find_inventory(&inventory, "state");
    let user_skills = find_inventory(&inventory, "user-skills");
    let global_agents = find_inventory(&inventory, "global-agents");
    let hooks = find_inventory(&inventory, "hooks");
    let custom_agents = find_inventory(&inventory, "custom-agents");

    Ok(OperationResult {
        kind: OperationKind::Doctor,
        summary: format!(
            "runtime: {}\nconfig: {}\nstate: {}\nuser-skills: {}\nglobal-agents: {}\nhooks: {}\ncustom-agents: {}\nroot: {}\ncodex-home: {}",
            doctor_status(runtime),
            doctor_status(config),
            doctor_status(state),
            doctor_status(user_skills),
            doctor_status(global_agents),
            doctor_status(hooks),
            doctor_status(custom_agents),
            paths.runtime_root.display(),
            codex_paths.codex_home.display()
        ),
        details: vec![],
        paths_touched: collect_paths_touched(&inventory),
        inventory,
    })
}

fn inspect_inventory(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<Vec<InventoryItem>, String> {
    let snapshot_path = paths.state_dir.join("current-run.json");
    let user_skill_path = codex_paths
        .user_skills_dir
        .join(SANE_ROUTER_SKILL_NAME)
        .join("SKILL.md");
    let hooks_inventory = inspect_hooks_inventory(codex_paths)?;
    let custom_agents_inventory = inspect_custom_agents_inventory(codex_paths);

    let global_agents_inventory = if !codex_paths.global_agents_md.exists() {
        InventoryItem {
            name: "global-agents".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Missing,
            path: codex_paths.global_agents_md.display().to_string(),
            repair_hint: Some("run `export global-agents`".to_string()),
        }
    } else {
        let body =
            fs::read_to_string(&codex_paths.global_agents_md).map_err(|error| error.to_string())?;
        if body.contains(SANE_GLOBAL_AGENTS_BEGIN) && body.contains(SANE_GLOBAL_AGENTS_END) {
            InventoryItem {
                name: "global-agents".to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::Installed,
                path: codex_paths.global_agents_md.display().to_string(),
                repair_hint: None,
            }
        } else {
            InventoryItem {
                name: "global-agents".to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::PresentWithoutSaneBlock,
                path: codex_paths.global_agents_md.display().to_string(),
                repair_hint: Some("run `export global-agents`".to_string()),
            }
        }
    };

    Ok(vec![
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
            name: "state".to_string(),
            scope: InventoryScope::LocalRuntime,
            status: if !paths.state_dir.exists() || !snapshot_path.exists() {
                InventoryStatus::Missing
            } else if RunSnapshot::read_from_path(&snapshot_path).is_ok() {
                InventoryStatus::Installed
            } else {
                InventoryStatus::Invalid
            },
            path: snapshot_path.display().to_string(),
            repair_hint: if !paths.state_dir.exists() || !snapshot_path.exists() {
                Some("rerun `install`".to_string())
            } else if RunSnapshot::read_from_path(&snapshot_path).is_ok() {
                None
            } else {
                Some("rerun `install`".to_string())
            },
        },
        InventoryItem {
            name: "user-skills".to_string(),
            scope: InventoryScope::CodexNative,
            status: if user_skill_path.exists() {
                InventoryStatus::Installed
            } else {
                InventoryStatus::Missing
            },
            path: user_skill_path.display().to_string(),
            repair_hint: if user_skill_path.exists() {
                None
            } else {
                Some("run `export user-skills`".to_string())
            },
        },
        global_agents_inventory,
        hooks_inventory,
        custom_agents_inventory,
    ])
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
        "state" => match item.status {
            InventoryStatus::Installed => "ok".to_string(),
            InventoryStatus::Missing => "missing current-run.json (rerun install)".to_string(),
            InventoryStatus::Invalid => "invalid current-run.json (rerun install)".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "runtime" => match item.status {
            InventoryStatus::Installed => "ok".to_string(),
            InventoryStatus::Missing => "missing".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "user-skills" => match item.status {
            InventoryStatus::Installed => "installed".to_string(),
            InventoryStatus::Missing => "missing (run `export user-skills`)".to_string(),
            _ => item.status.as_str().to_string(),
        },
        "global-agents" => match item.status {
            InventoryStatus::Installed => "installed".to_string(),
            InventoryStatus::Missing => "missing (run `export global-agents`)".to_string(),
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

fn export_user_skills(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let skill_dir = codex_paths.user_skills_dir.join(SANE_ROUTER_SKILL_NAME);
    fs::create_dir_all(&skill_dir).map_err(|error| error.to_string())?;
    let skill_path = skill_dir.join("SKILL.md");
    fs::write(&skill_path, sane_router_skill()).map_err(|error| error.to_string())?;

    Ok(OperationResult {
        kind: OperationKind::ExportUserSkills,
        summary: format!("export user-skills: installed {}", SANE_ROUTER_SKILL_NAME),
        details: vec![format!("path: {}", skill_path.display())],
        paths_touched: vec![skill_path.display().to_string()],
        inventory: vec![InventoryItem {
            name: "user-skills".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: skill_path.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn export_all(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let user_skills = export_user_skills(codex_paths)?;
    let global_agents = export_global_agents(codex_paths)?;
    let hooks = export_hooks(codex_paths)?;
    let custom_agents = export_custom_agents(codex_paths)?;

    Ok(merge_results(
        OperationKind::ExportAll,
        "export all: installed managed targets",
        vec![user_skills, global_agents, hooks, custom_agents],
    ))
}

fn export_global_agents(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    if let Some(parent) = codex_paths.global_agents_md.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let existing = if codex_paths.global_agents_md.exists() {
        fs::read_to_string(&codex_paths.global_agents_md).map_err(|error| error.to_string())?
    } else {
        String::new()
    };

    let updated = upsert_managed_block(
        &existing,
        SANE_GLOBAL_AGENTS_BEGIN,
        SANE_GLOBAL_AGENTS_END,
        sane_global_agents_overlay(),
    );
    fs::write(&codex_paths.global_agents_md, updated).map_err(|error| error.to_string())?;

    Ok(OperationResult {
        kind: OperationKind::ExportGlobalAgents,
        summary: "export global-agents: installed managed block".to_string(),
        details: vec![format!("path: {}", codex_paths.global_agents_md.display())],
        paths_touched: vec![codex_paths.global_agents_md.display().to_string()],
        inventory: vec![InventoryItem {
            name: "global-agents".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: codex_paths.global_agents_md.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn uninstall_user_skills(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let skill_dir = codex_paths.user_skills_dir.join(SANE_ROUTER_SKILL_NAME);
    let skill_path = skill_dir.join("SKILL.md");

    if !skill_dir.exists() {
        return Ok(OperationResult {
            kind: OperationKind::UninstallUserSkills,
            summary: format!(
                "uninstall user-skills: {} not installed",
                SANE_ROUTER_SKILL_NAME
            ),
            details: vec![],
            paths_touched: vec![skill_path.display().to_string()],
            inventory: vec![InventoryItem {
                name: "user-skills".to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::Missing,
                path: skill_path.display().to_string(),
                repair_hint: None,
            }],
        });
    }

    fs::remove_dir_all(&skill_dir).map_err(|error| error.to_string())?;
    Ok(OperationResult {
        kind: OperationKind::UninstallUserSkills,
        summary: format!("uninstall user-skills: removed {}", SANE_ROUTER_SKILL_NAME),
        details: vec![],
        paths_touched: vec![skill_dir.display().to_string()],
        inventory: vec![InventoryItem {
            name: "user-skills".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Removed,
            path: skill_path.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn uninstall_global_agents(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    if !codex_paths.global_agents_md.exists() {
        return Ok(OperationResult {
            kind: OperationKind::UninstallGlobalAgents,
            summary: "uninstall global-agents: not installed".to_string(),
            details: vec![],
            paths_touched: vec![codex_paths.global_agents_md.display().to_string()],
            inventory: vec![InventoryItem {
                name: "global-agents".to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::Missing,
                path: codex_paths.global_agents_md.display().to_string(),
                repair_hint: None,
            }],
        });
    }

    let existing =
        fs::read_to_string(&codex_paths.global_agents_md).map_err(|error| error.to_string())?;
    let updated = remove_managed_block(&existing, SANE_GLOBAL_AGENTS_BEGIN, SANE_GLOBAL_AGENTS_END);

    if updated == existing {
        return Ok(OperationResult {
            kind: OperationKind::UninstallGlobalAgents,
            summary: "uninstall global-agents: not installed".to_string(),
            details: vec![],
            paths_touched: vec![codex_paths.global_agents_md.display().to_string()],
            inventory: vec![InventoryItem {
                name: "global-agents".to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::PresentWithoutSaneBlock,
                path: codex_paths.global_agents_md.display().to_string(),
                repair_hint: None,
            }],
        });
    }

    if updated.trim().is_empty() {
        fs::remove_file(&codex_paths.global_agents_md).map_err(|error| error.to_string())?;
    } else {
        fs::write(&codex_paths.global_agents_md, updated).map_err(|error| error.to_string())?;
    }

    Ok(OperationResult {
        kind: OperationKind::UninstallGlobalAgents,
        summary: "uninstall global-agents: removed managed block".to_string(),
        details: vec![],
        paths_touched: vec![codex_paths.global_agents_md.display().to_string()],
        inventory: vec![InventoryItem {
            name: "global-agents".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Removed,
            path: codex_paths.global_agents_md.display().to_string(),
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
        "uninstall all: removed managed targets",
        vec![user_skills, global_agents, hooks, custom_agents],
    ))
}

fn export_custom_agents(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    fs::create_dir_all(&codex_paths.custom_agents_dir).map_err(|error| error.to_string())?;
    let reviewer_path = codex_paths
        .custom_agents_dir
        .join(format!("{SANE_REVIEWER_AGENT_NAME}.toml"));
    let explorer_path = codex_paths
        .custom_agents_dir
        .join(format!("{SANE_EXPLORER_AGENT_NAME}.toml"));

    fs::write(&reviewer_path, sane_reviewer_agent()).map_err(|error| error.to_string())?;
    fs::write(&explorer_path, sane_explorer_agent()).map_err(|error| error.to_string())?;

    Ok(OperationResult {
        kind: OperationKind::ExportCustomAgents,
        summary: "export custom-agents: installed managed agent files".to_string(),
        details: vec![
            format!("path: {}", reviewer_path.display()),
            format!("path: {}", explorer_path.display()),
        ],
        paths_touched: vec![
            reviewer_path.display().to_string(),
            explorer_path.display().to_string(),
        ],
        inventory: vec![InventoryItem {
            name: "custom-agents".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Installed,
            path: codex_paths.custom_agents_dir.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn uninstall_custom_agents(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let reviewer_path = codex_paths
        .custom_agents_dir
        .join(format!("{SANE_REVIEWER_AGENT_NAME}.toml"));
    let explorer_path = codex_paths
        .custom_agents_dir
        .join(format!("{SANE_EXPLORER_AGENT_NAME}.toml"));
    let managed_paths = [&reviewer_path, &explorer_path];

    let had_any = managed_paths.iter().any(|path| path.exists());
    if !had_any {
        return Ok(OperationResult {
            kind: OperationKind::UninstallCustomAgents,
            summary: "uninstall custom-agents: not installed".to_string(),
            details: vec![],
            paths_touched: vec![codex_paths.custom_agents_dir.display().to_string()],
            inventory: vec![InventoryItem {
                name: "custom-agents".to_string(),
                scope: InventoryScope::CodexNative,
                status: InventoryStatus::Missing,
                path: codex_paths.custom_agents_dir.display().to_string(),
                repair_hint: None,
            }],
        });
    }

    for path in managed_paths {
        if path.exists() {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }

    if codex_paths.custom_agents_dir.exists()
        && fs::read_dir(&codex_paths.custom_agents_dir)
            .map_err(|error| error.to_string())?
            .next()
            .is_none()
    {
        fs::remove_dir(&codex_paths.custom_agents_dir).map_err(|error| error.to_string())?;
    }

    Ok(OperationResult {
        kind: OperationKind::UninstallCustomAgents,
        summary: "uninstall custom-agents: removed managed agent files".to_string(),
        details: vec![],
        paths_touched: vec![
            reviewer_path.display().to_string(),
            explorer_path.display().to_string(),
        ],
        inventory: vec![InventoryItem {
            name: "custom-agents".to_string(),
            scope: InventoryScope::CodexNative,
            status: InventoryStatus::Removed,
            path: codex_paths.custom_agents_dir.display().to_string(),
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

fn inspect_custom_agents_inventory(codex_paths: &CodexPaths) -> InventoryItem {
    let reviewer_path = codex_paths
        .custom_agents_dir
        .join(format!("{SANE_REVIEWER_AGENT_NAME}.toml"));
    let explorer_path = codex_paths
        .custom_agents_dir
        .join(format!("{SANE_EXPLORER_AGENT_NAME}.toml"));
    let reviewer_exists = reviewer_path.exists();
    let explorer_exists = explorer_path.exists();

    let status = match (reviewer_exists, explorer_exists) {
        (true, true) => InventoryStatus::Installed,
        (false, false) => InventoryStatus::Missing,
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
    }

    #[test]
    fn config_reports_missing_before_install() {
        let dir = tempdir().unwrap();
        let output = run(&["config"], dir.path()).unwrap();

        assert!(output.contains("missing"));
        assert!(output.contains(".sane/config.local.toml"));
    }

    #[test]
    fn doctor_reports_runtime_status() {
        let dir = tempdir().unwrap();
        let home = tempdir().unwrap();
        let _ = run_with_home(&["install"], dir.path(), home.path()).unwrap();
        let output = run_with_home(&["doctor"], dir.path(), home.path()).unwrap();

        assert!(output.contains("runtime: ok"));
        assert!(output.contains("config: ok"));
        assert!(output.contains("state: ok"));
        assert!(output.contains("user-skills: missing"));
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

        assert!(output.contains("state: missing current-run.json"));
        assert!(output.contains("rerun install"));
    }

    #[test]
    fn summary_lists_commands() {
        let output = run(&[], Path::new(".")).unwrap();

        assert!(output.contains("install"));
        assert!(output.contains("config"));
        assert!(output.contains("status"));
        assert!(output.contains("export"));
        assert!(output.contains("uninstall"));
        assert!(output.contains("doctor"));
        assert!(output.contains("hook"));
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

        let _ = run_with_home(&["export", "user-skills"], project.path(), home.path()).unwrap();
        let output =
            run_with_home(&["uninstall", "user-skills"], project.path(), home.path()).unwrap();

        let skill_path = home
            .path()
            .join(".agents")
            .join("skills")
            .join("sane-router");

        assert!(output.contains("uninstall user-skills"));
        assert!(!skill_path.exists());
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

        let app = super::TuiApp::new(&paths, &codex_paths).unwrap();
        let labels = app
            .actions
            .iter()
            .map(|action| action.label)
            .collect::<Vec<_>>();

        assert_eq!(
            labels,
            vec![
                "Install runtime",
                "Inspect config",
                "Doctor",
                "Export user skill",
                "Export global agents",
                "Export hooks",
                "Export custom agents",
                "Export all",
                "Uninstall all",
            ]
        );
    }

    #[test]
    fn status_reports_all_managed_targets() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let _ = run_with_home(&["install"], project.path(), home.path()).unwrap();
        let output = run_with_home(&["status"], project.path(), home.path()).unwrap();

        assert!(output.contains("status: 7 managed targets inspected"));
        assert!(output.contains("local runtime:"));
        assert!(output.contains("codex-native:"));
        assert!(output.contains("runtime: installed"));
        assert!(output.contains("config: installed"));
        assert!(output.contains("state: installed"));
        assert!(output.contains("user-skills: missing (run `export user-skills`)"));
        assert!(output.contains("global-agents: missing (run `export global-agents`)"));
        assert!(output.contains("hooks: missing (run `export hooks`)"));
        assert!(output.contains("custom-agents: missing (run `export custom-agents`)"));
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

        assert_eq!(paths.len(), 5);
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
        let reviewer = std::fs::read_to_string(agents_dir.join("sane-reviewer.toml")).unwrap();
        let explorer = std::fs::read_to_string(agents_dir.join("sane-explorer.toml")).unwrap();

        assert!(output.contains("export custom-agents"));
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
