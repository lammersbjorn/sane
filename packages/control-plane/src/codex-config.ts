import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

import { createRecommendedLocalConfig, detectCodexEnvironment, type LocalConfig } from "@sane/config";
import { InventoryScope, InventoryStatus, OperationKind, OperationResult } from "@sane/core";
import { type CodexPaths, ensureRuntimeDirs, type ProjectPaths } from "@sane/platform";
import { writeAtomicTextFile } from "@sane/state";

import {
  applyCloudflareProfileToValue,
  applyCoreCodexProfileToValue,
  applyIntegrationsProfileToValue,
  applyStatuslineProfileToValue,
  inspectCloudflareProfileApplyResultFromContext,
  inspectCloudflareProfileAuditFromContext,
  inspectCodexProfileApplyResultFromContext,
  inspectCodexProfileAuditFromContext,
  inspectIntegrationsProfileApplyResultFromContext,
  inspectIntegrationsProfileAuditFromContext,
  inspectStatuslineProfileApplyResultFromContext,
  inspectStatuslineProfileAuditFromContext
} from "./codex-config-profile-logic.js";
import {
  previewCloudflareProfileFromAudit,
  previewCodexProfileFromAudit,
  previewIntegrationsProfileFromAudit,
  previewStatuslineProfileFromAudit
} from "./codex-config-profile-preview.js";
import { synthesizeCodexConfigConflictWarnings } from "./codex-config-conflict-warnings.js";
import { asPlainRecord, clonePlainRecord, isPlainRecord, type PlainRecord } from "./config-object.js";
import { buildSaneCompactPrompt } from "./session-start-hook.js";

type TomlTable = PlainRecord;

export interface IntegrationsProfileAudit {
  status: "installed" | "missing" | "invalid";
  recommendedChangeCount: number;
  recommendedTargets: string[];
  optionalTargets: string[];
  details: string[];
}

export type IntegrationsProfileStatus = IntegrationsProfileAudit["status"];
export type IntegrationsProfileApplyResultStatus =
  | "blocked_invalid"
  | "already_satisfied"
  | "ready";
export type IntegrationsProfileAppliedKey =
  | "mcp_servers.context7"
  | "mcp_servers.playwright"
  | "mcp_servers.grep_app";
export interface IntegrationsProfileApplyResult {
  status: IntegrationsProfileApplyResultStatus;
  recommendedChangeCount: number;
  appliedKeys: IntegrationsProfileAppliedKey[];
  details: string[];
}

export interface CodexProfileChange {
  key: "model" | "model_reasoning_effort" | "features.codex_hooks" | "compact_prompt";
  current: string | null;
  recommended: string;
}

export interface CodexProfileAudit {
  status: "installed" | "missing" | "invalid";
  recommendedChangeCount: number;
  changes: CodexProfileChange[];
  details: string[];
}

export type CodexProfileStatus = CodexProfileAudit["status"];
export type CodexProfileApplyResultStatus = "blocked_invalid" | "already_satisfied" | "ready";
export type CodexProfileAppliedKey = CodexProfileChange["key"];
export interface CodexProfileApplyResult {
  status: CodexProfileApplyResultStatus;
  recommendedChangeCount: number;
  appliedKeys: CodexProfileAppliedKey[];
  details: string[];
}

export interface CloudflareProfileAudit {
  status: "installed" | "missing" | "invalid";
  recommendedChangeCount: number;
  target: "cloudflare-api";
  details: string[];
}

export type CloudflareProfileStatus = CloudflareProfileAudit["status"];
export type CloudflareProfileApplyResultStatus = "blocked_invalid" | "already_satisfied" | "ready";
export type CloudflareProfileAppliedKey = "mcp_servers.cloudflare-api";
export interface CloudflareProfileApplyResult {
  status: CloudflareProfileApplyResultStatus;
  recommendedChangeCount: number;
  appliedKeys: CloudflareProfileAppliedKey[];
  details: string[];
}

