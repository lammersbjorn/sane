import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { parse as parseToml } from 'toml';
import { z } from 'zod';

export const AVAILABLE_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.2',
  'gpt-5-codex',
  'gpt-5.1-codex',
  'gpt-5.1-codex-mini',
] as const;

export const PICKER_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.2',
  'gpt-5.1-codex',
  'gpt-5.1-codex-mini',
  'gpt-5-codex',
] as const;

export const REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
export const TELEMETRY_LEVELS = ['off', 'local-only', 'product-improvement'] as const;

export type AvailableModel = (typeof AVAILABLE_MODELS)[number];
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];
export type TelemetryLevel = (typeof TELEMETRY_LEVELS)[number];

export interface ModelPreset {
  model: string;
  reasoningEffort: ReasoningEffort;
}

export interface ModelRolePresets {
  coordinator: ModelPreset;
  sidecar: ModelPreset;
  verifier: ModelPreset;
}

export interface ModelRoutingPresets {
  coordinator: ModelPreset;
  execution: ModelPreset;
  sidecar: ModelPreset;
  verifier: ModelPreset;
  realtime: ModelPreset;
}

export interface SubagentRoutingPresets {
  explorer: ModelPreset;
  implementation: ModelPreset;
  verifier: ModelPreset;
  realtime: ModelPreset;
  frontendCraft: ModelPreset;
}

export type SubagentTaskClass =
  | 'explorer'
  | 'implementation'
  | 'verifier'
  | 'realtime'
  | 'frontendCraft';

export interface DetectedAvailableModel {
  slug: string;
  reasoningEfforts: ReasoningEffort[];
}

export interface CodexEnvironment {
  planType?: string;
  availableModels: DetectedAvailableModel[];
}

export interface PrivacyConfig {
  telemetry: TelemetryLevel;
}

export interface PackConfig {
  core: boolean;
  caveman: boolean;
  rtk: boolean;
  frontendCraft: boolean;
}

export interface LifecycleHooksConfig {
  tokscaleSubmit: boolean;
  tokscaleDryRun: boolean;
  rateLimitResume: boolean;
}

export interface LocalConfig {
  version: number;
  models: ModelRolePresets;
  subagents: SubagentRoutingPresets;
  privacy: PrivacyConfig;
  packs: PackConfig;
  lifecycleHooks: LifecycleHooksConfig;
}

const reasoningEffortSchema = z.enum(REASONING_EFFORTS);
const telemetryLevelSchema = z.enum(TELEMETRY_LEVELS);
const COORDINATOR_PRIORITY = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2',
  'gpt-5.4-mini',
  'gpt-5.3-codex-spark',
  'gpt-5.1-codex',
  'gpt-5-codex',
  'gpt-5.1-codex-mini',
] as const;
const EXECUTION_PRIORITY = [
  'gpt-5.3-codex',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.2',
  'gpt-5.3-codex-spark',
  'gpt-5.1-codex',
  'gpt-5-codex',
  'gpt-5.4-mini',
  'gpt-5.1-codex-mini',
] as const;
const SIDECAR_PRIORITY = [
  'gpt-5.4-mini',
  'gpt-5.3-codex-spark',
  'gpt-5.3-codex',
  'gpt-5.4',
  'gpt-5.5',
  'gpt-5.2',
  'gpt-5.1-codex-mini',
  'gpt-5.1-codex',
  'gpt-5-codex',
] as const;
const VERIFIER_PRIORITY = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2',
  'gpt-5.4-mini',
  'gpt-5.3-codex-spark',
  'gpt-5.1-codex',
  'gpt-5-codex',
  'gpt-5.1-codex-mini',
] as const;
const REALTIME_PRIORITY = [
  'gpt-5.3-codex-spark',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.4',
  'gpt-5.5',
  'gpt-5.2',
  'gpt-5.1-codex-mini',
  'gpt-5.1-codex',
  'gpt-5-codex',
] as const;
const FRONTEND_CRAFT_PRIORITY = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2',
  'gpt-5.4-mini',
  'gpt-5.3-codex-spark',
  'gpt-5.1-codex',
  'gpt-5-codex',
  'gpt-5.1-codex-mini',
] as const;
const COORDINATOR_REASONING: readonly ReasoningEffort[] = ['high', 'xhigh', 'medium', 'low'];
const EXECUTION_REASONING: readonly ReasoningEffort[] = ['medium', 'high', 'low', 'xhigh'];
const SIDECAR_REASONING: readonly ReasoningEffort[] = ['medium', 'low', 'high', 'xhigh'];
const VERIFIER_REASONING: readonly ReasoningEffort[] = ['high', 'medium', 'xhigh', 'low'];
const REALTIME_REASONING: readonly ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh'];
const FRONTEND_CRAFT_REASONING: readonly ReasoningEffort[] = ['high', 'xhigh', 'medium', 'low'];
const COORDINATOR_REASONING_BY_MODEL: Record<string, readonly ReasoningEffort[]> = {
  'gpt-5.5': ['medium', 'high', 'xhigh', 'low'],
};
const DEFAULT_RECOMMENDATION_ENVIRONMENT: CodexEnvironment = {
  availableModels: AVAILABLE_MODELS.map((slug) => ({
    slug,
    reasoningEfforts: [...REASONING_EFFORTS],
  })),
};

