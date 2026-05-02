import {
  asInteger,
  asOptionalInteger,
  asOptionalJsonRecord,
  asOptionalString,
  asOptionalStringArray,
  asString,
  asStringArray,
  expectRecord,
  readAlias,
} from './coercion.js';
import { nowUnix } from './io.js';
import type { ArtifactRecord, DecisionRecord, EventRecord, JsonRecord } from './types.js';

export function parseEventRecordValue(value: unknown): EventRecord {
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

export function serializeEventRecord(record: EventRecord): JsonRecord {
  return {
    ts_unix: record.tsUnix,
    category: record.category,
    action: record.action,
    result: record.result,
    summary: record.summary,
    paths: record.paths,
  };
}

export function parseDecisionRecordValue(value: unknown): DecisionRecord {
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

export function serializeDecisionRecord(record: DecisionRecord): JsonRecord {
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

export function parseArtifactRecordValue(value: unknown): ArtifactRecord {
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

export function serializeArtifactRecord(record: ArtifactRecord): JsonRecord {
  return {
    version: record.version,
    ts_unix: record.tsUnix,
    kind: record.kind,
    path: record.path,
    summary: record.summary,
    paths: record.paths,
  };
}
