import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

import {
  createRecommendedLocalConfig,
  createRecommendedModelRoutingPresets,
  createRecommendedSubagentRoutingPresets,
  detectCodexEnvironment,
  enabledPackNames,
  stringifyLocalConfig,
  type LocalConfig,
  type ModelPreset,
  type ModelRoutingPresets,
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

import { inspectSavedLocalConfig, loadOrRecommendedLocalConfig } from "./local-config.js";

export interface PreferencesSnapshot {
  source: "local" | "recommended";
  models: ReturnType<typeof createRecommendedLocalConfig>["models"];
  derivedRouting: Pick<ModelRoutingPresets, "execution" | "realtime">;
  subagents: Pick<SubagentRoutingPresets, "explorer" | "implementation" | "realtime">;
  telemetry: ReturnType<typeof createRecommendedLocalConfig>["privacy"]["telemetry"];
  telemetryFiles: TelemetrySnapshot;
  enabledPacks: string[];
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
  return new OperationResult({
    kind: OperationKind.ShowConfig,
    summary: `config: ok at ${paths.configPath}`,
    details: configDetails(
      config,
      codexPaths ? inspectPreferencesSnapshot(paths, codexPaths) : null
    ),
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
  ensureTelemetryFiles(paths, config.privacy.telemetry);

  const rewrite = operationRewriteMetadata(
    writeCanonicalWithBackupResult(paths.configPath, config, {
      format: "toml",
      stringify: stringifyLocalConfig
    })
  );

  const details: string[] = [];
  appendRewriteDetails(details, rewrite);

  return new OperationResult({
    kind: OperationKind.ShowConfig,
    summary: `config: saved at ${paths.configPath}`,
    rewrite,
    details,
    pathsTouched: unique([rewrite.rewrittenPath, rewrite.backupPath]),
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
  const snapshot = inspectEditablePreferencesConfig(paths, codexPaths);
  const environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
  const routing = createRecommendedModelRoutingPresets(environment);
  const subagents = createRecommendedSubagentRoutingPresets(environment);
  return {
    source: snapshot.source,
    models: snapshot.current.models,
    derivedRouting: {
      execution: routing.execution,
      realtime: routing.realtime
    },
    subagents: {
      explorer: subagents.explorer,
      implementation: subagents.implementation,
      realtime: subagents.realtime
    },
    telemetry: snapshot.current.privacy.telemetry,
    telemetryFiles: inspectTelemetrySnapshot(paths),
    enabledPacks: enabledPackNames(snapshot.current.packs)
  };
}

export function inspectEditablePreferencesConfig(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): EditablePreferencesConfigSnapshot {
  const recommended = createRecommendedLocalConfig(
    detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson)
  );
  const current = loadOrRecommendedLocalConfig(paths, recommended);

  return {
    source: inspectSavedLocalConfig(paths).kind === "loaded" ? "local" : "recommended",
    current,
    recommended
  };
}

export function inspectTelemetrySnapshot(paths: ProjectPaths): TelemetrySnapshot {
  return {
    dirPresent: existsSync(paths.telemetryDir),
    summaryPresent: existsSync(paths.telemetrySummaryPath),
    eventsPresent: existsSync(paths.telemetryEventsPath),
    queuePresent: existsSync(paths.telemetryQueuePath)
  };
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

function ensureTelemetryFiles(paths: ProjectPaths, level: TelemetryLevel): void {
  if (level === "off") {
    return;
  }

  mkdirSync(paths.telemetryDir, { recursive: true });
  ensureFileWithDefault(paths.telemetrySummaryPath, '{\n  "version": 1\n}\n');
  ensureFileWithDefault(paths.telemetryEventsPath, "");

  if (level === "product-improvement") {
    ensureFileWithDefault(paths.telemetryQueuePath, "");
  }
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

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}