export interface StatuslineProfileAudit {
  status: "installed" | "missing" | "invalid";
  recommendedChangeCount: number;
  details: string[];
}

export type StatuslineProfileStatus = StatuslineProfileAudit["status"];
export type StatuslineProfileApplyResultStatus = "blocked_invalid" | "already_satisfied" | "ready";
export type StatuslineProfileAppliedKey =
  | "tui.notification_condition"
  | "tui.status_line"
  | "tui.terminal_title";
export interface StatuslineProfileApplyResult {
  status: StatuslineProfileApplyResultStatus;
  recommendedChangeCount: number;
  appliedKeys: StatuslineProfileAppliedKey[];
  details: string[];
}

export interface CodexConfigBackupSnapshot {
  restoreAvailable: boolean;
  backupCount: number;
  latestBackupPath: string | null;
}

export type CodexConfigConflictWarningKind =
  | "invalid_config"
  | "disabled_codex_hooks"
  | "codex_profile_drift"
  | "codex_native_memories_enabled"
  | "oversized_guidance_file"
  | "managed_mcp_server_drift"
  | "statusline_profile_drift"
  | "unmanaged_mcp_server"
  | "unmanaged_plugin"
  | "unsupported_tui_theme";

export interface CodexConfigConflictWarning {
  kind: CodexConfigConflictWarningKind;
  target: string;
  path: string;
  message: string;
}

export interface CodexProfileSnapshot {
  audit: CodexProfileAudit;
  apply: CodexProfileApplyResult;
  preview: OperationResult;
}

export interface IntegrationsProfileSnapshot {
  audit: IntegrationsProfileAudit;
  apply: IntegrationsProfileApplyResult;
  preview: OperationResult;
}

export interface CloudflareProfileSnapshot {
  audit: CloudflareProfileAudit;
  apply: CloudflareProfileApplyResult;
  preview: OperationResult;
}

export interface StatuslineProfileSnapshot {
  audit: StatuslineProfileAudit;
  apply: StatuslineProfileApplyResult;
  preview: OperationResult;
}

export interface CodexProfileFamilySnapshot {
  codexConfig: OperationResult;
  core: CodexProfileSnapshot;
  integrations: IntegrationsProfileSnapshot;
  cloudflare: CloudflareProfileSnapshot;
  statusline: StatuslineProfileSnapshot;
}

interface CodexConfigContext {
  codexPaths: CodexPaths;
  inventory: ReturnType<typeof inspectCodexConfigInventory>;
  recommended: LocalConfig;
  config: TomlTable | null;
}

export function showCodexConfig(codexPaths: CodexPaths): OperationResult {
  const context = inspectCodexConfigContext(codexPaths);

  return showCodexConfigFromContext(context);
}

function showCodexConfigFromContext(context: CodexConfigContext): OperationResult {
  if (context.inventory.status === InventoryStatus.Missing) {
    return new OperationResult({
      kind: OperationKind.ShowCodexConfig,
      summary: `codex-config: missing at ${context.codexPaths.configToml}`,
      details: [
        "no user Codex config exists yet",
        "use `apply codex-profile` or `apply integrations-profile` to create one"
      ],
      pathsTouched: [context.codexPaths.configToml],
      inventory: [context.inventory]
    });
  }

  if (context.inventory.status === InventoryStatus.Invalid) {
    return new OperationResult({
      kind: OperationKind.ShowCodexConfig,
      summary: `codex-config: invalid at ${context.codexPaths.configToml}`,
      details: [
        "cannot read Codex config until ~/.codex/config.toml parses cleanly",
        "repair ~/.codex/config.toml first"
      ],
      pathsTouched: [context.codexPaths.configToml],
      inventory: [context.inventory]
    });
  }

  return new OperationResult({
    kind: OperationKind.ShowCodexConfig,
    summary: `codex-config: ok at ${context.codexPaths.configToml}`,
    details: codexConfigDetails(context.config ?? {}),
    pathsTouched: [context.codexPaths.configToml],
    inventory: [context.inventory]
  });
}

