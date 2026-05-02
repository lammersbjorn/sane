import {
  isPlainObject,
  parseJsonValue,
  upgradedVersion,
} from './coercion.js';
import {
  createDefaultVerificationStatus,
  parseCurrentRunStateValue,
  parseRunSnapshotValue,
  serializeCurrentRunState,
  serializeRunSnapshot,
} from './current-run-json.js';
import {
  parseArtifactRecordValue,
  parseDecisionRecordValue,
  parseEventRecordValue,
  serializeArtifactRecord,
  serializeDecisionRecord,
  serializeEventRecord,
} from './history-json.js';
import {
  appendTextLine,
  nowUnix,
  readText,
  writeAtomicTextFile,
  writeCanonicalWithBackupResult as writeEncodedCanonicalWithBackupResult,
} from './io.js';
import { parseRunSummaryValue, serializeRunSummary } from './run-summary-json.js';
import { stringifyLocalStateConfig } from './toml-state.js';
import type {
  ArtifactRecord,
  CanonicalRewriteResult,
  CanonicalWriteOptions,
  CurrentRunState,
  DecisionRecord,
  EventRecord,
  JsonRecord,
  LocalStateConfig,
  RunSnapshot,
  RunSummary,
  RunSummaryPromotion,
} from './types.js';

export function parseRunSnapshotJson(raw: string, path = 'current-run.json'): RunSnapshot {
  return parseRunSnapshotValue(parseJsonValue(raw, path));
}

export function stringifyRunSnapshot(snapshot: RunSnapshot): string {
  return JSON.stringify(serializeRunSnapshot(snapshot), null, 2);
}

export function readRunSnapshot(path: string): RunSnapshot {
  const raw = readText(path);

  try {
    return currentRunStateToRunSnapshot(parseCurrentRunStateJson(raw, path));
  } catch {
    return parseRunSnapshotJson(raw, path);
  }
}

export function writeRunSnapshot(path: string, snapshot: RunSnapshot): void {
  writeJsonFile(path, stringifyCurrentRunState(runSnapshotToCurrentRunState(snapshot)));
}

export function runSnapshotToCurrentRunState(snapshot: RunSnapshot): CurrentRunState {
  return createDefaultCurrentRunState(snapshot.objective, snapshot.version);
}

export function currentRunStateToRunSnapshot(state: CurrentRunState): RunSnapshot {
  return {
    version: state.version,
    objective: state.objective,
  };
}

export function parseRunSummaryJson(raw: string, path = 'summary.json'): RunSummary {
  return parseRunSummaryValue(parseJsonValue(raw, path));
}

export function stringifyRunSummary(summary: RunSummary): string {
  return JSON.stringify(serializeRunSummary(summary), null, 2);
}

export function readRunSummary(path: string): RunSummary {
  return parseRunSummaryJson(readText(path), path);
}

export function writeRunSummary(path: string, summary: RunSummary): void {
  writeJsonFile(path, stringifyRunSummary(summary));
}

export function createDefaultRunSummary(): RunSummary {
  return {
    version: 2,
    acceptedDecisions: [],
    completedMilestones: [],
    constraints: [],
    lastVerifiedOutputs: [],
    filesTouched: [],
    extra: {},
  };
}

export function createDefaultCurrentRunState(objective: string, version = 2): CurrentRunState {
  return {
    version: upgradedVersion(version),
    objective,
    phase: 'unknown',
    activeTasks: [],
    blockingQuestions: [],
    verification: createDefaultVerificationStatus(),
    lastCompactionTsUnix: null,
    extra: {},
  };
}

export function promoteRunSummary(summary: RunSummary, promotion: RunSummaryPromotion): RunSummary {
  const filesTouched = [...summary.filesTouched];
  for (const path of promotion.pathsTouched) {
    filesTouched.push(path);
  }

  const milestone = promotion.milestone ?? null;
  const completedMilestones = [...summary.completedMilestones];
  if (milestone && !completedMilestones.includes(milestone)) {
    completedMilestones.push(milestone);
  }

  return {
    ...summary,
    completedMilestones,
    filesTouched: Array.from(new Set(filesTouched)).sort(),
  };
}

export function buildRunBrief(summary: RunSummary, current: CurrentRunState): string {
  return [
    '# Sane Brief',
    '',
    '## Current Run',
    `- Objective: ${current.objective}`,
    `- Phase: ${current.phase}`,
    `- Verification: ${current.verification.status}`,
    `- Last compaction: ${current.lastCompactionTsUnix ?? 'none'}`,
    '',
    '## Active Tasks',
    ...renderBriefBullets(current.activeTasks),
    '',
    '## Blocking Questions',
    ...renderBriefBullets(current.blockingQuestions),
    '',
    '## Accepted Decisions',
    ...renderBriefBullets(summary.acceptedDecisions),
    '',
    '## Completed Milestones',
    ...renderBriefBullets(summary.completedMilestones),
    '',
    '## Last Verified Outputs',
    ...renderBriefBullets(summary.lastVerifiedOutputs),
    '',
    '## Files Touched',
    ...renderBriefBullets(summary.filesTouched),
    '',
  ].join('\n');
}

export function parseCurrentRunStateJson(raw: string, path = 'current-run.json'): CurrentRunState {
  return parseCurrentRunStateValue(parseJsonValue(raw, path));
}

export function stringifyCurrentRunState(state: CurrentRunState): string {
  return JSON.stringify(serializeCurrentRunState(state), null, 2);
}

