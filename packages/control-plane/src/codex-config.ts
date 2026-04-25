import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import * as TOML from "@iarna/toml";

import { createRecommendedLocalConfig, detectCodexEnvironment, type LocalConfig } from "@sane/config";
import { InventoryScope, InventoryStatus, OperationKind, OperationResult } from "@sane/core";
import { type CodexPaths, ensureRuntimeDirs, type ProjectPaths } from "@sane/platform";
import { writeAtomicTextFile } from "@sane/state";

type TomlTable = Record<string, unknown>;

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
  key: "model" | "model_reasoning_effort" | "features.codex_hooks";
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

export interface OpencodeProfileAudit {
  status: "installed" | "missing" | "invalid";
  recommendedChangeCount: number;
  target: "opensrc";
  details: string[];
}

export type OpencodeProfileStatus = OpencodeProfileAudit["status"];
export type OpencodeProfileApplyResultStatus = "blocked_invalid" | "already_satisfied" | "ready";
export type OpencodeProfileAppliedKey = "mcp_servers.opensrc";
export interface OpencodeProfileApplyResult {
  status: OpencodeProfileApplyResultStatus;
  recommendedChangeCount: number;
  appliedKeys: OpencodeProfileAppliedKey[];
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
  | "managed_mcp_server_drift"
  | "statusline_profile_drift"
  | "unmanaged_mcp_server"
  | "unmanaged_plugin";

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

export interface OpencodeProfileSnapshot {
  audit: OpencodeProfileAudit;
  apply: OpencodeProfileApplyResult;
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
  opencode: OpencodeProfileSnapshot;
  statusline: StatuslineProfileSnapshot;
}

interface CodexConfigContext {
  codexPaths: CodexPaths;
  inventory: ReturnType<typeof inspectCodexConfigInventory>;
  recommended: LocalConfig;
  config: TomlTable | null;
}

const RECOMMENDED_STATUSLINE = [
  "model-with-reasoning",
  "project-root",
  "git-branch",
  "context-remaining",
  "current-dir",
  "five-hour-limit",
  "weekly-limit",
  "context-window-size",
  "used-tokens"
] as const;

const RECOMMENDED_TERMINAL_TITLE = ["project", "spinner"] as const;
const RECOMMENDED_TUI_NOTIFICATION_CONDITION = "always";
const SANE_KNOWN_MCP_SERVERS = new Set([
  "cloudflare-api",
  "context7",
  "grep",
  "grep_app",
  "opensrc",
  "playwright"
]);

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
  return previewCodexProfileFromAudit(codexPaths, audit);
}

export function previewIntegrationsProfile(codexPaths: CodexPaths): OperationResult {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectIntegrationsProfileAuditFromContext(context);
  return previewIntegrationsProfileFromAudit(codexPaths, audit);
}

export function previewCloudflareProfile(codexPaths: CodexPaths): OperationResult {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectCloudflareProfileAuditFromContext(context);
  return previewCloudflareProfileFromAudit(codexPaths, audit);
}

export function previewOpencodeProfile(codexPaths: CodexPaths): OperationResult {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectOpencodeProfileAuditFromContext(context);
  return previewOpencodeProfileFromAudit(codexPaths, audit);
}

export function previewStatuslineProfile(codexPaths: CodexPaths): OperationResult {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectStatuslineProfileAuditFromContext(context);
  return previewStatuslineProfileFromAudit(codexPaths, audit);
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

  details.push("applied keys: model, model_reasoning_effort, features.codex_hooks");
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
  details.push("opensrc left untouched");
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

export function inspectOpencodeProfileAudit(codexPaths: CodexPaths): OpencodeProfileAudit {
  return inspectOpencodeProfileAuditFromContext(inspectCodexConfigContext(codexPaths));
}

export function inspectOpencodeProfileStatus(codexPaths: CodexPaths): OpencodeProfileStatus {
  return inspectOpencodeProfileAudit(codexPaths).status;
}

export function inspectOpencodeProfileApplyResult(codexPaths: CodexPaths): OpencodeProfileApplyResult {
  return inspectOpencodeProfileApplyResultFromContext(inspectCodexConfigContext(codexPaths));
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
    summary: "cloudflare-profile apply: wrote optional provider profile",
    details,
    pathsTouched: unique([codexPaths.configToml, backupPath]),
    inventory: [installedCodexConfigInventory(codexPaths)]
  });
}

