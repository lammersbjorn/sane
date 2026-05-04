import { existsSync, readFileSync } from "node:fs";

import { ensureRuntimeDirs, type ProjectPaths } from "../../platform.js";
import {
  buildRunBrief,
  type CanonicalRewriteResult,
  createCanonicalStatePaths,
  createMissingLatestPolicyPreviewSnapshot,
  loadLayeredStateBundle,
  parseEventRecordJson,
  readJsonlRecords,
  readCurrentRunState,
  writeCurrentRunState,
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
import {
  buildNextOutcomeCurrentRun,
  buildNextOutcomeSummary,
  outcomeAdvanceDetails,
  outcomeAdvanceStatus
} from "./runtime-state-outcome.js";
import {
  buildOutcomeReadinessChecks,
  buildSelfHostingShadowChecks,
  outcomeStatus
} from "./runtime-state-readiness.js";
import { inspectOutcomeRescueSignalFromRuntimeStateSnapshot } from "./runtime-state-rescue-signals.js";

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

export interface RecentBlockerSummary {
  total: number;
  items: string[];
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
  const checks = buildSelfHostingShadowChecks(paths, runtime);

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
  const checks = buildOutcomeReadinessChecks(paths, runtime);

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
  return inspectOutcomeRescueSignalFromRuntimeStateSnapshot(runtime);
}

export function inspectRecentBlockersFromStateEvents(
  paths: ProjectPaths,
  limit = 3
): RecentBlockerSummary {
  if (limit <= 0) {
    return { total: 0, items: [] };
  }

  const records = safeRead(() => readJsonlRecords(paths.eventsPath, parseEventRecordJson)) ?? [];
  const blockers = records.filter(isBlockerEvent);
  const items = blockers
    .slice(-limit)
    .reverse()
    .map((record) => sanitizeBlockerSummary(`${record.action}: ${record.summary}`));

  return { total: blockers.length, items };
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

function isBlockerEvent(record: { result: string; summary: string }): boolean {
  const result = record.result.trim().toLowerCase();
  if (result === "blocked" || result === "failed" || result === "warning") {
    return true;
  }

  const summary = record.summary.toLowerCase();
  return (
    summary.includes("blocked")
    || summary.includes("failed")
    || summary.includes("invalid")
    || summary.includes("warning")
  );
}

function sanitizeBlockerSummary(value: string): string {
  const withoutControl = value.replace(/[\u0000-\u001F\u007F]/g, " ");
  const collapsed = withoutControl.replace(/\s+/g, " ").trim();

  if (collapsed.length <= 180) {
    return collapsed;
  }

  return `${collapsed.slice(0, 177)}...`;
}
