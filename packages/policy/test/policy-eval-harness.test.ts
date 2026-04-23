import { describe, expect, it } from "vitest";

import {
  Intent,
  Level,
  Obligation,
  Parallelism,
  PolicyRule,
  RunState,
  StopCondition,
  SubagentReadinessReason,
  SubagentStrategy,
  TaskShape,
  ContinuationStrategy,
  VerifierTiming,
  b7PolicyEvalFixtures,
  canonicalPolicyEvalFixtures,
  evaluatePolicyFixtures,
  outcomeRunnerPreflightFixtures,
  type PolicyEvalFixture
} from "../src/index.js";

describe("policy eval harness", () => {
  it("passes fixtures that pin obligations, orchestration, and continuation", () => {
    const fixtures: PolicyEvalFixture[] = [
      {
        caseId: "simple-question",
        input: {
          intent: Intent.Question,
          taskShape: TaskShape.Trivial,
          risk: Level.Low,
          ambiguity: Level.Low,
          parallelism: Parallelism.None,
          contextPressure: Level.Low,
          runState: RunState.Exploring
        },
        expected: {
          obligations: [Obligation.DirectAnswer],
          continuation: {
            strategy: ContinuationStrategy.AnswerDirectly,
            stopCondition: StopCondition.Answered
          },
          orchestration: {
            subagents: SubagentStrategy.SoloOnly
          }
        }
      },
      {
        caseId: "compacted-self-repair",
        input: {
          intent: Intent.Orchestrate,
          taskShape: TaskShape.LongRunning,
          risk: Level.Medium,
          ambiguity: Level.High,
          parallelism: Parallelism.Possible,
          contextPressure: Level.High,
          runState: RunState.Blocked
        },
        expected: {
          obligations: [
            Obligation.Planning,
            Obligation.Review,
            Obligation.ContextCompaction,
            Obligation.SelfRepair
          ],
          continuation: {
            strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
            stopCondition: StopCondition.UnblockedOrNeedsInput
          },
          orchestration: {
            subagents: SubagentStrategy.WaitForIndependentSlices
          },
          trace: [
            {
              obligation: Obligation.Planning,
              rule: PolicyRule.NeedsUpfrontPlanning
            },
            {
              obligation: Obligation.Review,
              rule: PolicyRule.NeedsIndependentReview
            },
            {
              obligation: Obligation.ContextCompaction,
              rule: PolicyRule.ContextNeedsCompaction
            },
            {
              obligation: Obligation.SelfRepair,
              rule: PolicyRule.BlockedRunNeedsSelfRepair
            }
          ]
        }
      }
    ];

    expect(evaluatePolicyFixtures(fixtures)).toEqual({
      passed: true,
      caseCount: 2,
      failureCount: 0,
      failures: []
    });
  });

  it("evaluates the canonical policy suite", () => {
    const fixtures = canonicalPolicyEvalFixtures();

    expect(fixtures.map((fixture) => fixture.caseId)).toEqual([
      "simple-question",
      "local-edit",
      "unknown-bug",
      "multi-file-feature",
      "blocked-long-run"
    ]);
    expect(evaluatePolicyFixtures(fixtures)).toEqual({
      passed: true,
      caseCount: 5,
      failureCount: 0,
      failures: []
    });
    expect(fixtures.find((fixture) => fixture.caseId === "multi-file-feature")?.expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.Planning,
          Obligation.Tdd,
          Obligation.Review,
          Obligation.SubagentEligible
        ],
        orchestration: expect.objectContaining({
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ThroughoutExecution
        })
      })
    );
    expect(fixtures.find((fixture) => fixture.caseId === "blocked-long-run")?.expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.Planning,
          Obligation.Review,
          Obligation.ContextCompaction,
          Obligation.SelfRepair
        ],
        continuation: {
          strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
          stopCondition: StopCondition.UnblockedOrNeedsInput
        }
      })
    );
  });

  it("evaluates the B7 routing, compaction, and self-repair fixture suite", () => {
    const fixtures = b7PolicyEvalFixtures();

    expect(fixtures.map((fixture) => fixture.caseId)).toEqual([
      "parallel-multifile-routing",
      "long-run-compaction-before-drift",
      "blocked-run-self-repair-without-sidecar",
      "closing-review-gate"
    ]);
    expect(evaluatePolicyFixtures(fixtures)).toEqual({
      passed: true,
      caseCount: 4,
      failureCount: 0,
      failures: []
    });
    expect(fixtures.find((fixture) => fixture.caseId === "parallel-multifile-routing")?.expected).toEqual(
      expect.objectContaining({
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: expect.objectContaining({
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ThroughoutExecution
        })
      })
    );
    expect(fixtures.find((fixture) => fixture.caseId === "long-run-compaction-before-drift")?.expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.Planning,
          Obligation.Review,
          Obligation.ContextCompaction
        ],
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilVerified,
          stopCondition: StopCondition.Verified
        }
      })
    );
    expect(fixtures.find((fixture) => fixture.caseId === "blocked-run-self-repair-without-sidecar")?.expected).toEqual(
      expect.objectContaining({
        roles: {
          coordinator: true,
          sidecar: false,
          verifier: true
        },
        orchestration: expect.objectContaining({
          subagents: SubagentStrategy.SoloOnly,
          subagentReadiness: SubagentReadinessReason.RunStateDisallowsDelegation
        }),
        continuation: {
          strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
          stopCondition: StopCondition.UnblockedOrNeedsInput
        }
      })
    );
    expect(fixtures.find((fixture) => fixture.caseId === "closing-review-gate")?.expected).toEqual(
      expect.objectContaining({
        roles: {
          coordinator: true,
          sidecar: false,
          verifier: true
        },
        orchestration: expect.objectContaining({
          subagents: SubagentStrategy.SoloOnly,
          subagentReadiness: SubagentReadinessReason.TaskTooSmall,
          verifierTiming: VerifierTiming.ClosingGate
        }),
        continuation: {
          strategy: ContinuationStrategy.CloseWhenVerified,
          stopCondition: StopCondition.Closed
        }
      })
    );
  });

  it("evaluates the B8 outcome-runner preflight policy suite without shipping a runner", () => {
    const fixtures = outcomeRunnerPreflightFixtures();

    expect(fixtures.map((fixture) => fixture.caseId)).toEqual([
      "b8-long-run-preflight",
      "b8-blocked-self-repair-boundary"
    ]);
    expect(evaluatePolicyFixtures(fixtures)).toEqual({
      passed: true,
      caseCount: 2,
      failureCount: 0,
      failures: []
    });
    expect(fixtures.find((fixture) => fixture.caseId === "b8-long-run-preflight")?.expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.Planning,
          Obligation.Review,
          Obligation.SubagentEligible,
          Obligation.ContextCompaction
        ],
        orchestration: expect.objectContaining({
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady
        }),
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilVerified,
          stopCondition: StopCondition.Verified
        }
      })
    );
    expect(fixtures.find((fixture) => fixture.caseId === "b8-blocked-self-repair-boundary")?.expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.Planning,
          Obligation.Review,
          Obligation.ContextCompaction,
          Obligation.SelfRepair
        ],
        roles: {
          coordinator: true,
          sidecar: false,
          verifier: true
        },
        orchestration: expect.objectContaining({
          subagents: SubagentStrategy.SoloOnly,
          subagentReadiness: SubagentReadinessReason.RunStateDisallowsDelegation,
          verifierTiming: VerifierTiming.ThroughoutExecution
        }),
        continuation: {
          strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
          stopCondition: StopCondition.UnblockedOrNeedsInput
        }
      })
    );
  });

  it("returns structured failures for mismatched expectations", () => {
    const result = evaluatePolicyFixtures([
      {
        caseId: "bad-continuation",
        input: {
          intent: Intent.Question,
          taskShape: TaskShape.Trivial,
          risk: Level.Low,
          ambiguity: Level.Low,
          parallelism: Parallelism.None,
          contextPressure: Level.Low,
          runState: RunState.Exploring
        },
        expected: {
          continuation: {
            strategy: ContinuationStrategy.ContinueUntilVerified
          }
        }
      }
    ]);

    expect(result).toEqual({
      passed: false,
      caseCount: 1,
      failureCount: 1,
      failures: [
        {
          caseId: "bad-continuation",
          field: "continuation.strategy",
          expected: ContinuationStrategy.ContinueUntilVerified,
          actual: ContinuationStrategy.AnswerDirectly
        }
      ]
    });
  });

  it("returns structured failures for roles mismatches", () => {
    const result = evaluatePolicyFixtures([
      {
        caseId: "bad-roles",
        input: {
          intent: Intent.Question,
          taskShape: TaskShape.Trivial,
          risk: Level.Low,
          ambiguity: Level.Low,
          parallelism: Parallelism.None,
          contextPressure: Level.Low,
          runState: RunState.Exploring
        },
        expected: {
          roles: {
            sidecar: true,
            verifier: true
          }
        }
      }
    ]);

    expect(result).toEqual({
      passed: false,
      caseCount: 1,
      failureCount: 2,
      failures: [
        {
          caseId: "bad-roles",
          field: "roles.sidecar",
          expected: true,
          actual: false
        },
        {
          caseId: "bad-roles",
          field: "roles.verifier",
          expected: true,
          actual: false
        }
      ]
    });
  });

  it("returns multiple structured failures for one case", () => {
    const result = evaluatePolicyFixtures([
      {
        caseId: "bad-shape",
        input: {
          intent: Intent.Edit,
          taskShape: TaskShape.Architectural,
          risk: Level.High,
          ambiguity: Level.Medium,
          parallelism: Parallelism.Clear,
          contextPressure: Level.Medium,
          runState: RunState.Executing
        },
        expected: {
          obligations: [Obligation.VerifyLight],
          orchestration: {
            subagents: SubagentStrategy.SoloOnly
          }
        }
      }
    ]);

    expect(result.passed).toBe(false);
    expect(result.caseCount).toBe(1);
    expect(result.failureCount).toBe(2);
    expect(result.failures).toEqual([
      {
        caseId: "bad-shape",
        field: "obligations",
        expected: [Obligation.VerifyLight],
        actual: [
          Obligation.Planning,
          Obligation.Tdd,
          Obligation.Review,
          Obligation.SubagentEligible
        ]
      },
      {
        caseId: "bad-shape",
        field: "orchestration.subagents",
        expected: SubagentStrategy.SoloOnly,
        actual: SubagentStrategy.AllowIndependentSlices
      }
    ]);
  });

  it("returns structured failures for trace mismatches", () => {
    const result = evaluatePolicyFixtures([
      {
        caseId: "bad-trace",
        input: {
          intent: Intent.Question,
          taskShape: TaskShape.Trivial,
          risk: Level.Low,
          ambiguity: Level.Low,
          parallelism: Parallelism.None,
          contextPressure: Level.Low,
          runState: RunState.Exploring
        },
        expected: {
          trace: [
            {
              obligation: Obligation.VerifyLight,
              rule: PolicyRule.LocalChangesNeedLightVerification
            }
          ]
        }
      }
    ]);

    expect(result).toEqual({
      passed: false,
      caseCount: 1,
      failureCount: 1,
      failures: [
        {
          caseId: "bad-trace",
          field: "trace",
          expected: [
            {
              obligation: Obligation.VerifyLight,
              rule: PolicyRule.LocalChangesNeedLightVerification
            }
          ],
          actual: [
            {
              obligation: Obligation.DirectAnswer,
              rule: PolicyRule.KeepDirectAnswersLight
            }
          ]
        }
      ]
    });
  });
});
