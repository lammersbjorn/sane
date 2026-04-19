use std::env;
use std::path::Path;
use std::process::ExitCode;

use sane_config::LocalConfig;
use sane_core::NAME;
use sane_platform::{ProjectPaths, detect_platform};
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

    match run(&args.iter().map(String::as_str).collect::<Vec<_>>(), &cwd) {
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

fn run(args: &[&str], cwd: &Path) -> Result<String, String> {
    let command = Command::from_args(args)?;
    let paths = ProjectPaths::discover(cwd).map_err(|error| error.to_string())?;

    match command {
        Command::Summary => Ok(render_summary()),
        Command::Install => install_runtime(&paths),
        Command::Config => show_config(&paths),
        Command::Doctor => doctor_runtime(&paths),
        Command::Export => Ok("export: not implemented yet".to_string()),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Command {
    Summary,
    Install,
    Config,
    Doctor,
    Export,
}

impl Command {
    fn from_args(args: &[&str]) -> Result<Self, String> {
        match args.first().copied() {
            None => Ok(Self::Summary),
            Some("install") => Ok(Self::Install),
            Some("config") => Ok(Self::Config),
            Some("doctor") => Ok(Self::Doctor),
            Some("export") => Ok(Self::Export),
            Some(other) => Err(format!("unknown command: {other}")),
        }
    }
}

fn render_summary() -> String {
    format!(
        "{NAME}\nplatform: {:?}\ncommands: install, config, export, doctor",
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

fn doctor_runtime(paths: &ProjectPaths) -> Result<String, String> {
    let runtime_ok = paths.runtime_root.exists();
    let config_ok = paths.config_path.exists();
    let state_ok = paths.state_dir.exists();

    Ok(format!(
        "runtime: {}\nconfig: {}\nstate: {}\nroot: {}",
        if runtime_ok { "ok" } else { "missing" },
        if config_ok { "ok" } else { "missing" },
        if state_ok { "ok" } else { "missing" },
        paths.runtime_root.display()
    ))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use tempfile::tempdir;

    use super::run;

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
        let _ = run(&["install"], dir.path()).unwrap();
        let output = run(&["doctor"], dir.path()).unwrap();

        assert!(output.contains("runtime: ok"));
        assert!(output.contains("config: ok"));
        assert!(output.contains("state: ok"));
    }

    #[test]
    fn summary_lists_commands() {
        let output = run(&[], Path::new(".")).unwrap();

        assert!(output.contains("install"));
        assert!(output.contains("config"));
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
}
