use sane_policy::{
    Level, Obligation, Parallelism, PolicyRule, ReviewPosture, RunState, SubagentReadinessReason,
    SubagentStrategy, TaskShape, VerifierTiming, canonical_scenarios, explain,
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
        explanation.orchestration.subagents,
        SubagentStrategy::AllowIndependentSlices
    );
    assert_eq!(
        explanation.orchestration.subagent_readiness,
        SubagentReadinessReason::IndependentSlicesReady
    );
    assert_eq!(
        explanation.orchestration.review_posture,
        ReviewPosture::Independent
    );
    assert_eq!(
        explanation.orchestration.verifier_timing,
        VerifierTiming::ThroughoutExecution
    );

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
fn blocked_long_run_keeps_subagents_disallowed_until_parallel_slices_are_clear() {
    let scenario = canonical_scenarios()
        .iter()
        .find(|scenario| scenario.id == "blocked-long-run")
        .expect("blocked-long-run fixture");

    let explanation = explain(scenario.input);

    assert!(!explanation.decision.has(Obligation::SubagentEligible));
    assert_eq!(
        explanation.orchestration.subagents,
        SubagentStrategy::WaitForIndependentSlices
    );
    assert_eq!(
        explanation.orchestration.subagent_readiness,
        SubagentReadinessReason::IndependentSlicesNotClear
    );
    assert_eq!(
        explanation.orchestration.review_posture,
        ReviewPosture::Independent
    );
    assert_eq!(
        explanation.orchestration.verifier_timing,
        VerifierTiming::ThroughoutExecution
    );
}

#[test]
fn simple_question_stays_single_agent_without_review_posture() {
    let scenario = canonical_scenarios()
        .iter()
        .find(|scenario| scenario.id == "simple-question")
        .expect("simple-question fixture");

    let explanation = explain(scenario.input);

    assert_eq!(
        explanation.orchestration.subagents,
        SubagentStrategy::SoloOnly
    );
    assert_eq!(
        explanation.orchestration.subagent_readiness,
        SubagentReadinessReason::TaskTooSmall
    );
    assert_eq!(
        explanation.orchestration.review_posture,
        ReviewPosture::None
    );
    assert_eq!(
        explanation.orchestration.verifier_timing,
        VerifierTiming::None
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

#[test]
fn validating_phase_blocks_subagents_even_for_clear_parallel_work() {
    let explanation = explain(sane_policy::PolicyInput {
        intent: sane_policy::Intent::Edit,
        task_shape: TaskShape::Architectural,
        risk: Level::Medium,
        ambiguity: Level::Low,
        parallelism: Parallelism::Clear,
        context_pressure: Level::Low,
        run_state: RunState::Validating,
    });

    assert_eq!(
        explanation.orchestration.subagents,
        SubagentStrategy::SoloOnly
    );
    assert_eq!(
        explanation.orchestration.subagent_readiness,
        SubagentReadinessReason::RunStateDisallowsDelegation
    );
}
