use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;
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

const COORDINATOR_PRIORITY: &[&str] = &[
    "gpt-5.4",
    "gpt-5.2",
    "gpt-5.2-codex",
    "gpt-5.1-codex-max",
    "gpt-5.3-codex",
    "gpt-5.4-mini",
    "gpt-5.3-codex-spark",
    "gpt-5.1-codex-mini",
];

const SIDECAR_PRIORITY: &[&str] = &[
    "gpt-5.4-mini",
    "gpt-5.3-codex-spark",
    "gpt-5.1-codex-mini",
    "gpt-5.3-codex",
    "gpt-5.2-codex",
    "gpt-5.2",
    "gpt-5.4",
    "gpt-5.1-codex-max",
];

const VERIFIER_PRIORITY: &[&str] = &[
    "gpt-5.2-codex",
    "gpt-5.1-codex-max",
    "gpt-5.4",
    "gpt-5.2",
    "gpt-5.3-codex",
    "gpt-5.4-mini",
    "gpt-5.3-codex-spark",
    "gpt-5.1-codex-mini",
];

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CodexEnvironment {
    pub plan_type: Option<String>,
    pub available_models: Vec<AvailableModel>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AvailableModel {
    pub slug: String,
    pub reasoning_efforts: Vec<ReasoningEffort>,
}

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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
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

    pub fn from_api_str(value: &str) -> Option<Self> {
        let value = value.to_ascii_lowercase();
        match value.as_str() {
            "low" => Some(Self::Low),
            "medium" => Some(Self::Medium),
            "high" => Some(Self::High),
            "xhigh" => Some(Self::XHigh),
            _ => None,
        }
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

impl LocalConfig {
    pub fn recommended_for_environment(environment: &CodexEnvironment) -> Self {
        Self {
            version: 1,
            models: ModelRolePresets::recommended_for_environment(environment),
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

impl CodexEnvironment {
    pub fn detect(
        models_cache_path: impl AsRef<Path>,
        auth_path: impl AsRef<Path>,
    ) -> Result<Self, CodexEnvironmentError> {
        Ok(Self {
            plan_type: detect_plan_type(auth_path.as_ref())?,
            available_models: detect_available_models(models_cache_path.as_ref())?,
        })
    }
}

impl ModelRolePresets {
    pub fn recommended_for_environment(environment: &CodexEnvironment) -> Self {
        if environment.available_models.is_empty() {
            return Self::default();
        }

        let premium_plan = environment
            .plan_type
            .as_deref()
            .is_some_and(is_premium_plan_type);

        let coordinator = pick_model_preset(
            &environment.available_models,
            COORDINATOR_PRIORITY,
            &[
                ReasoningEffort::High,
                ReasoningEffort::Medium,
                ReasoningEffort::Low,
            ],
        )
        .unwrap_or_else(|| {
            select_available_model_preset(
                &environment.available_models,
                true,
                &[
                    ReasoningEffort::High,
                    ReasoningEffort::Medium,
                    ReasoningEffort::Low,
                ],
            )
            .expect("non-empty available model list")
        });

        let sidecar = pick_model_preset(
            &environment.available_models,
            SIDECAR_PRIORITY,
            &[
                ReasoningEffort::Medium,
                ReasoningEffort::Low,
                ReasoningEffort::High,
            ],
        )
        .unwrap_or_else(|| {
            select_available_model_preset(
                &environment.available_models,
                false,
                &[
                    ReasoningEffort::Medium,
                    ReasoningEffort::Low,
                    ReasoningEffort::High,
                ],
            )
            .expect("non-empty available model list")
        });

        let verifier = pick_model_preset(
            &environment.available_models,
            VERIFIER_PRIORITY,
            if premium_plan {
                &[
                    ReasoningEffort::XHigh,
                    ReasoningEffort::High,
                    ReasoningEffort::Medium,
                    ReasoningEffort::Low,
                ]
            } else {
                &[
                    ReasoningEffort::High,
                    ReasoningEffort::Medium,
                    ReasoningEffort::Low,
                    ReasoningEffort::XHigh,
                ]
            },
        )
        .unwrap_or_else(|| {
            select_available_model_preset(
                &environment.available_models,
                true,
                if premium_plan {
                    &[
                        ReasoningEffort::XHigh,
                        ReasoningEffort::High,
                        ReasoningEffort::Medium,
                        ReasoningEffort::Low,
                    ]
                } else {
                    &[
                        ReasoningEffort::High,
                        ReasoningEffort::Medium,
                        ReasoningEffort::Low,
                    ]
                },
            )
            .expect("non-empty available model list")
        });

        Self {
            coordinator,
            sidecar,
            verifier,
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
pub enum CodexEnvironmentError {
    #[error("failed to read models cache from {path}: {source}")]
    ReadModelsCache {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to parse models cache from {path}: {source}")]
    ParseModelsCache {
        path: String,
        #[source]
        source: serde_json::Error,
    },
    #[error("failed to read auth file from {path}: {source}")]
    ReadAuth {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to parse auth file from {path}: {source}")]
    ParseAuth {
        path: String,
        #[source]
        source: serde_json::Error,
    },
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

pub fn detect_available_models_from_json(json: &Value) -> Vec<AvailableModel> {
    let models = json
        .get("models")
        .and_then(Value::as_array)
        .or_else(|| json.as_array())
        .cloned()
        .unwrap_or_default();

    let mut detected = vec![];
    for (index, entry) in models.into_iter().enumerate() {
        let Some(slug) = entry
            .get("slug")
            .and_then(Value::as_str)
            .or_else(|| entry.get("id").and_then(Value::as_str))
            .or_else(|| entry.get("name").and_then(Value::as_str))
        else {
            continue;
        };

        if !AVAILABLE_MODELS.contains(&slug) {
            continue;
        }

        let mut reasoning = BTreeSet::new();
        collect_reasoning_efforts(entry.get("supported_reasoning_levels"), &mut reasoning);
        collect_reasoning_efforts(entry.get("supported_reasoning_efforts"), &mut reasoning);
        collect_reasoning_efforts(entry.get("reasoning_efforts"), &mut reasoning);
        if reasoning.is_empty()
            && let Some(default_level) = entry
                .get("default_reasoning_level")
                .and_then(Value::as_str)
                .and_then(ReasoningEffort::from_api_str)
        {
            reasoning.insert(default_level);
        }
        if reasoning.is_empty() {
            reasoning.insert(ReasoningEffort::Medium);
        }

        let priority = entry
            .get("priority")
            .and_then(parse_model_priority)
            .unwrap_or(u64::MAX);

        detected.push(DetectedModel {
            slug: slug.to_string(),
            reasoning_efforts: ReasoningEffort::all()
                .iter()
                .copied()
                .filter(|candidate| reasoning.contains(candidate))
                .collect(),
            priority,
            index,
        });
    }

    detected.sort_by(|left, right| {
        left.priority
            .cmp(&right.priority)
            .then(left.index.cmp(&right.index))
            .then(left.slug.cmp(&right.slug))
    });
    detected.dedup_by(|left, right| left.slug == right.slug);

    detected
        .into_iter()
        .map(|model| AvailableModel {
            slug: model.slug,
            reasoning_efforts: model.reasoning_efforts,
        })
        .collect()
}

fn detect_available_models(path: &Path) -> Result<Vec<AvailableModel>, CodexEnvironmentError> {
    if !path.exists() {
        return Ok(vec![]);
    }

    let raw =
        fs::read_to_string(path).map_err(|source| CodexEnvironmentError::ReadModelsCache {
            path: path.display().to_string(),
            source,
        })?;
    let json: Value =
        serde_json::from_str(&raw).map_err(|source| CodexEnvironmentError::ParseModelsCache {
            path: path.display().to_string(),
            source,
        })?;

    Ok(detect_available_models_from_json(&json))
}

pub fn detect_plan_type_from_json(json: &Value) -> Option<String> {
    detect_plan_type_in_object(json).or_else(|| {
        json.get("https://api.openai.com/auth")
            .and_then(detect_plan_type_in_object)
    })
}

fn detect_plan_type(path: &Path) -> Result<Option<String>, CodexEnvironmentError> {
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(path).map_err(|source| CodexEnvironmentError::ReadAuth {
        path: path.display().to_string(),
        source,
    })?;
    let json: Value =
        serde_json::from_str(&raw).map_err(|source| CodexEnvironmentError::ParseAuth {
            path: path.display().to_string(),
            source,
        })?;

    Ok(detect_plan_type_from_json(&json))
}

fn pick_model_preset(
    available_models: &[AvailableModel],
    priority: &[&str],
    reasoning_priority: &[ReasoningEffort],
) -> Option<ModelPreset> {
    priority.iter().find_map(|slug| {
        let model = available_models.iter().find(|model| model.slug == *slug)?;
        let reasoning_effort = reasoning_priority
            .iter()
            .copied()
            .find(|candidate| model.reasoning_efforts.contains(candidate))
            .or_else(|| model.reasoning_efforts.first().copied())?;

        Some(ModelPreset {
            model: model.slug.clone(),
            reasoning_effort,
        })
    })
}

fn select_available_model_preset(
    available_models: &[AvailableModel],
    strongest: bool,
    reasoning_priority: &[ReasoningEffort],
) -> Option<ModelPreset> {
    let model = if strongest {
        available_models.first()?
    } else {
        available_models.last()?
    };

    let reasoning_effort = reasoning_priority
        .iter()
        .copied()
        .find(|candidate| model.reasoning_efforts.contains(candidate))
        .or_else(|| model.reasoning_efforts.first().copied())?;

    Some(ModelPreset {
        model: model.slug.clone(),
        reasoning_effort,
    })
}

fn collect_reasoning_efforts(value: Option<&Value>, reasoning: &mut BTreeSet<ReasoningEffort>) {
    let Some(levels) = value.and_then(Value::as_array) else {
        return;
    };

    for level in levels {
        let effort = level
            .get("effort")
            .and_then(Value::as_str)
            .or_else(|| level.get("reasoning_effort").and_then(Value::as_str))
            .or_else(|| level.as_str());
        if let Some(effort) = effort
            && let Some(reasoning_effort) = ReasoningEffort::from_api_str(effort)
        {
            reasoning.insert(reasoning_effort);
        }
    }
}

fn parse_model_priority(value: &Value) -> Option<u64> {
    value
        .as_u64()
        .or_else(|| value.as_i64().map(|priority| priority.max(0) as u64))
        .or_else(|| value.as_str().and_then(|priority| priority.parse().ok()))
}

fn detect_plan_type_in_object(value: &Value) -> Option<String> {
    if let Some(plan_type) = value
        .get("chatgpt_plan_type")
        .and_then(Value::as_str)
        .or_else(|| value.get("plan_type").and_then(Value::as_str))
    {
        return Some(plan_type.to_string());
    }

    let token = value
        .get("tokens")
        .and_then(Value::as_object)
        .and_then(|tokens| {
            tokens
                .get("id_token")
                .and_then(Value::as_str)
                .or_else(|| tokens.get("access_token").and_then(Value::as_str))
        })
        .or_else(|| value.get("id_token").and_then(Value::as_str))
        .or_else(|| value.get("access_token").and_then(Value::as_str));

    let token = token?;
    let payload = token.split('.').nth(1)?;

    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(payload))
        .ok()?;
    let claims: Value = serde_json::from_slice(&decoded).ok()?;

    detect_plan_type_in_object(&claims).or_else(|| {
        claims
            .get("https://api.openai.com/auth")
            .and_then(detect_plan_type_in_object)
    })
}

fn is_premium_plan_type(plan_type: &str) -> bool {
    let normalized = plan_type.to_ascii_lowercase();
    normalized.contains("pro")
        || normalized.contains("plus")
        || normalized.contains("team")
        || normalized.contains("enterprise")
        || normalized.contains("edu")
}

#[derive(Debug)]
struct DetectedModel {
    slug: String,
    reasoning_efforts: Vec<ReasoningEffort>,
    priority: u64,
    index: usize,
}
