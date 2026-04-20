use sane_state::{CurrentRunState, EventRecord, RunSnapshot};
use tempfile::tempdir;

#[test]
fn run_snapshot_round_trips_through_json() {
    let snapshot = RunSnapshot {
        version: 1,
        objective: "bootstrap sane".to_string(),
    };
    let encoded = serde_json::to_string(&snapshot).unwrap();
    let decoded: RunSnapshot = serde_json::from_str(&encoded).unwrap();
    assert_eq!(decoded, snapshot);
}

#[test]
fn run_snapshot_converts_to_canonical_current_run_state_defaults() {
    let snapshot = RunSnapshot {
        version: 1,
        objective: "bootstrap sane".to_string(),
    };

    let current = snapshot.into_current_run_state();

    assert_eq!(current.version, 2);
    assert_eq!(current.objective, "bootstrap sane");
    assert_eq!(current.phase, "unknown");
    assert!(current.active_tasks.is_empty());
    assert!(current.blocking_questions.is_empty());
    assert_eq!(current.verification.status, "unknown");
    assert_eq!(current.last_compaction_ts_unix, None);
}

#[test]
fn event_record_round_trips_through_json() {
    let event = EventRecord::new("operation", "doctor", "ok", "doctor run", vec![]);
    let encoded = serde_json::to_string(&event).unwrap();
    let decoded: EventRecord = serde_json::from_str(&encoded).unwrap();
    assert_eq!(decoded.category, "operation");
    assert_eq!(decoded.action, "doctor");
    assert_eq!(decoded.result, "ok");
}

#[test]
fn current_run_state_reads_legacy_snapshot_shape() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("current-run.json");

    std::fs::write(
        &path,
        r#"{
  "version": 1,
  "objective": "bootstrap sane",
  "carry_forward": "keep me"
}"#,
    )
    .unwrap();

    let decoded = CurrentRunState::read_from_path(&path).unwrap();

    assert_eq!(decoded.version, 2);
    assert_eq!(decoded.objective, "bootstrap sane");
    assert_eq!(decoded.phase, "unknown");
    assert!(decoded.active_tasks.is_empty());
    assert!(decoded.blocking_questions.is_empty());
    assert_eq!(decoded.verification.status, "unknown");
    assert_eq!(
        decoded.extra.get("carry_forward"),
        Some(&serde_json::Value::String("keep me".to_string()))
    );
}
