export enum Intent {
  Question = "question",
  Explain = "explain",
  Inspect = "inspect",
  Edit = "edit",
  Debug = "debug",
  Design = "design",
  Review = "review",
  Orchestrate = "orchestrate"
}

export enum TaskShape {
  Trivial = "trivial",
  Local = "local",
  MultiFile = "multi_file",
  Architectural = "architectural",
  LongRunning = "long_running"
}

export enum Level {
  Low = "low",
  Medium = "medium",
  High = "high"
}

export enum Parallelism {
  None = "none",
  Possible = "possible",
  Clear = "clear"
}

export enum RunState {
  Exploring = "exploring",
  Executing = "executing",
  Validating = "validating",
  Blocked = "blocked",
  Closing = "closing"
}

export enum Obligation {
  DirectAnswer = "direct_answer",
  VerifyLight = "verify_light",
  Planning = "planning",
  DebugRigor = "debug_rigor",
  Tdd = "tdd",
  Review = "review",
  SubagentEligible = "subagent_eligible",
  ContextCompaction = "context_compaction",
  SelfRepair = "self_repair"
}

export enum PolicyRule {
  KeepDirectAnswersLight = "keep_direct_answers_light",
  LocalChangesNeedLightVerification = "local_changes_need_light_verification",
  DebuggingNeedsRigor = "debugging_needs_rigor",
  NeedsUpfrontPlanning = "needs_upfront_planning",
  ImplementationNeedsTdd = "implementation_needs_tdd",
  NeedsIndependentReview = "needs_independent_review",
  ParallelWorkCanUseSubagents = "parallel_work_can_use_subagents",
  ContextNeedsCompaction = "context_needs_compaction",
  BlockedRunNeedsSelfRepair = "blocked_run_needs_self_repair"
}

export interface PolicyInput {
  intent: Intent;
  taskShape: TaskShape;
  risk: Level;
  ambiguity: Level;
  parallelism: Parallelism;
  contextPressure: Level;
  runState: RunState;
}

export class PolicyDecision {
  public readonly obligations: readonly Obligation[];

  public constructor(obligations: readonly Obligation[]) {
    this.obligations = [...obligations];
  }

  public has(obligation: Obligation): boolean {
    return this.obligations.includes(obligation);
  }
}

export interface PolicyTraceEntry {
  obligation: Obligation;
  rule: PolicyRule;
}

export interface PolicyExplanation {
  decision: PolicyDecision;
  roles: RolePlan;
  orchestration: OrchestrationGuidance;
  continuation: ContinuationGuidance;
  trace: readonly PolicyTraceEntry[];
}

export interface PolicyScenario {
  id: string;
  summary: string;
  input: PolicyInput;
}

export interface RolePlan {
  coordinator: boolean;
  sidecar: boolean;
  verifier: boolean;
}

export enum SubagentStrategy {
  SoloOnly = "solo_only",
  WaitForIndependentSlices = "wait_for_independent_slices",
  AllowIndependentSlices = "allow_independent_slices"
}

export enum SubagentReadinessReason {
  TaskTooSmall = "task_too_small",
  NoIndependentSlicesIdentified = "no_independent_slices_identified",
  IndependentSlicesNotClear = "independent_slices_not_clear",
  RunStateDisallowsDelegation = "run_state_disallows_delegation",
  IndependentSlicesReady = "independent_slices_ready"
}

export enum ReviewPosture {
  None = "none",
  Light = "light",
  Iterative = "iterative",
  Independent = "independent"
}

export enum VerifierTiming {
  None = "none",
  AfterChangeSet = "after_change_set",
  ThroughoutExecution = "throughout_execution",
  ClosingGate = "closing_gate"
}

export interface OrchestrationGuidance {
  subagents: SubagentStrategy;
  subagentReadiness: SubagentReadinessReason;
  reviewPosture: ReviewPosture;
  verifierTiming: VerifierTiming;
}

export enum ContinuationStrategy {
  AnswerDirectly = "answer_directly",
  ContinueUntilVerified = "continue_until_verified",
  ContinueUntilBlocked = "continue_until_blocked",
  SelfRepairUntilUnblocked = "self_repair_until_unblocked",
  CloseWhenVerified = "close_when_verified"
}