const modelPresetSchema = z.object({
  model: z.string(),
  reasoningEffort: reasoningEffortSchema,
});

const modelRolePresetsSchema = z.object({
  coordinator: modelPresetSchema,
  sidecar: modelPresetSchema,
  verifier: modelPresetSchema,
});

const privacyConfigSchema = z.object({
  telemetry: telemetryLevelSchema,
});

const packConfigSchema = z
  .object({
    core: z.boolean(),
    caveman: z.boolean().default(false),
    rtk: z.boolean().default(false),
    frontendCraft: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.core) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'core pack must stay enabled',
      });
    }
  });

const lifecycleHooksConfigSchema = z.object({
  tokscaleSubmit: z.boolean().default(false),
  tokscaleDryRun: z.boolean().default(true),
  rateLimitResume: z.boolean().default(false),
});

const localConfigSchema = z.object({
  version: z.literal(1),
  models: modelRolePresetsSchema.default(createDefaultModelRolePresets),
  subagents: z.object({
    explorer: modelPresetSchema,
    implementation: modelPresetSchema,
    verifier: modelPresetSchema,
    realtime: modelPresetSchema,
    frontendCraft: modelPresetSchema.default(
      () => createDefaultSubagentRoutingPresets().frontendCraft,
    ),
  }).default(createDefaultSubagentRoutingPresets),
  privacy: privacyConfigSchema.default(createDefaultPrivacyConfig),
  packs: packConfigSchema.default(createDefaultPackConfig),
  lifecycleHooks: lifecycleHooksConfigSchema.default(createDefaultLifecycleHooksConfig),
});

export function createDefaultModelRolePresets(): ModelRolePresets {
  const routing = createDefaultModelRoutingPresets();

  return {
    coordinator: routing.coordinator,
    sidecar: routing.sidecar,
    verifier: routing.verifier,
  };
}

export function createDefaultModelRoutingPresets(): ModelRoutingPresets {
  return createRecommendedModelRoutingPresets(DEFAULT_RECOMMENDATION_ENVIRONMENT);
}

export function createDefaultSubagentRoutingPresets(): SubagentRoutingPresets {
  return createRecommendedSubagentRoutingPresets(DEFAULT_RECOMMENDATION_ENVIRONMENT);
}

export function createDefaultPrivacyConfig(): PrivacyConfig {
  return {
    telemetry: 'off',
  };
}

export function createDefaultPackConfig(): PackConfig {
  return {
    core: true,
    caveman: false,
    rtk: false,
    frontendCraft: false,
  };
}

export function createDefaultLifecycleHooksConfig(): LifecycleHooksConfig {
  return {
    tokscaleSubmit: false,
    tokscaleDryRun: true,
    rateLimitResume: false,
  };
}

export function createDefaultLocalConfig(): LocalConfig {
  return {
    version: 1,
    models: createDefaultModelRolePresets(),
    subagents: createDefaultSubagentRoutingPresets(),
    privacy: createDefaultPrivacyConfig(),
    packs: createDefaultPackConfig(),
    lifecycleHooks: createDefaultLifecycleHooksConfig(),
  };
}

export function createRecommendedModelRolePresets(
  environment: CodexEnvironment,
): ModelRolePresets {
  const routing = createRecommendedModelRoutingPresets(environment);

  return {
    coordinator: routing.coordinator,
    sidecar: routing.sidecar,
    verifier: routing.verifier,
  };
}

