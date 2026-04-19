use sane_config::LocalConfig;
use tempfile::tempdir;

#[test]
fn local_config_round_trips_through_toml() {
    let config = LocalConfig::default();
    let encoded = toml::to_string(&config).unwrap();
    let decoded: LocalConfig = toml::from_str(&encoded).unwrap();
    assert_eq!(decoded, config);
}

#[test]
fn local_config_persists_to_disk() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("config.local.toml");

    let config = LocalConfig::default();
    config.write_to_path(&path).unwrap();

    let decoded = LocalConfig::read_from_path(&path).unwrap();
    assert_eq!(decoded, config);
}
