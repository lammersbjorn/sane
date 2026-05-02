import {
  asOptionalBoolean,
  asOptionalJsonRecord,
  asOptionalString,
} from './coercion.js';
import { exists, readText } from './io.js';
import { parseDecisionRecordJson } from './json-state.js';
import type {
  DecisionRecord,
  JsonRecord,
  LatestPolicyPreviewSnapshot,
  PolicyPreviewDecisionContext,
  PolicyPreviewDecisionScenario,
  PolicyPreviewDecisionScenarioInput,
  PolicyPreviewDecisionScenarioInputSnapshot,
  PolicyPreviewDecisionTraceEntryInput,
  PolicyPreviewDecisionRolesInput,
  PolicyPreviewScenarioContinuationInput,
  PolicyPreviewScenarioOrchestrationInput,
} from './types.js';

const MAX_LATEST_POLICY_PREVIEW_SCENARIOS = 32;
const MAX_LATEST_POLICY_PREVIEW_TRACE_ENTRIES = 16;

export function readLatestPolicyPreviewDecision(path: string): DecisionRecord | null {
  if (!exists(path)) {
    return null;
  }

  const lines = readText(path).split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line || line.trim().length === 0) {
      continue;
    }

    let decision: DecisionRecord;
    try {
      decision = parseDecisionRecordJson(line, `${path}:${index + 1}`);
    } catch {
      continue;
    }

    if (policyPreviewDecisionContext(decision)) {
      return decision;
    }
  }

  return null;
}

export function readLatestPolicyPreviewSnapshot(path: string): LatestPolicyPreviewSnapshot {
  const latestPolicyDecision = readLatestPolicyPreviewDecision(path);
  if (!latestPolicyDecision) {
    return createMissingLatestPolicyPreviewSnapshot();
  }

  const latestPolicyContext = policyPreviewDecisionContext(latestPolicyDecision);
  if (!latestPolicyContext) {
    return createMissingLatestPolicyPreviewSnapshot();
  }

  const scenarios = latestPolicyContext.scenarios.slice(0, MAX_LATEST_POLICY_PREVIEW_SCENARIOS);
  const scenarioIds = scenarios.flatMap((scenario) => (typeof scenario.id === 'string' ? [scenario.id] : []));

  return {
    status: 'present',
    scenarioCount: scenarios.length,
    scenarioIds,
    scenarios: scenarios.map((scenario) => {
      const trace = scenario.trace.slice(0, MAX_LATEST_POLICY_PREVIEW_TRACE_ENTRIES);
      return {
        id: scenario.id,
        summary: scenario.summary,
        input: scenario.input,
        roles: scenario.roles,
        orchestration: scenario.orchestration,
        continuation: scenario.continuation,
        obligationCount: scenario.obligations.length,
        traceCount: trace.length,
        trace: trace.map((entry) => ({ obligation: entry.obligation, rule: entry.rule })),
      };
    }),
    tsUnix: latestPolicyDecision.tsUnix,
    summary: latestPolicyDecision.summary,
  };
}

export function createMissingLatestPolicyPreviewSnapshot(): LatestPolicyPreviewSnapshot {
  return {
    status: 'missing',
    scenarioCount: 0,
    scenarioIds: [],
    scenarios: [],
    tsUnix: null,
    summary: null,
  };
}

export function createPolicyPreviewDecisionContext(
  scenarios: PolicyPreviewDecisionScenarioInput[],
): PolicyPreviewDecisionContext {
  return {
    kind: 'policy_preview',
    scenarios: scenarios.map(normalizePolicyPreviewScenario),
  };
}

export function policyPreviewDecisionContext(record: DecisionRecord): PolicyPreviewDecisionContext | null {
  const context = record.context;
  if (!context || context.kind !== 'policy_preview' || !Array.isArray(context.scenarios)) {
    return null;
  }

  const parsedScenarios: PolicyPreviewDecisionScenario[] = [];
  for (const scenario of context.scenarios) {
    const parsed = asOptionalJsonRecord(scenario);
    if (!parsed) {
      return null;
    }
    try {
      parsedScenarios.push(normalizePolicyPreviewScenarioRecord(parsed));
    } catch {
      return null;
    }
  }

  return { kind: 'policy_preview', scenarios: parsedScenarios };
}

function normalizePolicyPreviewScenario(scenario: PolicyPreviewDecisionScenarioInput): PolicyPreviewDecisionScenario {
  return {
    id: scenario.id,
    summary: scenario.summary ?? null,
    input: normalizePolicyPreviewScenarioInput(scenario.input),
    obligations: [...(scenario.obligations ?? [])],
    roles: normalizePolicyPreviewScenarioRoles(scenario.roles),
    orchestration: normalizePolicyPreviewScenarioOrchestration(scenario.orchestration),
    continuation: normalizePolicyPreviewScenarioContinuation(scenario.continuation),
    trace: normalizePolicyPreviewTraceEntries(scenario.trace),
  };
}