export function createRecommendedModelRoutingPresets(
  environment: CodexEnvironment,
): ModelRoutingPresets {
  if (environment.availableModels.length === 0) {
    return createDefaultModelRoutingPresets();
  }

  return {
    coordinator:
      pickModelPreset(
        environment.availableModels,
        COORDINATOR_PRIORITY,
        COORDINATOR_REASONING,
        COORDINATOR_REASONING_BY_MODEL,
      ) ??
      selectAvailableModelPreset(environment.availableModels, true, COORDINATOR_REASONING)!,
    execution:
      pickModelPreset(environment.availableModels, EXECUTION_PRIORITY, EXECUTION_REASONING) ??
      selectAvailableModelPreset(environment.availableModels, true, EXECUTION_REASONING)!,
    sidecar:
      pickModelPreset(environment.availableModels, SIDECAR_PRIORITY, SIDECAR_REASONING) ??
      selectAvailableModelPreset(environment.availableModels, false, SIDECAR_REASONING)!,
    verifier:
      pickModelPreset(environment.availableModels, VERIFIER_PRIORITY, VERIFIER_REASONING) ??
      selectAvailableModelPreset(environment.availableModels, true, VERIFIER_REASONING)!,
    realtime:
      pickModelPreset(environment.availableModels, REALTIME_PRIORITY, REALTIME_REASONING) ??
      selectAvailableModelPreset(environment.availableModels, false, REALTIME_REASONING)!,
  };
}

export function createRecommendedLocalConfig(environment: CodexEnvironment): LocalConfig {
  return {
    version: 1,
    models: createRecommendedModelRolePresets(environment),
    subagents: createRecommendedSubagentRoutingPresets(environment),
    privacy: createDefaultPrivacyConfig(),
    packs: createDefaultPackConfig(),
    lifecycleHooks: createDefaultLifecycleHooksConfig(),
  };
}

export function createRecommendedSubagentRoutingPresets(
  environment: CodexEnvironment,
): SubagentRoutingPresets {
  return {
    explorer: createRecommendedSubagentPreset(environment, 'explorer'),
    implementation: createRecommendedSubagentPreset(environment, 'implementation'),
    verifier: createRecommendedSubagentPreset(environment, 'verifier'),
    realtime: createRecommendedSubagentPreset(environment, 'realtime'),
    frontendCraft: createRecommendedSubagentPreset(environment, 'frontendCraft'),
  };
}

export function createRecommendedSubagentPreset(
  environment: CodexEnvironment,
  taskClass: SubagentTaskClass,
): ModelPreset {
  const routing = createRecommendedModelRoutingPresets(environment);

  switch (taskClass) {
    case 'explorer':
      return {
        model: routing.sidecar.model,
        reasoningEffort: pickReasoningForModel(
          environment.availableModels,
          routing.sidecar.model,
          ['low', 'medium', 'high', 'xhigh'],
          'low',
        ),
      };
    case 'implementation':
      return routing.execution;
    case 'verifier':
      return routing.verifier;
    case 'realtime':
      return routing.realtime;
    case 'frontendCraft':
      return (
        pickModelPreset(
          environment.availableModels,
          FRONTEND_CRAFT_PRIORITY,
          FRONTEND_CRAFT_REASONING,
        ) ??
        selectAvailableModelPreset(
          environment.availableModels,
          true,
          FRONTEND_CRAFT_REASONING,
        ) ??
        createDefaultSubagentRoutingPresets().frontendCraft
      );
  }
}

export function detectAvailableModelsFromJson(json: unknown): DetectedAvailableModel[] {
  const modelEntries =
    (isRecord(json) && Array.isArray(json.models) ? json.models : undefined) ??
    (Array.isArray(json) ? json : []);
  const detected = modelEntries.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      return [];
    }

    const slug = firstString(entry.slug, entry.id, entry.name);
    if (!slug || !isAvailableModel(slug)) {
      return [];
    }

    const reasoning = new Set<ReasoningEffort>();
    collectReasoningEfforts(entry.supported_reasoning_levels, reasoning);
    collectReasoningEfforts(entry.supported_reasoning_efforts, reasoning);
    collectReasoningEfforts(entry.reasoning_efforts, reasoning);

    const defaultReasoningLevel = normalizeReasoningEffort(entry.default_reasoning_level);
    if (reasoning.size === 0 && defaultReasoningLevel) {
      reasoning.add(defaultReasoningLevel);
    }
    if (reasoning.size === 0) {
      reasoning.add('medium');
    }

    return [
      {
        slug,
        reasoningEfforts: REASONING_EFFORTS.filter((candidate) => reasoning.has(candidate)),
        priority: parseModelPriority(entry.priority) ?? Number.MAX_SAFE_INTEGER,
        index,
      },
    ];
  });

  detected.sort(
    (left, right) =>
      left.priority - right.priority ||
      left.index - right.index ||
      left.slug.localeCompare(right.slug),
  );

  const deduped: DetectedAvailableModel[] = [];
  const seen = new Set<string>();
  for (const model of detected) {
    if (seen.has(model.slug)) {
      continue;
    }
    seen.add(model.slug);
    deduped.push({
      slug: model.slug,
      reasoningEfforts: model.reasoningEfforts,
    });
  }

  return deduped;
}

