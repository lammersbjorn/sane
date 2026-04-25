import { existsSync, readFileSync } from "node:fs";

import { type ProjectPaths } from "@sane/platform";
import {
  evaluatePolicyFixtures,
  outcomeRunnerPreflightFixtures
} from "@sane/policy";
import {
  buildRunBrief,
  type CanonicalRewriteResult,
  createCanonicalStatePaths,
  createMissingLatestPolicyPreviewSnapshot,
  loadLayeredStateBundle,
  readCurrentRunState,
  readRunSummary,
  stringifyCurrentRunState,
  writeCanonicalWithBackupResult,
  writeRunSummary,
  type CurrentRunState,
  type LayeredStateBundle,
  type LayeredStateHistoryPreview,
  type LayeredStateLayerStatus,
  type LatestPolicyPreviewSnapshot,
  type RunSummary
} from "@sane/state";
import { writeAtomicTextFile } from "@sane/state";

export interface RuntimeHandoffState {
  layeredState: LayeredStateBundle | null;
  current: CurrentRunState | null;
  summary: RunSummary | null;
  brief: string | null;
}

export interface RuntimeHandoffBaselineResult {
  current: CurrentRunState;
  summary: RunSummary;
  currentRewrite: CanonicalRewriteResult | null;
  summaryRewrite: CanonicalRewriteResult | null;
  briefUpdated: boolean;
  briefWriteMode: "preserved" | "first write" | "rewrite";
}

export interface RuntimeInspectSnapshot {
  current: CurrentRunState | null;
  summary: RunSummary | null;
  brief: string | null;
  layerStatus: {
    currentRun: LayeredStateLayerStatus;
    summary: LayeredStateLayerStatus;
    brief: LayeredStateLayerStatus;
  };
  historyCounts: LayeredStateBundle["historyCounts"];
  historyPreview: LayeredStateHistoryPreview;
  latestPolicyPreview: LatestPolicyPreviewSnapshot;
}

export type SelfHostingShadowStatus = "ready" | "blocked";

export type SelfHostingShadowCheckStatus = "pass" | "warn" | "block";

export interface SelfHostingShadowCheck {
  id: string;
  status: SelfHostingShadowCheckStatus;
  summary: string;
  path: string | null;
}

export interface SelfHostingShadowSnapshot {
  mode: "shadow-inspect-only";
  runnerEnabled: false;
  status: SelfHostingShadowStatus;
  checks: SelfHostingShadowCheck[];
  runtime: RuntimeInspectSnapshot;
}

export type OutcomeReadinessStatus = "ready" | "blocked" | "needs_input";

export interface OutcomeReadinessCheck {
  id: string;
  status: SelfHostingShadowCheckStatus;
  summary: string;
  path: string | null;
}

export interface OutcomeReadinessSnapshot {
  mode: "codex-native-outcome-readiness";
  autonomousLoopEnabled: false;
  status: OutcomeReadinessStatus;
  checks: OutcomeReadinessCheck[];
  runtime: RuntimeInspectSnapshot;
}

export function runtimeHandoffPaths(paths: ProjectPaths): string[] {
  return [paths.currentRunPath, paths.summaryPath, paths.briefPath];
}

export function runtimeHistoryPaths(paths: ProjectPaths): string[] {
  return [paths.eventsPath, paths.decisionsPath, paths.artifactsPath];
}

export function runtimeStatePaths(paths: ProjectPaths): string[] {
  return [...runtimeHandoffPaths(paths), ...runtimeHistoryPaths(paths)];
}

export function writeRuntimeSummaryAndBrief(
  paths: ProjectPaths,
  summary: RunSummary,
  current: CurrentRunState
): void {
  writeRunSummary(paths.summaryPath, summary);
  writeAtomicTextFile(paths.briefPath, buildRunBrief(summary, current));
}

export function createInstallCurrentRunState(): CurrentRunState {
  return {
    version: 2,
    objective: "initialize sane runtime",
    phase: "setup",
    activeTasks: ["install sane runtime"],
    blockingQuestions: [],
    verification: {
      status: "pending",
      summary: "runtime scaffolding created"
    },
    lastCompactionTsUnix: null,
    extra: {}
  };
}

