import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  listCanonicalBackupSiblings,
  parseLocalStateConfigToml,
  readLocalStateConfig,
  readRunSummary,
  writeAtomicTextFile,
  writeCanonicalWithBackup,
  writeCanonicalWithBackupResult,
  writeLocalStateConfig,
  writeRunSummary,
  type LocalStateConfig,
  type RunSummary,
} from '../src/index.js';
import { makeTempDir } from './helpers.js';

describe('backup and write helpers', () => {
  it('round trips local state config through TOML parsing and writing', () => {
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

  it('preserves prototype-shaped TOML keys without mutating object prototypes', () => {
    const decoded = parseLocalStateConfigToml(`
version = 1
"__proto__" = "root"
constructor = "ctor"
prototype = "proto"

["nested"."__proto__"]
value = "nested"
`);

    expect(Object.hasOwn(decoded.extra, '__proto__')).toBe(true);
    expect(decoded.extra.__proto__).toBe('root');
    expect(decoded.extra.constructor).toBe('ctor');
    expect(decoded.extra.prototype).toBe('proto');
    expect(({} as Record<string, unknown>).value).toBeUndefined();
    expect(({} as Record<string, unknown>).__proto__).not.toBe('root');
    const nested = decoded.extra.nested as Record<string, Record<string, string>>;
    expect(Object.hasOwn(nested, '__proto__')).toBe(true);
    expect(nested.__proto__.value).toBe('nested');
  });

  it('writes plain text atomically through the shared helper', () => {
    const dir = makeTempDir();
    const path = join(dir, 'nested', 'brief.md');

    writeAtomicTextFile(path, '# first\n');
    writeAtomicTextFile(path, '# second\n');

    expect(readFileSync(path, 'utf8')).toBe('# second\n');
  });

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

  it('returns empty backup lists when the parent directory is missing', () => {
    const dir = makeTempDir();
    const path = join(dir, 'missing', 'summary.json');

    expect(listCanonicalBackupSiblings(path)).toEqual([]);
    expect(existsSync(join(dir, 'missing'))).toBe(false);
  });
});