export function applyOpencodeProfile(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  ensureRuntimeDirs(paths);
  const context = inspectCodexConfigContext(codexPaths);
  const applyResult = inspectOpencodeProfileApplyResultFromContext(context);

  if (applyResult.status === "blocked_invalid") {
    return new OperationResult({
      kind: OperationKind.ApplyOpencodeProfile,
      summary: "opencode-profile apply: blocked by invalid config",
      details: applyResult.details,
      pathsTouched: [codexPaths.configToml],
      inventory: [context.inventory]
    });
  }

  const details = [...applyResult.details];
  const updatedConfig = cloneTable(context.config ?? {});
  if (applyResult.status === "already_satisfied") {
    return new OperationResult({
      kind: OperationKind.ApplyOpencodeProfile,
      summary: "opencode-profile apply: already satisfied",
      details,
      pathsTouched: [codexPaths.configToml],
      inventory: [context.inventory]
    });
  }
  applyOpencodeProfileToValue(updatedConfig);

  const backupPath =
    context.inventory.status === InventoryStatus.Installed
      ? writeCodexConfigBackup(paths, codexPaths)
      : null;
  writeCodexConfig(codexPaths.configToml, updatedConfig);

  details.push(`applied keys: ${applyResult.appliedKeys.join(", ")}`);
  details.push("opensrc stays outside Sane's default recommended integrations");
  details.push(backupPath ? `backup: ${backupPath}` : "backup: skipped (no prior config existed)");

  return new OperationResult({
    kind: OperationKind.ApplyOpencodeProfile,
    summary: "opencode-profile apply: wrote optional compatibility profile",
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
    preview: previewCodexProfileFromAudit(codexPaths, audit)
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
    preview: previewIntegrationsProfileFromAudit(codexPaths, audit)
  };
}

export function inspectCloudflareProfileSnapshot(codexPaths: CodexPaths): CloudflareProfileSnapshot {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectCloudflareProfileAuditFromContext(context);
  return {
    audit,
    apply: inspectCloudflareProfileApplyResultFromContext(context),
    preview: previewCloudflareProfileFromAudit(codexPaths, audit)
  };
}

export function inspectOpencodeProfileSnapshot(codexPaths: CodexPaths): OpencodeProfileSnapshot {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectOpencodeProfileAuditFromContext(context);
  return {
    audit,
    apply: inspectOpencodeProfileApplyResultFromContext(context),
    preview: previewOpencodeProfileFromAudit(codexPaths, audit)
  };
}

export function inspectStatuslineProfileSnapshot(codexPaths: CodexPaths): StatuslineProfileSnapshot {
  const context = inspectCodexConfigContext(codexPaths);
  const audit = inspectStatuslineProfileAuditFromContext(context);
  return {
    audit,
    apply: inspectStatuslineProfileApplyResultFromContext(context),
    preview: previewStatuslineProfileFromAudit(codexPaths, audit)
  };
}

export function inspectCodexProfileFamilySnapshot(
  codexPaths: CodexPaths
): CodexProfileFamilySnapshot {
  const context = inspectCodexConfigContext(codexPaths);
  const coreAudit = inspectCodexProfileAuditFromContext(context);
  const integrationsAudit = inspectIntegrationsProfileAuditFromContext(context);
  const cloudflareAudit = inspectCloudflareProfileAuditFromContext(context);
  const opencodeAudit = inspectOpencodeProfileAuditFromContext(context);
  const statuslineAudit = inspectStatuslineProfileAuditFromContext(context);

  return {
    codexConfig: showCodexConfigFromContext(context),
    core: {
      audit: coreAudit,
      apply: inspectCodexProfileApplyResultFromContext(context),
      preview: previewCodexProfileFromAudit(codexPaths, coreAudit)
    },
    integrations: {
      audit: integrationsAudit,
      apply: inspectIntegrationsProfileApplyResultFromContext(context),
      preview: previewIntegrationsProfileFromAudit(codexPaths, integrationsAudit)
    },
    cloudflare: {
      audit: cloudflareAudit,
      apply: inspectCloudflareProfileApplyResultFromContext(context),
      preview: previewCloudflareProfileFromAudit(codexPaths, cloudflareAudit)
    },
    opencode: {
      audit: opencodeAudit,
      apply: inspectOpencodeProfileApplyResultFromContext(context),
      preview: previewOpencodeProfileFromAudit(codexPaths, opencodeAudit)
    },
    statusline: {
      audit: statuslineAudit,
      apply: inspectStatuslineProfileApplyResultFromContext(context),
      preview: previewStatuslineProfileFromAudit(codexPaths, statuslineAudit)
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

  return [
    ...collectUnmanagedMcpWarnings(config, codexPaths),
    ...collectManagedMcpDriftWarnings(config, codexPaths),
    ...collectCoreProfileDriftWarnings(config, codexPaths, recommendedLocalConfig(codexPaths)),
    ...collectCodexAdjacentSetupWarnings(config, codexPaths),
    ...collectStatuslineDriftWarnings(config, codexPaths),
    ...collectPluginWarnings(config, codexPaths)
  ];
}

function collectUnmanagedMcpWarnings(
  config: TomlTable,
  codexPaths: CodexPaths
): CodexConfigConflictWarning[] {
  const mcpServers = sortedKeys(asTomlTable(config.mcp_servers));
  return mcpServers
    .filter((name) => !SANE_KNOWN_MCP_SERVERS.has(name))
    .map((name) => ({
      kind: "unmanaged_mcp_server" as const,
      target: `mcp_servers.${name}`,
      path: codexPaths.configToml,
      message: `unmanaged Codex MCP server '${name}' is outside Sane's known profiles`
    }));
}

function collectManagedMcpDriftWarnings(
  config: TomlTable,
  codexPaths: CodexPaths
): CodexConfigConflictWarning[] {
  const mcpServers = asTomlTable(config.mcp_servers);
  const expected: Record<string, TomlTable> = {
    "cloudflare-api": { url: "https://mcp.cloudflare.com/mcp" },
    context7: { url: "https://mcp.context7.com/mcp" },
    grep_app: { url: "https://mcp.grep.app" },
    opensrc: { url: "https://mcp.opensrc.dev" },
    playwright: { command: "npx", args: ["@playwright/mcp@latest"] }
  };

  return Object.entries(expected).flatMap(([name, expectedValue]) => {
    const actual = asTomlTable(mcpServers?.[name]);
    if (!actual || tomlValueEqual(actual, expectedValue)) {
      return [];
    }

    return [
      {
        kind: "managed_mcp_server_drift" as const,
        target: `mcp_servers.${name}`,
        path: codexPaths.configToml,
        message: `managed Codex MCP server '${name}' differs from Sane's profile`
      }
    ];
  });
}

function collectCoreProfileDriftWarnings(
  config: TomlTable,
  codexPaths: CodexPaths,
  recommended: LocalConfig
): CodexConfigConflictWarning[] {
  const warnings: CodexConfigConflictWarning[] = [];
  const currentModel = asString(config.model);
  const currentReasoning = asString(config.model_reasoning_effort);
  const features = asTomlTable(config.features);

  if (currentModel !== null && currentModel !== recommended.models.coordinator.model) {
    warnings.push({
      kind: "codex_profile_drift",
      target: "model",
      path: codexPaths.configToml,
      message: `Codex model '${currentModel}' differs from Sane's recommended coordinator model '${recommended.models.coordinator.model}'`
    });
  }

  if (
    currentReasoning !== null
    && currentReasoning !== recommended.models.coordinator.reasoningEffort
  ) {
    warnings.push({
      kind: "codex_profile_drift",
      target: "model_reasoning_effort",
      path: codexPaths.configToml,
      message: `Codex reasoning '${currentReasoning}' differs from Sane's recommended coordinator reasoning '${recommended.models.coordinator.reasoningEffort}'`
    });
  }

  if (features?.codex_hooks === false) {
    warnings.push({
      kind: "disabled_codex_hooks",
      target: "features.codex_hooks",
      path: codexPaths.configToml,
      message:
        "Codex hooks are disabled, so Sane-managed hook exports will not run until features.codex_hooks is enabled"
    });
  }

  return warnings;
}

function collectCodexAdjacentSetupWarnings(
  config: TomlTable,
  codexPaths: CodexPaths
): CodexConfigConflictWarning[] {
  const features = asTomlTable(config.features);
  if (features?.memories !== true) {
    return [];
  }

  return [
    {
      kind: "codex_native_memories_enabled",
      target: "features.memories",
      path: codexPaths.configToml,
      message:
        "Codex native memories are enabled; Sane keeps default continuity in scoped exports plus .sane state instead"
    }
  ];
}

function collectStatuslineDriftWarnings(
  config: TomlTable,
  codexPaths: CodexPaths
): CodexConfigConflictWarning[] {
  const tui = asTomlTable(config.tui);
  if (!tui) {
    return [];
  }

  const warnings: CodexConfigConflictWarning[] = [];
  const notificationCondition = asString(tui.notification_condition);
  const statusLine = asStringArray(tui.status_line);
  const terminalTitle = asStringArray(tui.terminal_title);

  if (
    notificationCondition !== null
    && notificationCondition !== RECOMMENDED_TUI_NOTIFICATION_CONDITION
  ) {
    warnings.push({
      kind: "statusline_profile_drift",
      target: "tui.notification_condition",
      path: codexPaths.configToml,
      message: `Codex TUI notifications '${notificationCondition}' differ from Sane's statusline profile '${RECOMMENDED_TUI_NOTIFICATION_CONDITION}'`
    });
  }

  if (statusLine !== null && !stringArraysEqual(statusLine, RECOMMENDED_STATUSLINE)) {
    warnings.push({
      kind: "statusline_profile_drift",
      target: "tui.status_line",
      path: codexPaths.configToml,
      message: "Codex TUI status line differs from Sane's statusline profile"
    });
  }

  if (terminalTitle !== null && !stringArraysEqual(terminalTitle, RECOMMENDED_TERMINAL_TITLE)) {
    warnings.push({
      kind: "statusline_profile_drift",
      target: "tui.terminal_title",
      path: codexPaths.configToml,
      message: "Codex TUI terminal title differs from Sane's statusline profile"
    });
  }

  return warnings;
}

function collectPluginWarnings(
  config: TomlTable,
  codexPaths: CodexPaths
): CodexConfigConflictWarning[] {
  const plugins = asTomlTable(config.plugins);
  return sortedKeys(plugins)
    .filter((name) => asTomlTable(plugins?.[name])?.enabled === true)
    .map((name) => ({
      kind: "unmanaged_plugin" as const,
      target: `plugins.${name}`,
      path: codexPaths.configToml,
      message: `enabled Codex plugin '${name}' is outside Sane's managed profiles`
    }));
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
  writeAtomicTextFile(path, `${TOML.stringify(config as TOML.JsonMap).trimEnd()}\n`);
}

function readCodexConfig(path: string): TomlTable {
  try {
    const decoded = TOML.parse(readFileSync(path, "utf8"));
    if (!isTomlTable(decoded)) {
      throw new Error("config.toml root must be a table");
    }
    return decoded as TomlTable;
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

function previewCodexProfileFromAudit(
  codexPaths: CodexPaths,
  audit: CodexProfileAudit
): OperationResult {
  const summary =
    audit.status === "invalid"
      ? "codex-profile preview: blocked by invalid config"
      : `codex-profile preview: ${audit.recommendedChangeCount} recommended change(s)`;

  return new OperationResult({
    kind: OperationKind.PreviewCodexProfile,
    summary,
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [inspectCodexConfigInventory(codexPaths)]
  });
}

function previewIntegrationsProfileFromAudit(
  codexPaths: CodexPaths,
  audit: IntegrationsProfileAudit
): OperationResult {
  const summary =
    audit.status === "invalid"
      ? "integrations-profile preview: blocked by invalid config"
      : `integrations-profile preview: ${audit.recommendedChangeCount} recommended change(s)`;

  return new OperationResult({
    kind: OperationKind.PreviewIntegrationsProfile,
    summary,
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [inspectCodexConfigInventory(codexPaths)]
  });
}

function previewCloudflareProfileFromAudit(
  codexPaths: CodexPaths,
  audit: CloudflareProfileAudit
): OperationResult {
  const summary =
    audit.status === "invalid"
      ? "cloudflare-profile preview: blocked by invalid config"
      : `cloudflare-profile preview: ${audit.recommendedChangeCount} recommended change(s)`;

  return new OperationResult({
    kind: OperationKind.PreviewCloudflareProfile,
    summary,
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [inspectCodexConfigInventory(codexPaths)]
  });
}

function previewOpencodeProfileFromAudit(
  codexPaths: CodexPaths,
  audit: OpencodeProfileAudit
): OperationResult {
  const summary =
    audit.status === "invalid"
      ? "opencode-profile preview: blocked by invalid config"
      : `opencode-profile preview: ${audit.recommendedChangeCount} recommended change(s)`;

  return new OperationResult({
    kind: OperationKind.PreviewOpencodeProfile,
    summary,
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [inspectCodexConfigInventory(codexPaths)]
  });
}

function previewStatuslineProfileFromAudit(
  codexPaths: CodexPaths,
  audit: StatuslineProfileAudit
): OperationResult {
  const summary =
    audit.status === "invalid"
      ? "statusline-profile preview: blocked by invalid config"
      : `statusline-profile preview: ${audit.recommendedChangeCount} recommended change(s)`;

  return new OperationResult({
    kind: OperationKind.PreviewStatuslineProfile,
    summary,
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [inspectCodexConfigInventory(codexPaths)]
  });
}

function inspectIntegrationsProfileAuditFromContext(
  context: CodexConfigContext
): IntegrationsProfileAudit {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return {
      status: "invalid",
      recommendedChangeCount: 0,
      recommendedTargets: [],
      optionalTargets: ["opensrc"],
      details: [
        "cannot preview integrations profile until ~/.codex/config.toml parses cleanly",
        "repair current config first"
      ]
    };
  }

  if (context.inventory.status === InventoryStatus.Missing) {
    return {
      status: "missing",
      recommendedChangeCount: 3,
      recommendedTargets: ["context7", "playwright", "grep.app"],
      optionalTargets: ["opensrc"],
      details: [
        "context7: missing -> recommended",
        "playwright: missing -> recommended",
        "grep.app: missing -> recommended",
        "opensrc: optional, not in default recommended profile"
      ]
    };
  }

  return integrationProfileAuditFromConfig(context.config ?? {});
}

function inspectIntegrationsProfileApplyResultFromContext(
  context: CodexConfigContext
): IntegrationsProfileApplyResult {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return {
      status: "blocked_invalid",
      recommendedChangeCount: 0,
      appliedKeys: [],
      details: [
        "repair ~/.codex/config.toml first",
        "Sane only writes after a clean parse"
      ]
    };
  }

  const appliedKeys = applyIntegrationsProfileToValue(cloneTable(context.config ?? {}));
  const audit = inspectIntegrationsProfileAuditFromContext(context);
  return {
    status: appliedKeys.length === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys,
    details: [...audit.details]
  };
}

function inspectCodexProfileAuditFromContext(context: CodexConfigContext): CodexProfileAudit {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return {
      status: "invalid",
      recommendedChangeCount: 0,
      changes: [],
      details: [
        "cannot preview managed profile until ~/.codex/config.toml parses cleanly",
        "repair current config first"
      ]
    };
  }

  if (context.inventory.status === InventoryStatus.Missing) {
    return codexProfileAuditFromCurrentValues(
      context.recommended,
      {
        model: null,
        modelReasoningEffort: null,
        codexHooks: null
      },
      "missing"
    );
  }

  const features = asTomlTable(context.config?.features);
  return codexProfileAuditFromCurrentValues(
    context.recommended,
    {
      model: asString(context.config?.model),
      modelReasoningEffort: asString(context.config?.model_reasoning_effort),
      codexHooks: displayHooks(features?.codex_hooks)
    },
    "missing"
  );
}

function inspectCodexProfileApplyResultFromContext(context: CodexConfigContext): CodexProfileApplyResult {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return {
      status: "blocked_invalid",
      recommendedChangeCount: 0,
      appliedKeys: [],
      details: [
        "repair ~/.codex/config.toml first",
        "Sane only writes after a clean parse"
      ]
    };
  }

  const audit = inspectCodexProfileAuditFromContext(context);
  return {
    status: audit.recommendedChangeCount === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys: audit.changes.map((change) => change.key),
    details: codexProfileApplyDetails(audit)
  };
}

function inspectCloudflareProfileAuditFromContext(
  context: CodexConfigContext
): CloudflareProfileAudit {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return {
      status: "invalid",
      recommendedChangeCount: 0,
      target: "cloudflare-api",
      details: [
        "cannot preview cloudflare profile until ~/.codex/config.toml parses cleanly",
        "repair current config first"
      ]
    };
  }

  if (context.inventory.status === InventoryStatus.Missing) {
    return {
      status: "missing",
      recommendedChangeCount: 1,
      target: "cloudflare-api",
      details: [
        "cloudflare-api: missing -> optional provider profile",
        "oauth and permissions stay explicit at connect time",
        "note: not part of the broad recommended integrations profile"
      ]
    };
  }

  return cloudflareProfileAuditFromConfig(context.config ?? {});
}

