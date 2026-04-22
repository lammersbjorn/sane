import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonRecord;
export interface JsonRecord {
  [key: string]: JsonValue;
}

export type TomlPrimitive = string | number | boolean;
export type TomlValue = TomlPrimitive | TomlPrimitive[] | TomlTable;
export interface TomlTable {
  [key: string]: TomlValue;
}

export interface RunSnapshot {
  version: number;
  objective: string;
}

export interface RunSummary {
  version: number;
  acceptedDecisions: string[];
  completedMilestones: string[];
  constraints: string[];
  lastVerifiedOutputs: string[];
  filesTouched: string[];
  extra: JsonRecord;
}

export interface RunSummaryPromotion {
  pathsTouched: string[];
  milestone?: string | null;
}

export interface LocalStateConfig {
  version: number;
  extra: TomlTable;
}

export interface VerificationStatus {
  status: string;
  summary: string | null;
}

export interface CurrentRunState {
  version: number;
  objective: string;
  phase: string;
  activeTasks: string[];
  blockingQuestions: string[];
  verification: VerificationStatus;
  lastCompactionTsUnix: number | null;
  extra: JsonRecord;
}

export interface LayeredStateHistoryCounts {
  events: number;
  decisions: number;
  artifacts: number;
}

export interface CanonicalStatePaths {
  configPath: string;
  summaryPath: string;
  currentRunPath: string;
  briefPath: string;
  eventsPath?: string;
  decisionsPath?: string;
  artifactsPath?: string;
}

export interface LayeredStateBundle {
  config: LocalStateConfig | null;
  summary: RunSummary | null;
  currentRun: CurrentRunState | null;
  brief: string | null;
  historyCounts: LayeredStateHistoryCounts;
  latestPolicyPreview: LatestPolicyPreviewSnapshot;
}

export type CanonicalStateFormat = 'json' | 'toml';

export interface CanonicalWriteOptions<T> {
  format: CanonicalStateFormat;
  stringify?: (value: T) => string;
}

export interface CanonicalRewriteResult {
  rewrittenPath: string;
  backupPath: string | null;
  firstWrite: boolean;
}

export interface EventRecord {
  tsUnix: number;
  category: string;
  action: string;
  result: string;
  summary: string;
  paths: string[];
}

export interface DecisionRecord {
  version: number;
  tsUnix: number;
  summary: string;
  rationale: string;
  paths: string[];
  context: JsonRecord | null;
}

export interface PolicyPreviewDecisionContext extends JsonRecord {
  kind: 'policy_preview';
  scenarios: JsonRecord[];
}

export interface LatestPolicyPreviewSnapshot {
  status: 'missing' | 'present';
  scenarioCount: number;
  scenarioIds: string[];
  tsUnix: number | null;
  summary: string | null;
}

export interface ArtifactRecord {
  version: number;
  tsUnix: number;
  kind: string;
  path: string;
  summary: string;
  paths: string[];
}

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

export function parseRunSnapshotJson(raw: string, path = 'current-run.json'): RunSnapshot {
  return parseRunSnapshot(parseJsonValue(raw, path), path);
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
  return {
    version: upgradedVersion(snapshot.version),
    objective: snapshot.objective,
    phase: 'unknown',
    activeTasks: [],
    blockingQuestions: [],
    verification: createDefaultVerificationStatus(),
    lastCompactionTsUnix: null,
    extra: {},
  };
}

export function currentRunStateToRunSnapshot(state: CurrentRunState): RunSnapshot {
  return {
    version: state.version,
    objective: state.objective,
  };
}

