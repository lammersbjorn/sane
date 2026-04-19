use sane_state::{EventRecord, RunSnapshot};

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
fn event_record_round_trips_through_json() {
    let event = EventRecord::new("operation", "doctor", "ok", "doctor run", vec![]);
    let encoded = serde_json::to_string(&event).unwrap();
    let decoded: EventRecord = serde_json::from_str(&encoded).unwrap();
    assert_eq!(decoded.category, "operation");
    assert_eq!(decoded.action, "doctor");
    assert_eq!(decoded.result, "ok");
}
