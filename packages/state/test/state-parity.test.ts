import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  appendJsonlRecord,
  buildRunBrief,
  createArtifactRecord,
  createCanonicalStatePaths,
  createDefaultRunSummary,
  createDecisionRecord,
  createEventRecord,
  createPolicyPreviewDecisionContext,
  listCanonicalBackupSiblings,
  loadLayeredStateBundle,
  parseArtifactRecordJson,
  parseDecisionRecordJson,
  parseEventRecordJson,
  parseRunSnapshotJson,
  parseRunSummaryJson,
  policyPreviewDecisionContext,
  promoteRunSummary,
  readLatestPolicyPreviewDecision,
  readCurrentRunState,
  readJsonlRecords,
  readJsonlRecordsSlice,
  readLatestPolicyPreviewSnapshot,
  readRunSnapshot,
  readRunSummary,
  readLocalStateConfig,
  runSnapshotToCurrentRunState,
  stringifyDecisionRecord,
  stringifyRunSnapshot,
  writeCanonicalWithBackup,
  writeCanonicalWithBackupResult,
  writeCurrentRunState,
  writeLocalStateConfig,
  writeRunSnapshot,
  writeRunSummary,
  type ArtifactRecord,
  type CurrentRunState,
  type DecisionRecord,
  type LocalStateConfig,
  type RunSnapshot,
  type RunSummary,
  type VerificationStatus,
} from '../src/index.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sane-state-'));
  tempDirs.push(dir);
  return dir;
}

