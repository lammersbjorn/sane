import { describe, expect, it } from "vitest";

import {
  Intent,
  Level,
  Obligation,
  Parallelism,
  RunState,
  StopCondition,
  SubagentStrategy,
  TaskShape,
  ContinuationStrategy,
  evaluatePolicyFixtures,
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
          }
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
});
