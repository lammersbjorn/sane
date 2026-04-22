import {
  createDefaultLocalConfig,
  createDefaultModelRoutingPresets,
  createRecommendedModelRoutingPresets,
  createRecommendedSubagentPreset,
  detectCodexEnvironment,
  readLocalConfig
} from "@sane/config";
import {
  OperationKind,
  OperationResult,
  type PolicyPreviewPayload,
  type PolicyPreviewScenario
} from "@sane/core";
import { discoverCodexPaths, type HomeDirEnv, type ProjectPaths } from "@sane/platform";
import {
  canonicalScenarios,
  Intent,
  Level,
  Parallelism,
  RunState,
  TaskShape,
  explain,
  obligationAsString,
  policyRuleAsString
} from "@sane/policy";
import { readCurrentRunState } from "@sane/state";

export function previewPolicy(paths: ProjectPaths, env: HomeDirEnv = process.env): OperationResult {
  const config = loadOrDefaultConfig(paths);
  const routing = loadDerivedRouting(paths, env);
  const subagents = buildSubagentRouting(paths, env);
  const policyPreview = buildPolicyPreview(paths);
  const details = policyPreview.scenarios.map((scenario) =>
    renderPolicyPreviewLine(config, routing, subagents, scenario)
  );

  return new OperationResult({
    kind: OperationKind.PreviewPolicy,
    summary: "policy preview: rendered adaptive obligation scenarios",
    details,
    policyPreview,
    pathsTouched: [],
    inventory: []
  });
}

function loadOrDefaultConfig(paths: ProjectPaths) {
  try {
    return readLocalConfig(paths.configPath);
  } catch {
    return createDefaultLocalConfig();
  }
}

function renderPolicyPreviewLine(
  config: ReturnType<typeof createDefaultLocalConfig>,
  routing: ReturnType<typeof createDefaultModelRoutingPresets>,
  subagents: ReturnType<typeof buildSubagentRouting>,
  scenario: PolicyPreviewScenario
): string {
  return `${scenario.id}: ${scenario.obligations.join(", ")} | ${renderRolePlan(config, routing, subagents, scenario.roles)}`;
}

function renderRolePlan(
  config: ReturnType<typeof createDefaultLocalConfig>,
  routing: ReturnType<typeof createDefaultModelRoutingPresets>,
  subagents: ReturnType<typeof buildSubagentRouting>,
  roles: PolicyPreviewScenario["roles"]
): string {
  const parts: string[] = [];

  if (roles.coordinator) {
    parts.push(
      `coordinator=${config.models.coordinator.model}/${config.models.coordinator.reasoningEffort}`
    );
  }
  if (roles.sidecar) {
    parts.push(`sidecar=${config.models.sidecar.model}/${config.models.sidecar.reasoningEffort}`);
  }
  if (roles.verifier) {
    parts.push(
      `verifier=${config.models.verifier.model}/${config.models.verifier.reasoningEffort}`
    );
  }

  parts.push(`explorer=${subagents.explorer.model}/${subagents.explorer.reasoningEffort}`);
  parts.push(`execution=${routing.execution.model}/${routing.execution.reasoningEffort}`);
  parts.push(`realtime=${routing.realtime.model}/${routing.realtime.reasoningEffort}`);

  return parts.join(", ");
}

function buildPolicyPreview(paths: ProjectPaths): PolicyPreviewPayload {
  const scenarios = canonicalScenarios().map((scenario) =>
    buildScenarioPreview(scenario.id, scenario.summary, scenario.input)
  );
  const currentRunScenario = buildCurrentRunInspectScenario(paths);
  if (currentRunScenario) {
    scenarios.push(currentRunScenario);
  }

  return { scenarios };
}

function buildCurrentRunInspectScenario(paths: ProjectPaths): PolicyPreviewScenario | null {
  try {
    readCurrentRunState(paths.currentRunPath);
  } catch {
    return null;
  }

  return buildScenarioPreview(
    "current-run-inspect",
    "inspect-only scenario derived from current-run state",
    {
      intent: Intent.Inspect,
      taskShape: TaskShape.Local,
      risk: Level.Low,
      ambiguity: Level.Low,
      parallelism: Parallelism.None,
      contextPressure: Level.Low,
      runState: RunState.Executing
    }
  );
}

function buildScenarioPreview(
  id: string,
  summary: string,
  input: Parameters<typeof explain>[0]
): PolicyPreviewScenario {
  const explanation = explain(input);

  return {
    id,
    summary,
    obligations: explanation.decision.obligations.map(obligationAsString),
    roles: explanation.roles,
    orchestration: {
      subagents: explanation.orchestration.subagents,
      subagentReadiness: explanation.orchestration.subagentReadiness,
      reviewPosture: explanation.orchestration.reviewPosture,
      verifierTiming: explanation.orchestration.verifierTiming
    },
    trace: explanation.trace.map((entry) => ({
      obligation: obligationAsString(entry.obligation),
      rule: policyRuleAsString(entry.rule)
    }))
  };
}

function loadDerivedRouting(paths: ProjectPaths, env: HomeDirEnv) {
  try {
    return createRecommendedModelRoutingPresets(
      readCodexEnvironment(paths, env)
    );
  } catch {
    return createDefaultModelRoutingPresets();
  }
}

function readCodexEnvironment(paths: ProjectPaths, env: HomeDirEnv) {
  const codexPaths = discoverCodexPaths(env);
  return detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
}

function buildSubagentRouting(paths: ProjectPaths, env: HomeDirEnv) {
  try {
    const environment = readCodexEnvironment(paths, env);
    return {
      explorer: createRecommendedSubagentPreset(environment, "explorer"),
      implementation: createRecommendedSubagentPreset(environment, "implementation"),
      verifier: createRecommendedSubagentPreset(environment, "verifier"),
      realtime: createRecommendedSubagentPreset(environment, "realtime"),
    };
  } catch {
    return {
      explorer: {
        model: "gpt-5.4-mini",
        reasoningEffort: "low" as const,
      },
      implementation: {
        model: "gpt-5.3-codex",
        reasoningEffort: "medium" as const,
      },
      verifier: {
        model: "gpt-5.4",
        reasoningEffort: "high" as const,
      },
      realtime: {
        model: "gpt-5.3-codex-spark",
        reasoningEffort: "low" as const,
      },
    };
  }
}
