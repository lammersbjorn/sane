use sane_state::RunSnapshot;
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
