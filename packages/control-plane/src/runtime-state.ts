import { existsSync, readFileSync } from "node:fs";

import { type ProjectPaths } from "@sane/platform";
import {
  buildRunBrief,
  type CanonicalRewriteResult,
  createCanonicalStatePaths,
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
    latestPolicyPreview: missingLatestPolicyPreview()
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

function missingLatestPolicyPreview(): LatestPolicyPreviewSnapshot {
  return {
    status: "missing",
    scenarioCount: 0,
    scenarioIds: [],
    scenarios: [],
    tsUnix: null,
    summary: null
  };
}
