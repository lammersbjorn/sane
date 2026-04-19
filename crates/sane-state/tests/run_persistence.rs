use sane_state::{RunSnapshot, RunSummary};
use tempfile::tempdir;

#[test]
fn run_snapshot_persists_to_disk() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("current-run.json");

    let snapshot = RunSnapshot {
        version: 1,
        objective: "bootstrap sane runtime".to_string(),
    };

    snapshot.write_to_path(&path).unwrap();
    let decoded = RunSnapshot::read_from_path(&path).unwrap();

    assert_eq!(decoded, snapshot);
}

#[test]
fn run_summary_persists_to_disk() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("summary.json");

    let summary = RunSummary {
        version: 1,
        accepted_decisions: vec!["plain-language first".to_string()],
        completed_milestones: vec!["bootstrap".to_string()],
        constraints: vec!["no required AGENTS.md".to_string()],
        files_touched: vec!["README.md".to_string()],
    };

    summary.write_to_path(&path).unwrap();
    let decoded = RunSummary::read_from_path(&path).unwrap();

    assert_eq!(decoded, summary);
}
