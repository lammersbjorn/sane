import {
  canonicalScenarios,
  explain,
  type ContinuationGuidance,
  ContinuationStrategy,
  Intent,
  Level,
  type Obligation,
  type OrchestrationGuidance,
  Parallelism,
  type PolicyInput,
  type PolicyTraceEntry,
  RunState,
  StopCondition,
  SubagentReadinessReason,
  SubagentStrategy,
  TaskShape,
  VerifierTiming,
  Obligation as PolicyObligation,
  PolicyRule,
  type RolePlan
} from "./index.js";

export interface PolicyEvalExpected {
  obligations?: readonly Obligation[];
  roles?: Partial<RolePlan>;
  orchestration?: Partial<OrchestrationGuidance>;
  continuation?: Partial<ContinuationGuidance>;
  trace?: readonly PolicyTraceEntry[];
}

export interface PolicyEvalFixture {
  caseId: string;
  input: PolicyInput;
  expected: PolicyEvalExpected;
}

export interface PolicyEvalFailure {
  caseId: string;
  field: string;
  expected: unknown;
  actual: unknown;
}

export interface PolicyEvalResult {
  passed: boolean;
  caseCount: number;
  failureCount: number;
  failures: readonly PolicyEvalFailure[];
}

export function evaluatePolicyFixtures(
  fixtures: readonly PolicyEvalFixture[]
): PolicyEvalResult {
  const failures = fixtures.flatMap(evaluatePolicyFixture);

  return {
    passed: failures.length === 0,
    caseCount: fixtures.length,
    failureCount: failures.length,
    failures
  };
}

export function canonicalPolicyEvalFixtures(): readonly PolicyEvalFixture[] {
  return canonicalScenarios().map((scenario) => {
    const explanation = explain(scenario.input);
    return {
      caseId: scenario.id,
      input: scenario.input,
      expected: {
        obligations: explanation.decision.obligations,
        roles: explanation.roles,
        orchestration: explanation.orchestration,
        continuation: explanation.continuation,
        trace: explanation.trace
      }
    };
  });
}