export function backupCodexConfig(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  ensureRuntimeDirs(paths);
  const inventory = inspectCodexConfigInventory(codexPaths);

  if (inventory.status === InventoryStatus.Missing) {
    return new OperationResult({
      kind: OperationKind.BackupCodexConfig,
      summary: `codex-config backup: nothing to back up at ${codexPaths.configToml}`,
      details: ["no ~/.codex/config.toml exists yet"],
      pathsTouched: [codexPaths.configToml],
      inventory: [inventory]
    });
  }

  if (inventory.status === InventoryStatus.Invalid) {
    return new OperationResult({
      kind: OperationKind.BackupCodexConfig,
      summary: "codex-config backup: skipped because config is invalid",
      details: ["repair ~/.codex/config.toml first"],
      pathsTouched: [codexPaths.configToml],
      inventory: [inventory]
    });
  }

  const backupPath = writeCodexConfigBackup(paths, codexPaths);

  return new OperationResult({
    kind: OperationKind.BackupCodexConfig,
    summary: `codex-config backup: wrote ${backupPath}`,
    details: [
      `source: ${codexPaths.configToml}`,
      "future managed profile writes must preview diff before applying"
    ],
    pathsTouched: [codexPaths.configToml, backupPath],
    inventory: [inventory]
  });
}

export function previewCodexProfile(codexPaths: CodexPaths): OperationResult {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectCodexProfileAuditFromContext(context);
  return previewCodexProfileFromAudit(codexPaths, audit, { inspectCodexConfigInventory });
}

export function previewIntegrationsProfile(codexPaths: CodexPaths): OperationResult {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectIntegrationsProfileAuditFromContext(context);
  return previewIntegrationsProfileFromAudit(codexPaths, audit, { inspectCodexConfigInventory });
}

export function previewCloudflareProfile(codexPaths: CodexPaths): OperationResult {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectCloudflareProfileAuditFromContext(context);
  return previewCloudflareProfileFromAudit(codexPaths, audit, { inspectCodexConfigInventory });
}

export function previewStatuslineProfile(codexPaths: CodexPaths): OperationResult {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectStatuslineProfileAuditFromContext(context);
  return previewStatuslineProfileFromAudit(codexPaths, audit, { inspectCodexConfigInventory });
}

export function applyCodexProfile(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  ensureRuntimeDirs(paths);
  const context = inspectCodexConfigContext(codexPaths);
  const applyResult = inspectCodexProfileApplyResultFromContext(context);

  if (applyResult.status === "blocked_invalid") {
    return new OperationResult({
      kind: OperationKind.ApplyCodexProfile,
      summary: "codex-profile apply: blocked by invalid config",
      details: applyResult.details,
      pathsTouched: [codexPaths.configToml],
      inventory: [context.inventory]
    });
  }

  const backupPath =
    context.inventory.status === InventoryStatus.Installed
      ? writeCodexConfigBackup(paths, codexPaths)
      : null;
  const config = cloneTable(context.config ?? {});
  const details = [...applyResult.details];

  applyCoreCodexProfileToValue(config, context.recommended);
  writeCodexConfig(codexPaths.configToml, config);

  details.push("applied keys: model, model_reasoning_effort, compact_prompt, features.codex_hooks");
  details.push(backupPath ? `backup: ${backupPath}` : "backup: skipped (no prior config existed)");

  return new OperationResult({
    kind: OperationKind.ApplyCodexProfile,
    summary: "codex-profile apply: wrote recommended core profile",
    details,
    pathsTouched: unique([codexPaths.configToml, backupPath]),
    inventory: [installedCodexConfigInventory(codexPaths)]
  });
}

