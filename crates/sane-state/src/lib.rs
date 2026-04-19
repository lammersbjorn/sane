use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use thiserror::Error;

pub type ExtraMap = BTreeMap<String, Value>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DecisionRecord {
    pub version: u32,
    pub ts_unix: u64,
    pub summary: String,
    pub rationale: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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
    #[error("failed to encode snapshot to json: {0}")]
    Encode(#[from] serde_json::Error),
}

#[derive(Debug, Deserialize)]
struct RunSummaryWire {
    version: Option<u32>,
    accepted_decisions: Option<Vec<String>>,
    completed_milestones: Option<Vec<String>>,
    constraints: Option<Vec<String>>,
    last_verified_outputs: Option<Vec<String>>,
    files_touched: Option<Vec<String>>,
    #[serde(flatten)]
    extra: ExtraMap,
}

#[derive(Debug, Deserialize)]
struct CurrentRunStateWire {
    version: Option<u32>,
    objective: String,
    phase: Option<String>,
    active_tasks: Option<Vec<String>>,
    blocking_questions: Option<Vec<String>>,
    verification: Option<VerificationStatus>,
    last_compaction_ts_unix: Option<u64>,
    #[serde(flatten)]
    extra: ExtraMap,
}

impl<'de> Deserialize<'de> for RunSummary {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let wire = RunSummaryWire::deserialize(deserializer)?;
        Ok(Self {
            version: upgraded_version(wire.version),
            accepted_decisions: wire.accepted_decisions.unwrap_or_default(),
            completed_milestones: wire.completed_milestones.unwrap_or_default(),
            constraints: wire.constraints.unwrap_or_default(),
            last_verified_outputs: wire.last_verified_outputs.unwrap_or_default(),
            files_touched: wire.files_touched.unwrap_or_default(),
            extra: wire.extra,
        })
    }
}

impl<'de> Deserialize<'de> for CurrentRunState {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let wire = CurrentRunStateWire::deserialize(deserializer)?;
        Ok(Self {
            version: upgraded_version(wire.version),
            objective: wire.objective,
            phase: wire.phase.unwrap_or_else(|| "unknown".to_string()),
            active_tasks: wire.active_tasks.unwrap_or_default(),
            blocking_questions: wire.blocking_questions.unwrap_or_default(),
            verification: wire.verification.unwrap_or_else(|| VerificationStatus {
                status: "unknown".to_string(),
                summary: None,
            }),
            last_compaction_ts_unix: wire.last_compaction_ts_unix,
            extra: wire.extra,
        })
    }
}

impl RunSnapshot {
    pub fn read_from_path(path: impl AsRef<Path>) -> Result<Self, RunSnapshotError> {
        read_json(path)
    }

    pub fn write_to_path(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        write_json(path, self)
    }
}

impl RunSummary {
    pub fn read_from_path(path: impl AsRef<Path>) -> Result<Self, RunSnapshotError> {
        read_json(path)
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

    pub fn render_brief(&self, current: &CurrentRunState) -> String {
        let accepted = render_bullets(&self.accepted_decisions);
        let milestones = render_bullets(&self.completed_milestones);
        let verified = render_bullets(&self.last_verified_outputs);
        let files = render_bullets(&self.files_touched);
        let tasks = render_bullets(&current.active_tasks);

        format!(
            "# Sane Brief\n\n## Current Run\n- Objective: {}\n- Phase: {}\n- Verification: {}\n\n## Active Tasks\n{}\n\n## Accepted Decisions\n{}\n\n## Completed Milestones\n{}\n\n## Last Verified Outputs\n{}\n\n## Files Touched\n{}\n",
            current.objective,
            current.phase,
            current.verification.status,
            tasks,
            accepted,
            milestones,
            verified,
            files
        )
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

impl CurrentRunState {
    pub fn read_from_path(path: impl AsRef<Path>) -> Result<Self, RunSnapshotError> {
        read_json(path)
    }

    pub fn write_to_path(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        write_json(path, self)
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