export function b7PolicyEvalFixtures(): readonly PolicyEvalFixture[] {
  return [
    {
      caseId: "parallel-multifile-routing",
      input: {
        intent: Intent.Edit,
        taskShape: TaskShape.MultiFile,
        risk: Level.Medium,
        ambiguity: Level.Low,
        parallelism: Parallelism.Clear,
        contextPressure: Level.Medium,
        runState: RunState.Executing
      },
      expected: {
        obligations: [
          PolicyObligation.Tdd,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ThroughoutExecution
        },
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilVerified,
          stopCondition: StopCondition.Verified
        },
        trace: [
          {
            obligation: PolicyObligation.Tdd,
            rule: PolicyRule.ImplementationNeedsTdd
          },
          {
            obligation: PolicyObligation.Review,
            rule: PolicyRule.NeedsIndependentReview
          },
          {
            obligation: PolicyObligation.SubagentEligible,
            rule: PolicyRule.ParallelWorkCanUseSubagents
          }
        ]
      }
    },
    {
      caseId: "long-run-compaction-before-drift",
      input: {
        intent: Intent.Orchestrate,
        taskShape: TaskShape.LongRunning,
        risk: Level.Medium,
        ambiguity: Level.Medium,
        parallelism: Parallelism.Possible,
        contextPressure: Level.Medium,
        runState: RunState.Executing
      },
      expected: {
        obligations: [
          PolicyObligation.Planning,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible,
          PolicyObligation.ContextCompaction
        ],
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady
        },
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilVerified,
          stopCondition: StopCondition.Verified
        },
        trace: [
          {
            obligation: PolicyObligation.Planning,
            rule: PolicyRule.NeedsUpfrontPlanning
          },
          {
            obligation: PolicyObligation.Review,
            rule: PolicyRule.NeedsIndependentReview
          },
          {
            obligation: PolicyObligation.SubagentEligible,
            rule: PolicyRule.ParallelWorkCanUseSubagents
          },
          {
            obligation: PolicyObligation.ContextCompaction,
            rule: PolicyRule.ContextNeedsCompaction
          }
        ]
      }
    },
    {
      caseId: "blocked-run-self-repair-with-sidecar",
      input: {
        intent: Intent.Orchestrate,
        taskShape: TaskShape.LongRunning,
        risk: Level.High,
        ambiguity: Level.High,
        parallelism: Parallelism.Clear,
        contextPressure: Level.High,
        runState: RunState.Blocked
      },
      expected: {
        obligations: [
          PolicyObligation.Planning,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible,
          PolicyObligation.ContextCompaction,
          PolicyObligation.SelfRepair
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ThroughoutExecution
        },
        continuation: {
          strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
          stopCondition: StopCondition.UnblockedOrNeedsInput
        },
        trace: [
          {
            obligation: PolicyObligation.Planning,
            rule: PolicyRule.NeedsUpfrontPlanning
          },
          {
            obligation: PolicyObligation.Review,
            rule: PolicyRule.NeedsIndependentReview
          },
          {
            obligation: PolicyObligation.SubagentEligible,
            rule: PolicyRule.ParallelWorkCanUseSubagents
          },
          {
            obligation: PolicyObligation.ContextCompaction,
            rule: PolicyRule.ContextNeedsCompaction
          },
          {
            obligation: PolicyObligation.SelfRepair,
            rule: PolicyRule.BlockedRunNeedsSelfRepair
          }
        ]
      }
    },
    {
      caseId: "closing-review-gate",
      input: {
        intent: Intent.Review,
        taskShape: TaskShape.Local,
        risk: Level.Medium,
        ambiguity: Level.Low,
        parallelism: Parallelism.None,
        contextPressure: Level.Low,
        runState: RunState.Closing
      },
      expected: {
        obligations: [
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ClosingGate
        },
        continuation: {
          strategy: ContinuationStrategy.CloseWhenVerified,
          stopCondition: StopCondition.Closed
        },
        trace: [
          {
            obligation: PolicyObligation.Review,
            rule: PolicyRule.NeedsIndependentReview
          },
          {
            obligation: PolicyObligation.SubagentEligible,
            rule: PolicyRule.ParallelWorkCanUseSubagents
          }
        ]
      }
    }
  ];
}

export function outcomeRunnerPreflightFixtures(): readonly PolicyEvalFixture[] {
  return [
    {
      caseId: "b8-long-run-preflight",
      input: {
        intent: Intent.Orchestrate,
        taskShape: TaskShape.LongRunning,
        risk: Level.High,
        ambiguity: Level.Medium,
        parallelism: Parallelism.Clear,
        contextPressure: Level.High,
        runState: RunState.Executing
      },
      expected: {
        obligations: [
          PolicyObligation.Planning,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible,
          PolicyObligation.ContextCompaction
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ClosingGate
        },
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilVerified,
          stopCondition: StopCondition.Verified
        },
        trace: [
          {
            obligation: PolicyObligation.Planning,
            rule: PolicyRule.NeedsUpfrontPlanning
          },
          {
            obligation: PolicyObligation.Review,
            rule: PolicyRule.NeedsIndependentReview
          },
          {
            obligation: PolicyObligation.SubagentEligible,
            rule: PolicyRule.ParallelWorkCanUseSubagents
          },
          {
            obligation: PolicyObligation.ContextCompaction,
            rule: PolicyRule.ContextNeedsCompaction
          }
        ]
      }
    },
    {
      caseId: "b8-blocked-self-repair-boundary",
      input: {
        intent: Intent.Orchestrate,
        taskShape: TaskShape.LongRunning,
        risk: Level.High,
        ambiguity: Level.High,
        parallelism: Parallelism.Clear,
        contextPressure: Level.High,
        runState: RunState.Blocked
      },
      expected: {
        obligations: [
          PolicyObligation.Planning,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible,
          PolicyObligation.ContextCompaction,
          PolicyObligation.SelfRepair
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ThroughoutExecution
        },
        continuation: {
          strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
          stopCondition: StopCondition.UnblockedOrNeedsInput
        },
        trace: [
          {
            obligation: PolicyObligation.Planning,
            rule: PolicyRule.NeedsUpfrontPlanning
          },
          {
            obligation: PolicyObligation.Review,
            rule: PolicyRule.NeedsIndependentReview
          },
          {
            obligation: PolicyObligation.SubagentEligible,
            rule: PolicyRule.ParallelWorkCanUseSubagents
          },
          {
            obligation: PolicyObligation.ContextCompaction,
            rule: PolicyRule.ContextNeedsCompaction
          },
          {
            obligation: PolicyObligation.SelfRepair,
            rule: PolicyRule.BlockedRunNeedsSelfRepair
          }
        ]
      }
    },
    {
      caseId: "b8-intake-stop-boundary",
      input: {
        intent: Intent.Design,
        taskShape: TaskShape.Local,
        risk: Level.Medium,
        ambiguity: Level.Medium,
        parallelism: Parallelism.None,
        contextPressure: Level.Low,
        runState: RunState.Exploring
      },
      expected: {
        obligations: [
          PolicyObligation.Planning,
          PolicyObligation.SubagentEligible
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: false
        },
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.None
        },
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilBlocked,
          stopCondition: StopCondition.RealBlockerOrExplicitPause
        },
        trace: [
          {
            obligation: PolicyObligation.Planning,
            rule: PolicyRule.NeedsUpfrontPlanning
          },
          {
            obligation: PolicyObligation.SubagentEligible,
            rule: PolicyRule.ParallelWorkCanUseSubagents
          }
        ]
      }
    }
  ];
}

