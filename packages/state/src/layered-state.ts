import { countJsonlEntries, readLatestValidJsonlRecord } from './history.js';
import { exists, readText } from './io.js';
import {
  parseArtifactRecordJson,
  parseDecisionRecordJson,
  parseEventRecordJson,
  readCurrentRunState,
  readRunSummary,
} from './json-state.js';
import {
  createMissingLatestPolicyPreviewSnapshot,
  readLatestPolicyPreviewSnapshot,
} from './policy-preview.js';
import { readLocalStateConfig } from './toml-state.js';
import type {
  CanonicalStatePaths,
  LayeredStateBundle,
  LayeredStateLayerStatus,
} from './types.js';

export function createCanonicalStatePaths(
  configPath: string,
  summaryPath: string,
  currentRunPath: string,
  briefPath: string,
  eventsPath?: string,
  decisionsPath?: string,
  artifactsPath?: string,
): CanonicalStatePaths {
  return {
    configPath,
    summaryPath,
    currentRunPath,
    briefPath,
    eventsPath,
    decisionsPath,
    artifactsPath,
  };
}

export function loadLayeredStateBundle(paths: CanonicalStatePaths): LayeredStateBundle {
  const config = readOptionalLayer(paths.configPath, readLocalStateConfig);
  const summary = readOptionalLayer(paths.summaryPath, readRunSummary);
  const currentRun = readOptionalLayer(paths.currentRunPath, readCurrentRunState);
  const brief = readOptionalText(paths.briefPath);

  return {
    config: config.value,
    summary: summary.value,
    currentRun: currentRun.value,
    brief: brief.value,
    layerStatus: {
      config: config.status,
      summary: summary.status,
      currentRun: currentRun.status,
      brief: brief.status,
    },
    historyCounts: {
      events: countOptionalJsonlEntries(paths.eventsPath),
      decisions: countOptionalJsonlEntries(paths.decisionsPath),
      artifacts: countOptionalJsonlEntries(paths.artifactsPath),
    },
    historyPreview: {
      latestEvent: paths.eventsPath
        ? readLatestValidJsonlRecord(paths.eventsPath, parseEventRecordJson, (record) => ({
            tsUnix: record.tsUnix,
            action: record.action,
            summary: record.summary,
            result: record.result,
          }))
        : null,
      latestDecision: paths.decisionsPath
        ? readLatestValidJsonlRecord(paths.decisionsPath, parseDecisionRecordJson, (record) => ({
            tsUnix: record.tsUnix,
            summary: record.summary,
            rationale: record.rationale,
          }))
        : null,
      latestArtifact: paths.artifactsPath
        ? readLatestValidJsonlRecord(paths.artifactsPath, parseArtifactRecordJson, (record) => ({
            tsUnix: record.tsUnix,
            kind: record.kind,
            summary: record.summary,
            path: record.path,
          }))
        : null,
    },
    latestPolicyPreview: paths.decisionsPath
      ? readLatestPolicyPreviewSnapshot(paths.decisionsPath)
      : createMissingLatestPolicyPreviewSnapshot(),
  };
}

function readOptional<T>(path: string, reader: (path: string) => T): T | null {
  if (!exists(path)) {
    return null;
  }
  return reader(path);
}

function readOptionalLayer<T>(
  path: string,
  reader: (path: string) => T,
): { value: T | null; status: LayeredStateLayerStatus } {
  if (!exists(path)) {
    return { value: null, status: 'missing' };
  }

  try {
    return { value: readOptional(path, reader), status: 'present' };
  } catch {
    return { value: null, status: 'invalid' };
  }
}

function countOptionalJsonlEntries(path: string | undefined): number {
  if (!path) {
    return 0;
  }
  try {
    return countJsonlEntries(path);
  } catch {
    return 0;
  }
}

function readOptionalText(path: string): { value: string | null; status: LayeredStateLayerStatus } {
  if (!exists(path)) {
    return { value: null, status: 'missing' };
  }
  try {
    return { value: readText(path), status: 'present' };
  } catch {
    return { value: null, status: 'invalid' };
  }
}