export function parseRunSummaryJson(raw: string, path = 'summary.json'): RunSummary {
  const value = parseJsonValue(raw, path);
  const record = expectRecord(value, 'run summary');

  return {
    version: upgradedVersion(asOptionalInteger(record.version)),
    acceptedDecisions: coerceStringList(
      readAlias(record, ['accepted_decisions', 'acceptedDecisions']),
      'accepted_decisions',
    ),
    completedMilestones: coerceStringList(
      readAlias(record, ['completed_milestones', 'completedMilestones']),
      'completed_milestones',
    ),
    constraints: coerceStringList(record.constraints, 'constraints'),
    lastVerifiedOutputs: coerceStringList(
      readAlias(record, ['last_verified_outputs', 'lastVerifiedOutputs']),
      'last_verified_outputs',
    ),
    filesTouched: coerceStringList(
      readAlias(record, ['files_touched', 'filesTouched']),
      'files_touched',
    ),
    extra: omitKeys(record, [
      'version',
      'accepted_decisions',
      'acceptedDecisions',
      'completed_milestones',
      'completedMilestones',
      'constraints',
      'last_verified_outputs',
      'lastVerifiedOutputs',
      'files_touched',
      'filesTouched',
    ]),
  };
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
  const value = parseJsonValue(raw, path);
  return parseCurrentRunState(value, path);
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

export function parseLocalStateConfigToml(
  raw: string,
  path = 'config.local.toml',
): LocalStateConfig {
  try {
    const parsed = parseTomlDocument(raw);
    return {
      version: upgradedConfigVersion(asOptionalInteger(parsed.version)),
      extra: omitTomlKeys(parsed, ['version']),
    };
  } catch (error) {
    throw new Error(`failed to parse snapshot from ${path}: ${messageOf(error)}`);
  }
}

export function stringifyLocalStateConfig(config: LocalStateConfig): string {
  const normalized: TomlTable = {
    version: upgradedConfigVersion(config.version),
    ...config.extra,
  };
  return stringifyTomlDocument(normalized);
}

export function readLocalStateConfig(path: string): LocalStateConfig {
  return parseLocalStateConfigToml(readText(path), path);
}

export function writeLocalStateConfig(path: string, config: LocalStateConfig): void {
  writeTextFile(path, stringifyLocalStateConfig(config));
}

export function loadLayeredStateBundle(paths: CanonicalStatePaths): LayeredStateBundle {
  return {
    config: readOptionalLayer(paths.configPath, readLocalStateConfig),
    summary: readOptionalLayer(paths.summaryPath, readRunSummary),
    currentRun: readOptionalLayer(paths.currentRunPath, readCurrentRunState),
    brief: readOptionalText(paths.briefPath),
    historyCounts: {
      events: countOptionalJsonlEntries(paths.eventsPath),
      decisions: countOptionalJsonlEntries(paths.decisionsPath),
      artifacts: countOptionalJsonlEntries(paths.artifactsPath),
    },
    latestPolicyPreview: paths.decisionsPath
      ? readLatestPolicyPreviewSnapshot(paths.decisionsPath)
      : missingLatestPolicyPreviewSnapshot(),
  };
}

export function createEventRecord(
  category: string,
  action: string,
  result: string,
  summary: string,
  paths: string[],
): EventRecord {
  return {
    tsUnix: nowUnix(),
    category,
    action,
    result,
    summary,
    paths,
  };
}

export function parseEventRecordJson(raw: string, path = 'events.jsonl'): EventRecord {
  const value = parseJsonValue(raw, path);
  const record = expectRecord(value, 'event record');

  return {
    tsUnix: asInteger(readAlias(record, ['ts_unix', 'tsUnix']), 'ts_unix'),
    category: asString(record.category, 'category'),
    action: asString(record.action, 'action'),
    result: asString(record.result, 'result'),
    summary: asString(record.summary, 'summary'),
    paths: asStringArray(record.paths, 'paths'),
  };
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
  return {
    version: 1,
    tsUnix: nowUnix(),
    summary,
    rationale,
    paths,
    context,
  };
}

export function parseDecisionRecordJson(raw: string, path = 'decisions.jsonl'): DecisionRecord {
  const value = parseJsonValue(raw, path);
  const record = expectRecord(value, 'decision record');

  if (typeof record.rationale === 'string') {
    return {
      version: asOptionalInteger(record.version) ?? 1,
      tsUnix: asOptionalInteger(readAlias(record, ['ts_unix', 'tsUnix'])) ?? nowUnix(),
      summary: asString(record.summary, 'summary'),
      rationale: record.rationale,
      paths: asOptionalStringArray(record.paths) ?? [],
      context: asOptionalJsonRecord(record.context) ?? null,
    };
  }

  const category = asOptionalString(record.category);
  const action = asOptionalString(record.action);
  const result = asOptionalString(record.result);
  if (!category && !action && !result) {
    throw new Error('invalid decision record: expected typed fields or legacy event identity');
  }

  let rationale = action ?? 'legacy decision event';
  if (result) {
    rationale = `${rationale} (${result})`;
  }
  if (category) {
    rationale = `${category}: ${rationale}`;
  }

  return {
    version: 1,
    tsUnix: asOptionalInteger(readAlias(record, ['ts_unix', 'tsUnix'])) ?? nowUnix(),
    summary: asString(record.summary, 'summary'),
    rationale,
    paths: asOptionalStringArray(record.paths) ?? [],
    context: null,
  };
}

export function stringifyDecisionRecord(record: DecisionRecord): string {
  return JSON.stringify(serializeDecisionRecord(record));
}

export function createArtifactRecord(
  kind: string,
  path: string,
  summary: string,
  paths: string[],
): ArtifactRecord {
  return {
    version: 1,
    tsUnix: nowUnix(),
    kind,
    path,
    summary,
    paths,
  };
}

export function parseArtifactRecordJson(raw: string, path = 'artifacts.jsonl'): ArtifactRecord {
  const value = parseJsonValue(raw, path);
  const record = expectRecord(value, 'artifact record');

  if (typeof record.kind === 'string' && typeof record.path === 'string') {
    return {
      version: asOptionalInteger(record.version) ?? 1,
      tsUnix: asOptionalInteger(readAlias(record, ['ts_unix', 'tsUnix'])) ?? nowUnix(),
      kind: record.kind,
      path: record.path,
      summary: asString(record.summary, 'summary'),
      paths: asOptionalStringArray(record.paths) ?? [],
    };
  }

  const category = asOptionalString(record.category);
  const action = asOptionalString(record.action);
  const result = asOptionalString(record.result);
  if (!category && !action && !result) {
    throw new Error('invalid artifact record: expected typed fields or legacy event identity');
  }

  const paths = asOptionalStringArray(record.paths) ?? [];
  const summary = asString(record.summary, 'summary');

  return {
    version: 1,
    tsUnix: asOptionalInteger(readAlias(record, ['ts_unix', 'tsUnix'])) ?? nowUnix(),
    kind: action ?? category ?? 'artifact',
    path: paths[0] ?? summary,
    summary: result ? `${summary} (${result})` : summary,
    paths,
  };
}

export function stringifyArtifactRecord(record: ArtifactRecord): string {
  return JSON.stringify(serializeArtifactRecord(record));
}

export function appendJsonlRecord<T>(
  path: string,
  value: T,
  stringifyValue: (value: T) => string = defaultJsonlStringify,
): void {
  ensureParentDir(path);
  try {
    writeFileSync(path, `${stringifyValue(value)}\n`, {
      encoding: 'utf8',
      flag: 'a',
    });
  } catch (error) {
    throw new Error(`failed to write snapshot to ${path}: ${messageOf(error)}`);
  }
}

export function readJsonlRecords<T>(
  path: string,
  parseLine: (raw: string, path?: string) => T,
): T[] {
  return readJsonlRecordsSlice(path, 0, null, parseLine);
}

export function readJsonlLastRecord<T>(
  path: string,
  parseLine: (raw: string, path?: string) => T,
): T | null {
  const records = readJsonlRecordsSlice(path, 0, null, parseLine);
  return records.at(-1) ?? null;
}

export function countJsonlEntries(path: string): number {
  if (!existsSync(path)) {
    return 0;
  }

  return readText(path)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;
}

export function readJsonlRecordsSlice<T>(
  path: string,
  offset: number,
  limit: number | null,
  parseLine: (raw: string, path?: string) => T,
): T[] {
  if (!existsSync(path)) {
    return [];
  }

  const raw = readText(path);
  const records: T[] = [];
  let seen = 0;

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (line.trim().length === 0) {
      continue;
    }
    if (seen < offset) {
      seen += 1;
      continue;
    }
    if (limit !== null && records.length >= limit) {
      break;
    }
    records.push(parseLine(line, `${path}:${index + 1}`));
    seen += 1;
  }

  return records;
}

