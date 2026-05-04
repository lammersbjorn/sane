import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildRunBrief,
  createDefaultRunSummary,
  parseRunSummaryJson,
  promoteRunSummary,
  readRunSummary,
  writeRunSummary,
  type CurrentRunState,
  type RunSummary,
} from '../src/index.js';
import { createVerificationStatus, makeTempDir } from './helpers.js';

describe('run summary promotion and brief generation', () => {
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
