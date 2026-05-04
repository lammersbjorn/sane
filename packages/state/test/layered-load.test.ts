import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  appendJsonlRecord,
  createArtifactRecord,
  createCanonicalStatePaths,
  createDecisionRecord,
  createEventRecord,
  createPolicyPreviewDecisionContext,
  loadLayeredStateBundle,
  stringifyArtifactRecord,
  stringifyDecisionRecord,
  stringifyEventRecord,
  writeCurrentRunState,
  writeLocalStateConfig,
  writeRunSummary,
  type CurrentRunState,
} from '../src/index.js';
import { createVerificationStatus, makeTempDir } from './helpers.js';

describe('layered load behavior', () => {
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
    expect(bundle.layerStatus).toEqual({
      config: 'present',
      summary: 'present',
      currentRun: 'present',
      brief: 'present',
    });
    expect(bundle.historyCounts).toEqual({ events: 0, decisions: 0, artifacts: 0 });
    expect(bundle.historyPreview).toEqual({
      latestEvent: null,
      latestDecision: null,
      latestArtifact: null,
    });
    expect(bundle.latestPolicyPreview).toEqual({
      status: 'missing',
      scenarioCount: 0,
      scenarioIds: [],
      scenarios: [],
      tsUnix: null,
      summary: null,
    });
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
    expect(bundle.layerStatus).toEqual({
      config: 'present',
      summary: 'invalid',
      currentRun: 'present',
      brief: 'present',
    });
    expect(bundle.historyPreview).toEqual({
      latestEvent: null,
      latestDecision: null,
      latestArtifact: null,
    });
    expect(bundle.latestPolicyPreview).toEqual({
      status: 'missing',
      scenarioCount: 0,
      scenarioIds: [],
      scenarios: [],
      tsUnix: null,
      summary: null,
    });
  });

  it('marks missing layers explicitly when canonical files are absent', () => {
    const dir = makeTempDir();
    const runtimeRoot = join(dir, '.sane');
    const stateDir = join(runtimeRoot, 'state');
    const configPath = join(runtimeRoot, 'config.local.toml');
    const summaryPath = join(stateDir, 'summary.json');
    const currentRunPath = join(stateDir, 'current-run.json');
    const briefPath = join(runtimeRoot, 'BRIEF.md');

    mkdirSync(stateDir, { recursive: true });
    writeCurrentRunState(currentRunPath, {
      version: 2,
      objective: 'keep current only',
      phase: 'implementing',
      activeTasks: [],
      blockingQuestions: [],
      verification: createVerificationStatus('pending', null),
      lastCompactionTsUnix: null,
      extra: {},
    });

    const bundle = loadLayeredStateBundle(
      createCanonicalStatePaths(configPath, summaryPath, currentRunPath, briefPath),
    );

    expect(bundle.config).toBeNull();
    expect(bundle.summary).toBeNull();
    expect(bundle.currentRun?.objective).toBe('keep current only');
    expect(bundle.brief).toBeNull();
    expect(bundle.layerStatus).toEqual({
      config: 'missing',
      summary: 'missing',
      currentRun: 'present',
      brief: 'missing',
    });
  });

  it('keeps bundle readable when brief path is unreadable', () => {
    const dir = makeTempDir();
    const runtimeRoot = join(dir, '.sane');
    const stateDir = join(runtimeRoot, 'state');
    const configPath = join(runtimeRoot, 'config.local.toml');
    const summaryPath = join(stateDir, 'summary.json');
    const currentRunPath = join(stateDir, 'current-run.json');
    const briefPath = join(runtimeRoot, 'BRIEF.md');

    writeLocalStateConfig(configPath, { version: 1, extra: {} });
    writeRunSummary(summaryPath, {
      version: 2,
      acceptedDecisions: [],
      completedMilestones: [],
      constraints: [],
      lastVerifiedOutputs: [],
      filesTouched: [],
      extra: {},
    });
    writeCurrentRunState(currentRunPath, {
      version: 2,
      objective: 'keep siblings readable',
      phase: 'implementing',
      activeTasks: [],
      blockingQuestions: [],
      verification: createVerificationStatus('pending', null),
      lastCompactionTsUnix: null,
      extra: {},
    });
    mkdirSync(briefPath, { recursive: true });

    const bundle = loadLayeredStateBundle(
      createCanonicalStatePaths(configPath, summaryPath, currentRunPath, briefPath),
    );

    expect(bundle.config?.version).toBe(1);
    expect(bundle.summary?.version).toBe(2);
    expect(bundle.currentRun?.objective).toBe('keep siblings readable');
    expect(bundle.brief).toBeNull();
    expect(bundle.layerStatus).toEqual({
      config: 'present',
      summary: 'present',
      currentRun: 'present',
      brief: 'invalid',
    });
  });

  it('includes latest policy preview snapshot from decisions history', () => {
    const dir = makeTempDir();
    const runtimeRoot = join(dir, '.sane');
    const stateDir = join(runtimeRoot, 'state');
    const configPath = join(runtimeRoot, 'config.local.toml');
    const summaryPath = join(stateDir, 'summary.json');
    const currentRunPath = join(stateDir, 'current-run.json');
    const briefPath = join(runtimeRoot, 'BRIEF.md');
    const decisionsPath = join(stateDir, 'decisions.jsonl');

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
    writeCurrentRunState(currentRunPath, {
      version: 2,
      objective: 'Finish R3',
      phase: 'implementing',
      activeTasks: [],
      blockingQuestions: [],
      verification: createVerificationStatus('pending'),
      lastCompactionTsUnix: null,
      extra: {},
    });
    writeFileSync(briefPath, '# brief\n');

    const previewDecision = createDecisionRecord(
      'policy preview: rendered adaptive obligation scenarios',
      'simple-question: direct_answer | coordinator=gpt-5.4/high',
      [],
      createPolicyPreviewDecisionContext([{ id: 'simple-question' }, { id: 'multi-file-feature' }]),
    );
    previewDecision.tsUnix = 1_700_000_123;
    appendJsonlRecord(decisionsPath, previewDecision, stringifyDecisionRecord);

    appendJsonlRecord(
      decisionsPath,
      createDecisionRecord('runtime installed', 'keep runtime bootstrap explicit', ['.sane/config.local.toml']),
      stringifyDecisionRecord,
    );

    const bundle = loadLayeredStateBundle(
      createCanonicalStatePaths(
        configPath,
        summaryPath,
        currentRunPath,
        briefPath,
        undefined,
        decisionsPath,
      ),
    );

    expect(bundle.latestPolicyPreview).toEqual({
      status: 'present',
      scenarioCount: 2,
      scenarioIds: ['simple-question', 'multi-file-feature'],
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
      tsUnix: 1_700_000_123,
      summary: 'policy preview: rendered adaptive obligation scenarios',
    });
    expect(bundle.historyCounts.decisions).toBe(2);
  });

  it('surfaces latest valid history records from layered jsonl state', () => {
    const dir = makeTempDir();
    const runtimeRoot = join(dir, '.sane');
    const stateDir = join(runtimeRoot, 'state');
    const configPath = join(runtimeRoot, 'config.local.toml');
    const summaryPath = join(stateDir, 'summary.json');
    const currentRunPath = join(stateDir, 'current-run.json');
    const briefPath = join(runtimeRoot, 'BRIEF.md');
    const eventsPath = join(stateDir, 'events.jsonl');
    const decisionsPath = join(stateDir, 'decisions.jsonl');
    const artifactsPath = join(stateDir, 'artifacts.jsonl');

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
    writeCurrentRunState(currentRunPath, {
      version: 2,
      objective: 'Finish R3',
      phase: 'implementing',
      activeTasks: [],
      blockingQuestions: [],
      verification: createVerificationStatus('pending'),
      lastCompactionTsUnix: null,
      extra: {},
    });
    writeFileSync(briefPath, '# brief\n');

    appendJsonlRecord(
      eventsPath,
      createEventRecord('operation', 'bootstrap_runtime', 'ok', 'runtime bootstrapped', []),
      stringifyEventRecord,
    );
    const latestDecision = createDecisionRecord(
      'policy preview: rendered adaptive obligation scenarios',
      'simple-question: direct_answer | coordinator=gpt-5.4/high',
      [],
      createPolicyPreviewDecisionContext([{ id: 'simple-question' }]),
    );
    latestDecision.tsUnix = 1_700_000_321;
    appendJsonlRecord(decisionsPath, latestDecision, stringifyDecisionRecord);
    appendJsonlRecord(
      artifactsPath,
      createArtifactRecord('summary', '.sane/BRIEF.md', 'saved runtime brief', ['.sane/BRIEF.md']),
      stringifyArtifactRecord,
    );

    writeFileSync(eventsPath, `${readFileSync(eventsPath, 'utf8')}{"broken":\n`, 'utf8');
    writeFileSync(decisionsPath, `${readFileSync(decisionsPath, 'utf8')}{\n`, 'utf8');
    writeFileSync(artifactsPath, `${readFileSync(artifactsPath, 'utf8')}not-json\n`, 'utf8');

    const bundle = loadLayeredStateBundle(
      createCanonicalStatePaths(
        configPath,
        summaryPath,
        currentRunPath,
        briefPath,
        eventsPath,
        decisionsPath,
        artifactsPath,
      ),
    );

    expect(bundle.historyCounts).toEqual({ events: 2, decisions: 2, artifacts: 2 });
    expect(bundle.historyPreview).toEqual({
      latestEvent: {
        tsUnix: expect.any(Number),
        action: 'bootstrap_runtime',
        summary: 'runtime bootstrapped',
        result: 'ok',
      },
      latestDecision: {
        tsUnix: 1_700_000_321,
        summary: 'policy preview: rendered adaptive obligation scenarios',
        rationale: 'simple-question: direct_answer | coordinator=gpt-5.4/high',
      },
      latestArtifact: {
        tsUnix: expect.any(Number),
        kind: 'summary',
        summary: 'saved runtime brief',
        path: '.sane/BRIEF.md',
      },
    });
  });
});