export function readLatestPolicyPreviewDecision(path: string): DecisionRecord | null {
  if (!existsSync(path)) {
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
    return missingLatestPolicyPreviewSnapshot();
  }

  const latestPolicyContext = policyPreviewDecisionContext(latestPolicyDecision);

  if (!latestPolicyContext) {
    return missingLatestPolicyPreviewSnapshot();
  }

  const scenarioIds = latestPolicyContext.scenarios.flatMap((scenario) =>
    typeof scenario.id === 'string' ? [scenario.id] : [],
  );

  return {
    status: 'present',
    scenarioCount: latestPolicyContext.scenarios.length,
    scenarioIds,
    tsUnix: latestPolicyDecision.tsUnix,
    summary: latestPolicyDecision.summary,
  };
}

function missingLatestPolicyPreviewSnapshot(): LatestPolicyPreviewSnapshot {
  return {
    status: 'missing',
    scenarioCount: 0,
    scenarioIds: [],
    tsUnix: null,
    summary: null,
  };
}

export function createPolicyPreviewDecisionContext(
  scenarios: JsonRecord[],
): PolicyPreviewDecisionContext {
  return {
    kind: 'policy_preview',
    scenarios,
  };
}

export function policyPreviewDecisionContext(
  record: DecisionRecord,
): PolicyPreviewDecisionContext | null {
  const context = record.context;
  if (!context || context.kind !== 'policy_preview' || !Array.isArray(context.scenarios)) {
    return null;
  }

  const scenarios: JsonRecord[] = [];
  for (const scenario of context.scenarios) {
    const parsed = asOptionalJsonRecord(scenario);
    if (!parsed) {
      return null;
    }
    scenarios.push(parsed);
  }

  return createPolicyPreviewDecisionContext(scenarios);
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
  ensureParentDir(path);

  const backupPath = backupExistingCanonical(path);
  const tmpPath = temporaryReplacementPath(path);

  try {
    writeFileSync(tmpPath, encoded, { encoding: 'utf8', flag: 'wx' });
    renameSync(tmpPath, path);
  } catch (error) {
    try {
      rmSync(tmpPath, { force: true });
    } catch {
      // Ignore cleanup failures on an already failing write path.
    }
    throw new Error(`failed to write snapshot to ${path}: ${messageOf(error)}`);
  }

  return {
    rewrittenPath: path,
    backupPath,
    firstWrite: backupPath === null,
  };
}