function inspectCloudflareProfileApplyResultFromContext(
  context: CodexConfigContext
): CloudflareProfileApplyResult {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return {
      status: "blocked_invalid",
      recommendedChangeCount: 0,
      appliedKeys: [],
      details: [
        "repair ~/.codex/config.toml first",
        "Sane only writes after a clean parse"
      ]
    };
  }

  const appliedKeys = applyCloudflareProfileToValue(cloneTable(context.config ?? {}));
  const audit = inspectCloudflareProfileAuditFromContext(context);
  return {
    status: appliedKeys.length === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys,
    details: [...audit.details]
  };
}

function inspectOpencodeProfileAuditFromContext(context: CodexConfigContext): OpencodeProfileAudit {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return {
      status: "invalid",
      recommendedChangeCount: 0,
      target: "opensrc",
      details: [
        "cannot preview opencode compatibility profile until ~/.codex/config.toml parses cleanly",
        "repair current config first"
      ]
    };
  }

  if (context.inventory.status === InventoryStatus.Missing) {
    return {
      status: "missing",
      recommendedChangeCount: 1,
      target: "opensrc",
      details: [
        "opensrc: missing -> optional Opencode compatibility profile",
        "note: not part of Sane's default recommended integrations",
        "note: this keeps Codex config additive and leaves broader Opencode setup separate"
      ]
    };
  }

  return opencodeProfileAuditFromConfig(context.config ?? {});
}