export function detectPlanTypeFromJson(json: unknown): string | undefined {
  return (
    detectPlanTypeInObject(json) ||
    (isRecord(json) ? detectPlanTypeInObject(json['https://api.openai.com/auth']) : undefined)
  );
}

export function detectCodexEnvironment(
  modelsCachePath: string,
  authPath: string,
): CodexEnvironment {
  return {
    planType: detectPlanType(authPath),
    availableModels: detectAvailableModels(modelsCachePath),
  };
}

export function parseLocalConfigToml(raw: string, path = 'config.local.toml'): LocalConfig {
  let decoded: unknown;
  try {
    decoded = parseToml(raw);
  } catch (error) {
    throw new Error(`failed to parse config from ${path}: ${messageOf(error)}`);
  }

  return parseLocalConfig(decoded, path);
}

export function readLocalConfig(path: string): LocalConfig {
  try {
    return parseLocalConfigToml(readFileSync(path, 'utf8'), path);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('failed to')) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('invalid config at')) {
      throw error;
    }
    throw new Error(`failed to read config from ${path}: ${messageOf(error)}`);
  }
}

export function writeLocalConfig(path: string, config: LocalConfig): void {
  validateLocalConfig(config, path);

  try {
    writeAtomicTextFile(path, stringifyLocalConfig(config));
  } catch (error) {
    throw new Error(`failed to write config to ${path}: ${messageOf(error)}`);
  }
}