export enum StopCondition {
  Answered = "answered",
  Verified = "verified",
  RealBlockerOrExplicitPause = "real_blocker_or_explicit_pause",
  UnblockedOrNeedsInput = "unblocked_or_needs_input",
  Closed = "closed"
}

export interface ContinuationGuidance {
  strategy: ContinuationStrategy;
  stopCondition: StopCondition;
}

const POLICY_RULE_REASONS: Record<PolicyRule, string> = {
  [PolicyRule.KeepDirectAnswersLight]:
    "simple low-risk questions should stay direct instead of forcing workflow",
  [PolicyRule.LocalChangesNeedLightVerification]:
    "small local edits and inspections still need a quick verification pass",
  [PolicyRule.DebuggingNeedsRigor]:
    "debug work needs stronger verification to avoid false fixes",
  [PolicyRule.NeedsUpfrontPlanning]:
    "high-risk, ambiguous, design-oriented, or long-running work needs planning first",
  [PolicyRule.ImplementationNeedsTdd]:
    "multi-file implementation work should pin behavior with tests before edits",
  [PolicyRule.NeedsIndependentReview]:
    "complex, risky, or closing-stage work needs a reviewer/verifier posture",
  [PolicyRule.ParallelWorkCanUseSubagents]:
    "clear parallel work can justify sidecar help without changing the single-agent default",
  [PolicyRule.ContextNeedsCompaction]:
    "long or crowded runs need compaction before context quality drifts",
  [PolicyRule.BlockedRunNeedsSelfRepair]:
    "blocked runs should switch into bounded self-repair instead of stalling"
};

const CANONICAL_SCENARIOS: readonly PolicyScenario[] = Object.freeze([
  {
    id: "simple-question",
    summary: "simple low-risk question stays direct",
    input: {
      intent: Intent.Question,
      taskShape: TaskShape.Trivial,
      risk: Level.Low,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Exploring
    }
  },
  {
    id: "local-edit",
    summary: "small local edit gets a light verification pass",
    input: {
      intent: Intent.Edit,
      taskShape: TaskShape.Local,
      risk: Level.Low,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Executing
    }
  },
  {
    id: "unknown-bug",
    summary: "debugging stays single-agent but adds rigor",
    input: {
      intent: Intent.Debug,
      taskShape: TaskShape.Local,
      risk: Level.Medium,
      ambiguity: Level.Medium,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Executing
    }
  },
  {
    id: "multi-file-feature",
    summary:
      "complex implementation turns on planning, TDD, review, and sidecar eligibility",
    input: {
      intent: Intent.Edit,
      taskShape: TaskShape.Architectural,
      risk: Level.High,
      ambiguity: Level.Medium,
      parallelism: Parallelism.Clear,
      contextPressure: Level.Medium,
      runState: RunState.Executing
    }
  },
  {
    id: "blocked-long-run",
    summary: "blocked long-running work plans, compacts, reviews, and self-repairs",
    input: {
      intent: Intent.Orchestrate,
      taskShape: TaskShape.LongRunning,
      risk: Level.Medium,
      ambiguity: Level.High,
      parallelism: Parallelism.Possible,
      contextPressure: Level.High,
      runState: RunState.Blocked
    }
  }
]);

export function obligationAsString(obligation: Obligation): string {
  return obligation;
}

export function policyRuleAsString(rule: PolicyRule): string {
  return rule;
}

export function policyRuleReason(rule: PolicyRule): string {
  return POLICY_RULE_REASONS[rule];
}

export function evaluate(input: PolicyInput): PolicyDecision {
  const [decision] = evaluateWithTrace(input);
  return decision;
}

export function explain(input: PolicyInput): PolicyExplanation {
  const [decision, trace] = evaluateWithTrace(input);

  return {
    decision,
    roles: recommendRoles(decision),
    orchestration: recommendOrchestration(input, decision),
    continuation: recommendContinuation(input, decision),
    trace
  };
}

export function canonicalScenarios(): readonly PolicyScenario[] {
  return CANONICAL_SCENARIOS;
}

