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
  agentFlowReleasePolicyFixtures,
  b7PolicyEvalFixtures,
  bootstrapResearchPolicyFixtures,
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
            Obligation.SubagentEligible,
            Obligation.ContextCompaction,
            Obligation.SelfRepair
          ],
          continuation: {
            strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
            stopCondition: StopCondition.UnblockedOrNeedsInput
          },
          orchestration: {
            subagents: SubagentStrategy.AllowIndependentSlices
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
              obligation: Obligation.SubagentEligible,
              rule: PolicyRule.ParallelWorkCanUseSubagents
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
          Obligation.SubagentEligible,
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

    expectFixtureSuiteToPass(fixtures, [
      "parallel-multifile-routing",
      "long-run-compaction-before-drift",
      "blocked-run-self-repair-with-sidecar",
      "closing-review-gate"
    ]);
    expect(findFixture(fixtures, "parallel-multifile-routing").expected).toEqual(
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
    expect(findFixture(fixtures, "long-run-compaction-before-drift").expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.Planning,
          Obligation.Review,
          Obligation.SubagentEligible,
          Obligation.ContextCompaction
        ],
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilVerified,
          stopCondition: StopCondition.Verified
        }
      })
    );
    expect(findFixture(fixtures, "blocked-run-self-repair-with-sidecar").expected).toEqual(
      expect.objectContaining({
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: expect.objectContaining({
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady
        }),
        continuation: {
          strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
          stopCondition: StopCondition.UnblockedOrNeedsInput
        }
      })
    );
    expect(findFixture(fixtures, "closing-review-gate").expected).toEqual(
      expect.objectContaining({
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: expect.objectContaining({
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
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

    expectFixtureSuiteToPass(fixtures, [
      "b8-long-run-preflight",
      "b8-blocked-self-repair-boundary",
      "b8-intake-stop-boundary"
    ]);
    expect(findFixture(fixtures, "b8-long-run-preflight").expected).toEqual(
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
    expect(findFixture(fixtures, "b8-blocked-self-repair-boundary").expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.Planning,
          Obligation.Review,
          Obligation.SubagentEligible,
          Obligation.ContextCompaction,
          Obligation.SelfRepair
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: expect.objectContaining({
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ThroughoutExecution
        }),
        continuation: {
          strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
          stopCondition: StopCondition.UnblockedOrNeedsInput
        }
      })
    );
    expect(findFixture(fixtures, "b8-intake-stop-boundary").expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.Planning,
          Obligation.SubagentEligible
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: false
        },
        orchestration: expect.objectContaining({
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.None
        }),
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilBlocked,
          stopCondition: StopCondition.RealBlockerOrExplicitPause
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

  it("evaluates the B12 bootstrap research policy suite", () => {
    const fixtures = bootstrapResearchPolicyFixtures();

    expectFixtureSuiteToPass(fixtures, [
      "b12-new-project-stack-research",
      "b12-small-existing-change-skips-bootstrap-research"
    ]);
    expect(findFixture(fixtures, "b12-new-project-stack-research").expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.BootstrapResearch,
          Obligation.Planning,
          Obligation.Review,
          Obligation.SubagentEligible
        ],
        trace: expect.arrayContaining([
          {
            obligation: Obligation.BootstrapResearch,
            rule: PolicyRule.NewProjectNeedsBootstrapResearch
          }
        ])
      })
    );
    expect(findFixture(fixtures, "b12-small-existing-change-skips-bootstrap-research").expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.VerifyLight,
          Obligation.SubagentEligible
        ]
      })
    );
  });

  it("evaluates the B14 agent-flow release policy suite", () => {
    const fixtures = agentFlowReleasePolicyFixtures();

    expectFixtureSuiteToPass(fixtures, [
      "b14-frontend-review-closing-gate",
      "b14-plugin-packaging-parallel-slices",
      "b14-lifecycle-hooks-risk-gate",
      "b14-continuation-blocked-self-repair",
      "b14-stop-condition-direct-answer",
      "b14-new-project-current-research-with-sidecars"
    ]);
    expect(findFixture(fixtures, "b14-new-project-current-research-with-sidecars").expected).toEqual(
      expect.objectContaining({
        obligations: [
          Obligation.BootstrapResearch,
          Obligation.Planning,
          Obligation.Review,
          Obligation.SubagentEligible
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        }
      })
    );
  });
});

function expectFixtureSuiteToPass(
  fixtures: readonly PolicyEvalFixture[],
  expectedCaseIds: readonly string[]
): void {
  const caseIds = fixtures.map((fixture) => fixture.caseId);

  expect(new Set(caseIds).size).toBe(caseIds.length);
  expect(caseIds).toHaveLength(expectedCaseIds.length);
  expect(caseIds).toEqual(expect.arrayContaining([...expectedCaseIds]));
  expect(evaluatePolicyFixtures(fixtures)).toEqual({
    passed: true,
    caseCount: expectedCaseIds.length,
    failureCount: 0,
    failures: []
  });
}

function findFixture(
  fixtures: readonly PolicyEvalFixture[],
  caseId: string
): PolicyEvalFixture {
  const fixture = fixtures.find((candidate) => candidate.caseId === caseId);

  expect(fixture, `missing policy eval fixture ${caseId}`).toBeDefined();

  return fixture as PolicyEvalFixture;
}