function inspectOpencodeProfileApplyResultFromContext(
  context: CodexConfigContext
): OpencodeProfileApplyResult {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return {
      status: "blocked_invalid",
      recommendedChangeCount: 0,
      appliedKeys: [],
      details: [
        "repair ~/.codex/config.toml first",
        "Sane only writes after a clean parse"
      ]
    };
  }

  const appliedKeys = applyOpencodeProfileToValue(cloneTable(context.config ?? {}));
  const audit = inspectOpencodeProfileAuditFromContext(context);
  return {
    status: appliedKeys.length === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys,
    details: [...audit.details]
  };
}

function inspectStatuslineProfileAuditFromContext(
  context: CodexConfigContext
): StatuslineProfileAudit {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return {
      status: "invalid",
      recommendedChangeCount: 0,
      details: [
        "cannot preview statusline profile until ~/.codex/config.toml parses cleanly",
        "repair current config first"
      ]
    };
  }

  const current = context.inventory.status === InventoryStatus.Missing ? {} : (context.config ?? {});
  return statuslineProfileAuditFromConfig(current);
}

function inspectStatuslineProfileApplyResultFromContext(
  context: CodexConfigContext
): StatuslineProfileApplyResult {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return {
      status: "blocked_invalid",
      recommendedChangeCount: 0,
      appliedKeys: [],
      details: [
        "repair ~/.codex/config.toml first",
        "Sane only writes after a clean parse"
      ]
    };
  }

  const appliedKeys = applyStatuslineProfileToValue(cloneTable(context.config ?? {}));
  const audit = inspectStatuslineProfileAuditFromContext(context);
  return {
    status: appliedKeys.length === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys,
    details: [...audit.details]
  };
}