export function listCanonicalBackupSiblings(canonicalPath: string): string[] {
  const parent = dirname(canonicalPath);
  if (!existsSync(parent)) {
    return [];
  }

  const canonicalName = canonicalPath.split(/[/\\]/).pop();
  if (!canonicalName) {
    return [];
  }
  const backupPrefix = `${canonicalName}.bak.`;

  return readdirSync(parent)
    .map((name) => {
      const metadata = parseBackupSiblingMetadata(name, backupPrefix);
      if (!metadata) {
        return null;
      }
      const path = join(parent, name);
      if (!statSync(path).isFile()) {
        return null;
      }
      return { ...metadata, path };
    })
    .filter((entry): entry is { tsUnix: number; attempt: number; path: string } => entry !== null)
    .sort(
      (left, right) =>
        right.tsUnix - left.tsUnix ||
        right.attempt - left.attempt ||
        left.path.localeCompare(right.path),
    )
    .map((entry) => entry.path);
}

function parseRunSnapshot(value: unknown, _path: string): RunSnapshot {
  const record = expectRecord(value, 'run snapshot');
  const objective = firstString(
    asOptionalString(record.objective),
    nestedObjective(record.current_run),
    nestedObjective(record.current),
    nestedObjective(record.state),
    nestedObjective(record.snapshot),
  );

  if (!objective) {
    throw new Error('missing objective');
  }

  return {
    version: asOptionalInteger(record.version) ?? 1,
    objective,
  };
}

