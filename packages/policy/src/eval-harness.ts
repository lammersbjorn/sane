import {
  canonicalScenarios,
  explain,
  type ContinuationGuidance,
  type Obligation,
  type OrchestrationGuidance,
  type PolicyInput,
  type RolePlan
} from "./index.js";

export interface PolicyEvalExpected {
  obligations?: readonly Obligation[];
  roles?: Partial<RolePlan>;
  orchestration?: Partial<OrchestrationGuidance>;
  continuation?: Partial<ContinuationGuidance>;
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
        continuation: explanation.continuation
      }
    };
  });
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