export function applyIntegrationsProfile(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  ensureRuntimeDirs(paths);
  const context = inspectCodexConfigContext(codexPaths);
  const applyResult = inspectIntegrationsProfileApplyResultFromContext(context);

  if (applyResult.status === "blocked_invalid") {
    return new OperationResult({
      kind: OperationKind.ApplyIntegrationsProfile,
      summary: "integrations-profile apply: blocked by invalid config",
      details: applyResult.details,
      pathsTouched: [codexPaths.configToml],
      inventory: [context.inventory]
    });
  }

  const details = [...applyResult.details];
  const updatedConfig = cloneTable(context.config ?? {});
  if (applyResult.status === "already_satisfied") {
    return new OperationResult({
      kind: OperationKind.ApplyIntegrationsProfile,
      summary: "integrations-profile apply: already satisfied",
      details,
      pathsTouched: [codexPaths.configToml],
      inventory: [context.inventory]
    });
  }
  applyIntegrationsProfileToValue(updatedConfig);

  const backupPath =
    context.inventory.status === InventoryStatus.Installed
      ? writeCodexConfigBackup(paths, codexPaths)
      : null;
  writeCodexConfig(codexPaths.configToml, updatedConfig);

  details.push(`applied keys: ${applyResult.appliedKeys.join(", ")}`);
  details.push(backupPath ? `backup: ${backupPath}` : "backup: skipped (no prior config existed)");

  return new OperationResult({
    kind: OperationKind.ApplyIntegrationsProfile,
    summary: "integrations-profile apply: wrote recommended integrations",
    details,
    pathsTouched: unique([codexPaths.configToml, backupPath]),
    inventory: [installedCodexConfigInventory(codexPaths)]
  });
}

export function inspectIntegrationsProfileAudit(codexPaths: CodexPaths): IntegrationsProfileAudit {
  return inspectIntegrationsProfileAuditFromContext(inspectCodexConfigContext(codexPaths));
}

export function inspectIntegrationsProfileStatus(codexPaths: CodexPaths): IntegrationsProfileStatus {
  return inspectIntegrationsProfileAudit(codexPaths).status;
}

export function inspectIntegrationsProfileApplyResult(
  codexPaths: CodexPaths
): IntegrationsProfileApplyResult {
  return inspectIntegrationsProfileApplyResultFromContext(inspectCodexConfigContext(codexPaths));
}

export function inspectCodexProfileAudit(codexPaths: CodexPaths): CodexProfileAudit {
  return inspectCodexProfileAuditFromContext(inspectCodexConfigContext(codexPaths));
}

export function inspectCodexProfileStatus(codexPaths: CodexPaths): CodexProfileStatus {
  return inspectCodexProfileAudit(codexPaths).status;
}

export function inspectCodexProfileApplyResult(codexPaths: CodexPaths): CodexProfileApplyResult {
  return inspectCodexProfileApplyResultFromContext(inspectCodexConfigContext(codexPaths));
}

export function inspectCloudflareProfileAudit(codexPaths: CodexPaths): CloudflareProfileAudit {
  return inspectCloudflareProfileAuditFromContext(inspectCodexConfigContext(codexPaths));
}

export function inspectCloudflareProfileStatus(codexPaths: CodexPaths): CloudflareProfileStatus {
  return inspectCloudflareProfileAudit(codexPaths).status;
}

export function inspectCloudflareProfileApplyResult(codexPaths: CodexPaths): CloudflareProfileApplyResult {
  return inspectCloudflareProfileApplyResultFromContext(inspectCodexConfigContext(codexPaths));
}

export function inspectStatuslineProfileAudit(codexPaths: CodexPaths): StatuslineProfileAudit {
  return inspectStatuslineProfileAuditFromContext(inspectCodexConfigContext(codexPaths));
}

export function inspectStatuslineProfileStatus(codexPaths: CodexPaths): StatuslineProfileStatus {
  return inspectStatuslineProfileAudit(codexPaths).status;
}

export function inspectStatuslineProfileApplyResult(codexPaths: CodexPaths): StatuslineProfileApplyResult {
  return inspectStatuslineProfileApplyResultFromContext(inspectCodexConfigContext(codexPaths));
}

