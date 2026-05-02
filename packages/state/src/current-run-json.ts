import {
  asNullableString,
  asOptionalInteger,
  asOptionalString,
  asOptionalStringArray,
  expectRecord,
  firstString,
  nestedObjective,
  omitKeys,
  readAlias,
  upgradedVersion,
} from './coercion.js';
import type { CurrentRunState, JsonRecord, RunSnapshot, VerificationStatus } from './types.js';

export function parseRunSnapshotValue(value: unknown): RunSnapshot {
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

  return { version: asOptionalInteger(record.version) ?? 1, objective };
}

export function parseCurrentRunStateValue(value: unknown): CurrentRunState {
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
      asOptionalInteger(readAlias(record, ['last_compaction_ts_unix', 'lastCompactionTsUnix'])) ?? null,
    extra: omitKeys(record, [
      'version', 'objective', 'current_run', 'current', 'state', 'snapshot', 'phase',
      'active_tasks', 'activeTasks', 'blocking_questions', 'blockingQuestions', 'verification',
      'last_compaction_ts_unix', 'lastCompactionTsUnix',
    ]),
  };
}

export function createDefaultVerificationStatus(): VerificationStatus {
  return { status: 'unknown', summary: null };
}

export function serializeRunSnapshot(snapshot: RunSnapshot): JsonRecord {
  return { version: snapshot.version, objective: snapshot.objective };
}

export function serializeCurrentRunState(state: CurrentRunState): JsonRecord {
  return {
    version: state.version,
    objective: state.objective,
    phase: state.phase,
    active_tasks: state.activeTasks,
    blocking_questions: state.blockingQuestions,
    verification: { status: state.verification.status, summary: state.verification.summary },
    last_compaction_ts_unix: state.lastCompactionTsUnix,
    ...state.extra,
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
