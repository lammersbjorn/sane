import {
  createDefaultLocalConfig,
  type LocalConfig
} from "@sane/config";
import {
  OperationKind,
  OperationResult,
  type PolicyPreviewPayload,
  type PolicyPreviewScenario
} from "@sane/core";
import { type HomeDirEnv, type ProjectPaths } from "@sane/platform";
import {
  canonicalScenarios,
  Intent,
  Level,
  Parallelism,
  RunState,
  TaskShape,
  explain,
  obligationAsString,
  policyRuleAsString,
  type PolicyInput
} from "@sane/policy";
import {
  type CurrentRunState
} from "@sane/state";

import { loadOrDefaultLocalConfig } from "./local-config.js";
import { inspectRuntimeState } from "./runtime-state.js";

export function previewPolicy(paths: ProjectPaths, env: HomeDirEnv = process.env): OperationResult {
  return previewPolicyForCurrentRun(paths, loadCurrentRunInspectState(paths), env);
}

export function previewPolicyForCurrentRun(
  paths: ProjectPaths,
  currentRun: CurrentRunState | null,
  _env: HomeDirEnv = process.env
): OperationResult {
  const config = loadOrDefaultConfig(paths);
  const subagents = config.subagents;
  const policyPreview = buildPolicyPreviewPayload(currentRun);
  const details = policyPreview.scenarios.map((scenario) =>
    renderPolicyPreviewLine(config, subagents, scenario)
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
  return loadOrDefaultLocalConfig(paths);
}

function renderPolicyPreviewLine(
  config: ReturnType<typeof createDefaultLocalConfig>,
  subagents: LocalConfig["subagents"],
  scenario: PolicyPreviewScenario
): string {
  return `${scenario.id}: ${scenario.obligations.join(", ")} | ${renderRolePlan(config, subagents, scenario.roles)}`;
}

function renderRolePlan(
  config: ReturnType<typeof createDefaultLocalConfig>,
  subagents: LocalConfig["subagents"],
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
  parts.push(`execution=${subagents.implementation.model}/${subagents.implementation.reasoningEffort}`);
  parts.push(`realtime=${subagents.realtime.model}/${subagents.realtime.reasoningEffort}`);
  parts.push(`frontend-craft=${subagents.frontendCraft.model}/${subagents.frontendCraft.reasoningEffort}`);

  return parts.join(", ");
}

export function buildPolicyPreviewPayload(currentRun: CurrentRunState | null): PolicyPreviewPayload {
  const scenarios = canonicalScenarios().map((scenario) =>
    buildScenarioPreview(scenario.id, scenario.summary, scenario.input)
  );
  const currentRunScenario = currentRun ? buildCurrentRunInspectPreview(currentRun) : null;
  if (currentRunScenario) {
    scenarios.push(currentRunScenario);
  }

  return { scenarios };
}

function loadCurrentRunInspectState(paths: ProjectPaths): CurrentRunState | null {
  return inspectRuntimeState(paths).current;
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
    input: {
      intent: input.intent,
      taskShape: input.taskShape,
      risk: input.risk,
      ambiguity: input.ambiguity,
      parallelism: input.parallelism,
      contextPressure: input.contextPressure,
      runState: input.runState
    },
    obligations: explanation.decision.obligations.map(obligationAsString),
    roles: explanation.roles,
    orchestration: {
      subagents: explanation.orchestration.subagents,
      subagentReadiness: explanation.orchestration.subagentReadiness,
      reviewPosture: explanation.orchestration.reviewPosture,
      verifierTiming: explanation.orchestration.verifierTiming
    },
    continuation: {
      strategy: explanation.continuation.strategy,
      stopCondition: explanation.continuation.stopCondition
    },
    trace: explanation.trace.map((entry) => ({
      obligation: obligationAsString(entry.obligation),
      rule: policyRuleAsString(entry.rule)
    }))
  };
}

export function buildCurrentRunInspectPreview(
  currentRun: CurrentRunState
): PolicyPreviewScenario {
  return buildScenarioPreview(
    "current-run-inspect",
    "inspect-only scenario derived from current-run state",
    mapCurrentRunToPolicyInput(currentRun)
  );
}

