import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createDefaultLocalConfig,
  enabledPackNames,
  parseLocalConfigToml,
  readLocalConfig,
  stringifyLocalConfig,
  writeLocalConfig,
} from '../src/index.js';

const tempDirs: string[] = [];
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sane-config-'));
  tempDirs.push(dir);
  return dir;
}

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8');
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe('local config parity', () => {
  it('round trips through TOML', () => {
    const config = createDefaultLocalConfig();
    const encoded = stringifyLocalConfig(config);
    const decoded = parseLocalConfigToml(encoded);

    expect(decoded).toEqual(config);
  });

  it('persists to disk', () => {
    const dir = makeTempDir();
    const path = join(dir, 'config.local.toml');
    const config = createDefaultLocalConfig();

    writeLocalConfig(path, config);
    const decoded = readLocalConfig(path);

    expect(decoded).toEqual(config);
  });

  it('contains default model role presets', () => {
    const config = createDefaultLocalConfig();

    expect(config.models.coordinator.model).toBe('gpt-5.4');
    expect(config.models.coordinator.reasoningEffort).toBe('high');
    expect(config.models.sidecar.model).toBe('gpt-5.4-mini');
    expect(config.models.verifier.model).toBe('gpt-5.4');
    expect(config.models.verifier.reasoningEffort).toBe('high');
    expect(config.privacy.telemetry).toBe('off');
    expect(enabledPackNames(config.packs)).toEqual(['core']);
  });

  it('rejects unknown models', () => {
    expect(() => parseLocalConfigToml(readFixture('invalid-unknown-model.toml'))).toThrow(
      /not in the supported Codex model set/,
    );
  });

  it('supports xhigh reasoning and full pack parsing', () => {
    const config = parseLocalConfigToml(readFixture('valid-full-config.toml'));

    expect(config.models.coordinator.reasoningEffort).toBe('xhigh');
    expect(config.privacy.telemetry).toBe('product-improvement');
    expect(enabledPackNames(config.packs)).toEqual([
      'core',
      'caveman',
      'cavemem',
      'rtk',
      'frontend-craft',
    ]);
  });

  it('rejects disabling the core pack', () => {
    expect(() => parseLocalConfigToml(readFixture('invalid-core-disabled.toml'))).toThrow(
      /core pack must stay enabled/,
    );
  });
});
