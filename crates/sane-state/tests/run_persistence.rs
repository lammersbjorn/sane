use sane_state::{
    ArtifactRecord, CanonicalStateFormat, CanonicalStatePaths, CurrentRunState, DecisionRecord,
    EventRecord, LayeredStateBundle, LocalStateConfig, RunSnapshot, RunSnapshotError, RunSummary,
    SummaryPromotion, read_jsonl_records, read_jsonl_records_slice, write_canonical_with_backup,
};
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
    let current = CurrentRunState::read_from_path(&path).unwrap();

    assert_eq!(decoded.version, 2);
    assert_eq!(decoded.objective, snapshot.objective);
    assert_eq!(current.version, 2);
    assert_eq!(current.objective, snapshot.objective);
    assert_eq!(current.phase, "unknown");
    assert!(current.active_tasks.is_empty());
    assert!(current.blocking_questions.is_empty());
    assert_eq!(current.verification.status, "unknown");
}

#[test]
fn run_summary_persists_to_disk() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("summary.json");

    let summary = RunSummary {
        version: 2,
        accepted_decisions: vec!["plain-language first".to_string()],
        completed_milestones: vec!["bootstrap".to_string()],
        constraints: vec!["no required AGENTS.md".to_string()],
        last_verified_outputs: vec!["cargo test -p sane-state".to_string()],
        files_touched: vec!["README.md".to_string()],
        extra: Default::default(),
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

#[test]
fn current_run_state_persists_to_disk() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("current-run.json");

    let state = CurrentRunState {
        version: 2,
        objective: "finish R3".to_string(),
        phase: "verifying".to_string(),
        active_tasks: vec!["cargo test -p sane-state".to_string()],
        blocking_questions: vec!["confirm telemetry wording".to_string()],
        verification: sane_state::VerificationStatus {
            status: "in_progress".to_string(),
            summary: Some("running crate tests".to_string()),
        },
        last_compaction_ts_unix: Some(1_713_560_000),
        extra: Default::default(),
    };

    state.write_to_path(&path).unwrap();
    let decoded = CurrentRunState::read_from_path(&path).unwrap();

    assert_eq!(decoded, state);
}

#[test]
fn legacy_run_summary_reads_with_defaults() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("summary.json");

    std::fs::write(
        &path,
        r#"{
  "version": 1,
  "accepted_decisions": ["plain-language first"],
  "completed_milestones": ["bootstrap"],
  "constraints": ["no required AGENTS.md"],
  "files_touched": ["README.md"],
  "carry_forward": "keep me"
}"#,
    )
    .unwrap();

    let decoded = RunSummary::read_from_path(&path).unwrap();

    assert_eq!(decoded.version, 2);
    assert!(decoded.last_verified_outputs.is_empty());
    assert_eq!(
        decoded.extra.get("carry_forward"),
        Some(&serde_json::Value::String("keep me".to_string()))
    );
}

#[test]
fn summary_promotion_dedupes_and_brief_render_uses_current_state() {
    let mut summary = RunSummary::default();
    summary.apply_promotion(SummaryPromotion {
        accepted_decisions: vec!["keep .sane thin".to_string(), "keep .sane thin".to_string()],
        completed_milestones: vec!["runtime installed".to_string()],
        constraints: vec!["local-only state".to_string()],
        last_verified_outputs: vec!["cargo test -p sane-state".to_string()],
        files_touched: vec!["crates/sane-state/src/lib.rs".to_string()],
    });

    let current = CurrentRunState {
        version: 2,
        objective: "Finish R3".to_string(),
        phase: "implementing".to_string(),
        active_tasks: vec!["wire typed records".to_string()],
        blocking_questions: vec!["none".to_string()],
        verification: sane_state::VerificationStatus {
            status: "pending".to_string(),
            summary: Some("tests not run yet".to_string()),
        },
        last_compaction_ts_unix: Some(1_713_560_000),
        extra: Default::default(),
    };

    assert_eq!(summary.accepted_decisions, vec!["keep .sane thin"]);
    assert_eq!(
        summary.last_verified_outputs,
        vec!["cargo test -p sane-state"]
    );

    let brief = summary.render_brief(&current);
    assert!(brief.contains("# Sane Brief"));
    assert!(brief.contains("Finish R3"));
    assert!(brief.contains("implementing"));
    assert!(brief.contains("keep .sane thin"));
    assert!(brief.contains("cargo test -p sane-state"));
}