function applyCoreCodexProfileToValue(config: TomlTable, recommended: LocalConfig): void {
  config.model = recommended.models.coordinator.model;
  config.model_reasoning_effort = recommended.models.coordinator.reasoningEffort;

  const features = ensureChildTable(config, "features", "[features] must be a table");
  features.codex_hooks = true;
}

function applyIntegrationsProfileToValue(config: TomlTable): IntegrationsProfileAppliedKey[] {
  const mcpServers = ensureChildTable(config, "mcp_servers", "[mcp_servers] must be a table");
  const appliedKeys: IntegrationsProfileAppliedKey[] = [];

  if (!Object.hasOwn(mcpServers, "context7")) {
    mcpServers.context7 = { url: "https://mcp.context7.com/mcp" };
    appliedKeys.push("mcp_servers.context7");
  }

  if (!Object.hasOwn(mcpServers, "playwright")) {
    mcpServers.playwright = {
      command: "npx",
      args: ["@playwright/mcp@latest"]
    };
    appliedKeys.push("mcp_servers.playwright");
  }

  if (!Object.hasOwn(mcpServers, "grep") && !Object.hasOwn(mcpServers, "grep_app")) {
    mcpServers.grep_app = { url: "https://mcp.grep.app" };
    appliedKeys.push("mcp_servers.grep_app");
  }

  return appliedKeys;
}