export function bootstrapResearchPolicyFixtures(): readonly PolicyEvalFixture[] {
  return [
    {
      caseId: "b12-new-project-stack-research",
      input: {
        intent: Intent.Design,
        taskShape: TaskShape.Architectural,
        risk: Level.Medium,
        ambiguity: Level.High,
        parallelism: Parallelism.Possible,
        contextPressure: Level.Low,
        runState: RunState.Exploring
      },
      expected: {
        obligations: [
          PolicyObligation.BootstrapResearch,
          PolicyObligation.Planning,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady
        },
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilVerified,
          stopCondition: StopCondition.Verified
        },
        trace: [
          {
            obligation: PolicyObligation.BootstrapResearch,
            rule: PolicyRule.NewProjectNeedsBootstrapResearch
          },
          {
            obligation: PolicyObligation.Planning,
            rule: PolicyRule.NeedsUpfrontPlanning
          },
          {
            obligation: PolicyObligation.Review,
            rule: PolicyRule.NeedsIndependentReview
          },
          {
            obligation: PolicyObligation.SubagentEligible,
            rule: PolicyRule.ParallelWorkCanUseSubagents
          }
        ]
      }
    },
    {
      caseId: "b12-small-existing-change-skips-bootstrap-research",
      input: {
        intent: Intent.Edit,
        taskShape: TaskShape.Local,
        risk: Level.Low,
        ambiguity: Level.Low,
        parallelism: Parallelism.None,
        contextPressure: Level.Low,
        runState: RunState.Executing
      },
      expected: {
        obligations: [
          PolicyObligation.VerifyLight,
          PolicyObligation.SubagentEligible
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.AfterChangeSet
        },
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilVerified,
          stopCondition: StopCondition.Verified
        },
        trace: [
          {
            obligation: PolicyObligation.VerifyLight,
            rule: PolicyRule.LocalChangesNeedLightVerification
          },
          {
            obligation: PolicyObligation.SubagentEligible,
            rule: PolicyRule.ParallelWorkCanUseSubagents
          }
        ]
      }
    }
  ];
}

