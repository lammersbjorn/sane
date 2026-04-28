import { existsSync, readFileSync } from "node:fs";

import { ensureRuntimeDirs, type ProjectPaths } from "@sane/platform";
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
  writeCurrentRunState,
  readRunSummary,
  stringifyCurrentRunState,
  writeCanonicalWithBackupResult,
  writeRunSummary,
  type CurrentRunState,
  type JsonRecord,
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

export type OutcomeRescueSignalStatus = "pass" | "warn" | "block";

export interface OutcomeRescueSignalSnapshot {
  status: OutcomeRescueSignalStatus;
  summary: string;
  reasons: string[];
}

export interface AdvanceOutcomeInput {
  objective?: string;
  completedTask?: string;
  nextTasks?: string[];
  blockingQuestions?: string[];
  toolError?: string;
  repeatedToolErrorCount?: number;
  verification?: {
    status: string;
    summary?: string | null;
  };
  milestone?: string;
  filesTouched?: string[];
}

export interface AdvanceOutcomeResult {
  status: "advanced" | "blocked" | "closing";
  current: CurrentRunState;
  summary: RunSummary;
  pathsTouched: string[];
  details: string[];
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

export function advanceOutcomeState(
  paths: ProjectPaths,
  input: AdvanceOutcomeInput = {}
): AdvanceOutcomeResult {
  ensureRuntimeDirs(paths);
  const baseline = ensureRuntimeHandoffBaseline(paths);
  const runtime = inspectRuntimeState(paths);
  const current = runtime.current ?? baseline.current;
  const summary = runtime.summary ?? baseline.summary;
  const nextCurrent = buildNextOutcomeCurrentRun(current, input);
  const nextSummary = buildNextOutcomeSummary(summary, nextCurrent, input);

  writeCurrentRunState(paths.currentRunPath, nextCurrent);
  writeRuntimeSummaryAndBrief(paths, nextSummary, nextCurrent);

  return {
    status: outcomeAdvanceStatus(nextCurrent),
    current: nextCurrent,
    summary: nextSummary,
    pathsTouched: unique([
      paths.currentRunPath,
      paths.summaryPath,
      paths.briefPath,
      ...(input.filesTouched ?? [])
    ]),
    details: outcomeAdvanceDetails(nextCurrent)
  };
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
    ...outcomeRescueSignalChecks(runtime),
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

export function inspectOutcomeRescueSignalFromRuntimeState(
  runtime: RuntimeInspectSnapshot
): OutcomeRescueSignalSnapshot {
  const signals = outcomeRescueSignalChecks(runtime);
  const blockSignals = signals.filter((signal) => signal.status === "block");
  const warnSignals = signals.filter((signal) => signal.status === "warn");
  const activeSignals = blockSignals.length > 0 ? blockSignals : warnSignals;

  if (activeSignals.length === 0) {
    return {
      status: "pass",
      summary: "no rescue signals detected",
      reasons: signals.map((signal) => signal.summary)
    };
  }

  return {
    status: blockSignals.length > 0 ? "block" : "warn",
    summary: activeSignals.map((signal) => signal.summary).join("; "),
    reasons: activeSignals.map((signal) => signal.summary)
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

function buildNextOutcomeCurrentRun(
  current: CurrentRunState,
  input: AdvanceOutcomeInput
): CurrentRunState {
  const activeTasks = normalizeList(input.nextTasks ?? current.activeTasks)
    .filter((task) => task !== input.completedTask);
  const blockingQuestions = normalizeList(input.blockingQuestions ?? current.blockingQuestions);
  const verification = input.verification
    ? {
        status: input.verification.status,
        summary: input.verification.summary ?? null
      }
    : current.verification;
  const existingOutcomeRecord = currentOutcomeJsonRecord(current);
  const existingOutcome = currentOutcomeMetadata(current);
  const next: CurrentRunState = {
    ...current,
    objective: normalizeText(input.objective) ?? current.objective,
    activeTasks,
    blockingQuestions,
    verification,
    extra: {
      ...current.extra,
      outcome: {
        ...existingOutcomeRecord,
        mode: "framework",
        autonomousLoop: false,
        lastAdvanceTsUnix: nowSeconds(),
        lastToolError: normalizeText(input.toolError) ?? existingOutcome.lastToolError ?? null,
        repeatedToolErrorCount: input.repeatedToolErrorCount ?? existingOutcome.repeatedToolErrorCount ?? 0,
        stopCondition: outcomeStopCondition(activeTasks, blockingQuestions, verification.status)
      }
    }
  };

  const phase = deriveOutcomePhase(next);
  const phaseRepeatCount = existingOutcome.lastPhase === phase
    ? (existingOutcome.phaseRepeatCount ?? 0) + 1
    : 1;

  return {
    ...next,
    phase,
    extra: {
      ...next.extra,
      outcome: {
        ...currentOutcomeJsonRecord(next),
        lastPhase: phase,
        phaseRepeatCount
      }
    }
  };
}

function buildNextOutcomeSummary(
  summary: RunSummary,
  current: CurrentRunState,
  input: AdvanceOutcomeInput
): RunSummary {
  const completedMilestones = [...summary.completedMilestones];
  const milestone = normalizeText(input.milestone);
  if (milestone && !completedMilestones.includes(milestone)) {
    completedMilestones.push(milestone);
  }

  const filesTouched = unique([...summary.filesTouched, ...(input.filesTouched ?? [])]);
  const lastVerifiedOutputs = [...summary.lastVerifiedOutputs];
  if (current.verification.status.toLowerCase() === "passed" && current.verification.summary) {
    lastVerifiedOutputs.push(current.verification.summary);
  }

  return {
    ...summary,
    completedMilestones,
    filesTouched,
    lastVerifiedOutputs: unique(lastVerifiedOutputs)
  };
}

function deriveOutcomePhase(current: CurrentRunState): string {
  const blockers = current.blockingQuestions.filter(isRealBlockingQuestion);
  const verificationStatus = current.verification.status.toLowerCase();

  if (blockers.length > 0) {
    return "blocked";
  }
  if (verificationStatus === "failed" || verificationStatus === "failing" || verificationStatus === "blocked") {
    return "repairing";
  }
  if (current.activeTasks.length === 0 && (verificationStatus === "passed" || verificationStatus === "verified")) {
    return "closing";
  }
  return "executing";
}

function outcomeAdvanceStatus(current: CurrentRunState): AdvanceOutcomeResult["status"] {
  if (current.phase === "blocked") {
    return "blocked";
  }
  if (current.phase === "closing") {
    return "closing";
  }
  return "advanced";
}

function outcomeAdvanceDetails(current: CurrentRunState): string[] {
  return [
    `objective: ${current.objective}`,
    `phase: ${current.phase}`,
    `active tasks: ${current.activeTasks.length === 0 ? "none" : current.activeTasks.join(", ")}`,
    `blocking questions: ${current.blockingQuestions.length === 0 ? "none" : current.blockingQuestions.join(", ")}`,
    `verification: ${current.verification.status}${current.verification.summary ? ` (${current.verification.summary})` : ""}`,
    "autonomous loop: disabled"
  ];
}

function outcomeStopCondition(
  activeTasks: string[],
  blockingQuestions: string[],
  verificationStatus: string
): string {
  if (blockingQuestions.some(isRealBlockingQuestion)) {
    return "needs_input";
  }
  if (activeTasks.length === 0 && ["passed", "verified"].includes(verificationStatus.toLowerCase())) {
    return "verified";
  }
  return "continue_until_verified";
}

function normalizeList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
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

const OUTCOME_STALL_WINDOW_SECONDS = 30 * 60;
const OUTCOME_REPEATED_PHASE_THRESHOLD = 3;
const OUTCOME_REPEATED_TOOL_ERROR_THRESHOLD = 3;

function outcomeRescueSignalChecks(runtime: RuntimeInspectSnapshot): OutcomeReadinessCheck[] {
  return [
    outcomeLongSilenceSignalCheck(runtime),
    outcomeRepeatedPhaseSignalCheck(runtime),
    outcomeFileDeltaSignalCheck(runtime),
    outcomeRepeatedToolErrorSignalCheck(runtime)
  ];
}

function outcomeLongSilenceSignalCheck(runtime: RuntimeInspectSnapshot): OutcomeReadinessCheck {
  const current = runtime.current;

  if (!current) {
    return {
      id: "long-silence",
      status: "block",
      summary: "current-run payload is unavailable",
      path: null
    };
  }

  const activeTasks = current.activeTasks.map((task) => task.trim()).filter((task) => task.length > 0);
  const blockers = current.blockingQuestions.filter(isRealBlockingQuestion);
  const verificationStatus = current.verification.status.trim().toLowerCase();

  if (activeTasks.length === 0 || blockers.length > 0) {
    return {
      id: "long-silence",
      status: "pass",
      summary: "no active unblocked work needs a stall check",
      path: null
    };
  }

  if (verificationStatus === "passed" || verificationStatus === "verified") {
    return {
      id: "long-silence",
      status: "pass",
      summary: "verification is already complete",
      path: null
    };
  }

  const latestProgressTs = latestPersistedOutcomeProgressTs(current, runtime.historyPreview);
  if (latestProgressTs === null) {
    return {
      id: "long-silence",
      status: "pass",
      summary: "no persisted progress signal exists yet",
      path: null
    };
  }

  const ageSeconds = nowSeconds() - latestProgressTs;
  if (ageSeconds >= OUTCOME_STALL_WINDOW_SECONDS) {
    return {
      id: "long-silence",
      status: "warn",
      summary: `long silence: no persisted progress for ${Math.floor(ageSeconds / 60)}m while ${activeTasks.length} task(s) remain open`,
      path: null
    };
  }

  return {
    id: "long-silence",
    status: "pass",
    summary: `recent persisted progress seen ${Math.floor(ageSeconds / 60)}m ago`,
    path: null
  };
}

function outcomeRepeatedPhaseSignalCheck(runtime: RuntimeInspectSnapshot): OutcomeReadinessCheck {
  const current = runtime.current;
  if (!current) {
    return {
      id: "repeated-phase",
      status: "block",
      summary: "current-run payload is unavailable",
      path: null
    };
  }

  const outcome = currentOutcomeMetadata(current);
  const phaseRepeatCount = outcome.phaseRepeatCount ?? 0;
  if (phaseRepeatCount >= OUTCOME_REPEATED_PHASE_THRESHOLD) {
    return {
      id: "repeated-phase",
      status: "warn",
      summary: `repeated phase: ${current.phase} seen ${phaseRepeatCount} time(s) without closing`,
      path: null
    };
  }

  return {
    id: "repeated-phase",
    status: "pass",
    summary: "no repeated phase signal detected",
    path: null
  };
}

function outcomeFileDeltaSignalCheck(runtime: RuntimeInspectSnapshot): OutcomeReadinessCheck {
  const current = runtime.current;
  if (!current) {
    return {
      id: "file-delta",
      status: "block",
      summary: "current-run payload is unavailable",
      path: null
    };
  }

  const activeTasks = current.activeTasks.map((task) => task.trim()).filter((task) => task.length > 0);
  const verificationStatus = current.verification.status.trim().toLowerCase();
  const filesTouched = runtime.summary?.filesTouched.length ?? 0;

  if (current.phase.trim().toLowerCase() === "setup") {
    return {
      id: "file-delta",
      status: "pass",
      summary: "setup phase does not need a file-delta check",
      path: null
    };
  }

  if (activeTasks.length === 0 || verificationStatus === "passed" || verificationStatus === "verified") {
    return {
      id: "file-delta",
      status: "pass",
      summary: "no active unverified work needs a file-delta check",
      path: null
    };
  }

  if (filesTouched === 0) {
    return {
      id: "file-delta",
      status: "warn",
      summary: "no file delta recorded while active unverified work remains",
      path: null
    };
  }

  return {
    id: "file-delta",
    status: "pass",
    summary: `file delta recorded (${filesTouched} file(s))`,
    path: null
  };
}

function outcomeRepeatedToolErrorSignalCheck(runtime: RuntimeInspectSnapshot): OutcomeReadinessCheck {
  const current = runtime.current;
  if (!current) {
    return {
      id: "repeated-tool-errors",
      status: "block",
      summary: "current-run payload is unavailable",
      path: null
    };
  }

  const outcome = currentOutcomeMetadata(current);
  const count = outcome.repeatedToolErrorCount ?? 0;
  if (count >= OUTCOME_REPEATED_TOOL_ERROR_THRESHOLD) {
    const suffix = outcome.lastToolError ? ` (${outcome.lastToolError})` : "";
    return {
      id: "repeated-tool-errors",
      status: "warn",
      summary: `repeated tool errors: ${count} recent failure(s)${suffix}`,
      path: null
    };
  }

  return {
    id: "repeated-tool-errors",
    status: "pass",
    summary: "no repeated tool error signal detected",
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

function latestPersistedOutcomeProgressTs(
  current: CurrentRunState,
  historyPreview: LayeredStateHistoryPreview
): number | null {
  const values = [
    currentOutcomeLastAdvanceTsUnix(current),
    historyPreview.latestEvent?.tsUnix ?? null,
    historyPreview.latestDecision?.tsUnix ?? null,
    historyPreview.latestArtifact?.tsUnix ?? null
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function currentOutcomeLastAdvanceTsUnix(current: CurrentRunState): number | null {
  const value = currentOutcomeMetadata(current).lastAdvanceTsUnix;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface OutcomeMetadata {
  mode?: string;
  autonomousLoop?: boolean;
  lastAdvanceTsUnix?: number;
  stopCondition?: string;
  lastPhase?: string | null;
  phaseRepeatCount?: number;
  lastToolError?: string | null;
  repeatedToolErrorCount?: number;
}

function currentOutcomeMetadata(current: CurrentRunState): OutcomeMetadata {
  const outcome = currentOutcomeJsonRecord(current);

  return {
    mode: typeof outcome.mode === "string" ? outcome.mode : undefined,
    autonomousLoop: typeof outcome.autonomousLoop === "boolean" ? outcome.autonomousLoop : undefined,
    lastAdvanceTsUnix: typeof outcome.lastAdvanceTsUnix === "number" ? outcome.lastAdvanceTsUnix : undefined,
    stopCondition: typeof outcome.stopCondition === "string" ? outcome.stopCondition : undefined,
    lastPhase: typeof outcome.lastPhase === "string" || outcome.lastPhase === null ? outcome.lastPhase : undefined,
    phaseRepeatCount: typeof outcome.phaseRepeatCount === "number" ? outcome.phaseRepeatCount : undefined,
    lastToolError: typeof outcome.lastToolError === "string" || outcome.lastToolError === null ? outcome.lastToolError : undefined,
    repeatedToolErrorCount: typeof outcome.repeatedToolErrorCount === "number" ? outcome.repeatedToolErrorCount : undefined
  };
}

function currentOutcomeJsonRecord(current: CurrentRunState): JsonRecord {
  const outcome = current.extra.outcome;

  if (!outcome || Array.isArray(outcome) || typeof outcome !== "object") {
    return {};
  }

  return outcome as JsonRecord;
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