function applyCloudflareProfileToValue(config: TomlTable): CloudflareProfileAppliedKey[] {
  const mcpServers = ensureChildTable(config, "mcp_servers", "[mcp_servers] must be a table");
  const appliedKeys: CloudflareProfileAppliedKey[] = [];
  if (Object.hasOwn(mcpServers, "cloudflare-api")) {
    return appliedKeys;
  }

  mcpServers["cloudflare-api"] = { url: "https://mcp.cloudflare.com/mcp" };
  appliedKeys.push("mcp_servers.cloudflare-api");
  return appliedKeys;
}

function applyOpencodeProfileToValue(config: TomlTable): OpencodeProfileAppliedKey[] {
  const mcpServers = ensureChildTable(config, "mcp_servers", "[mcp_servers] must be a table");
  const appliedKeys: OpencodeProfileAppliedKey[] = [];
  if (Object.hasOwn(mcpServers, "opensrc")) {
    return appliedKeys;
  }

  mcpServers.opensrc = { url: "https://mcp.opensrc.dev" };
  appliedKeys.push("mcp_servers.opensrc");
  return appliedKeys;
}

function applyStatuslineProfileToValue(config: TomlTable): StatuslineProfileAppliedKey[] {
  const tui = ensureChildTable(config, "tui", "[tui] must be a table");
  const appliedKeys: StatuslineProfileAppliedKey[] = [];
  const desiredStatusLine = [...RECOMMENDED_STATUSLINE];
  const desiredTerminalTitle = [...RECOMMENDED_TERMINAL_TITLE];

  if (asString(tui.notification_condition) !== RECOMMENDED_TUI_NOTIFICATION_CONDITION) {
    tui.notification_condition = RECOMMENDED_TUI_NOTIFICATION_CONDITION;
    appliedKeys.push("tui.notification_condition");
  }

  if (!stringArraysEqual(asStringArray(tui.status_line), desiredStatusLine)) {
    tui.status_line = desiredStatusLine;
    appliedKeys.push("tui.status_line");
  }

  if (!stringArraysEqual(asStringArray(tui.terminal_title), desiredTerminalTitle)) {
    tui.terminal_title = desiredTerminalTitle;
    appliedKeys.push("tui.terminal_title");
  }

  return appliedKeys;
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
    `tui theme: ${asString(tui?.theme) ?? "unset"}`
  ];
}

