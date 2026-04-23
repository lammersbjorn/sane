import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createDefaultLocalConfig,
  createRecommendedLocalConfig,
  createRecommendedModelRoutingPresets,
  createRecommendedSubagentRoutingPresets,
  createRecommendedSubagentPreset,
  detectAvailableModelsFromJson,
  detectCodexEnvironment,
  detectPlanTypeFromJson,
  type CodexEnvironment,
} from '../src/index.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sane-config-env-'));
  tempDirs.push(dir);
  return dir;
}

function makeJwt(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encoded}.signature`;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe('environment-aware recommendations', () => {
  it('uses gpt-5.5 for high-value coordination and verification when available', () => {
    const environment: CodexEnvironment = {
      planType: 'plus',
      availableModels: [
        {
          slug: 'gpt-5.5',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium', 'high'],
        },
        {
          slug: 'gpt-5.3-codex',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.3-codex-spark',
          reasoningEfforts: ['low', 'medium'],
        },
      ],
    };

    expect(createRecommendedModelRoutingPresets(environment)).toEqual({
      coordinator: {
        model: 'gpt-5.5',
        reasoningEffort: 'medium',
      },
      execution: {
        model: 'gpt-5.3-codex',
        reasoningEffort: 'medium',
      },
      sidecar: {
        model: 'gpt-5.4-mini',
        reasoningEffort: 'medium',
      },
      verifier: {
        model: 'gpt-5.5',
        reasoningEffort: 'high',
      },
      realtime: {
        model: 'gpt-5.3-codex-spark',
        reasoningEffort: 'low',
      },
    });

    expect(createRecommendedSubagentRoutingPresets(environment)).toEqual({
      explorer: {
        model: 'gpt-5.4-mini',
        reasoningEffort: 'low',
      },
      implementation: {
        model: 'gpt-5.3-codex',
        reasoningEffort: 'medium',
      },
      verifier: {
        model: 'gpt-5.5',
        reasoningEffort: 'high',
      },
      realtime: {
        model: 'gpt-5.3-codex-spark',
        reasoningEffort: 'low',
      },
    });
  });

  it('keeps high reasoning for gpt-5.4 coordinator fallback', () => {
    const environment: CodexEnvironment = {
      planType: 'plus',
      availableModels: [
        {
          slug: 'gpt-5.4',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium', 'high'],
        },
      ],
    };

    expect(createRecommendedModelRoutingPresets(environment).coordinator).toEqual({
      model: 'gpt-5.4',
      reasoningEffort: 'high',
    });
  });

  it('builds a task-shaped routing matrix from modern frontier and codex models', () => {
    const environment: CodexEnvironment = {
      planType: 'plus',
      availableModels: [
        {
          slug: 'gpt-5.4',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium', 'high'],
        },
        {
          slug: 'gpt-5.3-codex',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.3-codex-spark',
          reasoningEfforts: ['low', 'medium'],
        },
        {
          slug: 'gpt-5.2',
          reasoningEfforts: ['medium', 'high'],
        },
      ],
    };

    expect(createRecommendedModelRoutingPresets(environment)).toEqual({
      coordinator: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
      },
      execution: {
        model: 'gpt-5.3-codex',
        reasoningEffort: 'medium',
      },
      sidecar: {
        model: 'gpt-5.4-mini',
        reasoningEffort: 'medium',
      },
      verifier: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
      },
      realtime: {
        model: 'gpt-5.3-codex-spark',
        reasoningEffort: 'low',
      },
    });
  });

  it('uses gpt-5.4 for execution when gpt-5.3-codex is absent but frontier fallback exists', () => {
    const environment: CodexEnvironment = {
      availableModels: [
        {
          slug: 'gpt-5.4',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium'],
        },
        {
          slug: 'gpt-5.2',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
      ],
    };

    const routing = createRecommendedModelRoutingPresets(environment);

    expect(routing.execution).toEqual({
      model: 'gpt-5.4',
      reasoningEffort: 'medium',
    });
    expect(routing.sidecar).toEqual({
      model: 'gpt-5.4-mini',
      reasoningEffort: 'medium',
    });
    expect(routing.coordinator).toEqual({
      model: 'gpt-5.4',
      reasoningEffort: 'high',
    });
  });

  it('keeps gpt-5.2 as the execution fallback when newer execution models are absent', () => {
    const environment: CodexEnvironment = {
      availableModels: [
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium'],
        },
        {
          slug: 'gpt-5.2',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
      ],
    };

    expect(createRecommendedModelRoutingPresets(environment).execution).toEqual({
      model: 'gpt-5.2',
      reasoningEffort: 'medium',
    });
  });

  it('derives task-shaped subagent presets from the same environment matrix', () => {
    const environment: CodexEnvironment = {
      availableModels: [
        {
          slug: 'gpt-5.4',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium'],
        },
        {
          slug: 'gpt-5.3-codex',
          reasoningEfforts: ['medium', 'high'],
        },
        {
          slug: 'gpt-5.3-codex-spark',
          reasoningEfforts: ['low', 'medium'],
        },
      ],
    };

    expect(createRecommendedSubagentPreset(environment, 'implementation')).toEqual({
      model: 'gpt-5.3-codex',
      reasoningEffort: 'medium',
    });
    expect(createRecommendedSubagentPreset(environment, 'realtime')).toEqual({
      model: 'gpt-5.3-codex-spark',
      reasoningEffort: 'low',
    });
    expect(createRecommendedSubagentRoutingPresets(environment)).toEqual({
      explorer: {
        model: 'gpt-5.4-mini',
        reasoningEffort: 'low',
      },
      implementation: {
        model: 'gpt-5.3-codex',
        reasoningEffort: 'medium',
      },
      verifier: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
      },
      realtime: {
        model: 'gpt-5.3-codex-spark',
        reasoningEffort: 'low',
      },
    });
  });

  it('detects and normalizes available models from cache json', () => {
    const detected = detectAvailableModelsFromJson({
      models: [
        {
          slug: 'gpt-5.5',
          supported_reasoning_levels: ['high', 'xhigh'],
          priority: -10,
        },
        {
          slug: 'gpt-5.4',
          supported_reasoning_levels: ['high', { effort: 'medium' }],
          priority: '2',
        },
        {
          id: 'gpt-5.4-mini',
          reasoning_efforts: [{ reasoning_effort: 'low' }, 'medium'],
          priority: -5,
        },
        {
          slug: 'gpt-5.4',
          supported_reasoning_efforts: ['xhigh'],
          priority: 10,
        },
        {
          name: 'gpt-5.2',
          default_reasoning_level: 'high',
          priority: 3,
        },
        {
          slug: 'not-supported',
          supported_reasoning_levels: ['high'],
          priority: 1,
        },
      ],
    });

    expect(detected).toEqual([
      {
        slug: 'gpt-5.5',
        reasoningEfforts: ['high', 'xhigh'],
      },
      {
        slug: 'gpt-5.4-mini',
        reasoningEfforts: ['low', 'medium'],
      },
      {
        slug: 'gpt-5.4',
        reasoningEfforts: ['medium', 'high'],
      },
      {
        slug: 'gpt-5.2',
        reasoningEfforts: ['high'],
      },
    ]);
  });

  it('detects plan type from direct, nested, and jwt-backed auth payloads', () => {
    expect(detectPlanTypeFromJson({ chatgpt_plan_type: 'team' })).toBe('team');
    expect(
      detectPlanTypeFromJson({
        'https://api.openai.com/auth': {
          plan_type: 'enterprise',
        },
      }),
    ).toBe('enterprise');
    expect(
      detectPlanTypeFromJson({
        tokens: {
          id_token: makeJwt({
            'https://api.openai.com/auth': {
              chatgpt_plan_type: 'plus',
            },
          }),
        },
      }),
    ).toBe('plus');
  });

  it('detects environment from auth and models cache files', () => {
    const dir = makeTempDir();
    const modelsCachePath = join(dir, 'models.json');
    const authPath = join(dir, 'auth.json');

    writeFileSync(
      modelsCachePath,
      JSON.stringify([
        {
          slug: 'gpt-5.1-codex-max',
          supported_reasoning_levels: ['high', 'xhigh'],
          priority: 4,
        },
        {
          slug: 'gpt-5.4-mini',
          supported_reasoning_levels: ['low', 'medium'],
          priority: 1,
        },
      ]),
    );
    writeFileSync(
      authPath,
      JSON.stringify({
        access_token: makeJwt({
          plan_type: 'pro',
        }),
      }),
    );

    expect(detectCodexEnvironment(modelsCachePath, authPath)).toEqual({
      planType: 'pro',
      availableModels: [
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium'],
        },
      ],
    });
  });

  it('keeps default local config when no models are available', () => {
    const environment: CodexEnvironment = {
      availableModels: [],
    };

    expect(createRecommendedLocalConfig(environment)).toEqual(createDefaultLocalConfig());
  });

  it('uses premium plan defaults when stronger premium models are available', () => {
    const environment: CodexEnvironment = {
      planType: 'plus',
      availableModels: [
        {
          slug: 'gpt-5.4',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium'],
        },
      ],
    };

    const config = createRecommendedLocalConfig(environment);

    expect(config.models).toEqual({
      coordinator: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
      },
      sidecar: {
        model: 'gpt-5.4-mini',
        reasoningEffort: 'medium',
      },
      verifier: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
      },
    });
  });

  it('uses limited-plan priority defaults for constrained model sets', () => {
    const environment: CodexEnvironment = {
      planType: 'free',
      availableModels: [
        {
          slug: 'gpt-5.1-codex-max',
          reasoningEfforts: ['high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium'],
        },
      ],
    };

    const config = createRecommendedLocalConfig(environment);

    expect(config.models).toEqual({
      coordinator: {
        model: 'gpt-5.4-mini',
        reasoningEffort: 'medium',
      },
      sidecar: {
        model: 'gpt-5.4-mini',
        reasoningEffort: 'medium',
      },
      verifier: {
        model: 'gpt-5.4-mini',
        reasoningEffort: 'medium',
      },
    });
  });

  it('ignores gpt-5.1-codex-max when deriving modern model recommendations', () => {
    const environment: CodexEnvironment = {
      planType: 'pro',
      availableModels: [
        {
          slug: 'gpt-5.1-codex-max',
          reasoningEfforts: ['high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium'],
        },
      ],
    };

    const config = createRecommendedLocalConfig(environment);

    expect(config.models).toEqual({
      coordinator: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
      },
      sidecar: {
        model: 'gpt-5.4-mini',
        reasoningEffort: 'medium',
      },
      verifier: {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
      },
    });
  });

  it('derives explorer, implementation, verifier, and realtime subagent presets by task class', () => {
    const environment: CodexEnvironment = {
      planType: 'plus',
      availableModels: [
        {
          slug: 'gpt-5.4',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['low', 'medium', 'high'],
        },
        {
          slug: 'gpt-5.3-codex',
          reasoningEfforts: ['medium', 'high', 'xhigh'],
        },
        {
          slug: 'gpt-5.3-codex-spark',
          reasoningEfforts: ['low', 'medium'],
        },
        {
          slug: 'gpt-5.2',
          reasoningEfforts: ['medium', 'high'],
        },
      ],
    };

    expect(createRecommendedSubagentPreset(environment, 'explorer')).toEqual({
      model: 'gpt-5.4-mini',
      reasoningEffort: 'low',
    });
    expect(createRecommendedSubagentPreset(environment, 'implementation')).toEqual({
      model: 'gpt-5.3-codex',
      reasoningEffort: 'medium',
    });
    expect(createRecommendedSubagentPreset(environment, 'verifier')).toEqual({
      model: 'gpt-5.4',
      reasoningEffort: 'high',
    });
    expect(createRecommendedSubagentPreset(environment, 'realtime')).toEqual({
      model: 'gpt-5.3-codex-spark',
      reasoningEffort: 'low',
    });
  });

  it('falls back cleanly when explorer low reasoning is unavailable', () => {
    const environment: CodexEnvironment = {
      availableModels: [
        {
          slug: 'gpt-5.4-mini',
          reasoningEfforts: ['medium'],
        },
      ],
    };

    expect(createRecommendedSubagentPreset(environment, 'explorer')).toEqual({
      model: 'gpt-5.4-mini',
      reasoningEffort: 'medium',
    });
  });

  it('filters gpt-5.1-codex-max out of detected active models', () => {
    expect(
      detectAvailableModelsFromJson({
        models: [
          {
            slug: 'gpt-5.1-codex-max',
            supported_reasoning_levels: ['high', 'xhigh'],
          },
        ],
      }),
    ).toEqual([]);
  });
});