#[test]
fn decision_record_appends_jsonl() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("decisions.jsonl");

    let decision = DecisionRecord::new(
        "runtime installed",
        "keep repair paths reversible",
        vec![".sane/config.local.toml".to_string()],
    );

    decision.append_jsonl(&path).unwrap();

    let body = std::fs::read_to_string(&path).unwrap();
    let decoded: DecisionRecord = serde_json::from_str(body.lines().next().unwrap()).unwrap();

    assert_eq!(decoded.version, 1);
    assert_eq!(decoded.summary, "runtime installed");
    assert_eq!(decoded.rationale, "keep repair paths reversible");
}

#[test]
fn jsonl_reader_preserves_order_for_multi_record_file() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("decisions.jsonl");

    DecisionRecord::new("first", "r1", vec![])
        .append_jsonl(&path)
        .unwrap();
    DecisionRecord::new("second", "r2", vec![])
        .append_jsonl(&path)
        .unwrap();
    DecisionRecord::new("third", "r3", vec![])
        .append_jsonl(&path)
        .unwrap();

    let decoded = read_jsonl_records::<DecisionRecord>(&path).unwrap();
    let summaries = decoded
        .iter()
        .map(|record| record.summary.as_str())
        .collect::<Vec<_>>();
    assert_eq!(summaries, vec!["first", "second", "third"]);
}

#[test]
fn jsonl_reader_slice_returns_ordered_window() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("events.jsonl");

    EventRecord::new("operation", "first", "ok", "first", vec![])
        .append_jsonl(&path)
        .unwrap();
    EventRecord::new("operation", "second", "ok", "second", vec![])
        .append_jsonl(&path)
        .unwrap();
    EventRecord::new("operation", "third", "ok", "third", vec![])
        .append_jsonl(&path)
        .unwrap();

    let decoded = read_jsonl_records_slice::<EventRecord>(&path, 1, Some(2)).unwrap();
    let actions = decoded
        .iter()
        .map(|record| record.action.as_str())
        .collect::<Vec<_>>();
    assert_eq!(actions, vec!["second", "third"]);
}

#[test]
fn decision_record_rejects_ambiguous_payload_without_typed_or_legacy_shape() {
    let decoded = serde_json::from_str::<DecisionRecord>(
        r#"{
  "summary": "runtime installed",
  "paths": [".sane/config.local.toml"]
}"#,
    );

    assert!(decoded.is_err());
}

#[test]
fn decision_record_reads_legacy_event_shape() {
    let decoded = serde_json::from_str::<DecisionRecord>(
        r#"{
  "ts_unix": 42,
  "category": "decision",
  "action": "install_runtime",
  "result": "ok",
  "summary": "runtime installed",
  "paths": [".sane/config.local.toml"]
}"#,
    )
    .unwrap();

    assert_eq!(decoded.ts_unix, 42);
    assert_eq!(decoded.summary, "runtime installed");
    assert_eq!(decoded.rationale, "decision: install_runtime (ok)");
}

#[test]
fn artifact_record_appends_jsonl() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("artifacts.jsonl");

    let artifact = ArtifactRecord::new(
        "report",
        "docs/report.md",
        "state audit report",
        vec!["docs/report.md".to_string()],
    );

    artifact.append_jsonl(&path).unwrap();

    let body = std::fs::read_to_string(&path).unwrap();
    let decoded: ArtifactRecord = serde_json::from_str(body.lines().next().unwrap()).unwrap();

    assert_eq!(decoded.version, 1);
    assert_eq!(decoded.kind, "report");
    assert_eq!(decoded.path, "docs/report.md");
    assert_eq!(decoded.summary, "state audit report");
}

#[test]
fn artifact_record_rejects_ambiguous_payload_without_typed_or_legacy_shape() {
    let decoded = serde_json::from_str::<ArtifactRecord>(
        r#"{
  "summary": "state audit report",
  "paths": ["docs/report.md"]
}"#,
    );

    assert!(decoded.is_err());
}

#[test]
fn artifact_record_reads_legacy_event_shape() {
    let decoded = serde_json::from_str::<ArtifactRecord>(
        r#"{
  "ts_unix": 99,
  "category": "artifact",
  "action": "report",
  "result": "ok",
  "summary": "state audit report",
  "paths": ["docs/report.md"]
}"#,
    )
    .unwrap();

    assert_eq!(decoded.ts_unix, 99);
    assert_eq!(decoded.kind, "report");
    assert_eq!(decoded.path, "docs/report.md");
    assert_eq!(decoded.summary, "state audit report (ok)");
}

