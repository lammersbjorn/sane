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
          PolicyObligation.ContextCompaction
        ],
        orchestration: {
          subagents: SubagentStrategy.WaitForIndependentSlices,
          subagentReadiness: SubagentReadinessReason.IndependentSlicesNotClear
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
            obligation: PolicyObligation.ContextCompaction,
            rule: PolicyRule.ContextNeedsCompaction
          }
        ]
      }
    },
    {
      caseId: "blocked-run-self-repair-without-sidecar",
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
          PolicyObligation.ContextCompaction,
          PolicyObligation.SelfRepair
        ],
        roles: {
          coordinator: true,
          sidecar: false,
          verifier: true
        },
        orchestration: {
          subagents: SubagentStrategy.SoloOnly,
          subagentReadiness: SubagentReadinessReason.RunStateDisallowsDelegation,
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
            obligation: PolicyObligation.ContextCompaction,
            rule: PolicyRule.ContextNeedsCompaction
          },
          {
            obligation: PolicyObligation.SelfRepair,
            rule: PolicyRule.BlockedRunNeedsSelfRepair
          }
        ]
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