function parseCurrentRunState(value: unknown, _path: string): CurrentRunState {
  const record = expectRecord(value, 'current run state');
  const objective = firstString(
    asOptionalString(record.objective),
    nestedObjective(record.current_run),
    nestedObjective(record.current),
    nestedObjective(record.state),
    nestedObjective(record.snapshot),
  );

  if (!objective) {
    throw new Error('missing objective');
  }

  return {
    version: upgradedVersion(asOptionalInteger(record.version)),
    objective,
    phase: asOptionalString(readAlias(record, ['phase'])) ?? 'unknown',
    activeTasks: asOptionalStringArray(readAlias(record, ['active_tasks', 'activeTasks'])) ?? [],
    blockingQuestions:
      asOptionalStringArray(readAlias(record, ['blocking_questions', 'blockingQuestions'])) ?? [],
    verification: parseVerificationStatus(record.verification),
    lastCompactionTsUnix:
      asOptionalInteger(
        readAlias(record, ['last_compaction_ts_unix', 'lastCompactionTsUnix']),
      ) ?? null,
    extra: omitKeys(record, [
      'version',
      'objective',
      'current_run',
      'current',
      'state',
      'snapshot',
      'phase',
      'active_tasks',
      'activeTasks',
      'blocking_questions',
      'blockingQuestions',
      'verification',
      'last_compaction_ts_unix',
      'lastCompactionTsUnix',
    ]),
  };
}

function parseVerificationStatus(value: unknown): VerificationStatus {
  if (value === undefined) {
    return createDefaultVerificationStatus();
  }
  const record = expectRecord(value, 'verification status');
  return {
    status: asOptionalString(record.status) ?? 'unknown',
    summary: record.summary === undefined ? null : asNullableString(record.summary, 'summary'),
  };
}

function createDefaultVerificationStatus(): VerificationStatus {
  return {
    status: 'unknown',
    summary: null,
  };
}

function parseJsonValue(raw: string, path: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`failed to parse snapshot from ${path}: ${messageOf(error)}`);
  }
}

function serializeRunSnapshot(snapshot: RunSnapshot): JsonRecord {
  return {
    version: snapshot.version,
    objective: snapshot.objective,
  };
}

function serializeRunSummary(summary: RunSummary): JsonRecord {
  return {
    version: summary.version,
    accepted_decisions: summary.acceptedDecisions,
    completed_milestones: summary.completedMilestones,
    constraints: summary.constraints,
    last_verified_outputs: summary.lastVerifiedOutputs,
    files_touched: summary.filesTouched,
    ...summary.extra,
  };
}

function serializeCurrentRunState(state: CurrentRunState): JsonRecord {
  return {
    version: state.version,
    objective: state.objective,
    phase: state.phase,
    active_tasks: state.activeTasks,
    blocking_questions: state.blockingQuestions,
    verification: {
      status: state.verification.status,
      summary: state.verification.summary,
    },
    last_compaction_ts_unix: state.lastCompactionTsUnix,
    ...state.extra,
  };
}

function serializeEventRecord(record: EventRecord): JsonRecord {
  return {
    ts_unix: record.tsUnix,
    category: record.category,
    action: record.action,
    result: record.result,
    summary: record.summary,
    paths: record.paths,
  };
}