export function recommendRoles(decision: PolicyDecision): RolePlan {
  return {
    coordinator: true,
    sidecar: decision.has(Obligation.SubagentEligible),
    verifier:
      decision.has(Obligation.VerifyLight) ||
      decision.has(Obligation.DebugRigor) ||
      decision.has(Obligation.Tdd) ||
      decision.has(Obligation.Review)
  };
}

export function recommendOrchestration(
  input: PolicyInput,
  decision: PolicyDecision
): OrchestrationGuidance {
  const [subagents, subagentReadiness] = classifySubagentReadiness(input, decision);

  const reviewPosture = decision.has(Obligation.Review)
    ? ReviewPosture.Independent
    : decision.has(Obligation.DebugRigor) || decision.has(Obligation.Tdd)
      ? ReviewPosture.Iterative
      : decision.has(Obligation.VerifyLight)
        ? ReviewPosture.Light
        : ReviewPosture.None;

  const verifierTiming =
    reviewPosture === ReviewPosture.None
      ? VerifierTiming.None
      : decision.has(Obligation.DebugRigor) ||
          decision.has(Obligation.Tdd) ||
          decision.has(Obligation.SelfRepair)
        ? VerifierTiming.ThroughoutExecution
        : input.runState === RunState.Validating ||
            input.runState === RunState.Closing ||
            decision.has(Obligation.Review)
          ? VerifierTiming.ClosingGate
          : VerifierTiming.AfterChangeSet;

  return {
    subagents,
    subagentReadiness,
    reviewPosture,
    verifierTiming
  };
}

export function recommendContinuation(
  input: PolicyInput,
  decision: PolicyDecision
): ContinuationGuidance {
  if (decision.has(Obligation.SelfRepair)) {
    return {
      strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
      stopCondition: StopCondition.UnblockedOrNeedsInput
    };
  }

  if (input.runState === RunState.Closing) {
    return {
      strategy: ContinuationStrategy.CloseWhenVerified,
      stopCondition: StopCondition.Closed
    };
  }

  if (
    decision.obligations.length === 1 &&
    decision.has(Obligation.DirectAnswer)
  ) {
    return {
      strategy: ContinuationStrategy.AnswerDirectly,
      stopCondition: StopCondition.Answered
    };
  }

  if (
    decision.has(Obligation.VerifyLight) ||
    decision.has(Obligation.DebugRigor) ||
    decision.has(Obligation.Tdd) ||
    decision.has(Obligation.Review)
  ) {
    return {
      strategy: ContinuationStrategy.ContinueUntilVerified,
      stopCondition: StopCondition.Verified
    };
  }

  return {
    strategy: ContinuationStrategy.ContinueUntilBlocked,
    stopCondition: StopCondition.RealBlockerOrExplicitPause
  };
}

