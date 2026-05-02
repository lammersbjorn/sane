import {
  asOptionalInteger,
  coerceStringList,
  expectRecord,
  omitKeys,
  readAlias,
  upgradedVersion,
} from './coercion.js';
import type { JsonRecord, RunSummary } from './types.js';

export function parseRunSummaryValue(value: unknown): RunSummary {
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

export function serializeRunSummary(summary: RunSummary): JsonRecord {
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