function codexProfilePreviewDetails(config: TomlTable, recommended: LocalConfig): string[] {
  const features = asTomlTable(config.features);
  return codexProfileAuditFromCurrentValues(
    recommended,
    {
      model: asString(config.model),
      modelReasoningEffort: asString(config.model_reasoning_effort),
      codexHooks: displayHooks(features?.codex_hooks)
    },
    "installed"
  ).details;
}

function codexProfileApplyDetails(audit: CodexProfileAudit): string[] {
  if (audit.status !== "missing") {
    return [...audit.details];
  }

  return audit.details.filter(
    (line) => line !== "note: integrations stay outside bare core profile"
  );
}

function codexProfileAuditFromCurrentValues(
  recommended: LocalConfig,
  current: {
    model: string | null;
    modelReasoningEffort: string | null;
    codexHooks: string | null;
  },
  status: CodexProfileAudit["status"]
): CodexProfileAudit {
  const changes: CodexProfileChange[] = [];
  const details: string[] = [];

  pushCodexProfileChange(
    changes,
    details,
    "model",
    "model",
    current.model,
    recommended.models.coordinator.model
  );
  pushCodexProfileChange(
    changes,
    details,
    "model_reasoning_effort",
    "reasoning",
    current.modelReasoningEffort,
    recommended.models.coordinator.reasoningEffort
  );
  pushCodexProfileChange(
    changes,
    details,
    "features.codex_hooks",
    "codex hooks",
    current.codexHooks,
    "enabled"
  );

  if (changes.length === 0) {
    details.push("core profile already matches current recommendation");
  }

  details.push("note: this writes the single-session Codex baseline only");
  details.push("note: broader execution and realtime routing stays derived outside config.toml");
  details.push("note: Codex native memories stay outside Sane's default continuity path");
  details.push("note: integrations stay outside bare core profile");

  return {
    status: changes.length === 0 ? "installed" : status,
    recommendedChangeCount: changes.length,
    changes,
    details
  };
}

