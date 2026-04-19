use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LocalConfig {
    pub version: u32,
    #[serde(default)]
    pub models: ModelRolePresets,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ModelRolePresets {
    pub coordinator: ModelPreset,
    pub sidecar: ModelPreset,
    pub verifier: ModelPreset,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ModelPreset {
    pub model: String,
    pub reasoning_effort: ReasoningEffort,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ReasoningEffort {
    Minimal,
    Low,
    Medium,
    High,
}

impl ReasoningEffort {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Minimal => "minimal",
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
        }
    }
}

impl Default for ModelRolePresets {
    fn default() -> Self {
        Self {
            coordinator: ModelPreset {
                model: "gpt-5.4".to_string(),
                reasoning_effort: ReasoningEffort::High,
            },
            sidecar: ModelPreset {
                model: "gpt-5.4-mini".to_string(),
                reasoning_effort: ReasoningEffort::Medium,
            },
            verifier: ModelPreset {
                model: "gpt-5.4".to_string(),
                reasoning_effort: ReasoningEffort::Medium,
            },
        }
    }
}

impl Default for LocalConfig {
    fn default() -> Self {
        Self {
            version: 1,
            models: ModelRolePresets::default(),
        }
    }
}

#[derive(Debug, Error)]
pub enum LocalConfigError {
    #[error("failed to read config from {path}: {source}")]
    Read {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to write config to {path}: {source}")]
    Write {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to parse config from {path}: {source}")]
    Parse {
        path: String,
        #[source]
        source: toml::de::Error,
    },
    #[error("failed to encode config to toml: {0}")]
    Encode(#[from] toml::ser::Error),
}

impl LocalConfig {
    pub fn read_from_path(path: impl AsRef<Path>) -> Result<Self, LocalConfigError> {
        let path = path.as_ref();
        let raw = fs::read_to_string(path).map_err(|source| LocalConfigError::Read {
            path: path.display().to_string(),
            source,
        })?;

        toml::from_str(&raw).map_err(|source| LocalConfigError::Parse {
            path: path.display().to_string(),
            source,
        })
    }

    pub fn write_to_path(&self, path: impl AsRef<Path>) -> Result<(), LocalConfigError> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|source| LocalConfigError::Write {
                path: parent.display().to_string(),
                source,
            })?;
        }

        let encoded = toml::to_string(self)?;
        fs::write(path, encoded).map_err(|source| LocalConfigError::Write {
            path: path.display().to_string(),
            source,
        })
    }
}