export function applyCloudflareProfile(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  ensureRuntimeDirs(paths);
  const context = inspectCodexConfigContext(codexPaths);
  const applyResult = inspectCloudflareProfileApplyResultFromContext(context);

  if (applyResult.status === "blocked_invalid") {
    return new OperationResult({
      kind: OperationKind.ApplyCloudflareProfile,
      summary: "cloudflare-profile apply: blocked by invalid config",
      details: applyResult.details,
      pathsTouched: [codexPaths.configToml],
      inventory: [context.inventory]
    });
  }

  const details = [...applyResult.details];
  const updatedConfig = cloneTable(context.config ?? {});
  if (applyResult.status === "already_satisfied") {
    return new OperationResult({
      kind: OperationKind.ApplyCloudflareProfile,
      summary: "cloudflare-profile apply: already satisfied",
      details,
      pathsTouched: [codexPaths.configToml],
      inventory: [context.inventory]
    });
  }
  applyCloudflareProfileToValue(updatedConfig);

  const backupPath =
    context.inventory.status === InventoryStatus.Installed
      ? writeCodexConfigBackup(paths, codexPaths)
      : null;
  writeCodexConfig(codexPaths.configToml, updatedConfig);

  details.push(`applied keys: ${applyResult.appliedKeys.join(", ")}`);
  details.push("cloudflare stays outside broad recommended-integrations");
  details.push(backupPath ? `backup: ${backupPath}` : "backup: skipped (no prior config existed)");

  return new OperationResult({
    kind: OperationKind.ApplyCloudflareProfile,
summary: "cloudflare-profile apply: wrote optional provider settings",
    details,
    pathsTouched: unique([codexPaths.configToml, backupPath]),
    inventory: [installedCodexConfigInventory(codexPaths)]
  });
}

export function applyStatuslineProfile(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  ensureRuntimeDirs(paths);
  const context = inspectCodexConfigContext(codexPaths);
  const applyResult = inspectStatuslineProfileApplyResultFromContext(context);

  if (applyResult.status === "blocked_invalid") {
    return new OperationResult({
      kind: OperationKind.ApplyStatuslineProfile,
      summary: "statusline-profile apply: blocked by invalid config",
      details: applyResult.details,
      pathsTouched: [codexPaths.configToml],
      inventory: [context.inventory]
    });
  }

  const details = [...applyResult.details];
  const updatedConfig = cloneTable(context.config ?? {});
  if (applyResult.status === "already_satisfied") {
    return new OperationResult({
      kind: OperationKind.ApplyStatuslineProfile,
      summary: "statusline-profile apply: already satisfied",
      details,
      pathsTouched: [codexPaths.configToml],
      inventory: [context.inventory]
    });
  }
  const appliedKeys = applyStatuslineProfileToValue(updatedConfig);

  const backupPath =
    context.inventory.status === InventoryStatus.Installed
      ? writeCodexConfigBackup(paths, codexPaths)
      : null;
  writeCodexConfig(codexPaths.configToml, updatedConfig);

  details.push(`applied keys: ${appliedKeys.join(", ")}`);
  details.push("native Codex statusline/title support only; no Sane-owned custom statusline system");
  details.push(backupPath ? `backup: ${backupPath}` : "backup: skipped (no prior config existed)");

  return new OperationResult({
    kind: OperationKind.ApplyStatuslineProfile,
    summary: "statusline-profile apply: wrote native Codex statusline settings",
    details,
    pathsTouched: unique([codexPaths.configToml, backupPath]),
    inventory: [installedCodexConfigInventory(codexPaths)]
  });
}

export function inspectCodexConfigBackupSnapshot(paths: ProjectPaths): CodexConfigBackupSnapshot {
  const backups = listCodexConfigBackups(paths);
  return {
    restoreAvailable: backups.length > 0,
    backupCount: backups.length,
    latestBackupPath: backups.at(-1) ?? null
  };
}

