#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Intent {
    Question,
    Explain,
    Inspect,
    Edit,
    Debug,
    Design,
    Review,
    Orchestrate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskShape {
    Trivial,
    Local,
    MultiFile,
    Architectural,
    LongRunning,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Level {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Parallelism {
    None,
    Possible,
    Clear,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunState {
    Exploring,
    Executing,
    Validating,
    Blocked,
    Closing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Obligation {
    DirectAnswer,
    VerifyLight,
    Planning,
    DebugRigor,
    Tdd,
    Review,
    SubagentEligible,
    ContextCompaction,
    SelfRepair,
}

impl Obligation {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::DirectAnswer => "direct_answer",
            Self::VerifyLight => "verify_light",
            Self::Planning => "planning",
            Self::DebugRigor => "debug_rigor",
            Self::Tdd => "tdd",
            Self::Review => "review",
            Self::SubagentEligible => "subagent_eligible",
            Self::ContextCompaction => "context_compaction",
            Self::SelfRepair => "self_repair",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PolicyInput {
    pub intent: Intent,
    pub task_shape: TaskShape,
    pub risk: Level,
    pub ambiguity: Level,
    pub parallelism: Parallelism,
    pub context_pressure: Level,
    pub run_state: RunState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PolicyDecision {
    pub obligations: Vec<Obligation>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PolicyRule {
    KeepDirectAnswersLight,
    LocalChangesNeedLightVerification,
    DebuggingNeedsRigor,
    NeedsUpfrontPlanning,
    ImplementationNeedsTdd,
    NeedsIndependentReview,
    ParallelWorkCanUseSubagents,
    ContextNeedsCompaction,
    BlockedRunNeedsSelfRepair,
}

impl PolicyRule {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::KeepDirectAnswersLight => "keep_direct_answers_light",
            Self::LocalChangesNeedLightVerification => "local_changes_need_light_verification",
            Self::DebuggingNeedsRigor => "debugging_needs_rigor",
            Self::NeedsUpfrontPlanning => "needs_upfront_planning",
            Self::ImplementationNeedsTdd => "implementation_needs_tdd",
            Self::NeedsIndependentReview => "needs_independent_review",
            Self::ParallelWorkCanUseSubagents => "parallel_work_can_use_subagents",
            Self::ContextNeedsCompaction => "context_needs_compaction",
            Self::BlockedRunNeedsSelfRepair => "blocked_run_needs_self_repair",
        }
    }

    pub fn reason(self) -> &'static str {
        match self {
            Self::KeepDirectAnswersLight => {
                "simple low-risk questions should stay direct instead of forcing workflow"
            }
            Self::LocalChangesNeedLightVerification => {
                "small local edits and inspections still need a quick verification pass"
            }
            Self::DebuggingNeedsRigor => {
                "debug work needs stronger verification to avoid false fixes"
            }
            Self::NeedsUpfrontPlanning => {
                "high-risk, ambiguous, design-oriented, or long-running work needs planning first"
            }
            Self::ImplementationNeedsTdd => {
                "multi-file implementation work should pin behavior with tests before edits"
            }
            Self::NeedsIndependentReview => {
                "complex, risky, or closing-stage work needs a reviewer/verifier posture"
            }
            Self::ParallelWorkCanUseSubagents => {
                "clear parallel work can justify sidecar help without changing the single-agent default"
            }
            Self::ContextNeedsCompaction => {
                "long or crowded runs need compaction before context quality drifts"
            }
            Self::BlockedRunNeedsSelfRepair => {
                "blocked runs should switch into bounded self-repair instead of stalling"
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PolicyTraceEntry {
    pub obligation: Obligation,
    pub rule: PolicyRule,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PolicyExplanation {
    pub decision: PolicyDecision,
    pub roles: RolePlan,
    pub orchestration: OrchestrationGuidance,
    pub trace: Vec<PolicyTraceEntry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PolicyScenario {
    pub id: &'static str,
    pub summary: &'static str,
    pub input: PolicyInput,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RolePlan {
    pub coordinator: bool,
    pub sidecar: bool,
    pub verifier: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubagentStrategy {
    SoloOnly,
    WaitForIndependentSlices,
    AllowIndependentSlices,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewPosture {
    None,
    Light,
    Iterative,
    Independent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerifierTiming {
    None,
    AfterChangeSet,
    ThroughoutExecution,
    ClosingGate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OrchestrationGuidance {
    pub subagents: SubagentStrategy,
    pub review_posture: ReviewPosture,
    pub verifier_timing: VerifierTiming,
}

impl PolicyDecision {
    pub fn has(&self, obligation: Obligation) -> bool {
        self.obligations.contains(&obligation)
    }
}

pub fn evaluate(input: PolicyInput) -> PolicyDecision {
    let (decision, _) = evaluate_with_trace(input);
    decision
}

pub fn explain(input: PolicyInput) -> PolicyExplanation {
    let (decision, trace) = evaluate_with_trace(input);
    let roles = recommend_roles(&decision);
    let orchestration = recommend_orchestration(input, &decision);

    PolicyExplanation {
        decision,
        roles,
        orchestration,
        trace,
    }
}

pub fn canonical_scenarios() -> &'static [PolicyScenario] {
    &CANONICAL_SCENARIOS
}

fn evaluate_with_trace(input: PolicyInput) -> (PolicyDecision, Vec<PolicyTraceEntry>) {
    let mut obligations = Vec::new();
    let mut trace = Vec::new();

    let trivial_direct = matches!(input.intent, Intent::Question | Intent::Explain)
        && matches!(input.task_shape, TaskShape::Trivial | TaskShape::Local)
        && input.risk == Level::Low
        && input.ambiguity == Level::Low;

    if trivial_direct {
        push_unique(
            &mut obligations,
            &mut trace,
            Obligation::DirectAnswer,
            PolicyRule::KeepDirectAnswersLight,
        );
    }

    if matches!(input.intent, Intent::Edit | Intent::Inspect)
        && matches!(input.task_shape, TaskShape::Trivial | TaskShape::Local)
        && input.risk == Level::Low
        && input.ambiguity != Level::High
    {
        push_unique(
            &mut obligations,
            &mut trace,
            Obligation::VerifyLight,
            PolicyRule::LocalChangesNeedLightVerification,
        );
    }

    if matches!(input.intent, Intent::Debug) {
        push_unique(
            &mut obligations,
            &mut trace,
            Obligation::DebugRigor,
            PolicyRule::DebuggingNeedsRigor,
        );
        push_unique(
            &mut obligations,
            &mut trace,
            Obligation::VerifyLight,
            PolicyRule::DebuggingNeedsRigor,
        );
    }

    if matches!(input.intent, Intent::Design | Intent::Orchestrate)
        || matches!(
            input.task_shape,
            TaskShape::Architectural | TaskShape::LongRunning
        )
        || input.ambiguity == Level::High
        || input.risk == Level::High
    {
        push_unique(
            &mut obligations,
            &mut trace,
            Obligation::Planning,
            PolicyRule::NeedsUpfrontPlanning,
        );
    }

    if matches!(input.intent, Intent::Edit | Intent::Debug)
        && matches!(
            input.task_shape,
            TaskShape::MultiFile | TaskShape::Architectural | TaskShape::LongRunning
        )
    {
        push_unique(
            &mut obligations,
            &mut trace,
            Obligation::Tdd,
            PolicyRule::ImplementationNeedsTdd,
        );
    }

    if matches!(
        input.task_shape,
        TaskShape::MultiFile | TaskShape::Architectural | TaskShape::LongRunning
    ) || matches!(input.intent, Intent::Review)
        || matches!(input.run_state, RunState::Validating | RunState::Closing)
        || input.risk == Level::High
    {
        push_unique(
            &mut obligations,
            &mut trace,
            Obligation::Review,
            PolicyRule::NeedsIndependentReview,
        );
    }

    if input.parallelism == Parallelism::Clear
        && matches!(
            input.task_shape,
            TaskShape::MultiFile | TaskShape::LongRunning | TaskShape::Architectural
        )
        && matches!(input.run_state, RunState::Executing | RunState::Exploring)
    {
        push_unique(
            &mut obligations,
            &mut trace,
            Obligation::SubagentEligible,
            PolicyRule::ParallelWorkCanUseSubagents,
        );
    }

    if input.context_pressure == Level::High
        || (input.context_pressure == Level::Medium && input.task_shape == TaskShape::LongRunning)
    {
        push_unique(
            &mut obligations,
            &mut trace,
            Obligation::ContextCompaction,
            PolicyRule::ContextNeedsCompaction,
        );
    }

    if input.run_state == RunState::Blocked {
        push_unique(
            &mut obligations,
            &mut trace,
            Obligation::SelfRepair,
            PolicyRule::BlockedRunNeedsSelfRepair,
        );
    }

    (PolicyDecision { obligations }, trace)
}

fn push_unique(
    items: &mut Vec<Obligation>,
    trace: &mut Vec<PolicyTraceEntry>,
    item: Obligation,
    rule: PolicyRule,
) {
    if !items.contains(&item) {
        items.push(item);
        trace.push(PolicyTraceEntry {
            obligation: item,
            rule,
        });
    }
}

pub fn recommend_roles(decision: &PolicyDecision) -> RolePlan {
    let verifier = decision.has(Obligation::VerifyLight)
        || decision.has(Obligation::DebugRigor)
        || decision.has(Obligation::Tdd)
        || decision.has(Obligation::Review);

    RolePlan {
        coordinator: true,
        sidecar: decision.has(Obligation::SubagentEligible),
        verifier,
    }
}

pub fn recommend_orchestration(
    input: PolicyInput,
    decision: &PolicyDecision,
) -> OrchestrationGuidance {
    let complex_parallel_shape = matches!(
        input.task_shape,
        TaskShape::MultiFile | TaskShape::Architectural | TaskShape::LongRunning
    );

    let subagents = if decision.has(Obligation::SubagentEligible) {
        SubagentStrategy::AllowIndependentSlices
    } else if input.parallelism == Parallelism::Possible
        && complex_parallel_shape
        && matches!(
            input.run_state,
            RunState::Exploring | RunState::Executing | RunState::Blocked
        )
    {
        SubagentStrategy::WaitForIndependentSlices
    } else {
        SubagentStrategy::SoloOnly
    };

    let review_posture = if decision.has(Obligation::Review) {
        ReviewPosture::Independent
    } else if decision.has(Obligation::DebugRigor) || decision.has(Obligation::Tdd) {
        ReviewPosture::Iterative
    } else if decision.has(Obligation::VerifyLight) {
        ReviewPosture::Light
    } else {
        ReviewPosture::None
    };

    let verifier_timing = if review_posture == ReviewPosture::None {
        VerifierTiming::None
    } else if decision.has(Obligation::DebugRigor)
        || decision.has(Obligation::Tdd)
        || decision.has(Obligation::SelfRepair)
    {
        VerifierTiming::ThroughoutExecution
    } else if matches!(input.run_state, RunState::Validating | RunState::Closing)
        || decision.has(Obligation::Review)
    {
        VerifierTiming::ClosingGate
    } else {
        VerifierTiming::AfterChangeSet
    };

    OrchestrationGuidance {
        subagents,
        review_posture,
        verifier_timing,
    }
}

const CANONICAL_SCENARIOS: [PolicyScenario; 5] = [
    PolicyScenario {
        id: "simple-question",
        summary: "simple low-risk question stays direct",
        input: PolicyInput {
            intent: Intent::Question,
            task_shape: TaskShape::Trivial,
            risk: Level::Low,
            ambiguity: Level::Low,
            parallelism: Parallelism::None,
            context_pressure: Level::Low,
            run_state: RunState::Exploring,
        },
    },
    PolicyScenario {
        id: "local-edit",
        summary: "small local edit gets a light verification pass",
        input: PolicyInput {
            intent: Intent::Edit,
            task_shape: TaskShape::Local,
            risk: Level::Low,
            ambiguity: Level::Low,
            parallelism: Parallelism::None,
            context_pressure: Level::Low,
            run_state: RunState::Executing,
        },
    },
    PolicyScenario {
        id: "unknown-bug",
        summary: "debugging stays single-agent but adds rigor",
        input: PolicyInput {
            intent: Intent::Debug,
            task_shape: TaskShape::Local,
            risk: Level::Medium,
            ambiguity: Level::Medium,
            parallelism: Parallelism::None,
            context_pressure: Level::Low,
            run_state: RunState::Executing,
        },
    },
    PolicyScenario {
        id: "multi-file-feature",
        summary: "complex implementation turns on planning, TDD, review, and sidecar eligibility",
        input: PolicyInput {
            intent: Intent::Edit,
            task_shape: TaskShape::Architectural,
            risk: Level::High,
            ambiguity: Level::Medium,
            parallelism: Parallelism::Clear,
            context_pressure: Level::Medium,
            run_state: RunState::Executing,
        },
    },
    PolicyScenario {
        id: "blocked-long-run",
        summary: "blocked long-running work plans, compacts, reviews, and self-repairs",
        input: PolicyInput {
            intent: Intent::Orchestrate,
            task_shape: TaskShape::LongRunning,
            risk: Level::Medium,
            ambiguity: Level::High,
            parallelism: Parallelism::Possible,
            context_pressure: Level::High,
            run_state: RunState::Blocked,
        },
    },
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_question_stays_light() {
        let decision = evaluate(PolicyInput {
            intent: Intent::Question,
            task_shape: TaskShape::Trivial,
            risk: Level::Low,
            ambiguity: Level::Low,
            parallelism: Parallelism::None,
            context_pressure: Level::Low,
            run_state: RunState::Exploring,
        });

        assert!(decision.has(Obligation::DirectAnswer));
        assert!(!decision.has(Obligation::Planning));
        assert!(!decision.has(Obligation::Tdd));
        assert!(!decision.has(Obligation::Review));
    }

    #[test]
    fn local_edit_gets_light_verification() {
        let decision = evaluate(PolicyInput {
            intent: Intent::Edit,
            task_shape: TaskShape::Local,
            risk: Level::Low,
            ambiguity: Level::Low,
            parallelism: Parallelism::None,
            context_pressure: Level::Low,
            run_state: RunState::Executing,
        });

        assert!(decision.has(Obligation::VerifyLight));
        assert!(!decision.has(Obligation::Planning));
    }

    #[test]
    fn debug_task_gets_debug_rigor() {
        let decision = evaluate(PolicyInput {
            intent: Intent::Debug,
            task_shape: TaskShape::Local,
            risk: Level::Medium,
            ambiguity: Level::Medium,
            parallelism: Parallelism::None,
            context_pressure: Level::Low,
            run_state: RunState::Executing,
        });

        assert!(decision.has(Obligation::DebugRigor));
        assert!(decision.has(Obligation::VerifyLight));
    }

    #[test]
    fn complex_feature_gets_heavy_obligations() {
        let decision = evaluate(PolicyInput {
            intent: Intent::Edit,
            task_shape: TaskShape::Architectural,
            risk: Level::High,
            ambiguity: Level::Medium,
            parallelism: Parallelism::Clear,
            context_pressure: Level::Medium,
            run_state: RunState::Executing,
        });

        assert!(decision.has(Obligation::Planning));
        assert!(decision.has(Obligation::Tdd));
        assert!(decision.has(Obligation::Review));
        assert!(decision.has(Obligation::SubagentEligible));
    }

    #[test]
    fn long_running_pressure_triggers_compaction() {
        let decision = evaluate(PolicyInput {
            intent: Intent::Orchestrate,
            task_shape: TaskShape::LongRunning,
            risk: Level::Medium,
            ambiguity: Level::Medium,
            parallelism: Parallelism::Possible,
            context_pressure: Level::High,
            run_state: RunState::Executing,
        });

        assert!(decision.has(Obligation::Planning));
        assert!(decision.has(Obligation::ContextCompaction));
        assert!(decision.has(Obligation::Review));
    }

    #[test]
    fn blocked_state_triggers_self_repair() {
        let decision = evaluate(PolicyInput {
            intent: Intent::Inspect,
            task_shape: TaskShape::Local,
            risk: Level::Low,
            ambiguity: Level::Low,
            parallelism: Parallelism::None,
            context_pressure: Level::Low,
            run_state: RunState::Blocked,
        });

        assert!(decision.has(Obligation::SelfRepair));
    }

    #[test]
    fn direct_question_stays_coordinator_only() {
        let decision = evaluate(PolicyInput {
            intent: Intent::Question,
            task_shape: TaskShape::Trivial,
            risk: Level::Low,
            ambiguity: Level::Low,
            parallelism: Parallelism::None,
            context_pressure: Level::Low,
            run_state: RunState::Exploring,
        });

        let roles = recommend_roles(&decision);

        assert!(roles.coordinator);
        assert!(!roles.sidecar);
        assert!(!roles.verifier);
    }

    #[test]
    fn complex_feature_gets_all_roles() {
        let decision = evaluate(PolicyInput {
            intent: Intent::Edit,
            task_shape: TaskShape::Architectural,
            risk: Level::High,
            ambiguity: Level::Medium,
            parallelism: Parallelism::Clear,
            context_pressure: Level::Medium,
            run_state: RunState::Executing,
        });

        let roles = recommend_roles(&decision);

        assert!(roles.coordinator);
        assert!(roles.sidecar);
        assert!(roles.verifier);
    }

    #[test]
    fn local_edit_keeps_light_review_after_change_set() {
        let input = PolicyInput {
            intent: Intent::Edit,
            task_shape: TaskShape::Local,
            risk: Level::Low,
            ambiguity: Level::Low,
            parallelism: Parallelism::None,
            context_pressure: Level::Low,
            run_state: RunState::Executing,
        };
        let decision = evaluate(input);

        let orchestration = recommend_orchestration(input, &decision);

        assert_eq!(orchestration.subagents, SubagentStrategy::SoloOnly);
        assert_eq!(orchestration.review_posture, ReviewPosture::Light);
        assert_eq!(orchestration.verifier_timing, VerifierTiming::AfterChangeSet);
    }

    #[test]
    fn possible_parallel_work_stays_single_agent_until_slices_are_clear() {
        let input = PolicyInput {
            intent: Intent::Orchestrate,
            task_shape: TaskShape::LongRunning,
            risk: Level::Medium,
            ambiguity: Level::Medium,
            parallelism: Parallelism::Possible,
            context_pressure: Level::Medium,
            run_state: RunState::Exploring,
        };
        let decision = evaluate(input);

        let orchestration = recommend_orchestration(input, &decision);

        assert!(!decision.has(Obligation::SubagentEligible));
        assert_eq!(
            orchestration.subagents,
            SubagentStrategy::WaitForIndependentSlices
        );
        assert_eq!(orchestration.review_posture, ReviewPosture::Independent);
        assert_eq!(orchestration.verifier_timing, VerifierTiming::ClosingGate);
    }
}