function statuslineProfileAuditFromConfig(config: TomlTable): StatuslineProfileAudit {
  const tui = asTomlTable(config.tui);
  const currentStatusLine = asStringArray(tui?.status_line);
  const currentTerminalTitle = asStringArray(tui?.terminal_title);
  const currentNotifications = asString(tui?.notification_condition);
  const details: string[] = [];
  let recommendedChangeCount = 0;

  if (currentNotifications !== RECOMMENDED_TUI_NOTIFICATION_CONDITION) {
    details.push(
      `tui.notification_condition: ${currentNotifications ?? "<missing>"} -> ${RECOMMENDED_TUI_NOTIFICATION_CONDITION}`
    );
    recommendedChangeCount += 1;
  }

  if (!stringArraysEqual(currentStatusLine, RECOMMENDED_STATUSLINE)) {
    details.push(
      `tui.status_line: ${displayStringArray(currentStatusLine)} -> ${RECOMMENDED_STATUSLINE.join(", ")}`
    );
    recommendedChangeCount += 1;
  }

  if (!stringArraysEqual(currentTerminalTitle, RECOMMENDED_TERMINAL_TITLE)) {
    details.push(
      `tui.terminal_title: ${displayStringArray(currentTerminalTitle)} -> ${RECOMMENDED_TERMINAL_TITLE.join(", ")}`
    );
    recommendedChangeCount += 1;
  }

  if (recommendedChangeCount === 0) {
    details.push("statusline profile already matches current recommendation");
  }

  details.push("note: native Codex statusline/title config only");
  details.push("note: this stays additive inside ~/.codex/config.toml");

  return {
    status: recommendedChangeCount === 0 ? "installed" : "missing",
    recommendedChangeCount,
    details
  };
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

function tomlValueEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function integrationProfileAuditFromConfig(config: TomlTable): IntegrationsProfileAudit {
  const mcpServers = asTomlTable(config.mcp_servers);
  const hasContext7 = hasTableKey(mcpServers, "context7");
  const hasPlaywright = hasTableKey(mcpServers, "playwright");
  const hasOpenSrc = hasTableKey(mcpServers, "opensrc");
  const hasGrep = hasTableKey(mcpServers, "grep") || hasTableKey(mcpServers, "grep_app");
  const recommendedTargets = [
    hasContext7 ? null : "context7",
    hasPlaywright ? null : "playwright",
    hasGrep ? null : "grep.app"
  ].filter((value): value is string => value !== null);

  return {
    status: recommendedTargets.length === 0 ? "installed" : "missing",
    recommendedChangeCount: recommendedTargets.length,
    recommendedTargets,
    optionalTargets: ["opensrc"],
    details: [
      hasContext7 ? "context7: keep installed" : "context7: missing -> recommended",
      hasPlaywright ? "playwright: keep installed" : "playwright: missing -> recommended",
      hasGrep ? "grep.app: keep installed" : "grep.app: missing -> recommended",
      hasOpenSrc
        ? "opensrc: installed but stays outside default recommended profile"
        : "opensrc: optional, not in default recommended profile"
    ]
  };
}

function cloudflareProfileAuditFromConfig(config: TomlTable): CloudflareProfileAudit {
  const mcpServers = asTomlTable(config.mcp_servers);
  const hasCloudflare = hasTableKey(mcpServers, "cloudflare-api");
  return {
    status: hasCloudflare ? "installed" : "missing",
    recommendedChangeCount: hasCloudflare ? 0 : 1,
    target: "cloudflare-api",
    details: [
      hasCloudflare
        ? "cloudflare-api: keep installed"
        : "cloudflare-api: missing -> optional provider profile",
      "oauth and permissions stay explicit at connect time",
      "note: not part of the broad recommended integrations profile"
    ]
  };
}

function opencodeProfileAuditFromConfig(config: TomlTable): OpencodeProfileAudit {
  const mcpServers = asTomlTable(config.mcp_servers);
  const hasOpenSrc = hasTableKey(mcpServers, "opensrc");
  return {
    status: hasOpenSrc ? "installed" : "missing",
    recommendedChangeCount: hasOpenSrc ? 0 : 1,
    target: "opensrc",
    details: [
      hasOpenSrc
        ? "opensrc: keep installed"
        : "opensrc: missing -> optional Opencode compatibility profile",
      "note: not part of Sane's default recommended integrations",
      "note: this keeps Codex config additive and leaves broader Opencode setup separate"
    ]
  };
}

function pushProfileChange(details: string[], label: string, current: string, recommended: string): void {
  details.push(
    current === recommended ? `${label}: keep ${recommended}` : `${label}: ${current} -> ${recommended}`
  );
}

function pushCodexProfileChange(
  changes: CodexProfileChange[],
  details: string[],
  key: CodexProfileChange["key"],
  label: string,
  current: string | null,
  recommended: string
): void {
  const displayCurrent = current ?? "<missing>";
  if (current !== recommended) {
    changes.push({ key, current, recommended });
  }
  pushProfileChange(details, label, displayCurrent, recommended);
}

function ensureChildTable(parent: TomlTable, key: string, errorMessage: string): TomlTable {
  const existing = parent[key];
  if (existing === undefined) {
    const created: TomlTable = {};
    parent[key] = created;
    return created;
  }
  if (!isTomlTable(existing)) {
    throw new Error(errorMessage);
  }
  return existing;
}

function cloneTable(value: TomlTable): TomlTable {
  return JSON.parse(JSON.stringify(value)) as TomlTable;
}

function sortedKeys(table: TomlTable | null | undefined): string[] {
  return table ? Object.keys(table).sort() : [];
}

function hasTableKey(table: TomlTable | null | undefined, key: string): boolean {
  return table ? Object.hasOwn(table, key) : false;
}

function asTomlTable(value: unknown): TomlTable | null {
  return isTomlTable(value) ? value : null;
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

function isTomlTable(value: unknown): value is TomlTable {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