export function inspectCodexProfileSnapshot(codexPaths: CodexPaths): CodexProfileSnapshot {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectCodexProfileAuditFromContext(context);
  return {
    audit,
    apply: inspectCodexProfileApplyResultFromContext(context),
    preview: previewCodexProfileFromAudit(codexPaths, audit, { inspectCodexConfigInventory })
  };
}

export function inspectIntegrationsProfileSnapshot(
  codexPaths: CodexPaths
): IntegrationsProfileSnapshot {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectIntegrationsProfileAuditFromContext(context);
  return {
    audit,
    apply: inspectIntegrationsProfileApplyResultFromContext(context),
    preview: previewIntegrationsProfileFromAudit(codexPaths, audit, { inspectCodexConfigInventory })
  };
}

export function inspectCloudflareProfileSnapshot(codexPaths: CodexPaths): CloudflareProfileSnapshot {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectCloudflareProfileAuditFromContext(context);
  return {
    audit,
    apply: inspectCloudflareProfileApplyResultFromContext(context),
    preview: previewCloudflareProfileFromAudit(codexPaths, audit, { inspectCodexConfigInventory })
  };
}

export function inspectStatuslineProfileSnapshot(codexPaths: CodexPaths): StatuslineProfileSnapshot {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectStatuslineProfileAuditFromContext(context);
  return {
    audit,
    apply: inspectStatuslineProfileApplyResultFromContext(context),
    preview: previewStatuslineProfileFromAudit(codexPaths, audit, { inspectCodexConfigInventory })
  };
}

export function inspectCodexProfileFamilySnapshot(
  codexPaths: CodexPaths
): CodexProfileFamilySnapshot {
  const context = inspectCodexConfigContext(codexPaths);
  const coreAudit = inspectCodexProfileAuditFromContext(context);
  const integrationsAudit = inspectIntegrationsProfileAuditFromContext(context);
  const cloudflareAudit = inspectCloudflareProfileAuditFromContext(context);
  const statuslineAudit = inspectStatuslineProfileAuditFromContext(context);

  return {
    codexConfig: showCodexConfigFromContext(context),
    core: {
      audit: coreAudit,
      apply: inspectCodexProfileApplyResultFromContext(context),
      preview: previewCodexProfileFromAudit(codexPaths, coreAudit, { inspectCodexConfigInventory })
    },
    integrations: {
      audit: integrationsAudit,
      apply: inspectIntegrationsProfileApplyResultFromContext(context),
      preview: previewIntegrationsProfileFromAudit(codexPaths, integrationsAudit, { inspectCodexConfigInventory })
    },
    cloudflare: {
      audit: cloudflareAudit,
      apply: inspectCloudflareProfileApplyResultFromContext(context),
      preview: previewCloudflareProfileFromAudit(codexPaths, cloudflareAudit, { inspectCodexConfigInventory })
    },
    statusline: {
      audit: statuslineAudit,
      apply: inspectStatuslineProfileApplyResultFromContext(context),
      preview: previewStatuslineProfileFromAudit(codexPaths, statuslineAudit, { inspectCodexConfigInventory })
    }
  };
}

export function restoreCodexConfig(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const backupPath = latestCodexConfigBackup(paths);
  if (!backupPath) {
    return new OperationResult({
      kind: OperationKind.RestoreCodexConfig,
      summary: "codex-config restore: no backup available",
      details: [`expected backups under ${paths.codexConfigBackupsDir}`],
      pathsTouched: [paths.codexConfigBackupsDir],
      inventory: [inspectCodexConfigInventory(codexPaths)]
    });
  }

  mkdirSync(codexPaths.codexHome, { recursive: true });
  copyFileSync(backupPath, codexPaths.configToml);

  return new OperationResult({
    kind: OperationKind.RestoreCodexConfig,
    summary: `codex-config restore: restored from ${backupPath}`,
    details: [`target: ${codexPaths.configToml}`],
    pathsTouched: [backupPath, codexPaths.configToml],
    inventory: [inspectCodexConfigInventory(codexPaths)]
  });
}