export function createInstallRunSummary(): RunSummary {
  return {
    version: 2,
    acceptedDecisions: [],
    completedMilestones: [],
    constraints: [],
    lastVerifiedOutputs: [],
    filesTouched: [],
    extra: {}
  };
}

export function ensureRuntimeHandoffBaseline(
  paths: ProjectPaths
): RuntimeHandoffBaselineResult {
  const handoff = loadRuntimeHandoffState(paths);
  const defaultCurrent = createInstallCurrentRunState();
  const defaultSummary = createInstallRunSummary();
  const currentRewrite =
    handoff.current === null
      ? writeCanonicalWithBackupResult(paths.currentRunPath, defaultCurrent, {
          format: "json",
          stringify: stringifyCurrentRunState
        })
      : null;
  const summaryRewrite =
    handoff.summary === null
      ? writeCanonicalWithBackupResult(paths.summaryPath, defaultSummary, {
          format: "json"
        })
      : null;
  const current = handoff.current ?? defaultCurrent;
  const summary = handoff.summary ?? defaultSummary;
  const briefUpdated = handoff.brief === null || currentRewrite !== null || summaryRewrite !== null;
  const briefWriteMode =
    handoff.brief === null
      ? "first write"
      : briefUpdated
        ? "rewrite"
        : "preserved";

  if (briefUpdated) {
    writeAtomicTextFile(paths.briefPath, buildRunBrief(summary, current));
  }

  return {
    current,
    summary,
    currentRewrite,
    summaryRewrite,
    briefUpdated,
    briefWriteMode
  };
}

export function loadRuntimeHandoffState(paths: ProjectPaths): RuntimeHandoffState {
  const layeredState = tryLoadRuntimeStateBundle(paths);

  if (layeredState) {
    return {
      layeredState,
      current: layeredState.currentRun,
      summary: layeredState.summary,
      brief: layeredState.brief
    };
  }

  return {
    layeredState,
    current: safeRead(() => readCurrentRunState(paths.currentRunPath)),
    summary: safeRead(() => readRunSummary(paths.summaryPath)),
    brief: safeRead(() => readFileSync(paths.briefPath, "utf8"))
  };
}

export function inspectRuntimeState(paths: ProjectPaths): RuntimeInspectSnapshot {
  const handoff = loadRuntimeHandoffState(paths);
  const layeredState = handoff.layeredState;

  if (layeredState) {
    return {
      current: layeredState.currentRun,
      summary: layeredState.summary,
      brief: layeredState.brief,
      layerStatus: {
        currentRun: layeredState.layerStatus.currentRun,
        summary: layeredState.layerStatus.summary,
        brief: layeredState.layerStatus.brief
      },
      historyCounts: layeredState.historyCounts,
      historyPreview: layeredState.historyPreview,
      latestPolicyPreview: layeredState.latestPolicyPreview
    };
  }

  return {
    current: handoff.current,
    summary: handoff.summary,
    brief: handoff.brief,
    layerStatus: {
      currentRun: fallbackLayerStatus(paths.currentRunPath, handoff.current),
      summary: fallbackLayerStatus(paths.summaryPath, handoff.summary),
      brief: fallbackLayerStatus(paths.briefPath, handoff.brief)
    },
    historyCounts: { events: 0, decisions: 0, artifacts: 0 },
    historyPreview: {
      latestEvent: null,
      latestDecision: null,
      latestArtifact: null
    },
    latestPolicyPreview: createMissingLatestPolicyPreviewSnapshot()
  };
}

export function inspectSelfHostingShadowSnapshot(paths: ProjectPaths): SelfHostingShadowSnapshot {
  return inspectSelfHostingShadowSnapshotFromRuntimeState(paths, inspectRuntimeState(paths));
}

