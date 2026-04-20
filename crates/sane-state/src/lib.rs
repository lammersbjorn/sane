use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::de::{self, Deserializer};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;
use toml::Table as TomlTable;

pub type ExtraMap = BTreeMap<String, Value>;

/// Legacy compatibility snapshot for objective-only current-run files.
/// Canonical live-run storage is `CurrentRunState`.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct RunSnapshot {
    pub version: u32,
    pub objective: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct RunSummary {
    pub version: u32,
    pub accepted_decisions: Vec<String>,
    pub completed_milestones: Vec<String>,
    pub constraints: Vec<String>,
    pub last_verified_outputs: Vec<String>,
    pub files_touched: Vec<String>,
    #[serde(flatten)]
    pub extra: ExtraMap,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct LocalStateConfig {
    pub version: u32,
    #[serde(flatten)]
    pub extra: TomlTable,
}

/// Canonical live-run state.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct CurrentRunState {
    pub version: u32,
    pub objective: String,
    pub phase: String,
    pub active_tasks: Vec<String>,
    pub blocking_questions: Vec<String>,
    pub verification: VerificationStatus,
    pub last_compaction_ts_unix: Option<u64>,
    #[serde(flatten)]
    pub extra: ExtraMap,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CanonicalStatePaths {
    pub config_path: PathBuf,
    pub summary_path: PathBuf,
    pub current_run_path: PathBuf,
    pub brief_path: PathBuf,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct LayeredStateBundle {
    pub config: Option<LocalStateConfig>,
    pub summary: Option<RunSummary>,
    pub current_run: Option<CurrentRunState>,
    pub brief: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VerificationStatus {
    pub status: String,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EventRecord {
    pub ts_unix: u64,
    pub category: String,
    pub action: String,
    pub result: String,
    pub summary: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DecisionRecord {
    pub version: u32,
    pub ts_unix: u64,
    pub summary: String,
    pub rationale: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ArtifactRecord {
    pub version: u32,
    pub ts_unix: u64,
    pub kind: String,
    pub path: String,
    pub summary: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SummaryPromotion {
    pub accepted_decisions: Vec<String>,
    pub completed_milestones: Vec<String>,
    pub constraints: Vec<String>,
    pub last_verified_outputs: Vec<String>,
    pub files_touched: Vec<String>,
}

#[derive(Debug, Error)]
pub enum RunSnapshotError {
    #[error("failed to read snapshot from {path}: {source}")]
    Read {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to write snapshot to {path}: {source}")]
    Write {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to parse snapshot from {path}: {source}")]
    Parse {
        path: String,
        #[source]
        source: serde_json::Error,
    },
    #[error("failed to parse snapshot from {path}: {source}")]
    ParseToml {
        path: String,
        #[source]
        source: toml::de::Error,
    },
    #[error("failed to encode snapshot to json: {0}")]
    Encode(#[from] serde_json::Error),
    #[error("failed to encode snapshot to toml: {0}")]
    EncodeToml(#[from] toml::ser::Error),
}

#[derive(Debug, Deserialize)]
struct RunSummaryWire {
    version: Option<u32>,
    accepted_decisions: Option<Vec<Value>>,
    completed_milestones: Option<Vec<Value>>,
    constraints: Option<Vec<Value>>,
    last_verified_outputs: Option<Vec<Value>>,
    files_touched: Option<Vec<Value>>,
    #[serde(flatten)]
    extra: ExtraMap,
}

#[derive(Debug, Deserialize)]
struct LocalStateConfigWire {
    version: Option<u32>,
    #[serde(flatten)]
    extra: TomlTable,
}

#[derive(Debug, Deserialize)]
struct RunSnapshotWire {
    version: Option<u32>,
    objective: Option<String>,
    current_run: Option<RunSnapshotObjectiveWire>,
    current: Option<RunSnapshotObjectiveWire>,
    state: Option<RunSnapshotObjectiveWire>,
    snapshot: Option<RunSnapshotObjectiveWire>,
}

#[derive(Debug, Deserialize)]
struct RunSnapshotObjectiveWire {
    objective: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct DecisionRecordTypedWire {
    version: Option<u32>,
    ts_unix: Option<u64>,
    summary: String,
    rationale: String,
    paths: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct DecisionRecordLegacyWire {
    ts_unix: Option<u64>,
    category: Option<String>,
    action: Option<String>,
    result: Option<String>,
    summary: String,
    paths: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum DecisionRecordWire {
    Typed(DecisionRecordTypedWire),
    LegacyEvent(DecisionRecordLegacyWire),
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ArtifactRecordTypedWire {
    version: Option<u32>,
    ts_unix: Option<u64>,
    kind: String,
    path: String,
    summary: String,
    paths: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ArtifactRecordLegacyWire {
    ts_unix: Option<u64>,
    category: Option<String>,
    action: Option<String>,
    result: Option<String>,
    summary: String,
    paths: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ArtifactRecordWire {
    Typed(ArtifactRecordTypedWire),
    LegacyEvent(ArtifactRecordLegacyWire),
}

#[derive(Debug, Deserialize)]
struct CurrentRunStateWire {
    version: Option<u32>,
    objective: Option<String>,
    current_run: Option<RunSnapshotObjectiveWire>,
    current: Option<RunSnapshotObjectiveWire>,
    state: Option<RunSnapshotObjectiveWire>,
    snapshot: Option<RunSnapshotObjectiveWire>,
    phase: Option<String>,
    active_tasks: Option<Vec<String>>,
    blocking_questions: Option<Vec<String>>,
    verification: Option<VerificationStatus>,
    last_compaction_ts_unix: Option<u64>,
    #[serde(flatten)]
    extra: ExtraMap,
}

impl<'de> Deserialize<'de> for RunSnapshot {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let wire = RunSnapshotWire::deserialize(deserializer)?;
        let objective = wire
            .objective
            .or_else(|| wire.current_run.and_then(|item| item.objective))
            .or_else(|| wire.current.and_then(|item| item.objective))
            .or_else(|| wire.state.and_then(|item| item.objective))
            .or_else(|| wire.snapshot.and_then(|item| item.objective))
            .ok_or_else(|| de::Error::missing_field("objective"))?;

        Ok(Self {
            version: wire.version.unwrap_or(1),
            objective,
        })
    }
}

impl<'de> Deserialize<'de> for RunSummary {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let wire = RunSummaryWire::deserialize(deserializer)?;
        Ok(Self {
            version: upgraded_version(wire.version),
            accepted_decisions: coerce_string_list(wire.accepted_decisions)?,
            completed_milestones: coerce_string_list(wire.completed_milestones)?,
            constraints: coerce_string_list(wire.constraints)?,
            last_verified_outputs: coerce_string_list(wire.last_verified_outputs)?,
            files_touched: coerce_string_list(wire.files_touched)?,
            extra: wire.extra,
        })
    }
}

impl<'de> Deserialize<'de> for LocalStateConfig {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let wire = LocalStateConfigWire::deserialize(deserializer)?;
        Ok(Self {
            version: upgraded_config_version(wire.version),
            extra: wire.extra,
        })
    }
}

impl<'de> Deserialize<'de> for DecisionRecord {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        match DecisionRecordWire::deserialize(deserializer)? {
            DecisionRecordWire::Typed(wire) => Ok(Self {
                version: wire.version.unwrap_or(1),
                ts_unix: wire.ts_unix.unwrap_or_else(now_unix),
                summary: wire.summary,
                rationale: wire.rationale,
                paths: wire.paths.unwrap_or_default(),
            }),
            DecisionRecordWire::LegacyEvent(wire) => {
                require_legacy_event_identity::<D::Error>(
                    &wire.category,
                    &wire.action,
                    &wire.result,
                    "decision",
                )?;

                let mut rationale = wire
                    .action
                    .unwrap_or_else(|| "legacy decision event".to_string());
                if let Some(result) = wire.result {
                    rationale = format!("{rationale} ({result})");
                }
                if let Some(category) = wire.category {
                    rationale = format!("{category}: {rationale}");
                }

                Ok(Self {
                    version: 1,
                    ts_unix: wire.ts_unix.unwrap_or_else(now_unix),
                    summary: wire.summary,
                    rationale,
                    paths: wire.paths.unwrap_or_default(),
                })
            }
        }
    }
}

impl<'de> Deserialize<'de> for ArtifactRecord {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        match ArtifactRecordWire::deserialize(deserializer)? {
            ArtifactRecordWire::Typed(wire) => Ok(Self {
                version: wire.version.unwrap_or(1),
                ts_unix: wire.ts_unix.unwrap_or_else(now_unix),
                kind: wire.kind,
                path: wire.path,
                summary: wire.summary,
                paths: wire.paths.unwrap_or_default(),
            }),
            ArtifactRecordWire::LegacyEvent(wire) => {
                require_legacy_event_identity::<D::Error>(
                    &wire.category,
                    &wire.action,
                    &wire.result,
                    "artifact",
                )?;

                let paths = wire.paths.unwrap_or_default();
                let path = paths
                    .first()
                    .cloned()
                    .unwrap_or_else(|| wire.summary.clone());
                let kind = wire
                    .action
                    .or(wire.category)
                    .unwrap_or_else(|| "artifact".to_string());
                let summary = wire
                    .result
                    .map(|result| format!("{} ({result})", wire.summary))
                    .unwrap_or(wire.summary);

                Ok(Self {
                    version: 1,
                    ts_unix: wire.ts_unix.unwrap_or_else(now_unix),
                    kind,
                    path,
                    summary,
                    paths,
                })
            }
        }
    }
}

impl<'de> Deserialize<'de> for CurrentRunState {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let wire = CurrentRunStateWire::deserialize(deserializer)?;
        let objective = wire
            .objective
            .or_else(|| wire.current_run.and_then(|item| item.objective))
            .or_else(|| wire.current.and_then(|item| item.objective))
            .or_else(|| wire.state.and_then(|item| item.objective))
            .or_else(|| wire.snapshot.and_then(|item| item.objective))
            .ok_or_else(|| de::Error::missing_field("objective"))?;
        Ok(Self {
            version: upgraded_version(wire.version),
            objective,
            phase: wire.phase.unwrap_or_else(|| "unknown".to_string()),
            active_tasks: wire.active_tasks.unwrap_or_default(),
            blocking_questions: wire.blocking_questions.unwrap_or_default(),
            verification: wire
                .verification
                .unwrap_or_else(default_verification_status),
            last_compaction_ts_unix: wire.last_compaction_ts_unix,
            extra: wire.extra,
        })
    }
}

impl CanonicalStatePaths {
    pub fn new(
        config_path: impl Into<PathBuf>,
        summary_path: impl Into<PathBuf>,
        current_run_path: impl Into<PathBuf>,
        brief_path: impl Into<PathBuf>,
    ) -> Self {
        Self {
            config_path: config_path.into(),
            summary_path: summary_path.into(),
            current_run_path: current_run_path.into(),
            brief_path: brief_path.into(),
        }
    }
}

impl LayeredStateBundle {
    pub fn load(paths: &CanonicalStatePaths) -> Result<Self, RunSnapshotError> {
        Ok(Self {
            config: LocalStateConfig::read_optional_from_path(&paths.config_path)?,
            summary: RunSummary::read_optional_from_path(&paths.summary_path)?,
            current_run: CurrentRunState::read_optional_from_path(&paths.current_run_path)?,
            brief: read_optional_text(&paths.brief_path)?,
        })
    }
}

impl RunSnapshot {
    pub fn read_from_path(path: impl AsRef<Path>) -> Result<Self, RunSnapshotError> {
        let path = path.as_ref();
        match CurrentRunState::read_from_path(path) {
            Ok(state) => Ok(state.snapshot()),
            Err(_) => read_json(path),
        }
    }

    pub fn write_to_path(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        let state = self.clone().into_current_run_state();
        write_json(path, &state)
    }

    pub fn into_current_run_state(self) -> CurrentRunState {
        self.into()
    }
}

impl LocalStateConfig {
    pub fn read_from_path(path: impl AsRef<Path>) -> Result<Self, RunSnapshotError> {
        read_toml(path)
    }

    pub fn read_optional_from_path(
        path: impl AsRef<Path>,
    ) -> Result<Option<Self>, RunSnapshotError> {
        read_optional_toml(path)
    }

    pub fn write_to_path(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        write_toml(path, self)
    }
}

impl RunSummary {
    pub fn read_from_path(path: impl AsRef<Path>) -> Result<Self, RunSnapshotError> {
        read_json(path)
    }

    pub fn read_optional_from_path(
        path: impl AsRef<Path>,
    ) -> Result<Option<Self>, RunSnapshotError> {
        read_optional_json(path)
    }

    pub fn write_to_path(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        write_json(path, self)
    }

    pub fn apply_promotion(&mut self, promotion: SummaryPromotion) {
        merge_unique(&mut self.accepted_decisions, promotion.accepted_decisions);
        merge_unique(
            &mut self.completed_milestones,
            promotion.completed_milestones,
        );
        merge_unique(&mut self.constraints, promotion.constraints);
        merge_unique(
            &mut self.last_verified_outputs,
            promotion.last_verified_outputs,
        );
        merge_unique(&mut self.files_touched, promotion.files_touched);
    }

    pub fn apply_decision_record(&mut self, decision: &DecisionRecord) {
        self.apply_promotion(SummaryPromotion::from_decision_record(decision));
    }

    pub fn apply_artifact_record(&mut self, artifact: &ArtifactRecord) {
        self.apply_promotion(SummaryPromotion::from_artifact_record(artifact));
    }

    pub fn build_brief(&self, current: &CurrentRunState) -> String {
        let accepted = render_bullets(&self.accepted_decisions);
        let milestones = render_bullets(&self.completed_milestones);
        let verified = render_bullets(&self.last_verified_outputs);
        let files = render_bullets(&self.files_touched);
        let tasks = render_bullets(&current.active_tasks);
        let blockers = render_bullets(&current.blocking_questions);

        format!(
            "# Sane Brief\n\n## Current Run\n- Objective: {}\n- Phase: {}\n- Verification: {}\n- Last compaction: {}\n\n## Active Tasks\n{}\n\n## Blocking Questions\n{}\n\n## Accepted Decisions\n{}\n\n## Completed Milestones\n{}\n\n## Last Verified Outputs\n{}\n\n## Files Touched\n{}\n",
            current.objective,
            current.phase,
            current.verification.status,
            current
                .last_compaction_ts_unix
                .map(|ts| ts.to_string())
                .unwrap_or_else(|| "none".to_string()),
            tasks,
            blockers,
            accepted,
            milestones,
            verified,
            files
        )
    }

    pub fn render_brief(&self, current: &CurrentRunState) -> String {
        self.build_brief(current)
    }
}

impl Default for RunSummary {
    fn default() -> Self {
        Self {
            version: 2,
            accepted_decisions: vec![],
            completed_milestones: vec![],
            constraints: vec![],
            last_verified_outputs: vec![],
            files_touched: vec![],
            extra: ExtraMap::default(),
        }
    }
}

impl Default for LocalStateConfig {
    fn default() -> Self {
        Self {
            version: 1,
            extra: TomlTable::default(),
        }
    }
}

impl CurrentRunState {
    pub fn read_from_path(path: impl AsRef<Path>) -> Result<Self, RunSnapshotError> {
        read_json(path)
    }

    pub fn read_optional_from_path(
        path: impl AsRef<Path>,
    ) -> Result<Option<Self>, RunSnapshotError> {
        read_optional_json(path)
    }

    pub fn write_to_path(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        write_json(path, self)
    }

    pub fn from_snapshot(snapshot: RunSnapshot) -> Self {
        snapshot.into()
    }

    pub fn snapshot(&self) -> RunSnapshot {
        self.into()
    }
}

impl From<RunSnapshot> for CurrentRunState {
    fn from(snapshot: RunSnapshot) -> Self {
        Self {
            version: upgraded_version(Some(snapshot.version)),
            objective: snapshot.objective,
            phase: "unknown".to_string(),
            active_tasks: Vec::new(),
            blocking_questions: Vec::new(),
            verification: default_verification_status(),
            last_compaction_ts_unix: None,
            extra: ExtraMap::default(),
        }
    }
}

impl From<&CurrentRunState> for RunSnapshot {
    fn from(state: &CurrentRunState) -> Self {
        Self {
            version: state.version,
            objective: state.objective.clone(),
        }
    }
}

impl EventRecord {
    pub fn new(
        category: impl Into<String>,
        action: impl Into<String>,
        result: impl Into<String>,
        summary: impl Into<String>,
        paths: Vec<String>,
    ) -> Self {
        Self {
            ts_unix: now_unix(),
            category: category.into(),
            action: action.into(),
            result: result.into(),
            summary: summary.into(),
            paths,
        }
    }

    pub fn append_jsonl(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        append_jsonl(path, self)
    }
}

impl DecisionRecord {
    pub fn new(
        summary: impl Into<String>,
        rationale: impl Into<String>,
        paths: Vec<String>,
    ) -> Self {
        Self {
            version: 1,
            ts_unix: now_unix(),
            summary: summary.into(),
            rationale: rationale.into(),
            paths,
        }
    }

    pub fn append_jsonl(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        append_jsonl(path, self)
    }

    pub fn promotion(&self) -> SummaryPromotion {
        SummaryPromotion::from_decision_record(self)
    }
}

impl ArtifactRecord {
    pub fn new(
        kind: impl Into<String>,
        path: impl Into<String>,
        summary: impl Into<String>,
        paths: Vec<String>,
    ) -> Self {
        Self {
            version: 1,
            ts_unix: now_unix(),
            kind: kind.into(),
            path: path.into(),
            summary: summary.into(),
            paths,
        }
    }

    pub fn append_jsonl(&self, output: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        append_jsonl(output, self)
    }

    pub fn promotion(&self) -> SummaryPromotion {
        SummaryPromotion::from_artifact_record(self)
    }
}

pub fn read_jsonl_records<T>(path: impl AsRef<Path>) -> Result<Vec<T>, RunSnapshotError>
where
    T: for<'de> Deserialize<'de>,
{
    read_jsonl_records_slice(path, 0, None)
}

pub fn read_jsonl_records_slice<T>(
    path: impl AsRef<Path>,
    offset: usize,
    limit: Option<usize>,
) -> Result<Vec<T>, RunSnapshotError>
where
    T: for<'de> Deserialize<'de>,
{
    let path = path.as_ref();
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(path).map_err(|source| RunSnapshotError::Read {
        path: path.display().to_string(),
        source,
    })?;

    let mut records = Vec::new();
    let mut seen = 0usize;
    for (line_index, line) in raw.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }

        if seen < offset {
            seen += 1;
            continue;
        }

        if let Some(max) = limit {
            if records.len() >= max {
                break;
            }
        }

        let decoded = serde_json::from_str(line).map_err(|source| RunSnapshotError::Parse {
            path: format!("{}:{}", path.display(), line_index + 1),
            source,
        })?;
        records.push(decoded);
        seen += 1;
    }

    Ok(records)
}

fn read_json<T>(path: impl AsRef<Path>) -> Result<T, RunSnapshotError>
where
    T: for<'de> Deserialize<'de>,
{
    let path = path.as_ref();
    let raw = fs::read_to_string(path).map_err(|source| RunSnapshotError::Read {
        path: path.display().to_string(),
        source,
    })?;

    serde_json::from_str(&raw).map_err(|source| RunSnapshotError::Parse {
        path: path.display().to_string(),
        source,
    })
}

fn read_optional_json<T>(path: impl AsRef<Path>) -> Result<Option<T>, RunSnapshotError>
where
    T: for<'de> Deserialize<'de>,
{
    let path = path.as_ref();
    if !path.exists() {
        return Ok(None);
    }

    read_json(path).map(Some)
}

fn read_toml<T>(path: impl AsRef<Path>) -> Result<T, RunSnapshotError>
where
    T: for<'de> Deserialize<'de>,
{
    let path = path.as_ref();
    let raw = fs::read_to_string(path).map_err(|source| RunSnapshotError::Read {
        path: path.display().to_string(),
        source,
    })?;

    toml::from_str(&raw).map_err(|source| RunSnapshotError::ParseToml {
        path: path.display().to_string(),
        source,
    })
}

fn read_optional_toml<T>(path: impl AsRef<Path>) -> Result<Option<T>, RunSnapshotError>
where
    T: for<'de> Deserialize<'de>,
{
    let path = path.as_ref();
    if !path.exists() {
        return Ok(None);
    }

    read_toml(path).map(Some)
}

fn read_optional_text(path: impl AsRef<Path>) -> Result<Option<String>, RunSnapshotError> {
    let path = path.as_ref();
    if !path.exists() {
        return Ok(None);
    }

    fs::read_to_string(path)
        .map(Some)
        .map_err(|source| RunSnapshotError::Read {
            path: path.display().to_string(),
            source,
        })
}

fn write_json<T>(path: impl AsRef<Path>, value: &T) -> Result<(), RunSnapshotError>
where
    T: Serialize,
{
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|source| RunSnapshotError::Write {
            path: parent.display().to_string(),
            source,
        })?;
    }

    let encoded = serde_json::to_string_pretty(value)?;
    fs::write(path, encoded).map_err(|source| RunSnapshotError::Write {
        path: path.display().to_string(),
        source,
    })
}

fn write_toml<T>(path: impl AsRef<Path>, value: &T) -> Result<(), RunSnapshotError>
where
    T: Serialize,
{
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|source| RunSnapshotError::Write {
            path: parent.display().to_string(),
            source,
        })?;
    }

    let encoded = toml::to_string_pretty(value)?;
    fs::write(path, encoded).map_err(|source| RunSnapshotError::Write {
        path: path.display().to_string(),
        source,
    })
}

fn append_jsonl<T>(path: impl AsRef<Path>, value: &T) -> Result<(), RunSnapshotError>
where
    T: Serialize,
{
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|source| RunSnapshotError::Write {
            path: parent.display().to_string(),
            source,
        })?;
    }

    let encoded = serde_json::to_string(value)?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|source| RunSnapshotError::Write {
            path: path.display().to_string(),
            source,
        })?;
    writeln!(file, "{encoded}").map_err(|source| RunSnapshotError::Write {
        path: path.display().to_string(),
        source,
    })
}

fn upgraded_version(version: Option<u32>) -> u32 {
    match version {
        Some(value) if value >= 2 => value,
        _ => 2,
    }
}

fn upgraded_config_version(version: Option<u32>) -> u32 {
    match version {
        Some(value) if value >= 1 => value,
        _ => 1,
    }
}

fn default_verification_status() -> VerificationStatus {
    VerificationStatus {
        status: "unknown".to_string(),
        summary: None,
    }
}

fn require_legacy_event_identity<E>(
    category: &Option<String>,
    action: &Option<String>,
    result: &Option<String>,
    record_kind: &str,
) -> Result<(), E>
where
    E: de::Error,
{
    if category.is_none() && action.is_none() && result.is_none() {
        return Err(E::custom(format!(
            "invalid {record_kind} record: expected typed fields or legacy event identity"
        )));
    }

    Ok(())
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn merge_unique(target: &mut Vec<String>, additions: Vec<String>) {
    for item in additions {
        if !target.contains(&item) {
            target.push(item);
        }
    }
}

fn coerce_string_list<E>(values: Option<Vec<Value>>) -> Result<Vec<String>, E>
where
    E: de::Error,
{
    values
        .unwrap_or_default()
        .into_iter()
        .map(coerce_string_value::<E>)
        .collect()
}

fn coerce_string_value<E>(value: Value) -> Result<String, E>
where
    E: de::Error,
{
    match value {
        Value::String(value) => Ok(value),
        Value::Object(mut map) => {
            for key in ["summary", "text", "value", "name", "label", "path"] {
                if let Some(Value::String(value)) = map.remove(key) {
                    return Ok(value);
                }
            }

            if let Some(Value::Array(values)) = map.remove("paths") {
                if let Some(Value::String(value)) = values
                    .into_iter()
                    .find(|item| matches!(item, Value::String(_)))
                {
                    return Ok(value);
                }
            }

            Err(E::custom(
                "expected string or object with summary/text/value/name/label/path",
            ))
        }
        other => Err(E::custom(format!("expected string value, found {other}"))),
    }
}

impl SummaryPromotion {
    pub fn from_decision_record(decision: &DecisionRecord) -> Self {
        Self {
            accepted_decisions: vec![decision.summary.clone()],
            completed_milestones: Vec::new(),
            constraints: Vec::new(),
            last_verified_outputs: Vec::new(),
            files_touched: decision.paths.clone(),
        }
    }

    pub fn from_artifact_record(artifact: &ArtifactRecord) -> Self {
        let mut files_touched = vec![artifact.path.clone()];
        merge_unique(&mut files_touched, artifact.paths.clone());

        Self {
            accepted_decisions: Vec::new(),
            completed_milestones: Vec::new(),
            constraints: Vec::new(),
            last_verified_outputs: Vec::new(),
            files_touched,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.accepted_decisions.is_empty()
            && self.completed_milestones.is_empty()
            && self.constraints.is_empty()
            && self.last_verified_outputs.is_empty()
            && self.files_touched.is_empty()
    }
}

fn render_bullets(items: &[String]) -> String {
    if items.is_empty() {
        "- none".to_string()
    } else {
        items
            .iter()
            .map(|item| format!("- {item}"))
            .collect::<Vec<_>>()
            .join("\n")
    }
}