function serializeDecisionRecord(record: DecisionRecord): JsonRecord {
  const serialized: JsonRecord = {
    version: record.version,
    ts_unix: record.tsUnix,
    summary: record.summary,
    rationale: record.rationale,
    paths: record.paths,
  };
  if (record.context) {
    serialized.context = record.context;
  }
  return serialized;
}

function serializeArtifactRecord(record: ArtifactRecord): JsonRecord {
  return {
    version: record.version,
    ts_unix: record.tsUnix,
    kind: record.kind,
    path: record.path,
    summary: record.summary,
    paths: record.paths,
  };
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
  if (isRunSummary(value)) {
    return serializeRunSummary(value);
  }
  if (isCurrentRunState(value)) {
    return serializeCurrentRunState(value);
  }
  if (isRunSnapshot(value)) {
    return serializeRunSnapshot(value);
  }
  if (isDecisionRecord(value)) {
    return serializeDecisionRecord(value);
  }
  if (isArtifactRecord(value)) {
    return serializeArtifactRecord(value);
  }
  if (isEventRecord(value)) {
    return serializeEventRecord(value);
  }
  return value;
}

function isRunSnapshot(value: unknown): value is RunSnapshot {
  return isPlainObject(value) && typeof value.objective === 'string' && !('phase' in value);
}

function isRunSummary(value: unknown): value is RunSummary {
  return (
    isPlainObject(value) &&
    Array.isArray(value.acceptedDecisions) &&
    Array.isArray(value.completedMilestones) &&
    Array.isArray(value.constraints) &&
    Array.isArray(value.lastVerifiedOutputs) &&
    Array.isArray(value.filesTouched)
  );
}

function isLocalStateConfig(value: unknown): value is LocalStateConfig {
  return isPlainObject(value) && typeof value.version === 'number' && isPlainObject(value.extra);
}

function isCurrentRunState(value: unknown): value is CurrentRunState {
  return (
    isPlainObject(value) &&
    typeof value.objective === 'string' &&
    typeof value.phase === 'string' &&
    Array.isArray(value.activeTasks) &&
    Array.isArray(value.blockingQuestions) &&
    isPlainObject(value.verification)
  );
}

function isEventRecord(value: unknown): value is EventRecord {
  return (
    isPlainObject(value) &&
    typeof value.category === 'string' &&
    typeof value.action === 'string' &&
    typeof value.result === 'string'
  );
}

function isDecisionRecord(value: unknown): value is DecisionRecord {
  return isPlainObject(value) && typeof value.summary === 'string' && typeof value.rationale === 'string';
}

function isArtifactRecord(value: unknown): value is ArtifactRecord {
  return (
    isPlainObject(value) &&
    typeof value.kind === 'string' &&
    typeof value.path === 'string' &&
    typeof value.summary === 'string'
  );
}

function readOptional<T>(path: string, reader: (path: string) => T): T | null {
  if (!existsSync(path)) {
    return null;
  }
  return reader(path);
}

function readOptionalLayer<T>(path: string, reader: (path: string) => T): T | null {
  try {
    return readOptional(path, reader);
  } catch {
    return null;
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

function readOptionalText(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }
  return readText(path);
}

function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`failed to read snapshot from ${path}: ${messageOf(error)}`);
  }
}

function writeJsonFile(path: string, body: string): void {
  writeTextFile(path, body);
}

function writeTextFile(path: string, body: string): void {
  ensureParentDir(path);
  try {
    writeFileSync(path, body, 'utf8');
  } catch (error) {
    throw new Error(`failed to write snapshot to ${path}: ${messageOf(error)}`);
  }
}

function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function backupExistingCanonical(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }

  const ts = nowUnix();
  let attempt = 0;
  let candidate = backupCandidatePath(path, ts, attempt);
  while (existsSync(candidate)) {
    attempt += 1;
    candidate = backupCandidatePath(path, ts, attempt);
  }

  try {
    copyFileSync(path, candidate);
  } catch (error) {
    throw new Error(`failed to write snapshot to ${candidate}: ${messageOf(error)}`);
  }
  return candidate;
}

