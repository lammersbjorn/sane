import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  appendJsonlRecord,
  createArtifactRecord,
  createDecisionRecord,
  createEventRecord,
  createMissingLatestPolicyPreviewSnapshot,
  createPolicyPreviewDecisionContext,
  parseArtifactRecordJson,
  parseDecisionRecordJson,
  parseEventRecordJson,
  policyPreviewDecisionContext,
  readJsonlRecords,
  readJsonlRecordsSlice,
  readLatestPolicyPreviewDecision,
  readLatestPolicyPreviewSnapshot,
  stringifyDecisionRecord,
  type ArtifactRecord,
  type DecisionRecord,
} from '../src/index.js';
import { makeTempDir } from './helpers.js';

describe('JSONL record helpers', () => {
  it('appends and reads event records from jsonl in order', () => {
    const dir = makeTempDir();
    const path = join(dir, 'events.jsonl');

    appendJsonlRecord(path, createEventRecord('operation', 'first', 'ok', 'first', []));
    appendJsonlRecord(path, createEventRecord('operation', 'second', 'ok', 'second', []));
    appendJsonlRecord(path, createEventRecord('operation', 'third', 'ok', 'third', []));

    const decoded = readJsonlRecords(path, parseEventRecordJson);
    const windowed = readJsonlRecordsSlice(path, 1, 2, parseEventRecordJson);

    expect(decoded.map((record) => record.action)).toEqual(['first', 'second', 'third']);
    expect(windowed.map((record) => record.action)).toEqual(['second', 'third']);
  });

  it('parses typed and legacy decision records', () => {
    const typed: DecisionRecord = createDecisionRecord(
      'runtime installed',
      'keep repair paths reversible',
      ['.sane/config.local.toml'],
      {
        kind: 'policy_preview',
        scenarios: 5,
      },
    );
    const decodedTyped = parseDecisionRecordJson(JSON.stringify(typed));
    const decodedLegacy = parseDecisionRecordJson(
      JSON.stringify({
        ts_unix: 42,
        category: 'decision',
        action: 'install_runtime',
        result: 'ok',
        summary: 'runtime installed',
        paths: ['.sane/config.local.toml'],
      }),
    );

    expect(decodedTyped.summary).toBe('runtime installed');
    expect(decodedTyped.rationale).toBe('keep repair paths reversible');
    expect(decodedTyped.context).toEqual({
      kind: 'policy_preview',
      scenarios: 5,
    });
    expect(decodedLegacy.tsUnix).toBe(42);
    expect(decodedLegacy.rationale).toBe('decision: install_runtime (ok)');
    expect(decodedLegacy.context).toBeNull();
  });

  it('rejects ambiguous decision records', () => {
    expect(() =>
      parseDecisionRecordJson(
        JSON.stringify({
          summary: 'runtime installed',
          paths: ['.sane/config.local.toml'],
        }),
      ),
    ).toThrow(/expected typed fields or legacy event identity/);
  });

  it('reads the latest policy preview decision from decision history', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    appendJsonlRecord(
      path,
      createDecisionRecord('runtime installed', 'keep repair paths reversible', ['.sane/config.local.toml']),
      stringifyDecisionRecord,
    );
    appendJsonlRecord(
      path,
      createDecisionRecord(
        'policy preview: rendered adaptive obligation scenarios',
        'simple-question: direct_answer | coordinator=gpt-5.4/high',
        [],
        createPolicyPreviewDecisionContext([{ id: 'simple-question' }]),
      ),
      stringifyDecisionRecord,
    );

    const decision = readLatestPolicyPreviewDecision(path);

    expect(decision?.summary).toBe('policy preview: rendered adaptive obligation scenarios');
    expect(decision ? policyPreviewDecisionContext(decision) : null).toEqual(
      createPolicyPreviewDecisionContext([{ id: 'simple-question' }]),
    );
  });

  it('preserves scenario input snapshots in typed policy preview contexts', () => {
    const decision = createDecisionRecord(
      'policy preview: rendered adaptive obligation scenarios',
      'simple-question: direct_answer | coordinator=gpt-5.4/high',
      [],
      createPolicyPreviewDecisionContext([
        {
          id: 'simple-question',
          input: {
            intent: 'question',
            taskShape: 'trivial',
            risk: 'low',
            ambiguity: 'low',
            parallelism: 'none',
            contextPressure: 'low',
            runState: 'exploring',
          },
          roles: {
            coordinator: true,
          },
          orchestration: {
            subagents: 'none',
            subagentReadiness: 'not_needed',
            reviewPosture: 'inline_only',
            verifierTiming: 'inline',
          },
        },
      ]),
    );

    expect(policyPreviewDecisionContext(decision)).toEqual(
      createPolicyPreviewDecisionContext([
        {
          id: 'simple-question',
          input: {
            intent: 'question',
            taskShape: 'trivial',
            risk: 'low',
            ambiguity: 'low',
            parallelism: 'none',
            contextPressure: 'low',
            runState: 'exploring',
          },
          roles: {
            coordinator: true,
          },
          orchestration: {
            subagents: 'none',
            subagentReadiness: 'not_needed',
            reviewPosture: 'inline_only',
            verifierTiming: 'inline',
          },
        },
      ]),
    );
  });

  it('ignores malformed policy preview context when scanning latest decision', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    appendJsonlRecord(
      path,
      createDecisionRecord(
        'policy preview: rendered adaptive obligation scenarios',
        'simple-question: direct_answer | coordinator=gpt-5.4/high',
        [],
        createPolicyPreviewDecisionContext([{ id: 'simple-question' }]),
      ),
      stringifyDecisionRecord,
    );
    appendJsonlRecord(
      path,
      createDecisionRecord(
        'policy preview: malformed',
        'bad context',
        [],
        {
          kind: 'policy_preview',
          scenarios: [42 as never],
        },
      ),
      stringifyDecisionRecord,
    );

    const decision = readLatestPolicyPreviewDecision(path);

    expect(decision?.summary).toBe('policy preview: rendered adaptive obligation scenarios');
  });

  it('ignores policy preview scenarios missing ids when scanning latest decision', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    appendJsonlRecord(
      path,
      createDecisionRecord(
        'policy preview: rendered adaptive obligation scenarios',
        'simple-question: direct_answer | coordinator=gpt-5.4/high',
        [],
        createPolicyPreviewDecisionContext([{ id: 'simple-question' }]),
      ),
      stringifyDecisionRecord,
    );
    appendJsonlRecord(
      path,
      createDecisionRecord('policy preview: malformed', 'bad context', [], {
        kind: 'policy_preview',
        scenarios: [{ summary: 'missing id' } as never],
      }),
      stringifyDecisionRecord,
    );

    expect(() => readLatestPolicyPreviewDecision(path)).not.toThrow();
    expect(() => readLatestPolicyPreviewSnapshot(path)).not.toThrow();
    expect(readLatestPolicyPreviewDecision(path)?.summary).toBe(
      'policy preview: rendered adaptive obligation scenarios',
    );
    expect(readLatestPolicyPreviewSnapshot(path)).toEqual({
      status: 'present',
      scenarioCount: 1,
      scenarioIds: ['simple-question'],
      scenarios: [
        {
          id: 'simple-question',
          summary: null,
          input: null,
          roles: null,
          orchestration: null,
          continuation: null,
          obligationCount: 0,
          traceCount: 0,
          trace: [],
        },
      ],
      tsUnix: expect.any(Number),
      summary: 'policy preview: rendered adaptive obligation scenarios',
    });
  });

  it('reads latest policy preview snapshot through typed helper', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    const decision = createDecisionRecord(
      'policy preview: rendered adaptive obligation scenarios',
      'simple-question: direct_answer | coordinator=gpt-5.4/high',
      [],
      createPolicyPreviewDecisionContext([
        {
          id: 'simple-question',
          input: {
            intent: 'question',
            taskShape: 'trivial',
            risk: 'low',
            ambiguity: 'low',
            parallelism: 'none',
            contextPressure: 'low',
            runState: 'exploring',
          },
          roles: {
            coordinator: true,
          },
          orchestration: {
            subagents: 'none',
            subagentReadiness: 'not_needed',
            reviewPosture: 'inline_only',
            verifierTiming: 'inline',
          },
          trace: [
            {
              obligation: 'keep_direct_answers_light',
              rule: 'keep_direct_answers_light',
            },
          ],
        },
        { id: 'multi-file-feature' },
      ]),
    );
    decision.tsUnix = 1_700_000_001;

    appendJsonlRecord(path, decision, stringifyDecisionRecord);

    expect(readLatestPolicyPreviewSnapshot(path)).toEqual({
      status: 'present',
      scenarioCount: 2,
      scenarioIds: ['simple-question', 'multi-file-feature'],
      scenarios: [
        {
          id: 'simple-question',
          summary: null,
          input: {
            intent: 'question',
            taskShape: 'trivial',
            risk: 'low',
            ambiguity: 'low',
            parallelism: 'none',
            contextPressure: 'low',
            runState: 'exploring',
          },
          roles: {
            coordinator: true,
            sidecar: false,
            verifier: false,
          },
          orchestration: {
            subagents: 'none',
            subagentReadiness: 'not_needed',
            reviewPosture: 'inline_only',
            verifierTiming: 'inline',
          },
          continuation: null,
          obligationCount: 0,
          traceCount: 1,
          trace: [
            {
              obligation: 'keep_direct_answers_light',
              rule: 'keep_direct_answers_light',
            },
          ],
        },
        {
          id: 'multi-file-feature',
          summary: null,
          input: null,
          roles: null,
          orchestration: null,
          continuation: null,
          obligationCount: 0,
          traceCount: 0,
          trace: [],
        },
      ],
      tsUnix: 1_700_000_001,
      summary: 'policy preview: rendered adaptive obligation scenarios',
    });
  });

  it('keeps latest matching policy preview when newer non-policy decisions exist', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    const previewDecision = createDecisionRecord(
      'policy preview: rendered adaptive obligation scenarios',
      'simple-question: direct_answer | coordinator=gpt-5.4/high',
      [],
      createPolicyPreviewDecisionContext([{ id: 'simple-question' }]),
    );
    previewDecision.tsUnix = 1_700_000_006;
    appendJsonlRecord(path, previewDecision, stringifyDecisionRecord);

    const installDecision = createDecisionRecord(
      'runtime installed',
      'keep runtime bootstrap explicit',
      ['.sane/config.local.toml'],
    );
    installDecision.tsUnix = 1_700_000_007;
    appendJsonlRecord(path, installDecision, stringifyDecisionRecord);

    expect(readLatestPolicyPreviewDecision(path)?.summary).toBe(
      'policy preview: rendered adaptive obligation scenarios',
    );
    expect(readLatestPolicyPreviewSnapshot(path)).toEqual({
      status: 'present',
      scenarioCount: 1,
      scenarioIds: ['simple-question'],
      scenarios: [
        {
          id: 'simple-question',
          summary: null,
          input: null,
          roles: null,
          orchestration: null,
          continuation: null,
          obligationCount: 0,
          traceCount: 0,
          trace: [],
        },
      ],
      tsUnix: 1_700_000_006,
      summary: 'policy preview: rendered adaptive obligation scenarios',
    });
  });

  it('returns missing typed snapshot when latest policy context is malformed', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    appendJsonlRecord(
      path,
      createDecisionRecord(
        'policy preview: malformed',
        'bad context',
        [],
        {
          kind: 'policy_preview',
          scenarios: [42 as never],
        },
      ),
      stringifyDecisionRecord,
    );

    expect(readLatestPolicyPreviewSnapshot(path)).toEqual({
      status: 'missing',
      scenarioCount: 0,
      scenarioIds: [],
      scenarios: [],
      tsUnix: null,
      summary: null,
    });
  });

  it('returns last valid typed snapshot when trailing line is malformed JSON', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    appendJsonlRecord(
      path,
      createDecisionRecord(
        'policy preview: rendered adaptive obligation scenarios',
        'simple-question: direct_answer | coordinator=gpt-5.4/high',
        [],
        createPolicyPreviewDecisionContext([{ id: 'simple-question' }]),
      ),
      stringifyDecisionRecord,
    );
    writeFileSync(path, '{"version":1,"summary":"bad"', { encoding: 'utf8', flag: 'a' });

    expect(() => readLatestPolicyPreviewSnapshot(path)).not.toThrow();
    expect(readLatestPolicyPreviewSnapshot(path)).toEqual({
      status: 'present',
      scenarioCount: 1,
      scenarioIds: ['simple-question'],
      scenarios: [
        {
          id: 'simple-question',
          summary: null,
          input: null,
          roles: null,
          orchestration: null,
          continuation: null,
          obligationCount: 0,
          traceCount: 0,
          trace: [],
        },
      ],
      tsUnix: expect.any(Number),
      summary: 'policy preview: rendered adaptive obligation scenarios',
    });
  });

  it('returns missing typed snapshot when only malformed JSON exists', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    writeFileSync(path, '{"version":1,"summary":"bad"', 'utf8');

    expect(() => readLatestPolicyPreviewSnapshot(path)).not.toThrow();
    expect(readLatestPolicyPreviewSnapshot(path)).toEqual({
      status: 'missing',
      scenarioCount: 0,
      scenarioIds: [],
      scenarios: [],
      tsUnix: null,
      summary: null,
    });
  });

  it('exposes one canonical missing latest-policy-preview snapshot factory', () => {
    expect(createMissingLatestPolicyPreviewSnapshot()).toEqual({
      status: 'missing',
      scenarioCount: 0,
      scenarioIds: [],
      scenarios: [],
      tsUnix: null,
      summary: null,
    });
  });

  it('normalizes mixed-type policy preview scenario fields instead of dropping latest snapshot', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    appendJsonlRecord(
      path,
      createDecisionRecord('policy preview: malformed-ish', 'coerce fields', [], {
        kind: 'policy_preview',
        scenarios: [
          {
            id: 'simple-question',
            summary: 123,
            obligations: ['keep_direct_answers_light', 99, ''],
            roles: { coordinator: true, sidecar: 'yes', verifier: null },
            orchestration: { subagents: 'none', reviewPosture: 7 },
            continuation: { strategy: false, stopCondition: 'done' },
            trace: [
              { obligation: 'keep_direct_answers_light', rule: 'keep_direct_answers_light' },
              { obligation: 'bad', rule: 5 },
              { obligation: '', rule: 'empty_obligation' },
            ],
          },
        ],
      } as never),
      stringifyDecisionRecord,
    );

    expect(readLatestPolicyPreviewSnapshot(path)).toEqual({
      status: 'present',
      scenarioCount: 1,
      scenarioIds: ['simple-question'],
      scenarios: [
        {
          id: 'simple-question',
          summary: null,
          input: null,
          roles: {
            coordinator: true,
            sidecar: false,
            verifier: false,
          },
          orchestration: {
            subagents: 'none',
            subagentReadiness: null,
            reviewPosture: null,
            verifierTiming: null,
          },
          continuation: {
            strategy: null,
            stopCondition: 'done',
          },
          obligationCount: 1,
          traceCount: 1,
          trace: [
            {
              obligation: 'keep_direct_answers_light',
              rule: 'keep_direct_answers_light',
            },
          ],
        },
      ],
      tsUnix: expect.any(Number),
      summary: 'policy preview: malformed-ish',
    });
  });

  it('caps latest policy preview scenarios and trace entries to bounded inspect size', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');
    const scenarios = Array.from({ length: 80 }, (_, index) => ({
      id: `s-${index}`,
      trace: Array.from({ length: 40 }, (_, traceIndex) => ({
        obligation: `o-${traceIndex}`,
        rule: `r-${traceIndex}`,
      })),
    }));

    appendJsonlRecord(
      path,
      createDecisionRecord(
        'policy preview: rendered adaptive obligation scenarios',
        'bounded',
        [],
        createPolicyPreviewDecisionContext(scenarios),
      ),
      stringifyDecisionRecord,
    );

    const snapshot = readLatestPolicyPreviewSnapshot(path);

    expect(snapshot.status).toBe('present');
    expect(snapshot.scenarioCount).toBe(32);
    expect(snapshot.scenarioIds).toHaveLength(32);
    expect(snapshot.scenarios).toHaveLength(32);
    expect(snapshot.scenarios[0]?.traceCount).toBe(16);
    expect(snapshot.scenarios[0]?.trace).toHaveLength(16);
  });

  it('returns last valid typed snapshot when trailing policy context is malformed', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    appendJsonlRecord(
      path,
      createDecisionRecord(
        'policy preview: rendered adaptive obligation scenarios',
        'simple-question: direct_answer | coordinator=gpt-5.4/high',
        [],
        createPolicyPreviewDecisionContext([{ id: 'simple-question' }]),
      ),
      stringifyDecisionRecord,
    );
    appendJsonlRecord(
      path,
      createDecisionRecord(
        'policy preview: malformed',
        'bad context',
        [],
        {
          kind: 'policy_preview',
          scenarios: [42 as never],
        },
      ),
      stringifyDecisionRecord,
    );

    expect(readLatestPolicyPreviewSnapshot(path)).toEqual({
      status: 'present',
      scenarioCount: 1,
      scenarioIds: ['simple-question'],
      scenarios: [
        {
          id: 'simple-question',
          summary: null,
          input: null,
          roles: null,
          orchestration: null,
          continuation: null,
          obligationCount: 0,
          traceCount: 0,
          trace: [],
        },
      ],
      tsUnix: expect.any(Number),
      summary: 'policy preview: rendered adaptive obligation scenarios',
    });
  });

  it('parses typed and legacy artifact records', () => {
    const typed: ArtifactRecord = createArtifactRecord(
      'report',
      'docs/report.md',
      'state audit report',
      ['docs/report.md'],
    );
    const decodedTyped = parseArtifactRecordJson(JSON.stringify(typed));
    const decodedLegacy = parseArtifactRecordJson(
      JSON.stringify({
        ts_unix: 99,
        category: 'artifact',
        action: 'report',
        result: 'ok',
        summary: 'state audit report',
        paths: ['docs/report.md'],
      }),
    );

    expect(decodedTyped.kind).toBe('report');
    expect(decodedTyped.path).toBe('docs/report.md');
    expect(decodedLegacy.tsUnix).toBe(99);
    expect(decodedLegacy.kind).toBe('report');
    expect(decodedLegacy.path).toBe('docs/report.md');
    expect(decodedLegacy.summary).toBe('state audit report (ok)');
  });
});