export function inspectCodexConfigInventory(codexPaths: CodexPaths) {
  const status = !existsSync(codexPaths.configToml)
    ? InventoryStatus.Missing
    : inspectConfigStatus(codexPaths.configToml);

  return {
    name: "codex-config",
    scope: InventoryScope.CodexNative,
    status,
    path: codexPaths.configToml,
    repairHint:
      status === InventoryStatus.Installed
        ? null
        : status === InventoryStatus.Missing
          ? "use `apply codex-profile` or `apply integrations-profile` to create it"
          : "repair ~/.codex/config.toml first"
  };
}

export function inspectCodexConfigConflictWarnings(
  codexPaths: CodexPaths
): CodexConfigConflictWarning[] {
  if (!existsSync(codexPaths.configToml)) {
    return [];
  }

  let config: TomlTable;
  try {
    config = readCodexConfig(codexPaths.configToml);
  } catch (error) {
    return [
      {
        kind: "invalid_config",
        target: "config.toml",
        path: codexPaths.configToml,
        message: `Codex config does not parse cleanly: ${messageOf(error)}`
      }
    ];
  }

  return synthesizeCodexConfigConflictWarnings({
    codexConfigPath: codexPaths.configToml,
    config,
    recommended: recommendedLocalConfig(codexPaths)
  });
}

function recommendedLocalConfig(codexPaths: CodexPaths): LocalConfig {
  return createRecommendedLocalConfig(
    detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson)
  );
}

function inspectCodexConfigContext(codexPaths: CodexPaths): CodexConfigContext {
  const inventory = inspectCodexConfigInventory(codexPaths);
  return {
    codexPaths,
    inventory,
    recommended: recommendedLocalConfig(codexPaths),
    config: inventory.status === InventoryStatus.Installed ? readCodexConfig(codexPaths.configToml) : null
  };
}

function inspectConfigStatus(path: string) {
  try {
    readCodexConfig(path);
    return InventoryStatus.Installed;
  } catch {
    return InventoryStatus.Invalid;
  }
}

function installedCodexConfigInventory(codexPaths: CodexPaths) {
  return {
    name: "codex-config",
    scope: InventoryScope.CodexNative,
    status: InventoryStatus.Installed,
    path: codexPaths.configToml,
    repairHint: null
  };
}

function writeCodexConfig(path: string, config: TomlTable): void {
  mkdirSync(codexPathsParent(path), { recursive: true });
  writeAtomicTextFile(path, `${stringifyToml(config).trimEnd()}\n`);
}

function readCodexConfig(path: string): TomlTable {
  try {
    const decoded = parseToml(readFileSync(path, "utf8"));
    if (!isPlainRecord(decoded)) {
      throw new Error("config.toml root must be a table");
    }
    return decoded;
  } catch (error) {
    throw new Error(`invalid config.toml: ${messageOf(error)}`);
  }
}

function writeCodexConfigBackup(paths: ProjectPaths, codexPaths: CodexPaths): string {
  const timestamp = Math.floor(Date.now() / 1000);
  mkdirSync(paths.codexConfigBackupsDir, { recursive: true });
  const backupPath = nextCodexConfigBackupPath(paths, timestamp);
  copyFileSync(codexPaths.configToml, backupPath);
  return backupPath;
}

function nextCodexConfigBackupPath(paths: ProjectPaths, timestamp: number): string {
  const basePath = join(paths.codexConfigBackupsDir, `config-${timestamp}.toml`);
  if (!existsSync(basePath)) {
    return basePath;
  }

  for (let index = 1; index < 1000; index += 1) {
    const candidate = join(paths.codexConfigBackupsDir, `config-${timestamp}-${index}.toml`);
    if (!existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`could not allocate unique Codex config backup path for ${timestamp}`);
}

function latestCodexConfigBackup(paths: ProjectPaths): string | null {
  return listCodexConfigBackups(paths).at(-1) ?? null;
}

function listCodexConfigBackups(paths: ProjectPaths): string[] {
  if (!existsSync(paths.codexConfigBackupsDir)) {
    return [];
  }

  return readdirSync(paths.codexConfigBackupsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => parseCodexConfigBackupEntry(paths, entry.name))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.timestamp - right.timestamp || left.index - right.index)
    .map((entry) => entry.path);
}

