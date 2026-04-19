use sane_platform::ProjectPaths;
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
    assert_eq!(paths.logs_dir, dir.path().join(".sane").join("logs"));
    assert_eq!(paths.cache_dir, dir.path().join(".sane").join("cache"));
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
