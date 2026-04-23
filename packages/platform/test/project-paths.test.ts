import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  canonicalStateLoadOrder,
  createCodexPaths,
  createProjectPaths,
  detectPlatform,
  discoverCodexPaths,
  discoverProjectPaths,
  ensureRuntimeDirs,
  rawStateHistoryFiles,
} from '../src/index.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sane-platform-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe('project path parity', () => {
  it('uses the .sane namespace', () => {
    const dir = makeTempDir();
    const paths = createProjectPaths(dir);

    expect(paths.repoAgentsDir).toBe(join(dir, '.agents'));
    expect(paths.repoSkillsDir).toBe(join(dir, '.agents', 'skills'));
    expect(paths.repoAgentsMd).toBe(join(dir, 'AGENTS.md'));
    expect(paths.runtimeRoot).toBe(join(dir, '.sane'));
    expect(paths.configPath).toBe(join(dir, '.sane', 'config.local.toml'));
    expect(paths.stateDir).toBe(join(dir, '.sane', 'state'));
    expect(paths.currentRunPath).toBe(join(dir, '.sane', 'state', 'current-run.json'));
    expect(paths.summaryPath).toBe(join(dir, '.sane', 'state', 'summary.json'));
    expect(paths.eventsPath).toBe(join(dir, '.sane', 'state', 'events.jsonl'));
    expect(paths.decisionsPath).toBe(join(dir, '.sane', 'state', 'decisions.jsonl'));
    expect(paths.artifactsPath).toBe(join(dir, '.sane', 'state', 'artifacts.jsonl'));
    expect(paths.briefPath).toBe(join(dir, '.sane', 'BRIEF.md'));
    expect(paths.logsDir).toBe(join(dir, '.sane', 'logs'));
    expect(paths.cacheDir).toBe(join(dir, '.sane', 'cache'));
    expect(paths.backupsDir).toBe(join(dir, '.sane', 'backups'));
    expect(paths.codexConfigBackupsDir).toBe(join(dir, '.sane', 'backups', 'codex-config'));
    expect(paths.sessionsDir).toBe(join(dir, '.sane', 'sessions'));
    expect(paths.telemetryDir).toBe(join(dir, '.sane', 'telemetry'));
    expect(paths.telemetrySummaryPath).toBe(join(dir, '.sane', 'telemetry', 'summary.json'));
    expect(paths.telemetryEventsPath).toBe(join(dir, '.sane', 'telemetry', 'events.jsonl'));
    expect(paths.telemetryQueuePath).toBe(join(dir, '.sane', 'telemetry', 'queue.jsonl'));
  });

  it('walks up to Cargo.toml from a nested directory', () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'Cargo.toml'), '[workspace]\n');
    const nested = join(dir, 'crates', 'sane-tui', 'src');
    mkdirSync(nested, { recursive: true });

    const discovered = discoverProjectPaths(nested);

    expect(discovered.projectRoot).toBe(dir);
    expect(discovered.runtimeRoot).toBe(join(dir, '.sane'));
  });

  it('accepts a file start path', () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.git'));
    const file = join(dir, 'crates', 'sane-platform', 'src', 'lib.rs');
    mkdirSync(join(dir, 'crates', 'sane-platform', 'src'), { recursive: true });
    writeFileSync(file, '// test\n');

    const discovered = discoverProjectPaths(file);

    expect(discovered.projectRoot).toBe(dir);
  });

  it('uses .sane when repo markers are absent', () => {
    const dir = makeTempDir();
    const nested = join(dir, 'workspace', 'deep', 'src');
    const runtimeRoot = join(dir, 'workspace', '.sane');
    mkdirSync(nested, { recursive: true });
    mkdirSync(runtimeRoot, { recursive: true });

    const discovered = discoverProjectPaths(nested);

    expect(discovered.projectRoot).toBe(join(dir, 'workspace'));
    expect(discovered.runtimeRoot).toBe(runtimeRoot);
  });

  it('creates runtime state and telemetry directories idempotently', () => {
    const dir = makeTempDir();
    const paths = createProjectPaths(dir);

    ensureRuntimeDirs(paths);
    ensureRuntimeDirs(paths);

    expect(existsSync(paths.runtimeRoot)).toBe(true);
    expect(existsSync(paths.stateDir)).toBe(true);
    expect(existsSync(paths.cacheDir)).toBe(true);
    expect(existsSync(paths.backupsDir)).toBe(true);
    expect(existsSync(paths.codexConfigBackupsDir)).toBe(true);
    expect(existsSync(paths.logsDir)).toBe(true);
    expect(existsSync(paths.sessionsDir)).toBe(true);
    expect(existsSync(paths.telemetryDir)).toBe(true);
  });

  it('matches the canonical state load order', () => {
    const dir = makeTempDir();
    const paths = createProjectPaths(dir);

    const order = canonicalStateLoadOrder(paths);

    expect(order.map((entry) => entry.file)).toEqual(['config', 'summary', 'currentRun', 'brief']);
    expect(order[0]?.path).toBe(paths.configPath);
    expect(order[1]?.path).toBe(paths.summaryPath);
    expect(order[2]?.path).toBe(paths.currentRunPath);
    expect(order[3]?.path).toBe(paths.briefPath);
  });

  it('matches raw state history jsonl layout', () => {
    const dir = makeTempDir();
    const paths = createProjectPaths(dir);

    const logs = rawStateHistoryFiles(paths);

    expect(logs.map((entry) => entry.file)).toEqual(['events', 'decisions', 'artifacts']);
    expect(logs[0]?.path).toBe(paths.eventsPath);
    expect(logs[1]?.path).toBe(paths.decisionsPath);
    expect(logs[2]?.path).toBe(paths.artifactsPath);
  });
});