function mapCurrentRunToPolicyInput(currentRun: CurrentRunState): PolicyInput {
  const objective = currentRun.objective.toLowerCase();
  const phase = currentRun.phase.toLowerCase();
  const activeTasks = currentRun.activeTasks.filter((task) => task.trim().length > 0);
  const blockers = currentRun.blockingQuestions.filter((question) => isRealBlockingQuestion(question));
  const taskText = activeTasks.join(" ").toLowerCase();
  const intent = deriveIntent(objective, phase, taskText);
  const taskShape = deriveTaskShape(objective, taskText, activeTasks.length);
  const ambiguity =
    blockers.length >= 2 ? Level.High : blockers.length === 1 ? Level.Medium : Level.Low;
  const verificationStatus = currentRun.verification.status;
  const risk = deriveRisk(intent, taskShape, ambiguity, verificationStatus);
  const parallelism =
    activeTasks.length >= 4 ? Parallelism.Clear : activeTasks.length >= 2 ? Parallelism.Possible : Parallelism.None;
  const contextPressure =
    taskShape === TaskShape.LongRunning ||
    activeTasks.length >= 5 ||
    (currentRun.lastCompactionTsUnix === null && activeTasks.length >= 3)
      ? Level.High
      : currentRun.lastCompactionTsUnix === null || activeTasks.length >= 2
        ? Level.Medium
        : Level.Low;

  return {
    intent,
    taskShape,
    risk,
    ambiguity,
    parallelism,
    contextPressure,
    runState: deriveRunState(phase, blockers.length, activeTasks.length, taskShape)
  };
}

function deriveIntent(objective: string, phase: string, taskText: string): Intent {
  const text = `${objective} ${phase} ${taskText}`;

  if (hasAny(text, ["inspect", "status", "doctor"])) {
    return Intent.Inspect;
  }
  if (hasAny(text, ["fix", "repair", "debug", "error"])) {
    return Intent.Debug;
  }
  if (hasAny(text, ["plan", "design", "architecture", "refactor", "migration", "self-hosting"])) {
    return Intent.Design;
  }
  if (hasAny(text, ["edit", "apply", "update", "export", "write"])) {
    return Intent.Edit;
  }
  if (hasAny(text, ["orchestrate", "keep going", "long run"])) {
    return Intent.Orchestrate;
  }
  if (objective.trim().endsWith("?")) {
    return Intent.Question;
  }

  return Intent.Inspect;
}

function deriveTaskShape(objective: string, taskText: string, activeTaskCount: number): TaskShape {
  const text = `${objective} ${taskText}`;

  if (hasAny(text, ["architecture", "refactor", "migration", "self-hosting"])) {
    return TaskShape.Architectural;
  }
  if (activeTaskCount >= 5 || hasAny(text, ["long run", "long-running", "orchestrate"])) {
    return TaskShape.LongRunning;
  }
  if (activeTaskCount >= 3 || hasAny(text, ["export", "repair", "bundle", "files"])) {
    return TaskShape.MultiFile;
  }
  if (activeTaskCount >= 1) {
    return TaskShape.Local;
  }

  return TaskShape.Trivial;
}

function deriveRisk(
  intent: Intent,
  taskShape: TaskShape,
  ambiguity: Level,
  verificationStatus: CurrentRunState["verification"]["status"]
): Level {
  const status = verificationStatus.toLowerCase();

  if (status === "failed" || ambiguity === Level.High) {
    return Level.High;
  }
  if (taskShape === TaskShape.Architectural || taskShape === TaskShape.LongRunning) {
    return Level.High;
  }
  if (intent === Intent.Debug || taskShape === TaskShape.MultiFile) {
    return Level.Medium;
  }

  return Level.Low;
}

function deriveRunState(
  phase: CurrentRunState["phase"],
  blockerCount: number,
  activeTaskCount: number,
  taskShape: TaskShape
): RunState {
  if (hasAny(phase, ["blocked", "stalled"])) {
    return RunState.Blocked;
  }
  if (hasAny(phase, ["error", "errored", "failed", "failing"])) {
    return RunState.Blocked;
  }
  if (blockerCount > 0 && (taskShape === TaskShape.LongRunning || activeTaskCount >= 4)) {
    return RunState.Blocked;
  }
  if (hasAny(phase, ["validating", "reviewing"])) {
    return RunState.Validating;
  }
  if (hasAny(phase, ["closing", "done", "complete", "completed", "finished"])) {
    return RunState.Closing;
  }
  if (hasAny(phase, ["executing", "working", "editing", "implementing"])) {
    return RunState.Executing;
  }

  return RunState.Exploring;
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function isRealBlockingQuestion(question: string): boolean {
  const normalized = question.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "none" && normalized !== "n/a";
}
