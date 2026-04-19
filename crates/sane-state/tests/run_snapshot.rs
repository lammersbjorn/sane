use sane_state::RunSnapshot;

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
