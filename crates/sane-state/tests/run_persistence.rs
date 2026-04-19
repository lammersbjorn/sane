use sane_state::{EventRecord, RunSnapshot, RunSummary};
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

#[test]
fn event_record_appends_jsonl() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("events.jsonl");

    let event = EventRecord::new(
        "operation",
        "install_runtime",
        "ok",
        "installed runtime",
        vec![".sane/config.local.toml".to_string()],
    );

    event.append_jsonl(&path).unwrap();

    let body = std::fs::read_to_string(&path).unwrap();
    let line = body.lines().next().unwrap();
    let decoded: EventRecord = serde_json::from_str(line).unwrap();

    assert_eq!(decoded.category, "operation");
    assert_eq!(decoded.action, "install_runtime");
    assert_eq!(decoded.result, "ok");
}