export function readCurrentRunState(path: string): CurrentRunState {
  return parseCurrentRunStateJson(readText(path), path);
}

export function writeCurrentRunState(path: string, state: CurrentRunState): void {
  writeJsonFile(path, stringifyCurrentRunState(state));
}

export function createEventRecord(
  category: string,
  action: string,
  result: string,
  summary: string,
  paths: string[],
): EventRecord {
  return { tsUnix: nowUnix(), category, action, result, summary, paths };
}

export function parseEventRecordJson(raw: string, path = 'events.jsonl'): EventRecord {
  return parseEventRecordValue(parseJsonValue(raw, path));
}

export function stringifyEventRecord(record: EventRecord): string {
  return JSON.stringify(serializeEventRecord(record));
}

export function createDecisionRecord(
  summary: string,
  rationale: string,
  paths: string[],
  context: JsonRecord | null = null,
): DecisionRecord {
  return { version: 1, tsUnix: nowUnix(), summary, rationale, paths, context };
}

export function parseDecisionRecordJson(raw: string, path = 'decisions.jsonl'): DecisionRecord {
  return parseDecisionRecordValue(parseJsonValue(raw, path));
}

export function stringifyDecisionRecord(record: DecisionRecord): string {
  return JSON.stringify(serializeDecisionRecord(record));
}

export function createArtifactRecord(kind: string, path: string, summary: string, paths: string[]): ArtifactRecord {
  return { version: 1, tsUnix: nowUnix(), kind, path, summary, paths };
}

export function parseArtifactRecordJson(raw: string, path = 'artifacts.jsonl'): ArtifactRecord {
  return parseArtifactRecordValue(parseJsonValue(raw, path));
}

export function stringifyArtifactRecord(record: ArtifactRecord): string {
  return JSON.stringify(serializeArtifactRecord(record));
}

export function appendJsonlRecord<T>(
  path: string,
  value: T,
  stringifyValue: (value: T) => string = defaultJsonlStringify,
): void {
  appendTextLine(path, stringifyValue(value));
}

export function writeCanonicalWithBackup<T>(
  path: string,
  value: T,
  options: CanonicalWriteOptions<T>,
): string | null {
  return writeCanonicalWithBackupResult(path, value, options).backupPath;
}

export function writeCanonicalWithBackupResult<T>(
  path: string,
  value: T,
  options: CanonicalWriteOptions<T>,
): CanonicalRewriteResult {
  const encoded = encodeCanonicalValue(value, options);
  return writeEncodedCanonicalWithBackupResult(path, encoded);
}

function defaultJsonlStringify<T>(value: T): string {
  return JSON.stringify(canonicalizeKnownJsonState(value));
}

function encodeCanonicalValue<T>(value: T, options: CanonicalWriteOptions<T>): string {
  if (options.stringify) {
    return options.stringify(value);
  }

  if (options.format === 'json') {
    return JSON.stringify(canonicalizeKnownJsonState(value), null, 2);
  }

  if (isLocalStateConfig(value)) {
    return stringifyLocalStateConfig(value);
  }

  throw new Error('toml writes require a LocalStateConfig value or explicit stringify option');
}

function canonicalizeKnownJsonState(value: unknown): unknown {
  if (isRunSummary(value)) return serializeRunSummary(value);
  if (isCurrentRunState(value)) return serializeCurrentRunState(value);
  if (isRunSnapshot(value)) return serializeRunSnapshot(value);
  if (isDecisionRecord(value)) return serializeDecisionRecord(value);
  if (isArtifactRecord(value)) return serializeArtifactRecord(value);
  if (isEventRecord(value)) return serializeEventRecord(value);
  return value;
}

function isRunSnapshot(value: unknown): value is RunSnapshot {
  if (!isPlainObject(value)) {
    return false;
  }
  return typeof value.objective === 'string' && !('phase' in value);
}

function isRunSummary(value: unknown): value is RunSummary {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    Array.isArray(value.acceptedDecisions) &&
    Array.isArray(value.completedMilestones) &&
    Array.isArray(value.constraints) &&
    Array.isArray(value.lastVerifiedOutputs) &&
    Array.isArray(value.filesTouched)
  );
}

function isLocalStateConfig(value: unknown): value is LocalStateConfig {
  if (!isPlainObject(value)) {
    return false;
  }
  return typeof value.version === 'number' && isPlainObject(value.extra);
}

function isCurrentRunState(value: unknown): value is CurrentRunState {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    typeof value.objective === 'string' &&
    typeof value.phase === 'string' &&
    Array.isArray(value.activeTasks) &&
    Array.isArray(value.blockingQuestions) &&
    isPlainObject(value.verification)
  );
}

function isEventRecord(value: unknown): value is EventRecord {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    typeof value.category === 'string' &&
    typeof value.action === 'string' &&
    typeof value.result === 'string'
  );
}

function isDecisionRecord(value: unknown): value is DecisionRecord {
  if (!isPlainObject(value)) {
    return false;
  }
  return typeof value.summary === 'string' && typeof value.rationale === 'string';
}

function isArtifactRecord(value: unknown): value is ArtifactRecord {
  if (!isPlainObject(value)) {
    return false;
  }
  return (
    typeof value.kind === 'string' &&
    typeof value.path === 'string' &&
    typeof value.summary === 'string'
  );
}

function writeJsonFile(path: string, body: string): void {
  writeAtomicTextFile(path, body);
}

function renderBriefBullets(items: string[]): string[] {
  return items.length === 0 ? ['- none'] : items.map((item) => `- ${item}`);
}
