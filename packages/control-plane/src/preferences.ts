import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

import {
  createRecommendedLocalConfig,
  createRecommendedModelRoutingPresets,
  createRecommendedSubagentRoutingPresets,
  detectCodexEnvironment,
  enabledPackNames,
  stringifyLocalConfig,
  type CodexEnvironment,
  type DetectedAvailableModel,
  type LocalConfig,
  type ModelPreset,
  type ModelRoutingPresets,
  type ReasoningEffort,
  type SubagentRoutingPresets,
  type TelemetryLevel
} from "@sane/config";
import {
  InventoryScope,
  InventoryStatus,
  OperationKind,
  OperationResult,
  type OperationRewriteMetadata
} from "@sane/core";
import { ensureRuntimeDirs, type CodexPaths, type ProjectPaths } from "@sane/platform";
import { writeCanonicalWithBackupResult } from "@sane/state";

import {
  inspectLocalConfigFamily,
  inspectSavedLocalConfig,
  type LocalConfigFamilySnapshot,
  type SavedLocalConfigState
} from "./local-config.js";

export interface PreferencesSnapshot {
  source: "local" | "recommended";
  models: ReturnType<typeof createRecommendedLocalConfig>["models"];
  derivedRouting: Pick<ModelRoutingPresets, "execution" | "realtime">;
  subagents: Pick<SubagentRoutingPresets, "explorer" | "implementation" | "realtime">;
  modelCapabilities: ModelCapabilitySnapshot;
  telemetry: ReturnType<typeof createRecommendedLocalConfig>["privacy"]["telemetry"];
  telemetryFiles: TelemetrySnapshot;
  enabledPacks: string[];
}

export interface ModelCapabilitySnapshot {
  source: "detected" | "fallback-defaults";
  planType: string | null;
  availableModelCount: number;
  availableModels: DetectedAvailableModel[];
  details: string[];
}

export interface EditablePreferencesConfigSnapshot {
  source: "local" | "recommended";
  current: LocalConfig;
  recommended: LocalConfig;
}

export interface TelemetrySnapshot {
  dirPresent: boolean;
  summaryPresent: boolean;
  eventsPresent: boolean;
  queuePresent: boolean;
}

export interface PreferencesFamilySnapshot {
  editable: EditablePreferencesConfigSnapshot;
  preferences: PreferencesSnapshot;
  telemetry: TelemetrySnapshot;
}

export interface PrivacyTransparencySnapshot {
  consent: TelemetryLevel;
  dir: string;
  telemetry: TelemetrySnapshot;
  summaryPath: string;
  eventsPath: string;
  queuePath: string;
}

export function showConfig(paths: ProjectPaths, codexPaths?: CodexPaths): OperationResult {
  const configState = inspectSavedLocalConfig(paths);
  if (configState.kind !== "loaded") {
    return new OperationResult({
      kind: OperationKind.ShowConfig,
      summary:
        configState.kind === "missing"
          ? `config: missing at ${paths.configPath}`
          : `config: invalid at ${paths.configPath}`,
      details: [],
      pathsTouched: [paths.configPath],
      inventory: [
        {
          name: "config",
          scope: InventoryScope.LocalRuntime,
          status:
            configState.kind === "missing" ? InventoryStatus.Missing : InventoryStatus.Invalid,
          path: paths.configPath,
          repairHint: configState.kind === "missing" ? "run `install`" : "repair config first"
        }
      ]
    });
  }

  const config = configState.config;
  const preferences = codexPaths
    ? inspectPreferencesFamilySnapshotFromContext(
        paths,
        createPreferencesContext(paths, codexPaths, configState)
      ).preferences
    : null;
  return new OperationResult({
    kind: OperationKind.ShowConfig,
    summary: `config: ok at ${paths.configPath}`,
    details: configDetails(config, preferences),
    pathsTouched: [paths.configPath],
    inventory: [
      {
        name: "config",
        scope: InventoryScope.LocalRuntime,
        status: InventoryStatus.Installed,
        path: paths.configPath,
        repairHint: null
      }
    ]
  });
}

export function saveConfig(paths: ProjectPaths, config: LocalConfig): OperationResult {
  ensureRuntimeDirs(paths);
  const telemetryPathsTouched = ensureTelemetryFiles(paths, config.privacy.telemetry);

  const rewrite = operationRewriteMetadata(
    writeCanonicalWithBackupResult(paths.configPath, config, {
      format: "toml",
      stringify: stringifyLocalConfig
    })
  );

  const details: string[] = [];
  appendRewriteDetails(details, rewrite);
  appendTelemetryDetails(details, telemetryPathsTouched);

  return new OperationResult({
    kind: OperationKind.ShowConfig,
    summary: `config: saved at ${paths.configPath}`,
    rewrite,
    details,
    pathsTouched: unique([rewrite.rewrittenPath, rewrite.backupPath, ...telemetryPathsTouched]),
    inventory: [
      {
        name: "config",
        scope: InventoryScope.LocalRuntime,
        status: InventoryStatus.Installed,
        path: paths.configPath,
        repairHint: null
      }
    ]
  });
}

