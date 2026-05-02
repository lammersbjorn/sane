import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createDefaultLocalConfig,
  createPortableSettingsFile,
  enabledPackNames,
  parsePortableSettingsJson,
  parseLocalConfigToml,
  readLocalConfig,
  stringifyPortableSettings,
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

    expect(config.models.coordinator.model).toBe('gpt-5.5');
    expect(config.models.coordinator.reasoningEffort).toBe('medium');
    expect(config.models.sidecar.model).toBe('gpt-5.4-mini');
    expect(config.models.verifier.model).toBe('gpt-5.5');
    expect(config.models.verifier.reasoningEffort).toBe('high');
    expect(config.subagents.explorer.model).toBe('gpt-5.4-mini');
    expect(config.subagents.implementation.model).toBe('gpt-5.3-codex');
    expect(config.subagents.verifier.model).toBe('gpt-5.5');
    expect(config.subagents.realtime.model).toBe('gpt-5.3-codex-spark');
    expect(config.subagents.frontendCraft.model).toBe('gpt-5.5');
    expect(config.subagents.frontendCraft.reasoningEffort).toBe('high');
    expect(config.privacy.telemetry).toBe('off');
    expect(config.issueRelay.mode).toBe('off');
    expect(enabledPackNames(config.packs)).toEqual(['core']);
    expect(config.lifecycleHooks).toEqual({
      tokscaleSubmit: false,
      tokscaleDryRun: true,
      rateLimitResume: false,
    });
    expect(config.updates).toEqual({
      auto: false,
    });
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
    expect(config.issueRelay.mode).toBe('issue-review');
    expect(enabledPackNames(config.packs)).toEqual([
      'core',
      'caveman',
      'rtk',
      'frontend-craft',
      'docs-craft',
    ]);
    expect(config.lifecycleHooks).toEqual({
      tokscaleSubmit: true,
      tokscaleDryRun: false,
      rateLimitResume: true,
    });
    expect(config.updates.auto).toBe(true);
  });

  it('rejects disabling the core pack', () => {
    expect(() => parseLocalConfigToml(readFixture('invalid-core-disabled.toml'))).toThrow(
      /core pack must stay enabled/,
    );
  });

  it('fills frontend-craft subagent defaults for legacy subagent blocks', () => {
    const config = parseLocalConfigToml(`
version = 1

[subagents.explorer]
model = "gpt-5.4-mini"
reasoning_effort = "low"

[subagents.implementation]
model = "gpt-5.3-codex"
reasoning_effort = "medium"

[subagents.verifier]
model = "gpt-5.5"
reasoning_effort = "high"

[subagents.realtime]
model = "gpt-5.3-codex-spark"
reasoning_effort = "low"
`);

    expect(config.subagents.frontendCraft).toEqual({
      model: 'gpt-5.5',
      reasoningEffort: 'high',
    });
  });

  it('accepts frontendCraft wire key alias for subagent config', () => {
    const config = parseLocalConfigToml(`
version = 1

[subagents.explorer]
model = "gpt-5.4-mini"
reasoning_effort = "low"

[subagents.implementation]
model = "gpt-5.3-codex"
reasoning_effort = "medium"

[subagents.verifier]
model = "gpt-5.5"
reasoning_effort = "high"

[subagents.realtime]
model = "gpt-5.3-codex-spark"
reasoning_effort = "low"

[subagents.frontendCraft]
model = "gpt-5.4"
reasoning_effort = "xhigh"
`);

    expect(config.subagents.frontendCraft).toEqual({
      model: 'gpt-5.4',
      reasoningEffort: 'xhigh',
    });
  });

  it('round trips portable settings JSON', () => {
    const config = createDefaultLocalConfig();
    const portable = createPortableSettingsFile(config, '2026-04-29T12:00:00.000Z');
    const decoded = parsePortableSettingsJson(stringifyPortableSettings(portable));

    expect(decoded).toEqual(portable);
  });

  it('rejects unsupported portable settings version', () => {
    expect(() =>
      parsePortableSettingsJson(
        JSON.stringify({
          version: 2,
          exportedAt: '2026-04-29T12:00:00.000Z',
          config: createDefaultLocalConfig(),
        }),
      ),
    ).toThrow(/unsupported version/);
  });
});