function writeAtomicTextFile(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp.${process.hrtime.bigint()}`;

  try {
    writeFileSync(tmpPath, body, { encoding: 'utf8', flag: 'wx' });
    renameSync(tmpPath, path);
  } catch (error) {
    try {
      rmSync(tmpPath, { force: true });
    } catch {
      // Ignore cleanup failures on an already failing write path.
    }
    throw error;
  }
}

export function stringifyLocalConfig(config: LocalConfig): string {
  const normalized = validateLocalConfig(config);

  return [
    `version = ${normalized.version}`,
    '',
    '[models.coordinator]',
    `model = ${quote(normalized.models.coordinator.model)}`,
    `reasoning_effort = ${quote(normalized.models.coordinator.reasoningEffort)}`,
    '',
    '[models.sidecar]',
    `model = ${quote(normalized.models.sidecar.model)}`,
    `reasoning_effort = ${quote(normalized.models.sidecar.reasoningEffort)}`,
    '',
    '[models.verifier]',
    `model = ${quote(normalized.models.verifier.model)}`,
    `reasoning_effort = ${quote(normalized.models.verifier.reasoningEffort)}`,
    '',
    '[subagents.explorer]',
    `model = ${quote(normalized.subagents.explorer.model)}`,
    `reasoning_effort = ${quote(normalized.subagents.explorer.reasoningEffort)}`,
    '',
    '[subagents.implementation]',
    `model = ${quote(normalized.subagents.implementation.model)}`,
    `reasoning_effort = ${quote(normalized.subagents.implementation.reasoningEffort)}`,
    '',
    '[subagents.verifier]',
    `model = ${quote(normalized.subagents.verifier.model)}`,
    `reasoning_effort = ${quote(normalized.subagents.verifier.reasoningEffort)}`,
    '',
    '[subagents.realtime]',
    `model = ${quote(normalized.subagents.realtime.model)}`,
    `reasoning_effort = ${quote(normalized.subagents.realtime.reasoningEffort)}`,
    '',
    '[subagents."frontend-craft"]',
    `model = ${quote(normalized.subagents.frontendCraft.model)}`,
    `reasoning_effort = ${quote(normalized.subagents.frontendCraft.reasoningEffort)}`,
    '',
    '[privacy]',
    `telemetry = ${quote(normalized.privacy.telemetry)}`,
    '',
    '[packs]',
    `core = ${normalized.packs.core}`,
    `caveman = ${normalized.packs.caveman}`,
    `rtk = ${normalized.packs.rtk}`,
    `"frontend-craft" = ${normalized.packs.frontendCraft}`,
    '',
    '[lifecycle-hooks]',
    `"tokscale-submit" = ${normalized.lifecycleHooks.tokscaleSubmit}`,
    `"tokscale-dry-run" = ${normalized.lifecycleHooks.tokscaleDryRun}`,
    `"rate-limit-resume" = ${normalized.lifecycleHooks.rateLimitResume}`,
    '',
  ].join('\n');
}

export function enabledPackNames(config: PackConfig): string[] {
  const enabled: string[] = [];
  if (config.core) {
    enabled.push('core');
  }
  if (config.caveman) {
    enabled.push('caveman');
  }
  if (config.rtk) {
    enabled.push('rtk');
  }
  if (config.frontendCraft) {
    enabled.push('frontend-craft');
  }
  return enabled;
}

export function validateLocalConfig(config: LocalConfig, path = 'config.local.toml'): LocalConfig {
  return validateNormalizedLocalConfig(normalizeLocalConfigInput(config), path);
}

function parseLocalConfig(value: unknown, path: string): LocalConfig {
  return validateNormalizedLocalConfig(normalizeLocalConfigInput(value), path);
}

function normalizeLocalConfigInput(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const models = isRecord(value.models)
    ? {
        coordinator: normalizeModelPreset(value.models.coordinator),
        sidecar: normalizeModelPreset(value.models.sidecar),
        verifier: normalizeModelPreset(value.models.verifier),
      }
    : undefined;

  const privacy = isRecord(value.privacy)
    ? {
        telemetry: value.privacy.telemetry,
      }
    : undefined;

  const subagents = isRecord(value.subagents)
    ? {
        explorer: normalizeModelPreset(value.subagents.explorer),
        implementation: normalizeModelPreset(value.subagents.implementation),
        verifier: normalizeModelPreset(value.subagents.verifier),
        realtime: normalizeModelPreset(value.subagents.realtime),
        frontendCraft: normalizeModelPreset(
          value.subagents['frontend-craft'] ?? value.subagents.frontendCraft,
        ),
      }
    : undefined;

  const packs = isRecord(value.packs)
    ? {
        core: value.packs.core,
        caveman: value.packs.caveman,
        rtk: value.packs.rtk,
        frontendCraft: value.packs['frontend-craft'] ?? value.packs.frontendCraft,
      }
    : undefined;

  const rawLifecycleHooks = isRecord(value['lifecycle-hooks'])
    ? value['lifecycle-hooks']
    : isRecord(value.lifecycleHooks)
      ? value.lifecycleHooks
      : undefined;
  const lifecycleHooks = rawLifecycleHooks
    ? {
        tokscaleSubmit: rawLifecycleHooks['tokscale-submit'] ?? rawLifecycleHooks.tokscaleSubmit,
        tokscaleDryRun: rawLifecycleHooks['tokscale-dry-run'] ?? rawLifecycleHooks.tokscaleDryRun,
        rateLimitResume: rawLifecycleHooks['rate-limit-resume'] ?? rawLifecycleHooks.rateLimitResume,
      }
    : undefined;

  return {
    version: value.version,
    models,
    subagents,
    privacy,
    packs,
    lifecycleHooks,
  };
}

function normalizeModelPreset(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return {
    model: value.model,
    reasoningEffort: value.reasoning_effort ?? value.reasoningEffort,
  };
}

function isAvailableModel(model: string): model is AvailableModel {
  return (AVAILABLE_MODELS as readonly string[]).includes(model);
}

function detectAvailableModels(path: string): DetectedAvailableModel[] {
  if (!existsSync(path)) {
    return [];
  }

  const raw = readJsonFile(path, `failed to read models cache from ${path}: `);
  try {
    return detectAvailableModelsFromJson(JSON.parse(raw) as unknown);
  } catch (error) {
    throw new Error(`failed to parse models cache from ${path}: ${messageOf(error)}`);
  }
}

function detectPlanType(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  const raw = readJsonFile(path, `failed to read auth file from ${path}: `);
  try {
    return detectPlanTypeFromJson(JSON.parse(raw) as unknown);
  } catch (error) {
    throw new Error(`failed to parse auth file from ${path}: ${messageOf(error)}`);
  }
}

function validateNormalizedLocalConfig(value: unknown, path: string): LocalConfig {
  const parsed = localConfigSchema.safeParse(value);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new Error(`invalid config at ${path}: ${firstIssue?.message ?? 'validation failed'}`);
  }

  for (const role of ['coordinator', 'sidecar', 'verifier'] as const) {
    const model = parsed.data.models[role].model;
    if (!isAvailableModel(model)) {
      throw new Error(
        `invalid config at ${path}: ${role} model \`${model}\` is not in the supported Codex model set`,
      );
    }
  }
  for (const role of [
    'explorer',
    'implementation',
    'verifier',
    'realtime',
    'frontendCraft',
  ] as const) {
    const model = parsed.data.subagents[role].model;
    if (!isAvailableModel(model)) {
      throw new Error(
        `invalid config at ${path}: ${role} subagent model \`${model}\` is not in the supported Codex model set`,
      );
    }
  }

  return parsed.data;
}