export function agentFlowReleasePolicyFixtures(): readonly PolicyEvalFixture[] {
  return [
    {
      caseId: "b14-frontend-review-closing-gate",
      input: {
        intent: Intent.Review,
        taskShape: TaskShape.Architectural,
        risk: Level.Medium,
        ambiguity: Level.Medium,
        parallelism: Parallelism.Possible,
        contextPressure: Level.Medium,
        runState: RunState.Validating
      },
      expected: {
        obligations: [
          PolicyObligation.Planning,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible
        ],
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ClosingGate
        },
        continuation: {
          strategy: ContinuationStrategy.ContinueUntilVerified,
          stopCondition: StopCondition.Verified
        }
      }
    },
    {
      caseId: "b14-plugin-packaging-parallel-slices",
      input: {
        intent: Intent.Edit,
        taskShape: TaskShape.MultiFile,
        risk: Level.Medium,
        ambiguity: Level.Low,
        parallelism: Parallelism.Clear,
        contextPressure: Level.Low,
        runState: RunState.Executing
      },
      expected: {
        obligations: [
          PolicyObligation.Tdd,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ThroughoutExecution
        }
      }
    },
    {
      caseId: "b14-lifecycle-hooks-risk-gate",
      input: {
        intent: Intent.Edit,
        taskShape: TaskShape.MultiFile,
        risk: Level.High,
        ambiguity: Level.Medium,
        parallelism: Parallelism.Possible,
        contextPressure: Level.Medium,
        runState: RunState.Executing
      },
      expected: {
        obligations: [
          PolicyObligation.Planning,
          PolicyObligation.Tdd,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible
        ],
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady,
          verifierTiming: VerifierTiming.ThroughoutExecution
        }
      }
    },
    {
      caseId: "b14-continuation-blocked-self-repair",
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
          PolicyObligation.Planning,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible,
          PolicyObligation.ContextCompaction,
          PolicyObligation.SelfRepair
        ],
        continuation: {
          strategy: ContinuationStrategy.SelfRepairUntilUnblocked,
          stopCondition: StopCondition.UnblockedOrNeedsInput
        }
      }
    },
    {
      caseId: "b14-stop-condition-direct-answer",
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
        obligations: [
          PolicyObligation.DirectAnswer
        ],
        continuation: {
          strategy: ContinuationStrategy.AnswerDirectly,
          stopCondition: StopCondition.Answered
        }
      }
    },
    {
      caseId: "b14-new-project-current-research-with-sidecars",
      input: {
        intent: Intent.Design,
        taskShape: TaskShape.Architectural,
        risk: Level.High,
        ambiguity: Level.High,
        parallelism: Parallelism.Clear,
        contextPressure: Level.Medium,
        runState: RunState.Exploring
      },
      expected: {
        obligations: [
          PolicyObligation.BootstrapResearch,
          PolicyObligation.Planning,
          PolicyObligation.Review,
          PolicyObligation.SubagentEligible
        ],
        roles: {
          coordinator: true,
          sidecar: true,
          verifier: true
        },
        orchestration: {
          subagents: SubagentStrategy.AllowIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesReady
        }
      }
    }
  ];
}

function evaluatePolicyFixture(fixture: PolicyEvalFixture): PolicyEvalFailure[] {
  const explanation = explain(fixture.input);
  const failures: PolicyEvalFailure[] = [];

  pushMismatch(failures, fixture.caseId, "obligations", fixture.expected.obligations, [
    ...explanation.decision.obligations
  ]);
  pushPartialMismatches(failures, fixture.caseId, "roles", fixture.expected.roles, explanation.roles);
  pushPartialMismatches(
    failures,
    fixture.caseId,
    "orchestration",
    fixture.expected.orchestration,
    explanation.orchestration
  );
  pushPartialMismatches(
    failures,
    fixture.caseId,
    "continuation",
    fixture.expected.continuation,
    explanation.continuation
  );
  pushMismatch(failures, fixture.caseId, "trace", fixture.expected.trace, [
    ...explanation.trace
  ]);

  return failures;
}

function pushPartialMismatches<T extends object>(
  failures: PolicyEvalFailure[],
  caseId: string,
  prefix: string,
  expected: Partial<T> | undefined,
  actual: T
): void {
  if (!expected) {
    return;
  }

  for (const key of Object.keys(expected) as Array<keyof T>) {
    pushMismatch(failures, caseId, `${prefix}.${String(key)}`, expected[key], actual[key]);
  }
}

function pushMismatch(
  failures: PolicyEvalFailure[],
  caseId: string,
  field: string,
  expected: unknown,
  actual: unknown
): void {
  if (expected === undefined || deepEqual(expected, actual)) {
    return;
  }

  failures.push({
    caseId,
    field,
    expected,
    actual
  });
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