function backupCandidatePath(path: string, ts: number, attempt: number): string {
  if (attempt === 0) {
    return `${path}.bak.${ts}`;
  }
  return `${path}.bak.${ts}.${attempt}`;
}

function temporaryReplacementPath(path: string): string {
  return `${path}.tmp.${process.hrtime.bigint()}`;
}

function parseBackupSiblingMetadata(
  fileName: string,
  backupPrefix: string,
): { tsUnix: number; attempt: number } | null {
  if (!fileName.startsWith(backupPrefix)) {
    return null;
  }
  const suffix = fileName.slice(backupPrefix.length);
  const segments = suffix.split('.');
  const tsUnix = Number.parseInt(segments[0] ?? '', 10);
  if (!Number.isInteger(tsUnix)) {
    return null;
  }
  if (segments.length === 1) {
    return { tsUnix, attempt: 0 };
  }
  if (segments.length === 2) {
    const attempt = Number.parseInt(segments[1] ?? '', 10);
    if (Number.isInteger(attempt)) {
      return { tsUnix, attempt };
    }
  }
  return null;
}

function parseTomlDocument(raw: string): TomlTable {
  const result: TomlTable = {};
  let currentPath: string[] = [];

  for (const originalLine of raw.split(/\r?\n/)) {
    const line = originalLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('[') && line.endsWith(']')) {
      currentPath = line
        .slice(1, -1)
        .split('.')
        .map((segment) => parseTomlKey(segment.trim()));
      ensureTomlTable(result, currentPath);
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`invalid TOML line: ${originalLine}`);
    }
    const key = parseTomlKey(line.slice(0, separatorIndex).trim());
    const rawValue = line.slice(separatorIndex + 1).trim();
    const table = ensureTomlTable(result, currentPath);
    table[key] = parseTomlValue(rawValue);
  }

  return result;
}

function stringifyTomlDocument(table: TomlTable): string {
  const topLines: string[] = [];
  const tableSections: string[] = [];

  for (const key of Object.keys(table).sort()) {
    const value = table[key];
    if (isTomlTable(value)) {
      appendTomlTable(tableSections, [key], value);
      continue;
    }
    topLines.push(`${formatTomlKey(key)} = ${stringifyTomlValue(value)}`);
  }

  const blocks = [topLines.join('\n'), ...tableSections.filter((section) => section.length > 0)].filter(
    (section) => section.length > 0,
  );
  return `${blocks.join('\n\n')}\n`;
}

function appendTomlTable(target: string[], path: string[], table: TomlTable): void {
  const localLines: string[] = [];
  const childTables: Array<{ path: string[]; table: TomlTable }> = [];

  for (const key of Object.keys(table).sort()) {
    const value = table[key];
    if (isTomlTable(value)) {
      childTables.push({ path: [...path, key], table: value });
      continue;
    }
    localLines.push(`${formatTomlKey(key)} = ${stringifyTomlValue(value)}`);
  }

  target.push([`[${path.map(formatTomlBareKey).join('.')}]`, ...localLines].join('\n'));
  for (const child of childTables) {
    appendTomlTable(target, child.path, child.table);
  }
}

function ensureTomlTable(root: TomlTable, path: string[]): TomlTable {
  let cursor = root;
  for (const segment of path) {
    const current = cursor[segment];
    if (current === undefined) {
      const next: TomlTable = {};
      cursor[segment] = next;
      cursor = next;
      continue;
    }
    if (!isTomlTable(current)) {
      throw new Error(`expected TOML table at ${path.join('.')}`);
    }
    cursor = current;
  }
  return cursor;
}

function parseTomlKey(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value) as string;
  }
  return value;
}

