use sane_policy::{
    Level, Obligation, Parallelism, PolicyRule, RunState, TaskShape, canonical_scenarios, explain,
};

#[test]
fn canonical_scenarios_stay_stable() {
    let scenarios = canonical_scenarios();
    let ids = scenarios
        .iter()
        .map(|scenario| scenario.id)
        .collect::<Vec<_>>();

    assert_eq!(
        ids,
        vec![
            "simple-question",
            "local-edit",
            "unknown-bug",
            "multi-file-feature",
            "blocked-long-run",
        ]
    );

    let blocked = scenarios
        .iter()
        .find(|scenario| scenario.id == "blocked-long-run")
        .expect("blocked-long-run fixture");

    assert_eq!(blocked.input.task_shape, TaskShape::LongRunning);
    assert_eq!(blocked.input.risk, Level::Medium);
    assert_eq!(blocked.input.ambiguity, Level::High);
    assert_eq!(blocked.input.parallelism, Parallelism::Possible);
    assert_eq!(blocked.input.run_state, RunState::Blocked);
}

#[test]
fn explain_traces_why_a_complex_feature_gets_heavy_obligations() {
    let scenario = canonical_scenarios()
        .iter()
        .find(|scenario| scenario.id == "multi-file-feature")
        .expect("multi-file-feature fixture");

    let explanation = explain(scenario.input);
    let traced_rules = explanation
        .trace
        .iter()
        .map(|entry| (entry.obligation, entry.rule))
        .collect::<Vec<_>>();

    assert!(explanation.decision.has(Obligation::Planning));
    assert!(explanation.decision.has(Obligation::Tdd));
    assert!(explanation.decision.has(Obligation::Review));
    assert!(explanation.decision.has(Obligation::SubagentEligible));
    assert!(explanation.roles.coordinator);
    assert!(explanation.roles.sidecar);
    assert!(explanation.roles.verifier);

    assert_eq!(
        traced_rules,
        vec![
            (Obligation::Planning, PolicyRule::NeedsUpfrontPlanning),
            (Obligation::Tdd, PolicyRule::ImplementationNeedsTdd),
            (Obligation::Review, PolicyRule::NeedsIndependentReview),
            (
                Obligation::SubagentEligible,
                PolicyRule::ParallelWorkCanUseSubagents,
            ),
        ]
    );
}

#[test]
fn obligation_labels_are_stable_and_backend_owned() {
    assert_eq!(Obligation::DirectAnswer.as_str(), "direct_answer");
    assert_eq!(Obligation::VerifyLight.as_str(), "verify_light");
    assert_eq!(Obligation::Planning.as_str(), "planning");
    assert_eq!(Obligation::DebugRigor.as_str(), "debug_rigor");
    assert_eq!(Obligation::Tdd.as_str(), "tdd");
    assert_eq!(Obligation::Review.as_str(), "review");
    assert_eq!(Obligation::SubagentEligible.as_str(), "subagent_eligible");
    assert_eq!(Obligation::ContextCompaction.as_str(), "context_compaction");
    assert_eq!(Obligation::SelfRepair.as_str(), "self_repair");
}
