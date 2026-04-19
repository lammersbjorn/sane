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

impl PolicyDecision {
    pub fn has(&self, obligation: Obligation) -> bool {
        self.obligations.contains(&obligation)
    }
}

pub fn evaluate(input: PolicyInput) -> PolicyDecision {
    let mut obligations = Vec::new();

    let trivial_direct = matches!(input.intent, Intent::Question | Intent::Explain)
        && matches!(input.task_shape, TaskShape::Trivial | TaskShape::Local)
        && input.risk == Level::Low
        && input.ambiguity == Level::Low;

    if trivial_direct {
        push_unique(&mut obligations, Obligation::DirectAnswer);
    }

    if matches!(input.intent, Intent::Edit | Intent::Inspect)
        && matches!(input.task_shape, TaskShape::Trivial | TaskShape::Local)
        && input.risk == Level::Low
        && input.ambiguity != Level::High
    {
        push_unique(&mut obligations, Obligation::VerifyLight);
    }

    if matches!(input.intent, Intent::Debug) {
        push_unique(&mut obligations, Obligation::DebugRigor);
        push_unique(&mut obligations, Obligation::VerifyLight);
    }

    if matches!(input.intent, Intent::Design | Intent::Orchestrate)
        || matches!(
            input.task_shape,
            TaskShape::Architectural | TaskShape::LongRunning
        )
        || input.ambiguity == Level::High
        || input.risk == Level::High
    {
        push_unique(&mut obligations, Obligation::Planning);
    }

    if matches!(input.intent, Intent::Edit | Intent::Debug)
        && matches!(
            input.task_shape,
            TaskShape::MultiFile | TaskShape::Architectural | TaskShape::LongRunning
        )
    {
        push_unique(&mut obligations, Obligation::Tdd);
    }

    if matches!(
        input.task_shape,
        TaskShape::MultiFile | TaskShape::Architectural | TaskShape::LongRunning
    ) || matches!(input.intent, Intent::Review)
        || matches!(input.run_state, RunState::Validating | RunState::Closing)
        || input.risk == Level::High
    {
        push_unique(&mut obligations, Obligation::Review);
    }

    if input.parallelism == Parallelism::Clear
        && matches!(
            input.task_shape,
            TaskShape::MultiFile | TaskShape::LongRunning | TaskShape::Architectural
        )
        && matches!(input.run_state, RunState::Executing | RunState::Exploring)
    {
        push_unique(&mut obligations, Obligation::SubagentEligible);
    }

    if input.context_pressure == Level::High
        || (input.context_pressure == Level::Medium && input.task_shape == TaskShape::LongRunning)
    {
        push_unique(&mut obligations, Obligation::ContextCompaction);
    }

    if input.run_state == RunState::Blocked {
        push_unique(&mut obligations, Obligation::SelfRepair);
    }

    PolicyDecision { obligations }
}

fn push_unique(items: &mut Vec<Obligation>, item: Obligation) {
    if !items.contains(&item) {
        items.push(item);
    }
}

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
}
