import { describe, expect, it } from "vitest";
import {
  Intent,
  TaskShape,
  Level,
  Parallelism,
  RunState,
  Obligation,
  PolicyRule,
  ContinuationStrategy,
  ReviewPosture,
  StopCondition,
  SubagentReadinessReason,
  SubagentStrategy,
  VerifierTiming,
  evaluate,
  explain,
  canonicalScenarios,
  recommendOrchestration,
  recommendContinuation,
  recommendRoles,
  obligationAsString,
  policyRuleAsString,
  policyRuleReason
} from "../src/index.js";

describe("evaluate", () => {
  it("keeps simple low-risk questions direct", () => {
    const decision = evaluate({
      intent: Intent.Question,
      taskShape: TaskShape.Trivial,
      risk: Level.Low,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Exploring
    });

    expect(decision.has(Obligation.DirectAnswer)).toBe(true);
    expect(decision.has(Obligation.Planning)).toBe(false);
    expect(decision.has(Obligation.Tdd)).toBe(false);
    expect(decision.has(Obligation.Review)).toBe(false);
  });

  it("adds light verification for small local edits", () => {
    const decision = evaluate({
      intent: Intent.Edit,
      taskShape: TaskShape.Local,
      risk: Level.Low,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Executing
    });

    expect(decision.obligations).toEqual([Obligation.VerifyLight]);
  });

  it("adds debug rigor and verification for debug work", () => {
    const decision = evaluate({
      intent: Intent.Debug,
      taskShape: TaskShape.Local,
      risk: Level.Medium,
      ambiguity: Level.Medium,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Executing
    });

    expect(decision.obligations).toEqual([
      Obligation.DebugRigor,
      Obligation.VerifyLight
    ]);
  });

  it("turns on planning, tdd, review, and sidecar eligibility for complex edits", () => {
    const decision = evaluate({
      intent: Intent.Edit,
      taskShape: TaskShape.Architectural,
      risk: Level.High,
      ambiguity: Level.Medium,
      parallelism: Parallelism.Clear,
      contextPressure: Level.Medium,
      runState: RunState.Executing
    });

    expect(decision.obligations).toEqual([
      Obligation.Planning,
      Obligation.Tdd,
      Obligation.Review,
      Obligation.SubagentEligible
    ]);
  });

  it("adds compaction for pressured long-running work", () => {
    const decision = evaluate({
      intent: Intent.Orchestrate,
      taskShape: TaskShape.LongRunning,
      risk: Level.Medium,
      ambiguity: Level.Medium,
      parallelism: Parallelism.Possible,
      contextPressure: Level.High,
      runState: RunState.Executing
    });

    expect(decision.obligations).toEqual([
      Obligation.Planning,
      Obligation.Review,
      Obligation.ContextCompaction
    ]);
  });

  it("adds self-repair when blocked", () => {
    const decision = evaluate({
      intent: Intent.Inspect,
      taskShape: TaskShape.Local,
      risk: Level.Low,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Blocked
    });

    expect(decision.obligations).toEqual([
      Obligation.VerifyLight,
      Obligation.SelfRepair
    ]);
  });
});

describe("recommendRoles", () => {
  it("keeps direct questions coordinator-only", () => {
    const roles = recommendRoles(
      evaluate({
        intent: Intent.Question,
        taskShape: TaskShape.Trivial,
        risk: Level.Low,
        ambiguity: Level.Low,
        parallelism: Parallelism.None,
        contextPressure: Level.Low,
        runState: RunState.Exploring
      })
    );

    expect(roles).toEqual({
      coordinator: true,
      sidecar: false,
      verifier: false
    });
  });

  it("turns on all roles for complex features", () => {
    const roles = recommendRoles(
      evaluate({
        intent: Intent.Edit,
        taskShape: TaskShape.Architectural,
        risk: Level.High,
        ambiguity: Level.Medium,
        parallelism: Parallelism.Clear,
        contextPressure: Level.Medium,
        runState: RunState.Executing
      })
    );

    expect(roles).toEqual({
      coordinator: true,
      sidecar: true,
      verifier: true
    });
  });
});