function collectReasoningEfforts(value: unknown, reasoning: Set<ReasoningEffort>): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const level of value) {
    const effort = isRecord(level)
      ? firstString(level.effort, level.reasoning_effort)
      : typeof level === 'string'
        ? level
        : undefined;
    const normalized = normalizeReasoningEffort(effort);
    if (normalized) {
      reasoning.add(normalized);
    }
  }
}

function detectPlanTypeInObject(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const planType = firstString(value.chatgpt_plan_type, value.plan_type);
  if (planType) {
    return planType;
  }

  const token = firstString(
    isRecord(value.tokens) ? value.tokens.id_token : undefined,
    isRecord(value.tokens) ? value.tokens.access_token : undefined,
    value.id_token,
    value.access_token,
  );
  if (!token) {
    return undefined;
  }

  const claims = decodeJwtPayload(token);
  return (
    detectPlanTypeInObject(claims) ||
    (isRecord(claims)
      ? detectPlanTypeInObject(claims['https://api.openai.com/auth'])
      : undefined)
  );
}

function decodeJwtPayload(token: string): unknown {
  const payload = token.split('.')[1];
  if (!payload) {
    return undefined;
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as unknown;
  } catch {
    return undefined;
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function parseModelPriority(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }
  return undefined;
}

function pickModelPreset(
  availableModels: readonly DetectedAvailableModel[],
  priority: readonly string[],
  reasoningPriority: readonly ReasoningEffort[],
  reasoningPriorityByModel: Readonly<Record<string, readonly ReasoningEffort[]>> = {},
): ModelPreset | undefined {
  for (const slug of priority) {
    const model = availableModels.find((candidate) => candidate.slug === slug);
    if (!model) {
      continue;
    }

    const candidateReasoningPriority = reasoningPriorityByModel[slug] ?? reasoningPriority;
    const reasoningEffort =
      candidateReasoningPriority.find((candidate) => model.reasoningEfforts.includes(candidate)) ??
      model.reasoningEfforts[0];
    if (!reasoningEffort) {
      continue;
    }

    return {
      model: model.slug,
      reasoningEffort,
    };
  }

  return undefined;
}

function pickReasoningForModel(
  availableModels: readonly DetectedAvailableModel[],
  model: string,
  reasoningPriority: readonly ReasoningEffort[],
  fallback: ReasoningEffort,
): ReasoningEffort {
  const detected = availableModels.find((candidate) => candidate.slug === model);
  if (!detected) {
    return fallback;
  }

  const reasoningEffort =
    reasoningPriority.find((candidate) => detected.reasoningEfforts.includes(candidate)) ??
    detected.reasoningEfforts[0];

  return reasoningEffort ?? fallback;
}

function selectAvailableModelPreset(
  availableModels: readonly DetectedAvailableModel[],
  strongest: boolean,
  reasoningPriority: readonly ReasoningEffort[],
): ModelPreset | undefined {
  const model = strongest ? availableModels[0] : availableModels[availableModels.length - 1];
  if (!model) {
    return undefined;
  }

  const reasoningEffort =
    reasoningPriority.find((candidate) => model.reasoningEfforts.includes(candidate)) ??
    model.reasoningEfforts[0];
  if (!reasoningEffort) {
    return undefined;
  }

  return {
    model: model.slug,
    reasoningEffort,
  };
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string');
}

function normalizeReasoningEffort(value: unknown): ReasoningEffort | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.toLowerCase();
  return REASONING_EFFORTS.find((candidate) => candidate === normalized);
}

function readJsonFile(path: string, prefix: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`${prefix}${messageOf(error)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
