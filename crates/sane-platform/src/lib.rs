use std::path::{Path, PathBuf};

fn start_dir_for_discovery(start: &Path) -> PathBuf {
    if start.is_dir() {
        start.to_path_buf()
    } else {
        start
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."))
    }
}

fn is_project_root(candidate: &Path) -> bool {
    candidate.join("Cargo.toml").exists()
        || candidate.join(".git").exists()
        || candidate.join(".sane").exists()
}

fn resolve_home_dir(
    home: Option<&str>,
    userprofile: Option<&str>,
    homedrive: Option<&str>,
    homepath: Option<&str>,
) -> Option<PathBuf> {
    fn non_empty(value: Option<&str>) -> Option<&str> {
        value.filter(|value| !value.is_empty())
    }

    non_empty(home)
        .or_else(|| non_empty(userprofile))
        .map(PathBuf::from)
        .or_else(|| match (non_empty(homedrive), non_empty(homepath)) {
            (Some(drive), Some(path)) => Some(PathBuf::from(format!("{drive}{path}"))),
            _ => None,
        })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostPlatform {
    MacOs,
    Linux,
    Windows,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StateFile {
    Config,
    Summary,
    CurrentRun,
    Brief,
    Events,
    Decisions,
    Artifacts,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StateFileRef<'a> {
    pub file: StateFile,
    pub path: &'a Path,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectPaths {
    pub project_root: PathBuf,
    pub repo_agents_dir: PathBuf,
    pub repo_skills_dir: PathBuf,
    pub repo_agents_md: PathBuf,
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
    pub backups_dir: PathBuf,
    pub codex_config_backups_dir: PathBuf,
    pub logs_dir: PathBuf,
    pub sessions_dir: PathBuf,
    pub telemetry_dir: PathBuf,
    pub telemetry_summary_path: PathBuf,
    pub telemetry_events_path: PathBuf,
    pub telemetry_queue_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodexPaths {
    pub home_dir: PathBuf,
    pub codex_home: PathBuf,
    pub config_toml: PathBuf,
    pub models_cache_json: PathBuf,
    pub auth_json: PathBuf,
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
        let repo_agents_dir = project_root.join(".agents");
        let repo_skills_dir = repo_agents_dir.join("skills");
        let repo_agents_md = project_root.join("AGENTS.md");
        let runtime_root = project_root.join(".sane");
        let state_dir = runtime_root.join("state");
        let cache_dir = runtime_root.join("cache");
        let backups_dir = runtime_root.join("backups");
        let codex_config_backups_dir = backups_dir.join("codex-config");
        let logs_dir = runtime_root.join("logs");
        let sessions_dir = runtime_root.join("sessions");
        let telemetry_dir = runtime_root.join("telemetry");
        let telemetry_summary_path = telemetry_dir.join("summary.json");
        let telemetry_events_path = telemetry_dir.join("events.jsonl");
        let telemetry_queue_path = telemetry_dir.join("queue.jsonl");
        let current_run_path = state_dir.join("current-run.json");
        let summary_path = state_dir.join("summary.json");
        let events_path = state_dir.join("events.jsonl");
        let decisions_path = state_dir.join("decisions.jsonl");
        let artifacts_path = state_dir.join("artifacts.jsonl");
        let brief_path = runtime_root.join("BRIEF.md");

        Self {
            project_root,
            repo_agents_dir,
            repo_skills_dir,
            repo_agents_md,
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
            backups_dir,
            codex_config_backups_dir,
            logs_dir,
            sessions_dir,
            telemetry_dir,
            telemetry_summary_path,
            telemetry_events_path,
            telemetry_queue_path,
        }
    }

    pub fn discover(start: impl AsRef<Path>) -> std::io::Result<Self> {
        let start_dir = start_dir_for_discovery(start.as_ref());

        for candidate in start_dir.ancestors() {
            if is_project_root(candidate) {
                return Ok(Self::new(candidate));
            }
        }

        Ok(Self::new(start_dir))
    }

    pub fn ensure_runtime_dirs(&self) -> std::io::Result<()> {
        for dir in [
            &self.runtime_root,
            &self.state_dir,
            &self.cache_dir,
            &self.backups_dir,
            &self.codex_config_backups_dir,
            &self.logs_dir,
            &self.sessions_dir,
            &self.telemetry_dir,
        ] {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }

    pub fn state_file_path(&self, file: StateFile) -> &Path {
        match file {
            StateFile::Config => &self.config_path,
            StateFile::Summary => &self.summary_path,
            StateFile::CurrentRun => &self.current_run_path,
            StateFile::Brief => &self.brief_path,
            StateFile::Events => &self.events_path,
            StateFile::Decisions => &self.decisions_path,
            StateFile::Artifacts => &self.artifacts_path,
        }
    }

    pub fn canonical_state_load_order(&self) -> [StateFileRef<'_>; 4] {
        [
            StateFileRef {
                file: StateFile::Config,
                path: self.state_file_path(StateFile::Config),
            },
            StateFileRef {
                file: StateFile::Summary,
                path: self.state_file_path(StateFile::Summary),
            },
            StateFileRef {
                file: StateFile::CurrentRun,
                path: self.state_file_path(StateFile::CurrentRun),
            },
            StateFileRef {
                file: StateFile::Brief,
                path: self.state_file_path(StateFile::Brief),
            },
        ]
    }

    pub fn raw_state_history_files(&self) -> [StateFileRef<'_>; 3] {
        [
            StateFileRef {
                file: StateFile::Events,
                path: self.state_file_path(StateFile::Events),
            },
            StateFileRef {
                file: StateFile::Decisions,
                path: self.state_file_path(StateFile::Decisions),
            },
            StateFileRef {
                file: StateFile::Artifacts,
                path: self.state_file_path(StateFile::Artifacts),
            },
        ]
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
            config_toml: codex_home.join("config.toml"),
            models_cache_json: codex_home.join("models_cache.json"),
            auth_json: codex_home.join("auth.json"),
            user_agents_dir,
            user_skills_dir,
            custom_agents_dir,
            global_agents_md: codex_home.join("AGENTS.md"),
            hooks_json: codex_home.join("hooks.json"),
        }
    }

    pub fn discover() -> std::io::Result<Self> {
        let home = resolve_home_dir(
            std::env::var("HOME").ok().as_deref(),
            std::env::var("USERPROFILE").ok().as_deref(),
            std::env::var("HOMEDRIVE").ok().as_deref(),
            std::env::var("HOMEPATH").ok().as_deref(),
        )
        .ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "could not resolve HOME, USERPROFILE, or HOMEDRIVE/HOMEPATH",
            )
        })?;

        Ok(Self::new(home))
    }
}

#[cfg(test)]
mod tests {
    use super::resolve_home_dir;
    use std::path::PathBuf;

    #[test]
    fn resolve_home_dir_supports_home_drive_and_home_path_fallback() {
        let resolved = resolve_home_dir(None, None, Some("C:\\Users\\bjorn"), Some("\\profile"));

        assert_eq!(resolved, Some(PathBuf::from("C:\\Users\\bjorn\\profile")));
    }

    #[test]
    fn resolve_home_dir_prefers_home_over_other_sources() {
        let resolved = resolve_home_dir(
            Some("/Users/bjorn"),
            Some("/tmp/userprofile"),
            Some("C:\\Users\\bjorn"),
            Some("\\profile"),
        );

        assert_eq!(resolved, Some(PathBuf::from("/Users/bjorn")));
    }

    #[test]
    fn resolve_home_dir_skips_empty_values() {
        let resolved = resolve_home_dir(Some(""), Some("/Users/bjorn"), None, None);

        assert_eq!(resolved, Some(PathBuf::from("/Users/bjorn")));
    }
}
