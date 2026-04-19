use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RunSnapshot {
    pub version: u32,
    pub objective: String,
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