export function resetTelemetryData(paths: ProjectPaths): OperationResult {
  if (!existsSync(paths.telemetryDir)) {
    return new OperationResult({
      kind: OperationKind.ResetTelemetryData,
      summary: "telemetry reset: no local telemetry data present",
      details: [],
      pathsTouched: [paths.telemetryDir],
      inventory: []
    });
  }

  rmSync(paths.telemetryDir, { recursive: true, force: true });
  return new OperationResult({
    kind: OperationKind.ResetTelemetryData,
    summary: "telemetry reset: removed local telemetry data",
    details: [],
    pathsTouched: [paths.telemetryDir],
    inventory: []
  });
}

export function inspectPreferencesSnapshot(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): PreferencesSnapshot {
  return inspectPreferencesFamilySnapshot(paths, codexPaths).preferences;
}

export function inspectEditablePreferencesConfig(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): EditablePreferencesConfigSnapshot {
  return inspectPreferencesFamilySnapshot(paths, codexPaths).editable;
}

export function inspectPreferencesFamilySnapshot(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): PreferencesFamilySnapshot {
  return inspectPreferencesFamilySnapshotFromContext(paths, createPreferencesContext(paths, codexPaths));
}

export function inspectTelemetrySnapshot(paths: ProjectPaths): TelemetrySnapshot {
  return {
    dirPresent: existsSync(paths.telemetryDir),
    summaryPresent: existsSync(paths.telemetrySummaryPath),
    eventsPresent: existsSync(paths.telemetryEventsPath),
    queuePresent: existsSync(paths.telemetryQueuePath)
  };
}

export function inspectPrivacyTransparencySnapshot(
  paths: ProjectPaths,
  consent: TelemetryLevel
): PrivacyTransparencySnapshot {
  return {
    consent,
    dir: paths.telemetryDir,
    telemetry: inspectTelemetrySnapshot(paths),
    summaryPath: paths.telemetrySummaryPath,
    eventsPath: paths.telemetryEventsPath,
    queuePath: paths.telemetryQueuePath
  };
}

interface PreferencesContext {
  environment: CodexEnvironment;
  localConfig: LocalConfigFamilySnapshot;
  derivedRouting: ReturnType<typeof createRecommendedModelRoutingPresets>;
  subagents: ReturnType<typeof createRecommendedSubagentRoutingPresets>;
}

function createPreferencesContext(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  savedConfigState: SavedLocalConfigState = inspectSavedLocalConfig(paths)
): PreferencesContext {
  const environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
  const recommended = createRecommendedLocalConfig(environment);
  const localConfig =
    savedConfigState.kind === "loaded"
      ? {
          source: "local" as const,
          current: savedConfigState.config,
          recommended,
          saved: savedConfigState
        }
      : inspectLocalConfigFamily(paths, recommended);

  return {
    environment,
    localConfig,
    derivedRouting: createRecommendedModelRoutingPresets(environment),
    subagents: createRecommendedSubagentRoutingPresets(environment)
  };
}

function inspectPreferencesFamilySnapshotFromContext(
  paths: ProjectPaths,
  context: PreferencesContext
): PreferencesFamilySnapshot {
  const telemetry = inspectTelemetrySnapshot(paths);
  return {
    editable: {
      source: context.localConfig.source,
      current: context.localConfig.current,
      recommended: context.localConfig.recommended
    },
    preferences: {
      source: context.localConfig.source,
      models: context.localConfig.current.models,
      derivedRouting: {
        execution: context.derivedRouting.execution,
        realtime: context.derivedRouting.realtime
      },
      subagents: {
        explorer: context.subagents.explorer,
        implementation: context.subagents.implementation,
        realtime: context.subagents.realtime
      },
      modelCapabilities: buildModelCapabilitySnapshot(
        context.environment,
        context.localConfig.current,
        context.derivedRouting,
        context.subagents
      ),
      telemetry: context.localConfig.current.privacy.telemetry,
      telemetryFiles: telemetry,
      enabledPacks: enabledPackNames(context.localConfig.current.packs)
    },
    telemetry
  };
}

function buildModelCapabilitySnapshot(
  environment: CodexEnvironment,
  config: LocalConfig,
  routing: ModelRoutingPresets,
  subagents: SubagentRoutingPresets
): ModelCapabilitySnapshot {
  const source = environment.availableModels.length > 0 ? "detected" : "fallback-defaults";
  const planType = environment.planType ?? null;
  const details = [
    source === "detected"
      ? `model availability: detected ${environment.availableModels.length} model(s) from Codex cache (plan ${planType ?? "unknown"})`
      : `model availability: no Codex model cache; using Sane defaults (plan ${planType ?? "unknown"})`,
    environment.availableModels.length > 0
      ? `available models: ${environment.availableModels.map(formatAvailableModel).join(", ")}`
      : "available models: unknown"
  ];

  details.push(
    capabilityLine("coordinator", config.models.coordinator, environment.availableModels),
    capabilityLine("sidecar", config.models.sidecar, environment.availableModels),
    capabilityLine("verifier", config.models.verifier, environment.availableModels),
    capabilityLine("explorer", subagents.explorer, environment.availableModels),
    capabilityLine("implementation", routing.execution, environment.availableModels),
    capabilityLine("realtime", routing.realtime, environment.availableModels)
  );

  return {
    source,
    planType,
    availableModelCount: environment.availableModels.length,
    availableModels: environment.availableModels,
    details
  };
}

