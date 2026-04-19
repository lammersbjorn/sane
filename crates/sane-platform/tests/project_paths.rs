use sane_platform::{CodexPaths, ProjectPaths};
use tempfile::tempdir;

#[test]
fn project_paths_use_dot_sane_namespace() {
    let dir = tempdir().unwrap();
    let paths = ProjectPaths::new(dir.path());

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
    assert_eq!(
        paths.telemetry_dir,
        dir.path().join(".sane").join("telemetry")
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
fn codex_paths_use_user_skill_location_from_docs() {
    let home = tempdir().unwrap();
    let paths = CodexPaths::new(home.path());

    assert_eq!(paths.codex_home, home.path().join(".codex"));
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