describe('codex path parity', () => {
  it('uses user skill locations from docs', () => {
    const home = makeTempDir();
    const paths = createCodexPaths(home);

    expect(paths.codexHome).toBe(join(home, '.codex'));
    expect(paths.configToml).toBe(join(home, '.codex', 'config.toml'));
    expect(paths.userAgentsDir).toBe(join(home, '.agents'));
    expect(paths.userSkillsDir).toBe(join(home, '.agents', 'skills'));
    expect(paths.globalAgentsMd).toBe(join(home, '.codex', 'AGENTS.md'));
    expect(paths.hooksJson).toBe(join(home, '.codex', 'hooks.json'));
  });

  it('includes local model metadata files', () => {
    const home = makeTempDir();
    const paths = createCodexPaths(home);

    expect(paths.modelsCacheJson).toBe(join(home, '.codex', 'models_cache.json'));
    expect(paths.authJson).toBe(join(home, '.codex', 'auth.json'));
  });

  it('maps host platforms to the canonical Sane labels', () => {
    expect(detectPlatform('darwin')).toBe('macos');
    expect(detectPlatform('win32')).toBe('windows');
    expect(detectPlatform('linux')).toBe('linux');
  });

  it('discovers codex paths from HOME / USERPROFILE / HOMEDRIVE+HOMEPATH precedence', () => {
    expect(discoverCodexPaths({ HOME: '/Users/sane' }).homeDir).toBe('/Users/sane');
    expect(discoverCodexPaths({ USERPROFILE: 'C:\\Users\\sane' }).homeDir).toBe(
      'C:\\Users\\sane'
    );
    expect(
      discoverCodexPaths({
        HOMEDRIVE: 'C:',
        HOMEPATH: '\\Users\\sane'
      }).homeDir
    ).toBe('C:\\Users\\sane');
  });

  it('throws when no supported home environment variables are set', () => {
    expect(() => discoverCodexPaths({})).toThrow(
      'could not resolve HOME, USERPROFILE, or HOMEDRIVE/HOMEPATH'
    );
  });
});