function normalizePolicyPreviewScenarioRecord(record: JsonRecord): PolicyPreviewDecisionScenario {
  const id = asOptionalString(record.id);
  const input = asOptionalJsonRecord(record.input);
  const roles = asOptionalJsonRecord(record.roles);
  const orchestration = asOptionalJsonRecord(record.orchestration);
  const continuation = asOptionalJsonRecord(record.continuation);
  if (!id) {
    throw new Error('invalid policy preview scenario: missing id');
  }

  return normalizePolicyPreviewScenario({
    id,
    summary: asOptionalString(record.summary) ?? null,
    input: input
      ? {
          intent: asOptionalString(input.intent) ?? null,
          taskShape: asOptionalString(input.taskShape) ?? null,
          risk: asOptionalString(input.risk) ?? null,
          ambiguity: asOptionalString(input.ambiguity) ?? null,
          parallelism: asOptionalString(input.parallelism) ?? null,
          contextPressure: asOptionalString(input.contextPressure) ?? null,
          runState: asOptionalString(input.runState) ?? null,
        }
      : null,
    obligations: coerceOptionalStringItems(record.obligations),
    roles: roles
      ? {
          coordinator: asOptionalBoolean(roles.coordinator) ?? false,
          sidecar: asOptionalBoolean(roles.sidecar) ?? false,
          verifier: asOptionalBoolean(roles.verifier) ?? false,
        }
      : null,
    orchestration: orchestration
      ? {
          subagents: asOptionalString(orchestration.subagents) ?? null,
          subagentReadiness: asOptionalString(orchestration.subagentReadiness) ?? null,
          reviewPosture: asOptionalString(orchestration.reviewPosture) ?? null,
          verifierTiming: asOptionalString(orchestration.verifierTiming) ?? null,
        }
      : null,
    continuation: continuation
      ? {
          strategy: asOptionalString(continuation.strategy) ?? null,
          stopCondition: asOptionalString(continuation.stopCondition) ?? null,
        }
      : null,
    trace: Array.isArray(record.trace)
      ? record.trace.flatMap((entry) => {
          const traceRecord = asOptionalJsonRecord(entry);
          const obligation = asOptionalString(traceRecord?.obligation);
          const rule = asOptionalString(traceRecord?.rule);
          return obligation && rule ? [{ obligation, rule }] : [];
        })
      : [],
  });
}

function normalizePolicyPreviewScenarioInput(
  input: PolicyPreviewDecisionScenarioInputSnapshot | null | undefined,
): PolicyPreviewDecisionScenario['input'] {
  if (!input) {
    return null;
  }
  return {
    intent: input.intent ?? null,
    taskShape: input.taskShape ?? null,
    risk: input.risk ?? null,
    ambiguity: input.ambiguity ?? null,
    parallelism: input.parallelism ?? null,
    contextPressure: input.contextPressure ?? null,
    runState: input.runState ?? null,
  };
}

function normalizePolicyPreviewScenarioRoles(
  roles: PolicyPreviewDecisionRolesInput | null | undefined,
): PolicyPreviewDecisionScenario['roles'] {
  if (!roles) {
    return null;
  }
  return {
    coordinator: roles.coordinator ?? false,
    sidecar: roles.sidecar ?? false,
    verifier: roles.verifier ?? false,
  };
}

function normalizePolicyPreviewScenarioOrchestration(
  orchestration: PolicyPreviewScenarioOrchestrationInput | null | undefined,
): PolicyPreviewDecisionScenario['orchestration'] {
  if (!orchestration) {
    return null;
  }
  return {
    subagents: orchestration.subagents ?? null,
    subagentReadiness: orchestration.subagentReadiness ?? null,
    reviewPosture: orchestration.reviewPosture ?? null,
    verifierTiming: orchestration.verifierTiming ?? null,
  };
}

function normalizePolicyPreviewScenarioContinuation(
  continuation: PolicyPreviewScenarioContinuationInput | null | undefined,
): PolicyPreviewDecisionScenario['continuation'] {
  if (!continuation) {
    return null;
  }
  return {
    strategy: continuation.strategy ?? null,
    stopCondition: continuation.stopCondition ?? null,
  };
}

function normalizePolicyPreviewTraceEntries(
  trace: PolicyPreviewDecisionTraceEntryInput[] | undefined,
): PolicyPreviewDecisionScenario['trace'] {
  return (trace ?? []).flatMap((entry) =>
    entry.obligation && entry.rule ? [{ obligation: entry.obligation, rule: entry.rule }] : [],
  );
}

function coerceOptionalStringItems(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}