function evaluateWithTrace(
  input: PolicyInput
): [PolicyDecision, readonly PolicyTraceEntry[]] {
  const obligations: Obligation[] = [];
  const trace: PolicyTraceEntry[] = [];

  const trivialDirect =
    (input.intent === Intent.Question || input.intent === Intent.Explain) &&
    (input.taskShape === TaskShape.Trivial || input.taskShape === TaskShape.Local) &&
    input.risk === Level.Low &&
    input.ambiguity === Level.Low;

  if (trivialDirect) {
    pushUnique(
      obligations,
      trace,
      Obligation.DirectAnswer,
      PolicyRule.KeepDirectAnswersLight
    );
  }

  if (
    (input.intent === Intent.Edit || input.intent === Intent.Inspect) &&
    (input.taskShape === TaskShape.Trivial || input.taskShape === TaskShape.Local) &&
    input.risk === Level.Low &&
    input.ambiguity !== Level.High
  ) {
    pushUnique(
      obligations,
      trace,
      Obligation.VerifyLight,
      PolicyRule.LocalChangesNeedLightVerification
    );
  }

  if (input.intent === Intent.Debug) {
    pushUnique(
      obligations,
      trace,
      Obligation.DebugRigor,
      PolicyRule.DebuggingNeedsRigor
    );
    pushUnique(
      obligations,
      trace,
      Obligation.VerifyLight,
      PolicyRule.DebuggingNeedsRigor
    );
  }

  if (
    input.intent === Intent.Design ||
    input.intent === Intent.Orchestrate ||
    input.taskShape === TaskShape.Architectural ||
    input.taskShape === TaskShape.LongRunning ||
    input.ambiguity === Level.High ||
    input.risk === Level.High
  ) {
    pushUnique(
      obligations,
      trace,
      Obligation.Planning,
      PolicyRule.NeedsUpfrontPlanning
    );
  }

  if (
    (input.intent === Intent.Edit || input.intent === Intent.Debug) &&
    (input.taskShape === TaskShape.MultiFile ||
      input.taskShape === TaskShape.Architectural ||
      input.taskShape === TaskShape.LongRunning)
  ) {
    pushUnique(
      obligations,
      trace,
      Obligation.Tdd,
      PolicyRule.ImplementationNeedsTdd
    );
  }

  if (
    input.taskShape === TaskShape.MultiFile ||
    input.taskShape === TaskShape.Architectural ||
    input.taskShape === TaskShape.LongRunning ||
    input.intent === Intent.Review ||
    input.runState === RunState.Validating ||
    input.runState === RunState.Closing ||
    input.risk === Level.High
  ) {
    pushUnique(
      obligations,
      trace,
      Obligation.Review,
      PolicyRule.NeedsIndependentReview
    );
  }

  if (
    input.parallelism === Parallelism.Clear &&
    (input.taskShape === TaskShape.MultiFile ||
      input.taskShape === TaskShape.LongRunning ||
      input.taskShape === TaskShape.Architectural) &&
    (input.runState === RunState.Executing || input.runState === RunState.Exploring)
  ) {
    pushUnique(
      obligations,
      trace,
      Obligation.SubagentEligible,
      PolicyRule.ParallelWorkCanUseSubagents
    );
  }

  if (
    input.contextPressure === Level.High ||
    (input.contextPressure === Level.Medium &&
      input.taskShape === TaskShape.LongRunning)
  ) {
    pushUnique(
      obligations,
      trace,
      Obligation.ContextCompaction,
      PolicyRule.ContextNeedsCompaction
    );
  }

  if (input.runState === RunState.Blocked) {
    pushUnique(
      obligations,
      trace,
      Obligation.SelfRepair,
      PolicyRule.BlockedRunNeedsSelfRepair
    );
  }

  return [new PolicyDecision(obligations), trace];
}

function pushUnique(
  obligations: Obligation[],
  trace: PolicyTraceEntry[],
  obligation: Obligation,
  rule: PolicyRule
): void {
  if (obligations.includes(obligation)) {
    return;
  }

  obligations.push(obligation);
  trace.push({ obligation, rule });
}

function classifySubagentReadiness(
  input: PolicyInput,
  decision: PolicyDecision
): [SubagentStrategy, SubagentReadinessReason] {
  const complexParallelShape =
    input.taskShape === TaskShape.MultiFile ||
    input.taskShape === TaskShape.Architectural ||
    input.taskShape === TaskShape.LongRunning;

  if (decision.has(Obligation.SubagentEligible)) {
    return [
      SubagentStrategy.AllowIndependentSlices,
      SubagentReadinessReason.IndependentSlicesReady
    ];
  }

  if (!complexParallelShape) {
    return [SubagentStrategy.SoloOnly, SubagentReadinessReason.TaskTooSmall];
  }

  if (
    input.runState !== RunState.Exploring &&
    input.runState !== RunState.Executing &&
    input.runState !== RunState.Blocked
  ) {
    return [
      SubagentStrategy.SoloOnly,
      SubagentReadinessReason.RunStateDisallowsDelegation
    ];
  }

  if (
    input.runState === RunState.Blocked &&
    input.parallelism === Parallelism.Clear
  ) {
    return [
      SubagentStrategy.SoloOnly,
      SubagentReadinessReason.RunStateDisallowsDelegation
    ];
  }

  if (input.parallelism === Parallelism.Possible) {
    return [
      SubagentStrategy.WaitForIndependentSlices,
      SubagentReadinessReason.IndependentSlicesNotClear
    ];
  }

  return [
    SubagentStrategy.SoloOnly,
    SubagentReadinessReason.NoIndependentSlicesIdentified
  ];
}
