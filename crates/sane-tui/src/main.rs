use std::env;
use std::fs;
use std::path::Path;
use std::process::ExitCode;

use sane_config::LocalConfig;
use sane_core::{
    NAME, SANE_GLOBAL_AGENTS_BEGIN, SANE_GLOBAL_AGENTS_END, SANE_ROUTER_SKILL_NAME,
    sane_global_agents_overlay, sane_router_skill,
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
        Command::Install => install_runtime(&paths),
        Command::Config => show_config(&paths),
        Command::Doctor => doctor_runtime(&paths, &codex_paths),
        Command::Export => Ok("export: available targets: user-skills, global-agents".to_string()),
        Command::ExportUserSkills => export_user_skills(&codex_paths),
        Command::ExportGlobalAgents => export_global_agents(&codex_paths),
        Command::Uninstall => {
            Ok("uninstall: available targets: user-skills, global-agents".to_string())
        }
        Command::UninstallUserSkills => uninstall_user_skills(&codex_paths),
        Command::UninstallGlobalAgents => uninstall_global_agents(&codex_paths),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Command {
    Summary,
    Install,
    Config,
    Doctor,
    Export,
    ExportUserSkills,
    ExportGlobalAgents,
    Uninstall,
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
            (Some("export"), Some("user-skills")) => Ok(Self::ExportUserSkills),
            (Some("export"), Some("global-agents")) => Ok(Self::ExportGlobalAgents),
            (Some("export"), None) => Ok(Self::Export),
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

fn install_runtime(paths: &ProjectPaths) -> Result<String, String> {
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

    Ok(format!(
        "installed runtime at {}\nconfig: {}\nstate: {}",
        paths.runtime_root.display(),
        paths.config_path.display(),
        snapshot_path.display()
    ))
}

fn show_config(paths: &ProjectPaths) -> Result<String, String> {
    if !paths.config_path.exists() {
        return Ok(format!(
            "config: missing at {}",
            paths.config_path.display()
        ));
    }

    let config =
        LocalConfig::read_from_path(&paths.config_path).map_err(|error| error.to_string())?;
    Ok(format!(
        "config: ok at {}\nversion: {}\ncoordinator: {} ({})\nsidecar: {} ({})\nverifier: {} ({})",
        paths.config_path.display(),
        config.version,
        config.models.coordinator.model,
        config.models.coordinator.reasoning_effort.as_str(),
        config.models.sidecar.model,
        config.models.sidecar.reasoning_effort.as_str(),
        config.models.verifier.model,
        config.models.verifier.reasoning_effort.as_str()
    ))
}

fn doctor_runtime(paths: &ProjectPaths, codex_paths: &CodexPaths) -> Result<String, String> {
    let runtime_ok = paths.runtime_root.exists();
    let config_status = if !paths.config_path.exists() {
        "missing".to_string()
    } else if LocalConfig::read_from_path(&paths.config_path).is_ok() {
        "ok".to_string()
    } else {
        "invalid (rerun install)".to_string()
    };

    let snapshot_path = paths.state_dir.join("current-run.json");
    let state_status = if !paths.state_dir.exists() {
        "missing".to_string()
    } else if !snapshot_path.exists() {
        "missing current-run.json (rerun install)".to_string()
    } else if RunSnapshot::read_from_path(&snapshot_path).is_ok() {
        "ok".to_string()
    } else {
        "invalid current-run.json (rerun install)".to_string()
    };
    let user_skill_dir = codex_paths.user_skills_dir.join(SANE_ROUTER_SKILL_NAME);
    let user_skill_status = if user_skill_dir.join("SKILL.md").exists() {
        "installed".to_string()
    } else {
        "missing (run `export user-skills`)".to_string()
    };
    let global_agents_status = if !codex_paths.global_agents_md.exists() {
        "missing (run `export global-agents`)".to_string()
    } else {
        let body =
            fs::read_to_string(&codex_paths.global_agents_md).map_err(|error| error.to_string())?;
        if body.contains(SANE_GLOBAL_AGENTS_BEGIN) && body.contains(SANE_GLOBAL_AGENTS_END) {
            "installed".to_string()
        } else {
            "present without Sane block".to_string()
        }
    };

    Ok(format!(
        "runtime: {}\nconfig: {}\nstate: {}\nuser-skills: {}\nglobal-agents: {}\nroot: {}\ncodex-home: {}",
        if runtime_ok { "ok" } else { "missing" },
        config_status,
        state_status,
        user_skill_status,
        global_agents_status,
        paths.runtime_root.display(),
        codex_paths.codex_home.display()
    ))
}

fn export_user_skills(codex_paths: &CodexPaths) -> Result<String, String> {
    let skill_dir = codex_paths.user_skills_dir.join(SANE_ROUTER_SKILL_NAME);
    fs::create_dir_all(&skill_dir).map_err(|error| error.to_string())?;
    let skill_path = skill_dir.join("SKILL.md");
    fs::write(&skill_path, sane_router_skill()).map_err(|error| error.to_string())?;

    Ok(format!(
        "export user-skills: installed {}\npath: {}",
        SANE_ROUTER_SKILL_NAME,
        skill_path.display()
    ))
}

fn export_global_agents(codex_paths: &CodexPaths) -> Result<String, String> {
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

    Ok(format!(
        "export global-agents: installed managed block\npath: {}",
        codex_paths.global_agents_md.display()
    ))
}

fn uninstall_user_skills(codex_paths: &CodexPaths) -> Result<String, String> {
    let skill_dir = codex_paths.user_skills_dir.join(SANE_ROUTER_SKILL_NAME);

    if !skill_dir.exists() {
        return Ok(format!(
            "uninstall user-skills: {} not installed",
            SANE_ROUTER_SKILL_NAME
        ));
    }

    fs::remove_dir_all(&skill_dir).map_err(|error| error.to_string())?;
    Ok(format!(
        "uninstall user-skills: removed {}",
        SANE_ROUTER_SKILL_NAME
    ))
}

fn uninstall_global_agents(codex_paths: &CodexPaths) -> Result<String, String> {
    if !codex_paths.global_agents_md.exists() {
        return Ok("uninstall global-agents: not installed".to_string());
    }

    let existing =
        fs::read_to_string(&codex_paths.global_agents_md).map_err(|error| error.to_string())?;
    let updated = remove_managed_block(&existing, SANE_GLOBAL_AGENTS_BEGIN, SANE_GLOBAL_AGENTS_END);

    if updated == existing {
        return Ok("uninstall global-agents: not installed".to_string());
    }

    if updated.trim().is_empty() {
        fs::remove_file(&codex_paths.global_agents_md).map_err(|error| error.to_string())?;
    } else {
        fs::write(&codex_paths.global_agents_md, updated).map_err(|error| error.to_string())?;
    }

    Ok("uninstall global-agents: removed managed block".to_string())
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