function createVerificationStatus(
  status: VerificationStatus['status'],
  summary: string | null = null,
): VerificationStatus {
  return { status, summary };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe('run snapshot parity', () => {
  it('round trips through JSON parsing', () => {
    const snapshot: RunSnapshot = {
      version: 1,
      objective: 'bootstrap sane',
    };

    const decoded = parseRunSnapshotJson(stringifyRunSnapshot(snapshot));

    expect(decoded).toEqual(snapshot);
  });

  it('writes the canonical current-run shape and reads back as snapshot', () => {
    const dir = makeTempDir();
    const path = join(dir, 'current-run.json');
    const snapshot: RunSnapshot = {
      version: 1,
      objective: 'bootstrap sane runtime',
    };

    writeRunSnapshot(path, snapshot);

    const decodedSnapshot = readRunSnapshot(path);
    const current = readCurrentRunState(path);

    expect(decodedSnapshot.version).toBe(2);
    expect(decodedSnapshot.objective).toBe(snapshot.objective);
    expect(current.version).toBe(2);
    expect(current.objective).toBe(snapshot.objective);
    expect(current.phase).toBe('unknown');
    expect(current.activeTasks).toEqual([]);
    expect(current.blockingQuestions).toEqual([]);
    expect(current.verification.status).toBe('unknown');
    expect(current.lastCompactionTsUnix).toBeNull();
  });

  it('converts a legacy snapshot into canonical current-run defaults', () => {
    const snapshot: RunSnapshot = {
      version: 1,
      objective: 'bootstrap sane',
    };

    const current = runSnapshotToCurrentRunState(snapshot);

    expect(current.version).toBe(2);
    expect(current.objective).toBe('bootstrap sane');
    expect(current.phase).toBe('unknown');
    expect(current.activeTasks).toEqual([]);
    expect(current.blockingQuestions).toEqual([]);
    expect(current.verification.status).toBe('unknown');
    expect(current.lastCompactionTsUnix).toBeNull();
  });

  it('reads legacy current-run payloads and preserves extra fields', () => {
    const dir = makeTempDir();
    const path = join(dir, 'current-run.json');

    writeFileSync(
      path,
      JSON.stringify(
        {
          version: 1,
          objective: 'bootstrap sane',
          carry_forward: 'keep me',
        },
        null,
        2,
      ),
    );

    const decoded = readCurrentRunState(path);

    expect(decoded.version).toBe(2);
    expect(decoded.objective).toBe('bootstrap sane');
    expect(decoded.phase).toBe('unknown');
    expect(decoded.activeTasks).toEqual([]);
    expect(decoded.blockingQuestions).toEqual([]);
    expect(decoded.verification.status).toBe('unknown');
    expect(decoded.extra).toEqual({ carry_forward: 'keep me' });
  });
});

describe('run summary parity', () => {
  it('persists to disk', () => {
    const dir = makeTempDir();
    const path = join(dir, 'summary.json');
    const summary: RunSummary = {
      version: 2,
      acceptedDecisions: ['plain-language first'],
      completedMilestones: ['bootstrap'],
      constraints: ['no required AGENTS.md'],
      lastVerifiedOutputs: ['pnpm --dir packages/state test'],
      filesTouched: ['README.md'],
      extra: {},
    };

    writeRunSummary(path, summary);
    const decoded = readRunSummary(path);

    expect(decoded).toEqual(summary);
  });

  it('upgrades legacy payloads, coerces object entries, and preserves extra fields', () => {
    const decoded = parseRunSummaryJson(
      JSON.stringify({
        version: 1,
        accepted_decisions: [{ summary: 'plain-language first' }],
        completed_milestones: [{ name: 'bootstrap' }],
        constraints: [{ text: 'no required AGENTS.md' }],
        last_verified_outputs: [{ value: 'pnpm --dir packages/state test' }],
        files_touched: [{ path: 'README.md' }],
        carry_forward: 'keep me',
      }),
    );

    expect(decoded.version).toBe(2);
    expect(decoded.acceptedDecisions).toEqual(['plain-language first']);
    expect(decoded.completedMilestones).toEqual(['bootstrap']);
    expect(decoded.constraints).toEqual(['no required AGENTS.md']);
    expect(decoded.lastVerifiedOutputs).toEqual(['pnpm --dir packages/state test']);
    expect(decoded.filesTouched).toEqual(['README.md']);
    expect(decoded.extra).toEqual({ carry_forward: 'keep me' });
  });

  it('promotes summary entries with dedupe and sorted files', () => {
    const summary = createDefaultRunSummary();
    summary.filesTouched = ['z.md', 'a.md'];
    summary.completedMilestones = ['bootstrap'];

    const promoted = promoteRunSummary(summary, {
      pathsTouched: ['a.md', 'b.md', 'b.md'],
      milestone: 'bootstrap',
    });

    expect(promoted.filesTouched).toEqual(['a.md', 'b.md', 'z.md']);
    expect(promoted.completedMilestones).toEqual(['bootstrap']);
  });

  it('builds markdown brief from current run and summary', () => {
    const summary: RunSummary = {
      version: 2,
      acceptedDecisions: ['keep state thin'],
      completedMilestones: ['bootstrap'],
      constraints: [],
      lastVerifiedOutputs: [],
      filesTouched: ['README.md'],
      extra: {},
    };
    const current: CurrentRunState = {
      version: 2,
      objective: 'Finish R3',
      phase: 'implementing',
      activeTasks: [],
      blockingQuestions: [],
      verification: createVerificationStatus('pending', 'tests not run'),
      lastCompactionTsUnix: null,
      extra: {},
    };

    const brief = buildRunBrief(summary, current);

    expect(brief).toContain('# Sane Brief');
    expect(brief).toContain('- Objective: Finish R3');
    expect(brief).toContain('## Active Tasks\n- none');
    expect(brief).toContain('## Completed Milestones\n- bootstrap');
    expect(brief).toContain('## Files Touched\n- README.md');
  });
});

describe('typed record parity', () => {
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

  it('reads latest policy preview snapshot through typed helper', () => {
    const dir = makeTempDir();
    const path = join(dir, 'decisions.jsonl');

    const decision = createDecisionRecord(
      'policy preview: rendered adaptive obligation scenarios',
      'simple-question: direct_answer | coordinator=gpt-5.4/high',
      [],
      createPolicyPreviewDecisionContext([{ id: 'simple-question' }, { id: 'multi-file-feature' }]),
    );
    decision.tsUnix = 1_700_000_001;

    appendJsonlRecord(
      path,
      decision,
      stringifyDecisionRecord,
    );

    expect(readLatestPolicyPreviewSnapshot(path)).toEqual({
      status: 'present',
      scenarioCount: 2,
      scenarioIds: ['simple-question', 'multi-file-feature'],
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
      tsUnix: null,
      summary: null,
    });
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

describe('local state config parity', () => {
  it('round trips through TOML parsing and writing', () => {
    const dir = makeTempDir();
    const path = join(dir, 'config.local.toml');
    const config: LocalStateConfig = {
      version: 1,
      extra: {
        telemetry: 'off',
      },
    };

    writeLocalStateConfig(path, config);
    const decoded = readLocalStateConfig(path);
    const body = readFileSync(path, 'utf8');

    expect(decoded).toEqual(config);
    expect(body).toContain('version = 1');
    expect(body).toContain('telemetry = "off"');
  });
});

describe('canonical rewrite parity', () => {
  it('creates backups before json replacement and reports metadata', () => {
    const dir = makeTempDir();
    const path = join(dir, 'summary.json');
    const previous: RunSummary = {
      version: 2,
      acceptedDecisions: ['old decision'],
      completedMilestones: ['old milestone'],
      constraints: [],
      lastVerifiedOutputs: [],
      filesTouched: [],
      extra: {},
    };
    const replacement: RunSummary = {
      version: 2,
      acceptedDecisions: ['new decision'],
      completedMilestones: ['new milestone'],
      constraints: [],
      lastVerifiedOutputs: [],
      filesTouched: [],
      extra: {},
    };

    writeRunSummary(path, previous);

    const backupPath = writeCanonicalWithBackup(path, replacement, { format: 'json' });
    const result = writeCanonicalWithBackupResult(path, previous, { format: 'json' });

    expect(backupPath).toMatch(/summary\.json\.bak\./);
    expect(readRunSummary(path)).toEqual(previous);
    expect(readRunSummary(result.rewrittenPath)).toEqual(previous);
    expect(result.firstWrite).toBe(false);
    expect(result.backupPath).toMatch(/summary\.json\.bak\./);
  });

  it('skips backups on first canonical toml write', () => {
    const dir = makeTempDir();
    const path = join(dir, 'config.local.toml');
    const config: LocalStateConfig = {
      version: 1,
      extra: {
        telemetry: 'off',
      },
    };

    const result = writeCanonicalWithBackupResult(path, config, {
      format: 'toml',
    });

    expect(result.rewrittenPath).toBe(path);
    expect(result.backupPath).toBeNull();
    expect(result.firstWrite).toBe(true);
    expect(readLocalStateConfig(path)).toEqual(config);
  });

  it('lists canonical backup siblings newest first', () => {
    const dir = makeTempDir();
    const path = join(dir, 'summary.json');

    writeFileSync(join(dir, 'summary.json.bak.1700000000'), '{}');
    writeFileSync(join(dir, 'summary.json.bak.1700000001'), '{}');
    writeFileSync(join(dir, 'summary.json.bak.1700000002'), '{}');
    writeFileSync(join(dir, 'summary.json.bak.1700000002.1'), '{}');
    writeFileSync(join(dir, 'summary.json.bak.not-a-ts'), '{}');
    writeFileSync(join(dir, 'other.json.bak.1900000000'), '{}');

    expect(listCanonicalBackupSiblings(path)).toEqual([
      join(dir, 'summary.json.bak.1700000002.1'),
      join(dir, 'summary.json.bak.1700000002'),
      join(dir, 'summary.json.bak.1700000001'),
      join(dir, 'summary.json.bak.1700000000'),
    ]);
  });
});

describe('layered load parity', () => {
  it('loads optional layers in canonical order', () => {
    const dir = makeTempDir();
    const runtimeRoot = join(dir, '.sane');
    const stateDir = join(runtimeRoot, 'state');
    const configPath = join(runtimeRoot, 'config.local.toml');
    const summaryPath = join(stateDir, 'summary.json');
    const currentRunPath = join(stateDir, 'current-run.json');
    const briefPath = join(runtimeRoot, 'BRIEF.md');

    const currentRun: CurrentRunState = {
      version: 2,
      objective: 'Finish R3',
      phase: 'implementing',
      activeTasks: ['wire typed records'],
      blockingQuestions: ['none'],
      verification: createVerificationStatus('pending', 'tests not run yet'),
      lastCompactionTsUnix: 1_713_560_000,
      extra: {},
    };

    writeLocalStateConfig(configPath, { version: 1, extra: {} });
    writeRunSummary(summaryPath, {
      version: 2,
      acceptedDecisions: ['keep state thin'],
      completedMilestones: [],
      constraints: [],
      lastVerifiedOutputs: [],
      filesTouched: [],
      extra: {},
    });
    writeCurrentRunState(currentRunPath, currentRun);
    writeFileSync(briefPath, '# brief\n');

    const bundle = loadLayeredStateBundle(
      createCanonicalStatePaths(configPath, summaryPath, currentRunPath, briefPath),
    );

    expect(bundle.config?.version).toBe(1);
    expect(bundle.summary?.version).toBe(2);
    expect(bundle.currentRun).toEqual(currentRun);
    expect(bundle.brief).toBe('# brief\n');
    expect(bundle.historyCounts).toEqual({ events: 0, decisions: 0, artifacts: 0 });
  });

  it('keeps readable layers when summary parsing fails', () => {
    const dir = makeTempDir();
    const runtimeRoot = join(dir, '.sane');
    const stateDir = join(runtimeRoot, 'state');
    const configPath = join(runtimeRoot, 'config.local.toml');
    const summaryPath = join(stateDir, 'summary.json');
    const currentRunPath = join(stateDir, 'current-run.json');
    const briefPath = join(runtimeRoot, 'BRIEF.md');

    writeLocalStateConfig(configPath, { version: 1, extra: {} });
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(summaryPath, '{');
    writeCurrentRunState(currentRunPath, {
      version: 2,
      objective: 'recover current run',
      phase: 'implementing',
      activeTasks: [],
      blockingQuestions: [],
      verification: createVerificationStatus('pending', 'summary is broken'),
      lastCompactionTsUnix: null,
      extra: {},
    });
    writeFileSync(briefPath, '# brief\n');

    const bundle = loadLayeredStateBundle(
      createCanonicalStatePaths(configPath, summaryPath, currentRunPath, briefPath),
    );

    expect(bundle.config?.version).toBe(1);
    expect(bundle.summary).toBeNull();
    expect(bundle.currentRun?.objective).toBe('recover current run');
    expect(bundle.currentRun?.phase).toBe('implementing');
    expect(bundle.brief).toBe('# brief\n');
  });

  it('returns empty backup lists when the parent directory is missing', () => {
    const dir = makeTempDir();
    const path = join(dir, 'missing', 'summary.json');

    expect(listCanonicalBackupSiblings(path)).toEqual([]);
    expect(existsSync(join(dir, 'missing'))).toBe(false);
  });
});
