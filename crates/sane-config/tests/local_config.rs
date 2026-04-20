use sane_config::{
    AvailableModel, CodexEnvironment, LocalConfig, ModelRolePresets, ReasoningEffort,
    detect_available_models_from_json, detect_plan_type_from_json,
};
use serde_json::json;
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

#[test]
fn local_config_default_contains_model_role_presets() {
    let config = LocalConfig::default();

    assert_eq!(config.models.coordinator.model, "gpt-5.4");
    assert_eq!(config.models.coordinator.reasoning_effort.as_str(), "high");
    assert_eq!(config.models.sidecar.model, "gpt-5.4-mini");
    assert_eq!(config.models.verifier.model, "gpt-5.4");
    assert_eq!(config.privacy.telemetry.as_str(), "off");
    assert_eq!(config.packs.enabled_names(), vec!["core"]);
}

#[test]
fn local_config_rejects_unknown_model() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("config.local.toml");
    std::fs::write(
        &path,
        r#"
version = 1

[models.coordinator]
model = "fake-model"
reasoning_effort = "high"

[models.sidecar]
model = "gpt-5.4-mini"
reasoning_effort = "medium"

[models.verifier]
model = "gpt-5.4"
reasoning_effort = "medium"
"#,
    )
    .unwrap();

    let error = LocalConfig::read_from_path(&path).unwrap_err().to_string();
    assert!(error.contains("not in the supported Codex model set"));
}

#[test]
fn local_config_supports_xhigh_reasoning() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("config.local.toml");
    std::fs::write(
        &path,
        r#"
version = 1

[models.coordinator]
model = "gpt-5.4"
reasoning_effort = "xhigh"

[models.sidecar]
model = "gpt-5.4-mini"
reasoning_effort = "low"

[models.verifier]
model = "gpt-5.3-codex"
reasoning_effort = "medium"

[privacy]
telemetry = "product-improvement"

[packs]
core = true
caveman = true
cavemem = true
rtk = true
frontend-craft = true
"#,
    )
    .unwrap();

    let config = LocalConfig::read_from_path(&path).unwrap();
    assert_eq!(config.models.coordinator.reasoning_effort.as_str(), "xhigh");
    assert_eq!(config.privacy.telemetry.as_str(), "product-improvement");
    assert_eq!(
        config.packs.enabled_names(),
        vec!["core", "caveman", "cavemem", "rtk", "frontend-craft"]
    );
}

#[test]
fn local_config_rejects_disabling_core_pack() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("config.local.toml");
    std::fs::write(
        &path,
        r#"
version = 1

[models.coordinator]
model = "gpt-5.4"
reasoning_effort = "high"

[models.sidecar]
model = "gpt-5.4-mini"
reasoning_effort = "medium"

[models.verifier]
model = "gpt-5.4"
reasoning_effort = "medium"

[packs]
core = false
"#,
    )
    .unwrap();

    let error = LocalConfig::read_from_path(&path).unwrap_err().to_string();
    assert!(error.contains("core pack must stay enabled"));
}

#[test]
fn recommended_presets_use_detected_model_mix_when_available() {
    let environment = CodexEnvironment {
        plan_type: Some("prolite".to_string()),
        available_models: vec![
            AvailableModel {
                slug: "gpt-5.4".to_string(),
                reasoning_efforts: vec![
                    ReasoningEffort::Low,
                    ReasoningEffort::Medium,
                    ReasoningEffort::High,
                    ReasoningEffort::XHigh,
                ],
            },
            AvailableModel {
                slug: "gpt-5.2-codex".to_string(),
                reasoning_efforts: vec![
                    ReasoningEffort::Low,
                    ReasoningEffort::Medium,
                    ReasoningEffort::High,
                    ReasoningEffort::XHigh,
                ],
            },
            AvailableModel {
                slug: "gpt-5.4-mini".to_string(),
                reasoning_efforts: vec![
                    ReasoningEffort::Low,
                    ReasoningEffort::Medium,
                    ReasoningEffort::High,
                    ReasoningEffort::XHigh,
                ],
            },
        ],
    };

    let presets = ModelRolePresets::recommended_for_environment(&environment);
    assert_eq!(presets.coordinator.model, "gpt-5.4");
    assert_eq!(presets.coordinator.reasoning_effort, ReasoningEffort::High);
    assert_eq!(presets.sidecar.model, "gpt-5.4-mini");
    assert_eq!(presets.sidecar.reasoning_effort, ReasoningEffort::Medium);
    assert_eq!(presets.verifier.model, "gpt-5.2-codex");
    assert_eq!(presets.verifier.reasoning_effort, ReasoningEffort::XHigh);
}