function parseCodexConfigBackupEntry(
  paths: ProjectPaths,
  name: string
): { path: string; timestamp: number; index: number } | null {
  const match = /^config-(\d+)(?:-(\d+))?\.toml$/.exec(name);
  if (!match) {
    return null;
  }

  return {
    path: join(paths.codexConfigBackupsDir, name),
    timestamp: Number(match[1]),
    index: match[2] ? Number(match[2]) : 0
  };
}

function codexConfigDetails(config: TomlTable): string[] {
  const features = asTomlTable(config.features);
  const mcpServers = sortedKeys(asTomlTable(config.mcp_servers));
  const projects = asTomlTable(config.projects);
  const tui = asTomlTable(config.tui);
  const plugins = asTomlTable(config.plugins);
  const enabledPlugins = sortedKeys(plugins).filter((name) => {
    const plugin = asTomlTable(plugins?.[name]);
    return plugin?.enabled === true;
  });

  return [
    `model: ${asString(config.model) ?? "unset"}`,
    `reasoning: ${asString(config.model_reasoning_effort) ?? "unset"}`,
    `compact prompt: ${compactPromptStatus(config.compact_prompt) ?? "missing"}`,
    `codex hooks: ${displayHooks(features?.codex_hooks)}`,
    `codex memories: ${displayEnabled(features?.memories)}`,
    `mcp servers: ${mcpServers.length}`,
    `mcp server names: ${mcpServers.length === 0 ? "none" : mcpServers.join(", ")}`,
    `enabled plugins: ${enabledPlugins.length}`,
    `plugin names: ${enabledPlugins.length === 0 ? "none" : enabledPlugins.join(", ")}`,
    `trusted projects: ${projects ? Object.keys(projects).length : 0}`,
    `tui status line: ${displayStringArray(tui?.status_line)}`,
    `tui terminal title: ${displayStringArray(tui?.terminal_title)}`,
    `tui notifications: ${asString(tui?.notification_condition) ?? "unset"}`,
    `tui theme: ${asString(tui?.theme) ? `${asString(tui?.theme)} (display-only, not Sane-managed)` : "unset"}`
  ];
}

function displayEnabled(value: unknown): string {
  return value === true ? "enabled" : value === false ? "disabled" : "unset";
}

function displayStringArray(value: unknown): string {
  const entries = asStringArray(value);
  if (!entries) {
    return "unset";
  }

  return entries.length === 0 ? "none" : entries.join(", ");
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function stringArraysEqual(
  left: readonly string[] | null | undefined,
  right: readonly string[]
): boolean {
  if (!left || left.length !== right.length) {
    return false;
  }

  return left.every((entry, index) => entry === right[index]);
}

function pushProfileChange(details: string[], label: string, current: string, recommended: string): void {
  details.push(
    current === recommended ? `${label}: keep ${recommended}` : `${label}: ${current} -> ${recommended}`
  );
}

function cloneTable(value: TomlTable): TomlTable {
  return clonePlainRecord(value);
}

function sortedKeys(table: TomlTable | null | undefined): string[] {
  return table ? Object.keys(table).sort() : [];
}

function hasTableKey(table: TomlTable | null | undefined, key: string): boolean {
  return table ? Object.hasOwn(table, key) : false;
}

function asTomlTable(value: unknown): TomlTable | null {
  return asPlainRecord(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function displayHooks(value: unknown): string {
  if (value === true) {
    return "enabled";
  }
  if (value === false) {
    return "disabled";
  }
  return "unset";
}

function compactPromptStatus(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  return value === buildSaneCompactPrompt() ? "Sane continuity prompt" : "custom";
}

function codexPathsParent(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "." : path.slice(0, slash);
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
