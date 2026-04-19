use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostPlatform {
    MacOs,
    Linux,
    Windows,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectPaths {
    pub project_root: PathBuf,
    pub runtime_root: PathBuf,
    pub config_path: PathBuf,
    pub state_dir: PathBuf,
    pub current_run_path: PathBuf,
    pub summary_path: PathBuf,
    pub events_path: PathBuf,
    pub decisions_path: PathBuf,
    pub artifacts_path: PathBuf,
    pub brief_path: PathBuf,
    pub cache_dir: PathBuf,
    pub logs_dir: PathBuf,
    pub sessions_dir: PathBuf,
    pub telemetry_dir: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodexPaths {
    pub home_dir: PathBuf,
    pub codex_home: PathBuf,
    pub user_agents_dir: PathBuf,
    pub user_skills_dir: PathBuf,
    pub custom_agents_dir: PathBuf,
    pub global_agents_md: PathBuf,
    pub hooks_json: PathBuf,
}

pub fn detect_platform() -> HostPlatform {
    match std::env::consts::OS {
        "macos" => HostPlatform::MacOs,
        "windows" => HostPlatform::Windows,
        _ => HostPlatform::Linux,
    }
}

impl ProjectPaths {
    pub fn new(project_root: impl AsRef<Path>) -> Self {
        let project_root = project_root.as_ref().to_path_buf();
        let runtime_root = project_root.join(".sane");
        let state_dir = runtime_root.join("state");
        let cache_dir = runtime_root.join("cache");
        let logs_dir = runtime_root.join("logs");
        let sessions_dir = runtime_root.join("sessions");
        let telemetry_dir = runtime_root.join("telemetry");
        let current_run_path = state_dir.join("current-run.json");
        let summary_path = state_dir.join("summary.json");
        let events_path = state_dir.join("events.jsonl");
        let decisions_path = state_dir.join("decisions.jsonl");
        let artifacts_path = state_dir.join("artifacts.jsonl");
        let brief_path = runtime_root.join("BRIEF.md");

        Self {
            project_root,
            runtime_root: runtime_root.clone(),
            config_path: runtime_root.join("config.local.toml"),
            state_dir,
            current_run_path,
            summary_path,
            events_path,
            decisions_path,
            artifacts_path,
            brief_path,
            cache_dir,
            logs_dir,
            sessions_dir,
            telemetry_dir,
        }
    }

    pub fn discover(start: impl AsRef<Path>) -> std::io::Result<Self> {
        let start = start.as_ref();
        let start_dir = if start.is_dir() {
            start.to_path_buf()
        } else {
            start
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| PathBuf::from("."))
        };

        for candidate in start_dir.ancestors() {
            if candidate.join("Cargo.toml").exists()
                || candidate.join(".git").exists()
                || candidate.join(".sane").exists()
            {
                return Ok(Self::new(candidate));
            }
        }

        Ok(Self::new(start_dir))
    }

    pub fn ensure_runtime_dirs(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(&self.state_dir)?;
        std::fs::create_dir_all(&self.cache_dir)?;
        std::fs::create_dir_all(&self.logs_dir)?;
        std::fs::create_dir_all(&self.sessions_dir)?;
        Ok(())
    }
}

impl CodexPaths {
    pub fn new(home_dir: impl AsRef<Path>) -> Self {
        let home_dir = home_dir.as_ref().to_path_buf();
        let codex_home = home_dir.join(".codex");
        let user_agents_dir = home_dir.join(".agents");
        let user_skills_dir = user_agents_dir.join("skills");
        let custom_agents_dir = codex_home.join("agents");

        Self {
            home_dir,
            codex_home: codex_home.clone(),
            user_agents_dir,
            user_skills_dir,
            custom_agents_dir,
            global_agents_md: codex_home.join("AGENTS.md"),
            hooks_json: codex_home.join("hooks.json"),
        }
    }

    pub fn discover() -> std::io::Result<Self> {
        let home = std::env::var_os("HOME")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .map(PathBuf::from)
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "could not resolve HOME or USERPROFILE",
                )
            })?;

        Ok(Self::new(home))
    }
}