describe("recommendOrchestration", () => {
  it("keeps local edits single-agent with light review after the change set", () => {
    const input = {
      intent: Intent.Edit,
      taskShape: TaskShape.Local,
      risk: Level.Low,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Executing
    };

    expect(recommendOrchestration(input, evaluate(input))).toEqual({
      subagents: SubagentStrategy.SoloOnly,
      subagentReadiness: SubagentReadinessReason.TaskTooSmall,
      reviewPosture: ReviewPosture.Light,
      verifierTiming: VerifierTiming.AfterChangeSet
    });
  });

  it("waits for clear slices before parallelizing", () => {
    const input = {
      intent: Intent.Orchestrate,
      taskShape: TaskShape.LongRunning,
      risk: Level.Medium,
      ambiguity: Level.Medium,
      parallelism: Parallelism.Possible,
      contextPressure: Level.Medium,
      runState: RunState.Exploring
    };

    expect(recommendOrchestration(input, evaluate(input))).toEqual({
      subagents: SubagentStrategy.WaitForIndependentSlices,
      subagentReadiness: SubagentReadinessReason.IndependentSlicesNotClear,
      reviewPosture: ReviewPosture.Independent,
      verifierTiming: VerifierTiming.ClosingGate
    });
  });

  it("blocks subagents during validating even when slices are otherwise clear", () => {
    const input = {
      intent: Intent.Edit,
      taskShape: TaskShape.Architectural,
      risk: Level.Medium,
      ambiguity: Level.Low,
      parallelism: Parallelism.Clear,
      contextPressure: Level.Low,
      runState: RunState.Validating
    };

    expect(recommendOrchestration(input, evaluate(input))).toEqual({
      subagents: SubagentStrategy.SoloOnly,
      subagentReadiness: SubagentReadinessReason.RunStateDisallowsDelegation,
      reviewPosture: ReviewPosture.Independent,
      verifierTiming: VerifierTiming.ThroughoutExecution
    });
  });

  it("keeps blocked clear-parallel work single-agent", () => {
    const input = {
      intent: Intent.Orchestrate,
      taskShape: TaskShape.LongRunning,
      risk: Level.Medium,
      ambiguity: Level.Low,
      parallelism: Parallelism.Clear,
      contextPressure: Level.Medium,
      runState: RunState.Blocked
    };

    expect(recommendOrchestration(input, evaluate(input))).toEqual({
      subagents: SubagentStrategy.SoloOnly,
      subagentReadiness: SubagentReadinessReason.RunStateDisallowsDelegation,
      reviewPosture: ReviewPosture.Independent,
      verifierTiming: VerifierTiming.ThroughoutExecution
    });
  });

  it("reports no independent slices when parallelism is absent", () => {
    const input = {
      intent: Intent.Orchestrate,
      taskShape: TaskShape.LongRunning,
      risk: Level.Medium,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Medium,
      runState: RunState.Executing
    };

    expect(recommendOrchestration(input, evaluate(input))).toEqual({
      subagents: SubagentStrategy.SoloOnly,
      subagentReadiness: SubagentReadinessReason.NoIndependentSlicesIdentified,
      reviewPosture: ReviewPosture.Independent,
      verifierTiming: VerifierTiming.ClosingGate
    });
  });
});

