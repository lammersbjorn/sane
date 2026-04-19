use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const AVAILABLE_MODELS: &[&str] = &[
    "gpt-5.4",
    "gpt-5.2-codex",
    "gpt-5.1-codex-max",
    "gpt-5.4-mini",
    "gpt-5.3-codex",
    "gpt-5.3-codex-spark",
    "gpt-5.2",
    "gpt-5.1-codex-mini",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LocalConfig {
    pub version: u32,
    #[serde(default)]
    pub models: ModelRolePresets,
    #[serde(default)]
    pub privacy: PrivacyConfig,
    #[serde(default)]
    pub packs: PackConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ModelRolePresets {
    pub coordinator: ModelPreset,
    pub sidecar: ModelPreset,
    pub verifier: ModelPreset,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PrivacyConfig {
    pub telemetry: TelemetryLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PackConfig {
    pub core: bool,
    #[serde(default)]
    pub caveman: bool,
    #[serde(default)]
    pub cavemem: bool,
    #[serde(default)]
    pub rtk: bool,
    #[serde(rename = "frontend-craft", default)]
    pub frontend_craft: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ModelPreset {
    pub model: String,
    pub reasoning_effort: ReasoningEffort,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ReasoningEffort {
    Low,
    Medium,
    High,
    #[serde(rename = "xhigh")]
    XHigh,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum TelemetryLevel {
    Off,
    LocalOnly,
    ProductImprovement,
}

impl ReasoningEffort {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
            Self::XHigh => "xhigh",
        }
    }

    pub fn display_str(self) -> &'static str {
        match self {
            Self::Low => "Low",
            Self::Medium => "Medium",
            Self::High => "High",
            Self::XHigh => "xhigh",
        }
    }

    pub const fn all() -> &'static [Self] {
        &[Self::Low, Self::Medium, Self::High, Self::XHigh]
    }
}

impl TelemetryLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::LocalOnly => "local-only",
            Self::ProductImprovement => "product-improvement",
        }
    }

    pub fn display_str(self) -> &'static str {
        match self {
            Self::Off => "Off",
            Self::LocalOnly => "Local Only",
            Self::ProductImprovement => "Product Improvement",
        }
    }

    pub const fn all() -> &'static [Self] {
        &[Self::Off, Self::LocalOnly, Self::ProductImprovement]
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
            privacy: PrivacyConfig::default(),
            packs: PackConfig::default(),
        }
    }
}

impl Default for PrivacyConfig {
    fn default() -> Self {
        Self {
            telemetry: TelemetryLevel::Off,
        }
    }
}

impl Default for PackConfig {
    fn default() -> Self {
        Self {
            core: true,
            caveman: false,
            cavemem: false,
            rtk: false,
            frontend_craft: false,
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
    #[error("invalid config at {path}: {message}")]
    Validate { path: String, message: String },
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

        let config: Self = toml::from_str(&raw).map_err(|source| LocalConfigError::Parse {
            path: path.display().to_string(),
            source,
        })?;
        config
            .validate()
            .map_err(|message| LocalConfigError::Validate {
                path: path.display().to_string(),
                message,
            })?;
        Ok(config)
    }

    pub fn write_to_path(&self, path: impl AsRef<Path>) -> Result<(), LocalConfigError> {
        let path = path.as_ref();
        self.validate()
            .map_err(|message| LocalConfigError::Validate {
                path: path.display().to_string(),
                message,
            })?;
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

    pub fn validate(&self) -> Result<(), String> {
        self.models.coordinator.validate("coordinator")?;
        self.models.sidecar.validate("sidecar")?;
        self.models.verifier.validate("verifier")?;
        self.privacy.validate()?;
        self.packs.validate()?;
        Ok(())
    }
}

impl ModelPreset {
    pub fn validate(&self, role: &str) -> Result<(), String> {
        if AVAILABLE_MODELS.contains(&self.model.as_str()) {
            Ok(())
        } else {
            Err(format!(
                "{role} model `{}` is not in the supported Codex model set",
                self.model
            ))
        }
    }
}

impl PrivacyConfig {
    pub fn validate(&self) -> Result<(), String> {
        match self.telemetry {
            TelemetryLevel::Off
            | TelemetryLevel::LocalOnly
            | TelemetryLevel::ProductImprovement => Ok(()),
        }
    }
}

impl PackConfig {
    pub fn enabled_names(&self) -> Vec<&'static str> {
        let mut enabled = vec![];
        if self.core {
            enabled.push("core");
        }
        if self.caveman {
            enabled.push("caveman");
        }
        if self.cavemem {
            enabled.push("cavemem");
        }
        if self.rtk {
            enabled.push("rtk");
        }
        if self.frontend_craft {
            enabled.push("frontend-craft");
        }
        enabled
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.core {
            Ok(())
        } else {
            Err("core pack must stay enabled".to_string())
        }
    }
}