#[test]
fn recommended_config_falls_back_when_no_environment_is_detectable() {
    let config = LocalConfig::recommended_for_environment(&CodexEnvironment::default());

    assert_eq!(config.models.coordinator.model, "gpt-5.4");
    assert_eq!(config.models.sidecar.model, "gpt-5.4-mini");
    assert_eq!(config.models.verifier.model, "gpt-5.4");
}

#[test]
fn detect_available_models_from_models_cache_shape() {
    let detected = detect_available_models_from_json(&json!({
        "client_version": "1.0",
        "etag": "ignored",
        "fetched_at": "2026-04-20T00:00:00Z",
        "models": [
            {
                "slug": "unsupported-model",
                "priority": 1,
                "supported_reasoning_levels": [{"effort": "high"}]
            },
            {
                "slug": "gpt-5.4",
                "priority": 20,
                "supported_reasoning_levels": [
                    {"effort": "low"},
                    {"effort": "medium"},
                    {"effort": "high"},
                    {"effort": "xhigh"}
                ]
            },
            {
                "slug": "gpt-5.4-mini",
                "priority": 4,
                "supported_reasoning_efforts": ["low", "medium"]
            },
            {
                "slug": "gpt-5.3-codex",
                "priority": 6,
                "default_reasoning_level": "high"
            }
        ]
    }));

    assert_eq!(
        detected,
        vec![
            AvailableModel {
                slug: "gpt-5.4-mini".to_string(),
                reasoning_efforts: vec![ReasoningEffort::Low, ReasoningEffort::Medium],
            },
            AvailableModel {
                slug: "gpt-5.3-codex".to_string(),
                reasoning_efforts: vec![ReasoningEffort::High],
            },
            AvailableModel {
                slug: "gpt-5.4".to_string(),
                reasoning_efforts: vec![
                    ReasoningEffort::Low,
                    ReasoningEffort::Medium,
                    ReasoningEffort::High,
                    ReasoningEffort::XHigh,
                ],
            },
        ]
    );
}

#[test]
fn detect_plan_type_from_nested_auth_claim() {
    let claims = json!({
        "iss": "https://example.invalid",
        "https://api.openai.com/auth": {
            "chatgpt_plan_type": "prolite",
            "chatgpt_account_id": "acct_123",
        }
    });

    assert_eq!(
        detect_plan_type_from_json(&claims),
        Some("prolite".to_string())
    );
}

#[test]
fn detect_plan_type_from_nested_id_token_claim() {
    let token = jwt_with_auth_claim("team");
    let auth = json!({
        "tokens": {
            "id_token": token,
            "access_token": "ignored"
        }
    });

    assert_eq!(detect_plan_type_from_json(&auth), Some("team".to_string()));
}

#[test]
fn recommended_presets_use_available_models_when_only_one_exists() {
    let environment = CodexEnvironment {
        plan_type: Some("pro".to_string()),
        available_models: vec![AvailableModel {
            slug: "gpt-5.3-codex".to_string(),
            reasoning_efforts: vec![
                ReasoningEffort::Low,
                ReasoningEffort::Medium,
                ReasoningEffort::High,
                ReasoningEffort::XHigh,
            ],
        }],
    };

    let presets = ModelRolePresets::recommended_for_environment(&environment);

    assert_eq!(presets.coordinator.model, "gpt-5.3-codex");
    assert_eq!(presets.coordinator.reasoning_effort, ReasoningEffort::High);
    assert_eq!(presets.sidecar.model, "gpt-5.3-codex");
    assert_eq!(presets.sidecar.reasoning_effort, ReasoningEffort::Medium);
    assert_eq!(presets.verifier.model, "gpt-5.3-codex");
    assert_eq!(presets.verifier.reasoning_effort, ReasoningEffort::XHigh);
}

fn jwt_with_auth_claim(plan_type: &str) -> String {
    use base64::Engine;

    let header = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(r#"{"alg":"none"}"#);
    let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(format!(
        r#"{{"https://api.openai.com/auth":{{"chatgpt_plan_type":"{plan_type}"}}}}"#
    ));
    format!("{header}.{payload}.")
}