describe("recommendContinuation", () => {
  it("answers direct questions without inventing process", () => {
    const input = {
      intent: Intent.Question,
      taskShape: TaskShape.Trivial,
      risk: Level.Low,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Exploring
    };

    expect(recommendContinuation(input, evaluate(input))).toEqual({
      strategy: ContinuationStrategy.AnswerDirectly,
      stopCondition: StopCondition.Answered
    });
  });

  it("keeps implementation work moving until verified", () => {
    const input = {
      intent: Intent.Edit,
      taskShape: TaskShape.Architectural,
      risk: Level.High,
      ambiguity: Level.Medium,
      parallelism: Parallelism.Clear,
      contextPressure: Level.Medium,
      runState: RunState.Executing
    };

    expect(recommendContinuation(input, evaluate(input))).toEqual({
      strategy: ContinuationStrategy.ContinueUntilVerified,
      stopCondition: StopCondition.Verified
    });
  });

  it("switches blocked work into bounded self-repair", () => {
    const input = {
      intent: Intent.Debug,
      taskShape: TaskShape.Local,
      risk: Level.High,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Blocked
    };

    expect(recommendContinuation(input, evaluate(input))).toEqual({
      strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
      stopCondition: StopCondition.UnblockedOrNeedsInput
    });
  });

  it("continues planning-only work until a real blocker or pause", () => {
    const input = {
      intent: Intent.Design,
      taskShape: TaskShape.Local,
      risk: Level.Medium,
      ambiguity: Level.High,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Exploring
    };

    expect(recommendContinuation(input, evaluate(input))).toEqual({
      strategy: ContinuationStrategy.ContinueUntilBlocked,
      stopCondition: StopCondition.RealBlockerOrExplicitPause
    });
  });

  it("keeps validating work moving until verification is complete", () => {
    const input = {
      intent: Intent.Edit,
      taskShape: TaskShape.Local,
      risk: Level.Low,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Validating
    };

    expect(recommendContinuation(input, evaluate(input))).toEqual({
      strategy: ContinuationStrategy.ContinueUntilVerified,
      stopCondition: StopCondition.Verified
    });
  });

  it("closes closing-state work only after verification", () => {
    const input = {
      intent: Intent.Question,
      taskShape: TaskShape.Trivial,
      risk: Level.Low,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Closing
    };

    expect(recommendContinuation(input, evaluate(input))).toEqual({
      strategy: ContinuationStrategy.CloseWhenVerified,
      stopCondition: StopCondition.Closed
    });
  });
});

describe("explain", () => {
  it("returns decision, roles, orchestration, and ordered trace", () => {
    const explanation = explain({
      intent: Intent.Edit,
      taskShape: TaskShape.Architectural,
      risk: Level.High,
      ambiguity: Level.Medium,
      parallelism: Parallelism.Clear,
      contextPressure: Level.Medium,
      runState: RunState.Executing
    });

    expect(explanation.decision.obligations).toEqual([
      Obligation.Planning,
      Obligation.Tdd,
      Obligation.Review,
      Obligation.SubagentEligible
    ]);
    expect(explanation.roles).toEqual({
      coordinator: true,
      sidecar: true,
      verifier: true
    });
    expect(explanation.orchestration).toEqual({
      subagents: SubagentStrategy.AllowIndependentSlices,
      subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
      reviewPosture: ReviewPosture.Independent,
      verifierTiming: VerifierTiming.ThroughoutExecution
    });
    expect(explanation.continuation).toEqual({
      strategy: ContinuationStrategy.ContinueUntilVerified,
      stopCondition: StopCondition.Verified
    });
    expect(explanation.trace).toEqual([
      {
        obligation: Obligation.Planning,
        rule: PolicyRule.NeedsUpfrontPlanning
      },
      {
        obligation: Obligation.Tdd,
        rule: PolicyRule.ImplementationNeedsTdd
      },
      {
        obligation: Obligation.Review,
        rule: PolicyRule.NeedsIndependentReview
      },
      {
        obligation: Obligation.SubagentEligible,
        rule: PolicyRule.ParallelWorkCanUseSubagents
      }
    ]);
  });
});

describe("helpers", () => {
  it("exposes obligation and rule string ids", () => {
    expect(obligationAsString(Obligation.ContextCompaction)).toBe(
      "context_compaction"
    );
    expect(policyRuleAsString(PolicyRule.NeedsIndependentReview)).toBe(
      "needs_independent_review"
    );
  });

  it("exposes stable rule reasons", () => {
    expect(policyRuleReason(PolicyRule.KeepDirectAnswersLight)).toBe(
      "simple low-risk questions should stay direct instead of forcing workflow"
    );
    expect(policyRuleReason(PolicyRule.BlockedRunNeedsSelfRepair)).toBe(
      "blocked runs should switch into bounded self-repair instead of stalling"
    );
  });

  it("returns canonical scenarios with stable ids and behavior", () => {
    const scenarios = canonicalScenarios();

    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "simple-question",
      "local-edit",
      "unknown-bug",
      "multi-file-feature",
      "blocked-long-run"
    ]);

    expect(evaluate(scenarios[0]!.input).obligations).toEqual([
      Obligation.DirectAnswer
    ]);
    expect(evaluate(scenarios[4]!.input).obligations).toEqual([
      Obligation.Planning,
      Obligation.Review,
      Obligation.ContextCompaction,
      Obligation.SelfRepair
    ]);
  });
});