function formatAvailableModel(model: DetectedAvailableModel): string {
  return `${model.slug} [${model.reasoningEfforts.join(", ")}]`;
}

function capabilityLine(
  label: string,
  preset: ModelPreset,
  availableModels: readonly DetectedAvailableModel[]
): string {
  const detected = availableModels.find((model) => model.slug === preset.model);
  if (!detected) {
    return `${label} capability: ${preset.model} not in detected cache; selected ${preset.reasoningEffort}`;
  }

  return `${label} capability: ${preset.model} supports ${formatReasoningEfforts(detected.reasoningEfforts)}; selected ${preset.reasoningEffort}`;
}

function formatReasoningEfforts(reasoningEfforts: readonly ReasoningEffort[]): string {
  return reasoningEfforts.join("/");
}

function configDetails(
  config: LocalConfig,
  preferences: PreferencesSnapshot | null
): string[] {
  const lines = [
    `version: ${config.version}`,
    `coordinator: ${config.models.coordinator.model} (${config.models.coordinator.reasoningEffort})`,
    `sidecar: ${config.models.sidecar.model} (${config.models.sidecar.reasoningEffort})`,
    `verifier: ${config.models.verifier.model} (${config.models.verifier.reasoningEffort})`,
    `telemetry: ${config.privacy.telemetry}`,
    `packs: ${enabledPackNames(config.packs).join(", ")}`
  ];

  if (!preferences) {
    lines.splice(
      4,
      0,
      `derived routing: inspect Preferences for explorer, execution, and realtime defaults from detected model availability`
    );
    return lines;
  }

  lines.splice(
    4,
    0,
    ...preferences.modelCapabilities.details,
    `explorer: ${formatPreset(preferences.subagents.explorer)} (derived)`,
    `execution: ${formatPreset(preferences.derivedRouting.execution)} (derived)`,
    `realtime: ${formatPreset(preferences.derivedRouting.realtime)} (derived)`,
    `telemetry files: summary ${presentFlag(preferences.telemetryFiles.summaryPresent)}, events ${presentFlag(preferences.telemetryFiles.eventsPresent)}, queue ${presentFlag(preferences.telemetryFiles.queuePresent)}`
  );

  return lines;
}

function formatPreset(preset: ModelPreset): string {
  return `${preset.model} (${preset.reasoningEffort})`;
}

function presentFlag(value: boolean): string {
  return value ? "present" : "missing";
}

function ensureTelemetryFiles(paths: ProjectPaths, level: TelemetryLevel): string[] {
  if (level === "off") {
    rmSync(paths.telemetryDir, { recursive: true, force: true });
    return [paths.telemetryDir];
  }

  mkdirSync(paths.telemetryDir, { recursive: true });
  ensureFileWithDefault(paths.telemetrySummaryPath, '{\n  "version": 1\n}\n');
  ensureFileWithDefault(paths.telemetryEventsPath, "");

  if (level === "product-improvement") {
    ensureFileWithDefault(paths.telemetryQueuePath, "");
    return [paths.telemetrySummaryPath, paths.telemetryEventsPath, paths.telemetryQueuePath];
  }

  rmSync(paths.telemetryQueuePath, { force: true });
  return [paths.telemetrySummaryPath, paths.telemetryEventsPath, paths.telemetryQueuePath];
}

function ensureFileWithDefault(path: string, body: string): void {
  if (!existsSync(path)) {
    writeFileSync(path, body, "utf8");
  }
}

function operationRewriteMetadata(rewrite: {
  rewrittenPath: string;
  backupPath: string | null;
  firstWrite: boolean;
}): OperationRewriteMetadata {
  return {
    rewrittenPath: rewrite.rewrittenPath,
    backupPath: rewrite.backupPath,
    firstWrite: rewrite.firstWrite
  };
}

function appendRewriteDetails(details: string[], rewrite: OperationRewriteMetadata): void {
  details.push(`rewritten path: ${rewrite.rewrittenPath}`);
  if (rewrite.backupPath) {
    details.push(`backup path: ${rewrite.backupPath}`);
  }
  details.push(`write mode: ${rewrite.firstWrite ? "first write" : "rewrite"}`);
}

function appendTelemetryDetails(details: string[], pathsTouched: readonly string[]): void {
  for (const path of pathsTouched) {
    details.push(`telemetry path: ${path}`);
  }
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}