#[test]
fn local_state_config_reads_and_writes_versioned_toml() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("config.local.toml");

    std::fs::write(
        &path,
        r#"
version = 0
telemetry = "off"
"#,
    )
    .unwrap();

    let decoded = LocalStateConfig::read_from_path(&path).unwrap();
    assert_eq!(decoded.version, 1);
    assert_eq!(
        decoded
            .extra
            .get("telemetry")
            .and_then(|value| value.as_str()),
        Some("off")
    );

    decoded.write_to_path(&path).unwrap();
    let body = std::fs::read_to_string(path).unwrap();
    assert!(body.contains("version = 1"));
    assert!(body.contains("telemetry = \"off\""));
}

#[test]
fn canonical_json_rewrite_creates_backup_before_replacement() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("summary.json");

    let previous = RunSummary {
        version: 2,
        accepted_decisions: vec!["old decision".to_string()],
        completed_milestones: vec!["old milestone".to_string()],
        constraints: vec![],
        last_verified_outputs: vec![],
        files_touched: vec![],
        extra: Default::default(),
    };
    previous.write_to_path(&path).unwrap();

    let replacement = RunSummary {
        version: 2,
        accepted_decisions: vec!["new decision".to_string()],
        completed_milestones: vec!["new milestone".to_string()],
        constraints: vec![],
        last_verified_outputs: vec![],
        files_touched: vec![],
        extra: Default::default(),
    };

    let backup_path = write_canonical_with_backup(&path, &replacement, CanonicalStateFormat::Json)
        .unwrap()
        .expect("expected backup file for rewrite");

    let rewritten = RunSummary::read_from_path(&path).unwrap();
    let backup = RunSummary::read_from_path(&backup_path).unwrap();

    assert_eq!(rewritten, replacement);
    assert_eq!(backup, previous);
    assert!(backup_path.exists());
    assert!(
        backup_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .starts_with("summary.json.bak.")
    );
}

#[test]
fn canonical_toml_first_write_skips_backup() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("config.local.toml");

    let mut config = LocalStateConfig::default();
    config.extra.insert(
        "telemetry".to_string(),
        toml::Value::String("off".to_string()),
    );

    let backup = write_canonical_with_backup(&path, &config, CanonicalStateFormat::Toml).unwrap();
    let decoded = LocalStateConfig::read_from_path(&path).unwrap();

    assert!(backup.is_none());
    assert_eq!(decoded, config);
}

#[test]
fn layered_state_bundle_loads_optional_layers() {
    let dir = tempdir().unwrap();
    let runtime_root = dir.path().join(".sane");
    let state_dir = runtime_root.join("state");
    std::fs::create_dir_all(&state_dir).unwrap();

    std::fs::write(runtime_root.join("config.local.toml"), "version = 1\n").unwrap();
    std::fs::write(
        state_dir.join("summary.json"),
        r#"{"version":2,"accepted_decisions":["keep state thin"],"completed_milestones":[],"constraints":[],"last_verified_outputs":[],"files_touched":[]}"#,
    )
    .unwrap();
    std::fs::write(runtime_root.join("BRIEF.md"), "# brief\n").unwrap();

    let paths = CanonicalStatePaths::new(
        runtime_root.join("config.local.toml"),
        state_dir.join("summary.json"),
        state_dir.join("current-run.json"),
        runtime_root.join("BRIEF.md"),
    );

    let bundle = LayeredStateBundle::load(&paths).unwrap();
    assert_eq!(bundle.config.as_ref().map(|config| config.version), Some(1));
    assert_eq!(
        bundle.summary.as_ref().map(|summary| summary.version),
        Some(2)
    );
    assert!(bundle.current_run.is_none());
    assert_eq!(bundle.brief.as_deref(), Some("# brief\n"));
}

#[test]
fn layered_state_bundle_stops_on_summary_parse_after_config() {
    let dir = tempdir().unwrap();
    let runtime_root = dir.path().join(".sane");
    let state_dir = runtime_root.join("state");
    std::fs::create_dir_all(&state_dir).unwrap();

    std::fs::write(runtime_root.join("config.local.toml"), "version = 1\n").unwrap();
    std::fs::write(state_dir.join("summary.json"), "{").unwrap();
    std::fs::write(state_dir.join("current-run.json"), "{").unwrap();

    let paths = CanonicalStatePaths::new(
        runtime_root.join("config.local.toml"),
        state_dir.join("summary.json"),
        state_dir.join("current-run.json"),
        runtime_root.join("BRIEF.md"),
    );

    let error = LayeredStateBundle::load(&paths).unwrap_err();
    match error {
        RunSnapshotError::Parse { path, .. } => {
            assert!(path.ends_with("summary.json"));
        }
        other => panic!("expected summary parse error, got {other:?}"),
    }
}