function parseTomlValue(rawValue: string): TomlValue {
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return JSON.parse(rawValue) as string;
  }
  if (rawValue === 'true') {
    return true;
  }
  if (rawValue === 'false') {
    return false;
  }
  if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    const inner = rawValue.slice(1, -1).trim();
    if (inner.length === 0) {
      return [];
    }
    return inner.split(',').map((part) => {
      const value = parseTomlValue(part.trim());
      if (typeof value === 'object') {
        throw new Error('only primitive TOML arrays are supported');
      }
      return value;
    });
  }
  const numberValue = Number(rawValue);
  if (!Number.isNaN(numberValue)) {
    return numberValue;
  }
  throw new Error(`unsupported TOML value: ${rawValue}`);
}

function stringifyTomlValue(value: TomlValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyTomlPrimitive(item)).join(', ')}]`;
  }
  if (isTomlTable(value)) {
    throw new Error('nested TOML tables must be rendered as table sections');
  }
  return stringifyTomlPrimitive(value);
}

function stringifyTomlPrimitive(value: TomlPrimitive): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return String(value);
}

function renderBriefBullets(items: string[]): string[] {
  return items.length === 0 ? ['- none'] : items.map((item) => `- ${item}`);
}

function formatTomlKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function formatTomlBareKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function isTomlTable(value: TomlValue | undefined): value is TomlTable {
  return isPlainObject(value);
}

function omitKeys(record: Record<string, unknown>, keys: string[]): JsonRecord {
  const excluded = new Set(keys);
  const result: JsonRecord = {};
  for (const [key, value] of Object.entries(record)) {
    if (!excluded.has(key)) {
      result[key] = value as JsonValue;
    }
  }
  return result;
}

function omitTomlKeys(record: TomlTable, keys: string[]): TomlTable {
  const excluded = new Set(keys);
  const result: TomlTable = {};
  for (const [key, value] of Object.entries(record)) {
    if (!excluded.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

function readAlias(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

function nestedObjective(value: unknown): string | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  return asOptionalString(value.objective);
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`invalid ${label}: expected object`);
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (isPlainObject(value)) {
    return Object.values(value).every((item) => isJsonValue(item));
  }

  return false;
}

function firstString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string');
}

function asString(value: unknown, key: string): string {
  if (typeof value !== 'string') {
    throw new Error(`expected string for ${key}`);
  }
  return value;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asOptionalJsonRecord(value: unknown): JsonRecord | undefined {
  if (!isPlainObject(value) || !isJsonValue(value)) {
    return undefined;
  }

  return value as JsonRecord;
}

function asNullableString(value: unknown, key: string): string | null {
  if (value === null) {
    return null;
  }
  return asString(value, key);
}

function asInteger(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`expected integer for ${key}`);
  }
  return value;
}

function asOptionalInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function asStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`expected string array for ${key}`);
  }
  return [...value];
}

function asOptionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return asStringArray(value, 'paths');
}

function coerceStringList(value: unknown, key: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`expected array for ${key}`);
  }
  return value.map((item) => coerceStringValue(item, key));
}

function coerceStringValue(value: unknown, key: string): string {
  if (typeof value === 'string') {
    return value;
  }
  if (isPlainObject(value)) {
    for (const candidateKey of ['summary', 'text', 'value', 'name', 'label', 'path']) {
      const candidate = value[candidateKey];
      if (typeof candidate === 'string') {
        return candidate;
      }
    }
    const paths = value.paths;
    if (Array.isArray(paths)) {
      const firstPath = paths.find((item) => typeof item === 'string');
      if (typeof firstPath === 'string') {
        return firstPath;
      }
    }
  }
  throw new Error(`expected string-like value for ${key}`);
}

function upgradedVersion(version: number | undefined): number {
  return version !== undefined && version >= 2 ? version : 2;
}

function upgradedConfigVersion(version: number | undefined): number {
  return version !== undefined && version >= 1 ? version : 1;
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