export function inspectSelfHostingShadowSnapshotFromRuntimeState(
  paths: ProjectPaths,
  runtime: RuntimeInspectSnapshot
): SelfHostingShadowSnapshot {
  const checks: SelfHostingShadowCheck[] = [
    runtimeLayerCheck("current-run", runtime.layerStatus.currentRun, paths.currentRunPath),
    runtimeLayerCheck("summary", runtime.layerStatus.summary, paths.summaryPath),
    runtimeLayerCheck("brief", runtime.layerStatus.brief, paths.briefPath),
    currentRunPayloadCheck(runtime.current),
    summaryPayloadCheck(runtime.summary),
    briefPayloadCheck(runtime.brief),
    blockingQuestionsCheck(runtime.current),
    verificationCheck(runtime.current),
    latestPolicyPreviewCheck(runtime.latestPolicyPreview),
    {
      id: "codex-native-memories",
      status: "pass",
      summary: "shadow inspection uses .sane handoff state and does not depend on Codex native memories",
      path: null
    },
    {
      id: "runner",
      status: "pass",
      summary: "self-hosting runner is disabled; this surface is read-only inspection only",
      path: null
    }
  ];

  return {
    mode: "shadow-inspect-only",
    runnerEnabled: false,
    status: checks.some((check) => check.status === "block") ? "blocked" : "ready",
    checks,
    runtime
  };
}

export function inspectOutcomeReadinessSnapshot(
  paths: ProjectPaths
): OutcomeReadinessSnapshot {
  return inspectOutcomeReadinessSnapshotFromRuntimeState(paths, inspectRuntimeState(paths));
}

export function inspectOutcomeReadinessSnapshotFromRuntimeState(
  paths: ProjectPaths,
  runtime: RuntimeInspectSnapshot
): OutcomeReadinessSnapshot {
  const checks: OutcomeReadinessCheck[] = [
    runtimeLayerCheck("current-run", runtime.layerStatus.currentRun, paths.currentRunPath),
    runtimeLayerCheck("summary", runtime.layerStatus.summary, paths.summaryPath),
    runtimeLayerCheck("brief", runtime.layerStatus.brief, paths.briefPath),
    currentRunPayloadCheck(runtime.current),
    summaryPayloadCheck(runtime.summary),
    briefPayloadCheck(runtime.brief),
    blockingQuestionsCheck(runtime.current),
    outcomeVerificationCheck(runtime.current),
    latestPolicyPreviewCheck(runtime.latestPolicyPreview),
    outcomePolicyPreflightCheck()
  ];

  return {
    mode: "codex-native-outcome-readiness",
    autonomousLoopEnabled: false,
    status: outcomeStatus(checks),
    checks,
    runtime
  };
}

function tryLoadRuntimeStateBundle(paths: ProjectPaths): LayeredStateBundle | null {
  try {
    return loadLayeredStateBundle(
      createCanonicalStatePaths(
        paths.configPath,
        paths.summaryPath,
        paths.currentRunPath,
        paths.briefPath,
        paths.eventsPath,
        paths.decisionsPath,
        paths.artifactsPath
      )
    );
  } catch {
    return null;
  }
}

function safeRead<T>(reader: () => T): T | null {
  try {
    return reader();
  } catch {
    return null;
  }
}

function fallbackLayerStatus(path: string, value: unknown): LayeredStateLayerStatus {
  if (value !== null) {
    return "present";
  }

  return existsSync(path) ? "invalid" : "missing";
}

function runtimeLayerCheck(
  id: "current-run" | "summary" | "brief",
  layerStatus: LayeredStateLayerStatus,
  path: string
): SelfHostingShadowCheck {
  if (layerStatus === "present") {
    return {
      id,
      status: "pass",
      summary: `${id} layer is readable`,
      path
    };
  }

  return {
    id,
    status: "block",
    summary:
      layerStatus === "invalid"
        ? `${id} layer exists but cannot be parsed`
        : `${id} layer is missing`,
    path
  };
}

function currentRunPayloadCheck(current: CurrentRunState | null): SelfHostingShadowCheck {
  if (!current) {
    return {
      id: "current-run-payload",
      status: "block",
      summary: "current-run payload is unavailable",
      path: null
    };
  }

  const hasObjective = current.objective.trim().length > 0;
  const hasPhase = current.phase.trim().length > 0;
  const hasTasks = current.activeTasks.some((task) => task.trim().length > 0);

  if (hasObjective && hasPhase && hasTasks) {
    return {
      id: "current-run-payload",
      status: "pass",
      summary: "current-run has objective, phase, and active task context",
      path: null
    };
  }

  return {
    id: "current-run-payload",
    status: "block",
    summary: "current-run must include objective, phase, and at least one active task",
    path: null
  };
}

