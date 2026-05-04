import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createDefaultCurrentRunState,
  parseRunSnapshotJson,
  readCurrentRunState,
  readRunSnapshot,
  runSnapshotToCurrentRunState,
  stringifyRunSnapshot,
  writeRunSnapshot,
  type RunSnapshot,
} from '../src/index.js';
import { makeTempDir } from './helpers.js';

describe('run snapshot parsing', () => {
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

  it('creates canonical default current-run handoff state', () => {
    const current = createDefaultCurrentRunState('keep runtime handoff typed');

    expect(current).toEqual({
      version: 2,
      objective: 'keep runtime handoff typed',
      phase: 'unknown',
      activeTasks: [],
      blockingQuestions: [],
      verification: {
        status: 'unknown',
        summary: null,
      },
      lastCompactionTsUnix: null,
      extra: {},
    });
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
