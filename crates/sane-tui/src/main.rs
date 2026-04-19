use std::env;
use std::fs;
use std::path::Path;
use std::process::ExitCode;

use sane_config::LocalConfig;
use sane_core::{
    InventoryItem, InventoryStatus, NAME, OperationKind, OperationResult, SANE_GLOBAL_AGENTS_BEGIN,
    SANE_GLOBAL_AGENTS_END, SANE_ROUTER_SKILL_NAME, sane_global_agents_overlay, sane_router_skill,
};
use sane_platform::{CodexPaths, ProjectPaths, detect_platform};
use sane_state::RunSnapshot;

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
        Command::Install => install_runtime(&paths).map(|result| result.render_text()),
        Command::Config => show_config(&paths).map(|result| result.render_text()),
        Command::Doctor => doctor_runtime(&paths, &codex_paths).map(|result| result.render_text()),
        Command::Export => {
            Ok("export: available targets: all, user-skills, global-agents".to_string())
        }
        Command::ExportAll => export_all(&codex_paths).map(|result| result.render_text()),
        Command::ExportUserSkills => {
            export_user_skills(&codex_paths).map(|result| result.render_text())
        }
        Command::ExportGlobalAgents => {
            export_global_agents(&codex_paths).map(|result| result.render_text())
        }
        Command::Uninstall => {
            Ok("uninstall: available targets: all, user-skills, global-agents".to_string())
        }
        Command::UninstallAll => uninstall_all(&codex_paths).map(|result| result.render_text()),
        Command::UninstallUserSkills => {
            uninstall_user_skills(&codex_paths).map(|result| result.render_text())
        }
        Command::UninstallGlobalAgents => {
            uninstall_global_agents(&codex_paths).map(|result| result.render_text())
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Command {
    Summary,
    Install,
    Config,
    Doctor,
    Export,
    ExportAll,
    ExportUserSkills,
    ExportGlobalAgents,
    Uninstall,
    UninstallAll,
    UninstallUserSkills,
    UninstallGlobalAgents,
}

impl Command {
    fn from_args(args: &[&str]) -> Result<Self, String> {
        match (args.first().copied(), args.get(1).copied()) {
            (None, _) => Ok(Self::Summary),
            (Some("install"), _) => Ok(Self::Install),
            (Some("config"), _) => Ok(Self::Config),
            (Some("doctor"), _) => Ok(Self::Doctor),
            (Some("export"), Some("all")) => Ok(Self::ExportAll),
            (Some("export"), Some("user-skills")) => Ok(Self::ExportUserSkills),
            (Some("export"), Some("global-agents")) => Ok(Self::ExportGlobalAgents),
            (Some("export"), None) => Ok(Self::Export),
            (Some("uninstall"), Some("all")) => Ok(Self::UninstallAll),
            (Some("uninstall"), Some("user-skills")) => Ok(Self::UninstallUserSkills),
            (Some("uninstall"), Some("global-agents")) => Ok(Self::UninstallGlobalAgents),
            (Some("uninstall"), None) => Ok(Self::Uninstall),
            (Some(other), _) => Err(format!("unknown command: {other}")),
        }
    }
}

fn render_summary() -> String {
    format!(
        "{NAME}\nplatform: {:?}\ncommands: install, config, export, uninstall, doctor",
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
            status: InventoryStatus::Installed,
            path: paths.config_path.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn doctor_runtime(
    paths: &ProjectPaths,
    codex_paths: &CodexPaths,
) -> Result<OperationResult, String> {
    let runtime_ok = paths.runtime_root.exists();
    let (config_status, config_inventory) = if !paths.config_path.exists() {
        (
            "missing".to_string(),
            InventoryItem {
                name: "config".to_string(),
                status: InventoryStatus::Missing,
                path: paths.config_path.display().to_string(),
                repair_hint: Some("run `install`".to_string()),
            },
        )
    } else if LocalConfig::read_from_path(&paths.config_path).is_ok() {
        (
            "ok".to_string(),
            InventoryItem {
                name: "config".to_string(),
                status: InventoryStatus::Installed,
                path: paths.config_path.display().to_string(),
                repair_hint: None,
            },
        )
    } else {
        (
            "invalid (rerun install)".to_string(),
            InventoryItem {
                name: "config".to_string(),
                status: InventoryStatus::Invalid,
                path: paths.config_path.display().to_string(),
                repair_hint: Some("rerun `install`".to_string()),
            },
        )
    };

    let snapshot_path = paths.state_dir.join("current-run.json");
    let (state_status, state_inventory) = if !paths.state_dir.exists() {
        (
            "missing".to_string(),
            InventoryItem {
                name: "state".to_string(),
                status: InventoryStatus::Missing,
                path: snapshot_path.display().to_string(),
                repair_hint: Some("run `install`".to_string()),
            },
        )
    } else if !snapshot_path.exists() {
        (
            "missing current-run.json (rerun install)".to_string(),
            InventoryItem {
                name: "state".to_string(),
                status: InventoryStatus::Missing,
                path: snapshot_path.display().to_string(),
                repair_hint: Some("rerun `install`".to_string()),
            },
        )
    } else if RunSnapshot::read_from_path(&snapshot_path).is_ok() {
        (
            "ok".to_string(),
            InventoryItem {
                name: "state".to_string(),
                status: InventoryStatus::Installed,
                path: snapshot_path.display().to_string(),
                repair_hint: None,
            },
        )
    } else {
        (
            "invalid current-run.json (rerun install)".to_string(),
            InventoryItem {
                name: "state".to_string(),
                status: InventoryStatus::Invalid,
                path: snapshot_path.display().to_string(),
                repair_hint: Some("rerun `install`".to_string()),
            },
        )
    };
    let user_skill_dir = codex_paths.user_skills_dir.join(SANE_ROUTER_SKILL_NAME);
    let user_skill_path = user_skill_dir.join("SKILL.md");
    let (user_skill_status, user_skill_inventory) = if user_skill_path.exists() {
        (
            "installed".to_string(),
            InventoryItem {
                name: "user-skills".to_string(),
                status: InventoryStatus::Installed,
                path: user_skill_path.display().to_string(),
                repair_hint: None,
            },
        )
    } else {
        (
            "missing (run `export user-skills`)".to_string(),
            InventoryItem {
                name: "user-skills".to_string(),
                status: InventoryStatus::Missing,
                path: user_skill_path.display().to_string(),
                repair_hint: Some("run `export user-skills`".to_string()),
            },
        )
    };
    let (global_agents_status, global_agents_inventory) = if !codex_paths.global_agents_md.exists()
    {
        (
            "missing (run `export global-agents`)".to_string(),
            InventoryItem {
                name: "global-agents".to_string(),
                status: InventoryStatus::Missing,
                path: codex_paths.global_agents_md.display().to_string(),
                repair_hint: Some("run `export global-agents`".to_string()),
            },
        )
    } else {
        let body =
            fs::read_to_string(&codex_paths.global_agents_md).map_err(|error| error.to_string())?;
        if body.contains(SANE_GLOBAL_AGENTS_BEGIN) && body.contains(SANE_GLOBAL_AGENTS_END) {
            (
                "installed".to_string(),
                InventoryItem {
                    name: "global-agents".to_string(),
                    status: InventoryStatus::Installed,
                    path: codex_paths.global_agents_md.display().to_string(),
                    repair_hint: None,
                },
            )
        } else {
            (
                "present without Sane block".to_string(),
                InventoryItem {
                    name: "global-agents".to_string(),
                    status: InventoryStatus::PresentWithoutSaneBlock,
                    path: codex_paths.global_agents_md.display().to_string(),
                    repair_hint: Some("run `export global-agents`".to_string()),
                },
            )
        }
    };

    Ok(OperationResult {
        kind: OperationKind::Doctor,
        summary: format!(
            "runtime: {}\nconfig: {}\nstate: {}\nuser-skills: {}\nglobal-agents: {}\nroot: {}\ncodex-home: {}",
            if runtime_ok { "ok" } else { "missing" },
            config_status,
            state_status,
            user_skill_status,
            global_agents_status,
            paths.runtime_root.display(),
            codex_paths.codex_home.display()
        ),
        details: vec![],
        paths_touched: vec![
            paths.runtime_root.display().to_string(),
            paths.config_path.display().to_string(),
            snapshot_path.display().to_string(),
            user_skill_path.display().to_string(),
            codex_paths.global_agents_md.display().to_string(),
        ],
        inventory: vec![
            InventoryItem {
                name: "runtime".to_string(),
                status: if runtime_ok {
                    InventoryStatus::Installed
                } else {
                    InventoryStatus::Missing
                },
                path: paths.runtime_root.display().to_string(),
                repair_hint: if runtime_ok {
                    None
                } else {
                    Some("run `install`".to_string())
                },
            },
            config_inventory,
            state_inventory,
            user_skill_inventory,
            global_agents_inventory,
        ],
    })
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
            status: InventoryStatus::Installed,
            path: skill_path.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn export_all(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let user_skills = export_user_skills(codex_paths)?;
    let global_agents = export_global_agents(codex_paths)?;

    Ok(merge_results(
        OperationKind::ExportAll,
        "export all: installed managed targets",
        vec![user_skills, global_agents],
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
            status: InventoryStatus::Removed,
            path: codex_paths.global_agents_md.display().to_string(),
            repair_hint: None,
        }],
    })
}

fn uninstall_all(codex_paths: &CodexPaths) -> Result<OperationResult, String> {
    let user_skills = uninstall_user_skills(codex_paths)?;
    let global_agents = uninstall_global_agents(codex_paths)?;

    Ok(merge_results(
        OperationKind::UninstallAll,
        "uninstall all: removed managed targets",
        vec![user_skills, global_agents],
    ))
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
        assert!(output.contains("export"));
        assert!(output.contains("uninstall"));
        assert!(output.contains("doctor"));
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
        assert!(
            home.path()
                .join(".agents")
                .join("skills")
                .join("sane-router")
                .join("SKILL.md")
                .exists()
        );
        assert!(home.path().join(".codex").join("AGENTS.md").exists());
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
    }

    #[test]
    fn doctor_reports_installed_managed_assets() {
        let project = tempdir().unwrap();
        let home = tempdir().unwrap();
        std::fs::write(project.path().join("Cargo.toml"), "[workspace]\n").unwrap();

        let _ = run_with_home(&["install"], project.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "user-skills"], project.path(), home.path()).unwrap();
        let _ = run_with_home(&["export", "global-agents"], project.path(), home.path()).unwrap();

        let output = run_with_home(&["doctor"], project.path(), home.path()).unwrap();

        assert!(output.contains("user-skills: installed"));
        assert!(output.contains("global-agents: installed"));
    }
}
