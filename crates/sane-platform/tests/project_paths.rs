use sane_platform::{CodexPaths, ProjectPaths};
use tempfile::tempdir;

#[test]
fn project_paths_use_dot_sane_namespace() {
    let dir = tempdir().unwrap();
    let paths = ProjectPaths::new(dir.path());

    assert_eq!(paths.repo_agents_dir, dir.path().join(".agents"));
    assert_eq!(
        paths.repo_skills_dir,
        dir.path().join(".agents").join("skills")
    );
    assert_eq!(paths.repo_agents_md, dir.path().join("AGENTS.md"));
    assert_eq!(paths.runtime_root, dir.path().join(".sane"));
    assert_eq!(
        paths.config_path,
        dir.path().join(".sane").join("config.local.toml")
    );
    assert_eq!(paths.state_dir, dir.path().join(".sane").join("state"));
    assert_eq!(
        paths.current_run_path,
        dir.path()
            .join(".sane")
            .join("state")
            .join("current-run.json")
    );
    assert_eq!(
        paths.summary_path,
        dir.path().join(".sane").join("state").join("summary.json")
    );
    assert_eq!(
        paths.events_path,
        dir.path().join(".sane").join("state").join("events.jsonl")
    );
    assert_eq!(
        paths.decisions_path,
        dir.path()
            .join(".sane")
            .join("state")
            .join("decisions.jsonl")
    );
    assert_eq!(
        paths.artifacts_path,
        dir.path()
            .join(".sane")
            .join("state")
            .join("artifacts.jsonl")
    );
    assert_eq!(paths.brief_path, dir.path().join(".sane").join("BRIEF.md"));
    assert_eq!(paths.logs_dir, dir.path().join(".sane").join("logs"));
    assert_eq!(paths.cache_dir, dir.path().join(".sane").join("cache"));
    assert_eq!(paths.backups_dir, dir.path().join(".sane").join("backups"));
    assert_eq!(
        paths.codex_config_backups_dir,
        dir.path()
            .join(".sane")
            .join("backups")
            .join("codex-config")
    );
    assert_eq!(
        paths.telemetry_dir,
        dir.path().join(".sane").join("telemetry")
    );
    assert_eq!(
        paths.telemetry_summary_path,
        dir.path()
            .join(".sane")
            .join("telemetry")
            .join("summary.json")
    );
    assert_eq!(
        paths.telemetry_events_path,
        dir.path()
            .join(".sane")
            .join("telemetry")
            .join("events.jsonl")
    );
    assert_eq!(
        paths.telemetry_queue_path,
        dir.path()
            .join(".sane")
            .join("telemetry")
            .join("queue.jsonl")
    );
}

#[test]
fn discover_project_root_walks_up_to_cargo_manifest() {
    let dir = tempdir().unwrap();
    std::fs::write(dir.path().join("Cargo.toml"), "[workspace]\n").unwrap();
    let nested = dir.path().join("crates").join("sane-tui").join("src");
    std::fs::create_dir_all(&nested).unwrap();

    let discovered = ProjectPaths::discover(&nested).unwrap();

    assert_eq!(discovered.project_root, dir.path());
    assert_eq!(discovered.runtime_root, dir.path().join(".sane"));
}

#[test]
fn discover_project_root_accepts_file_start_path() {
    let dir = tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join(".git")).unwrap();
    let file = dir
        .path()
        .join("crates")
        .join("sane-platform")
        .join("src")
        .join("lib.rs");
    std::fs::create_dir_all(file.parent().unwrap()).unwrap();
    std::fs::write(&file, "// test\n").unwrap();

    let discovered = ProjectPaths::discover(&file).unwrap();

    assert_eq!(discovered.project_root, dir.path());
}

#[test]
fn discover_project_root_uses_dot_sane_when_repo_markers_are_absent() {
    let dir = tempdir().unwrap();
    let nested = dir.path().join("workspace").join("deep").join("src");
    let runtime_root = dir.path().join("workspace").join(".sane");
    std::fs::create_dir_all(&nested).unwrap();
    std::fs::create_dir_all(&runtime_root).unwrap();

    let discovered = ProjectPaths::discover(&nested).unwrap();

    assert_eq!(discovered.project_root, dir.path().join("workspace"));
    assert_eq!(discovered.runtime_root, runtime_root);
}

#[test]
fn codex_paths_use_user_skill_location_from_docs() {
    let home = tempdir().unwrap();
    let paths = CodexPaths::new(home.path());

    assert_eq!(paths.codex_home, home.path().join(".codex"));
    assert_eq!(
        paths.config_toml,
        home.path().join(".codex").join("config.toml")
    );
    assert_eq!(paths.user_agents_dir, home.path().join(".agents"));
    assert_eq!(
        paths.user_skills_dir,
        home.path().join(".agents").join("skills")
    );
    assert_eq!(
        paths.global_agents_md,
        home.path().join(".codex").join("AGENTS.md")
    );
    assert_eq!(
        paths.hooks_json,
        home.path().join(".codex").join("hooks.json")
    );
}

#[test]
fn codex_paths_include_local_model_metadata_files() {
    let home = tempdir().unwrap();
    let paths = CodexPaths::new(home.path());

    assert_eq!(
        paths.models_cache_json,
        home.path().join(".codex").join("models_cache.json")
    );
    assert_eq!(
        paths.auth_json,
        home.path().join(".codex").join("auth.json")
    );
}

#[test]
fn ensure_runtime_dirs_creates_state_and_telemetry_layout() {
    let dir = tempdir().unwrap();
    let paths = ProjectPaths::new(dir.path());

    paths.ensure_runtime_dirs().unwrap();
    paths.ensure_runtime_dirs().unwrap();

    assert!(paths.runtime_root.is_dir());
    assert!(paths.state_dir.is_dir());
    assert!(paths.cache_dir.is_dir());
    assert!(paths.backups_dir.is_dir());
    assert!(paths.codex_config_backups_dir.is_dir());
    assert!(paths.logs_dir.is_dir());
    assert!(paths.sessions_dir.is_dir());
    assert!(paths.telemetry_dir.is_dir());
}
