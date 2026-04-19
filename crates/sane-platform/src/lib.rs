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
    pub cache_dir: PathBuf,
    pub logs_dir: PathBuf,
    pub sessions_dir: PathBuf,
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

        Self {
            project_root,
            runtime_root: runtime_root.clone(),
            config_path: runtime_root.join("config.local.toml"),
            state_dir,
            cache_dir,
            logs_dir,
            sessions_dir,
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
