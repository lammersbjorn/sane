use std::fs;
use std::io::Write;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RunSnapshot {
    pub version: u32,
    pub objective: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RunSummary {
    pub version: u32,
    pub accepted_decisions: Vec<String>,
    pub completed_milestones: Vec<String>,
    pub constraints: Vec<String>,
    pub files_touched: Vec<String>,
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

impl RunSnapshot {
    pub fn read_from_path(path: impl AsRef<Path>) -> Result<Self, RunSnapshotError> {
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

    pub fn write_to_path(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|source| RunSnapshotError::Write {
                path: parent.display().to_string(),
                source,
            })?;
        }

        let encoded = serde_json::to_string_pretty(self)?;
        fs::write(path, encoded).map_err(|source| RunSnapshotError::Write {
            path: path.display().to_string(),
            source,
        })
    }
}

impl RunSummary {
    pub fn read_from_path(path: impl AsRef<Path>) -> Result<Self, RunSnapshotError> {
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

    pub fn write_to_path(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|source| RunSnapshotError::Write {
                path: parent.display().to_string(),
                source,
            })?;
        }

        let encoded = serde_json::to_string_pretty(self)?;
        fs::write(path, encoded).map_err(|source| RunSnapshotError::Write {
            path: path.display().to_string(),
            source,
        })
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
            ts_unix: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            category: category.into(),
            action: action.into(),
            result: result.into(),
            summary: summary.into(),
            paths,
        }
    }

    pub fn append_jsonl(&self, path: impl AsRef<Path>) -> Result<(), RunSnapshotError> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|source| RunSnapshotError::Write {
                path: parent.display().to_string(),
                source,
            })?;
        }

        let encoded = serde_json::to_string(self)?;
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
}