function summaryPayloadCheck(summary: RunSummary | null): SelfHostingShadowCheck {
  if (!summary) {
    return {
      id: "summary-payload",
      status: "block",
      summary: "summary payload is unavailable",
      path: null
    };
  }

  return {
    id: "summary-payload",
    status: "pass",
    summary: "summary payload is readable",
    path: null
  };
}

function briefPayloadCheck(brief: string | null): SelfHostingShadowCheck {
  if (brief && brief.trim().length > 0) {
    return {
      id: "brief-payload",
      status: "pass",
      summary: "brief payload is readable",
      path: null
    };
  }

  return {
    id: "brief-payload",
    status: "block",
    summary: "brief payload is missing or empty",
    path: null
  };
}

function blockingQuestionsCheck(current: CurrentRunState | null): SelfHostingShadowCheck {
  const blockers = current?.blockingQuestions.filter(isRealBlockingQuestion) ?? [];

  if (blockers.length === 0) {
    return {
      id: "blocking-questions",
      status: "pass",
      summary: "no unresolved blocking questions in current-run",
      path: null
    };
  }

  return {
    id: "blocking-questions",
    status: "block",
    summary: `${blockers.length} unresolved blocking question(s) must be answered before shadow work`,
    path: null
  };
}

function verificationCheck(current: CurrentRunState | null): SelfHostingShadowCheck {
  const status = current?.verification.status.trim().toLowerCase() ?? "";

  if (status.length === 0 || status === "unknown" || status === "pending") {
    return {
      id: "verification",
      status: "block",
      summary: "verification must pass before shadow readiness",
      path: null
    };
  }

  if (status === "failed" || status === "failing" || status === "blocked") {
    return {
      id: "verification",
      status: "block",
      summary: `verification status is ${current?.verification.status}`,
      path: null
    };
  }

  if (status !== "passed" && status !== "verified") {
    return {
      id: "verification",
      status: "block",
      summary: `verification status is ${current?.verification.status}`,
      path: null
    };
  }

  return {
    id: "verification",
    status: "pass",
    summary: `verification status is ${current?.verification.status}`,
    path: null
  };
}

function latestPolicyPreviewCheck(
  latestPolicyPreview: LatestPolicyPreviewSnapshot
): SelfHostingShadowCheck {
  if (latestPolicyPreview.status === "present") {
    return {
      id: "latest-policy-preview",
      status: "pass",
      summary: `latest policy preview has ${latestPolicyPreview.scenarioCount} scenario(s)`,
      path: null
    };
  }

  return {
    id: "latest-policy-preview",
    status: "warn",
    summary: "latest policy preview is missing; current-run inspection can still proceed",
    path: null
  };
}

function outcomeVerificationCheck(current: CurrentRunState | null): OutcomeReadinessCheck {
  const status = current?.verification.status.trim().toLowerCase() ?? "";

  if (status === "failed" || status === "failing" || status === "blocked") {
    return {
      id: "verification",
      status: "block",
      summary: `verification status is ${current?.verification.status}`,
      path: null
    };
  }

  if (status === "passed" || status === "verified") {
    return {
      id: "verification",
      status: "pass",
      summary: `verification status is ${current?.verification.status}`,
      path: null
    };
  }

  return {
    id: "verification",
    status: "warn",
    summary: "verification is not complete yet; outcome work must verify before closing",
    path: null
  };
}

function outcomePolicyPreflightCheck(): OutcomeReadinessCheck {
  const result = evaluatePolicyFixtures(outcomeRunnerPreflightFixtures());

  if (result.passed) {
    return {
      id: "policy-preflight",
      status: "pass",
      summary: `B8 policy preflight passed (${result.caseCount} case(s))`,
      path: null
    };
  }

  return {
    id: "policy-preflight",
    status: "block",
    summary: `B8 policy preflight failed (${result.failureCount} failure(s) across ${result.caseCount} case(s))`,
    path: null
  };
}

function outcomeStatus(checks: OutcomeReadinessCheck[]): OutcomeReadinessStatus {
  const blockingIds = checks
    .filter((check) => check.status === "block")
    .map((check) => check.id);

  if (blockingIds.length === 0) {
    return "ready";
  }

  return blockingIds.includes("blocking-questions") ? "needs_input" : "blocked";
}

function isRealBlockingQuestion(question: string): boolean {
  const normalized = question.trim().toLowerCase();

  return normalized.length > 0 && normalized !== "none" && normalized !== "n/a";
}
