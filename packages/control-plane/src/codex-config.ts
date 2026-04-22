import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import * as TOML from "@iarna/toml";

import { createRecommendedLocalConfig, detectCodexEnvironment, type LocalConfig } from "@sane/config";
import { InventoryScope, InventoryStatus, OperationKind, OperationResult } from "@sane/core";
import { type CodexPaths, ensureRuntimeDirs, type ProjectPaths } from "@sane/platform";

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

export interface CodexConfigBackupSnapshot {
  restoreAvailable: boolean;
}

export function showCodexConfig(codexPaths: CodexPaths): OperationResult {
  const inventory = inspectCodexConfigInventory(codexPaths);

  if (inventory.status === InventoryStatus.Missing) {
    return new OperationResult({
      kind: OperationKind.ShowCodexConfig,
      summary: `codex-config: missing at ${codexPaths.configToml}`,
      details: [
        "no user Codex config exists yet",
        "use `apply codex-profile` or `apply integrations-profile` to create one"
      ],
      pathsTouched: [codexPaths.configToml],
      inventory: [inventory]
    });
  }

  return new OperationResult({
    kind: OperationKind.ShowCodexConfig,
    summary: `codex-config: ok at ${codexPaths.configToml}`,
    details: codexConfigDetails(readCodexConfig(codexPaths.configToml)),
    pathsTouched: [codexPaths.configToml],
    inventory: [inventory]
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
  const inventory = inspectCodexConfigInventory(codexPaths);
  const audit = inspectCodexProfileAudit(codexPaths);

  return new OperationResult({
    kind: OperationKind.PreviewCodexProfile,
    summary: `codex-profile preview: ${audit.recommendedChangeCount} recommended change(s)`,
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [inventory]
  });
}

export function previewIntegrationsProfile(codexPaths: CodexPaths): OperationResult {
  const inventory = inspectCodexConfigInventory(codexPaths);
  const audit = inspectIntegrationsProfileAudit(codexPaths);

  return new OperationResult({
    kind: OperationKind.PreviewIntegrationsProfile,
    summary: `integrations-profile preview: ${audit.recommendedChangeCount} recommended change(s)`,
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [inventory]
  });
}

export function previewCloudflareProfile(codexPaths: CodexPaths): OperationResult {
  const inventory = inspectCodexConfigInventory(codexPaths);
  const audit = inspectCloudflareProfileAudit(codexPaths);

  return new OperationResult({
    kind: OperationKind.PreviewCloudflareProfile,
    summary: `cloudflare-profile preview: ${audit.recommendedChangeCount} recommended change(s)`,
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [inventory]
  });
}

export function previewOpencodeProfile(codexPaths: CodexPaths): OperationResult {
  const inventory = inspectCodexConfigInventory(codexPaths);
  const audit = inspectOpencodeProfileAudit(codexPaths);

  return new OperationResult({
    kind: OperationKind.PreviewOpencodeProfile,
    summary: `opencode-profile preview: ${audit.recommendedChangeCount} recommended change(s)`,
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [inventory]
  });
}

export function applyCodexProfile(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  ensureRuntimeDirs(paths);
  const recommended = recommendedLocalConfig(codexPaths);
  const inventory = inspectCodexConfigInventory(codexPaths);
  const audit = inspectCodexProfileAudit(codexPaths);

  if (inventory.status === InventoryStatus.Invalid) {
    return new OperationResult({
      kind: OperationKind.ApplyCodexProfile,
      summary: "codex-profile apply: blocked by invalid config",
      details: [
        "repair ~/.codex/config.toml first",
        "Sane only writes after a clean parse"
      ],
      pathsTouched: [codexPaths.configToml],
      inventory: [inventory]
    });
  }

  const backupPath =
    inventory.status === InventoryStatus.Installed ? writeCodexConfigBackup(paths, codexPaths) : null;
  const config =
    inventory.status === InventoryStatus.Installed ? readCodexConfig(codexPaths.configToml) : {};
  const details = codexProfileApplyDetails(audit);

  applyCoreCodexProfileToValue(config, recommended);
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
  const inventory = inspectCodexConfigInventory(codexPaths);
  const applyResult = inspectIntegrationsProfileApplyResult(codexPaths);

  if (applyResult.status === "blocked_invalid") {
    return new OperationResult({
      kind: OperationKind.ApplyIntegrationsProfile,
      summary: "integrations-profile apply: blocked by invalid config",
      details: applyResult.details,
      pathsTouched: [codexPaths.configToml],
      inventory: [inventory]
    });
  }

  const currentConfig =
    inventory.status === InventoryStatus.Installed ? readCodexConfig(codexPaths.configToml) : {};
  const details = [...applyResult.details];

  const updatedConfig = cloneTable(currentConfig);
  if (applyResult.status === "already_satisfied") {
    return new OperationResult({
      kind: OperationKind.ApplyIntegrationsProfile,
      summary: "integrations-profile apply: already satisfied",
      details,
      pathsTouched: [codexPaths.configToml],
      inventory: [inventory]
    });
  }
  applyIntegrationsProfileToValue(updatedConfig);

  const backupPath =
    inventory.status === InventoryStatus.Installed ? writeCodexConfigBackup(paths, codexPaths) : null;
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
  const inventory = inspectCodexConfigInventory(codexPaths);

  if (inventory.status === InventoryStatus.Invalid) {
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

  if (inventory.status === InventoryStatus.Missing) {
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

  return integrationProfileAuditFromConfig(readCodexConfig(codexPaths.configToml));
}

export function inspectIntegrationsProfileStatus(codexPaths: CodexPaths): IntegrationsProfileStatus {
  return inspectIntegrationsProfileAudit(codexPaths).status;
}

export function inspectIntegrationsProfileApplyResult(
  codexPaths: CodexPaths
): IntegrationsProfileApplyResult {
  const inventory = inspectCodexConfigInventory(codexPaths);
  if (inventory.status === InventoryStatus.Invalid) {
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

  const currentConfig =
    inventory.status === InventoryStatus.Installed ? readCodexConfig(codexPaths.configToml) : {};
  const appliedKeys: IntegrationsProfileAppliedKey[] = applyIntegrationsProfileToValue(
    cloneTable(currentConfig)
  );
  const audit = inspectIntegrationsProfileAudit(codexPaths);
  return {
    status: appliedKeys.length === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys,
    details: [...audit.details]
  };
}

export function inspectCodexProfileAudit(codexPaths: CodexPaths): CodexProfileAudit {
  const recommended = recommendedLocalConfig(codexPaths);
  const inventory = inspectCodexConfigInventory(codexPaths);

  if (inventory.status === InventoryStatus.Invalid) {
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

  if (inventory.status === InventoryStatus.Missing) {
    return codexProfileAuditFromCurrentValues(recommended, {
      model: null,
      modelReasoningEffort: null,
      codexHooks: null
    }, "missing");
  }

  const config = readCodexConfig(codexPaths.configToml);
  const features = asTomlTable(config.features);
  return codexProfileAuditFromCurrentValues(
    recommended,
    {
      model: asString(config.model),
      modelReasoningEffort: asString(config.model_reasoning_effort),
      codexHooks: displayHooks(features?.codex_hooks)
    },
    "missing"
  );
}

export function inspectCloudflareProfileAudit(codexPaths: CodexPaths): CloudflareProfileAudit {
  const inventory = inspectCodexConfigInventory(codexPaths);

  if (inventory.status === InventoryStatus.Invalid) {
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

  if (inventory.status === InventoryStatus.Missing) {
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

  return cloudflareProfileAuditFromConfig(readCodexConfig(codexPaths.configToml));
}

export function inspectCloudflareProfileStatus(codexPaths: CodexPaths): CloudflareProfileStatus {
  return inspectCloudflareProfileAudit(codexPaths).status;
}

export function inspectCloudflareProfileApplyResult(codexPaths: CodexPaths): CloudflareProfileApplyResult {
  const inventory = inspectCodexConfigInventory(codexPaths);
  if (inventory.status === InventoryStatus.Invalid) {
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

  const currentConfig =
    inventory.status === InventoryStatus.Installed ? readCodexConfig(codexPaths.configToml) : {};
  const appliedKeys: CloudflareProfileAppliedKey[] = applyCloudflareProfileToValue(
    cloneTable(currentConfig)
  );
  const audit = inspectCloudflareProfileAudit(codexPaths);
  return {
    status: appliedKeys.length === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys,
    details: [...audit.details]
  };
}

export function inspectOpencodeProfileAudit(codexPaths: CodexPaths): OpencodeProfileAudit {
  const inventory = inspectCodexConfigInventory(codexPaths);

  if (inventory.status === InventoryStatus.Invalid) {
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

  if (inventory.status === InventoryStatus.Missing) {
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

  return opencodeProfileAuditFromConfig(readCodexConfig(codexPaths.configToml));
}

export function inspectOpencodeProfileStatus(codexPaths: CodexPaths): OpencodeProfileStatus {
  return inspectOpencodeProfileAudit(codexPaths).status;
}

export function inspectOpencodeProfileApplyResult(codexPaths: CodexPaths): OpencodeProfileApplyResult {
  const inventory = inspectCodexConfigInventory(codexPaths);
  if (inventory.status === InventoryStatus.Invalid) {
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

  const currentConfig =
    inventory.status === InventoryStatus.Installed ? readCodexConfig(codexPaths.configToml) : {};
  const appliedKeys: OpencodeProfileAppliedKey[] = applyOpencodeProfileToValue(
    cloneTable(currentConfig)
  );
  const audit = inspectOpencodeProfileAudit(codexPaths);
  return {
    status: appliedKeys.length === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys,
    details: [...audit.details]
  };
}

export function applyCloudflareProfile(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  ensureRuntimeDirs(paths);
  const inventory = inspectCodexConfigInventory(codexPaths);
  const applyResult = inspectCloudflareProfileApplyResult(codexPaths);

  if (applyResult.status === "blocked_invalid") {
    return new OperationResult({
      kind: OperationKind.ApplyCloudflareProfile,
      summary: "cloudflare-profile apply: blocked by invalid config",
      details: applyResult.details,
      pathsTouched: [codexPaths.configToml],
      inventory: [inventory]
    });
  }

  const currentConfig =
    inventory.status === InventoryStatus.Installed ? readCodexConfig(codexPaths.configToml) : {};
  const details = [...applyResult.details];

  const updatedConfig = cloneTable(currentConfig);
  if (applyResult.status === "already_satisfied") {
    return new OperationResult({
      kind: OperationKind.ApplyCloudflareProfile,
      summary: "cloudflare-profile apply: already satisfied",
      details,
      pathsTouched: [codexPaths.configToml],
      inventory: [inventory]
    });
  }
  applyCloudflareProfileToValue(updatedConfig);

  const backupPath =
    inventory.status === InventoryStatus.Installed ? writeCodexConfigBackup(paths, codexPaths) : null;
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
  const inventory = inspectCodexConfigInventory(codexPaths);
  const applyResult = inspectOpencodeProfileApplyResult(codexPaths);

  if (applyResult.status === "blocked_invalid") {
    return new OperationResult({
      kind: OperationKind.ApplyOpencodeProfile,
      summary: "opencode-profile apply: blocked by invalid config",
      details: applyResult.details,
      pathsTouched: [codexPaths.configToml],
      inventory: [inventory]
    });
  }

  const currentConfig =
    inventory.status === InventoryStatus.Installed ? readCodexConfig(codexPaths.configToml) : {};
  const details = [...applyResult.details];

  const updatedConfig = cloneTable(currentConfig);
  if (applyResult.status === "already_satisfied") {
    return new OperationResult({
      kind: OperationKind.ApplyOpencodeProfile,
      summary: "opencode-profile apply: already satisfied",
      details,
      pathsTouched: [codexPaths.configToml],
      inventory: [inventory]
    });
  }
  applyOpencodeProfileToValue(updatedConfig);

  const backupPath =
    inventory.status === InventoryStatus.Installed ? writeCodexConfigBackup(paths, codexPaths) : null;
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

export function inspectCodexConfigBackupSnapshot(paths: ProjectPaths): CodexConfigBackupSnapshot {
  return {
    restoreAvailable: existsSync(paths.codexConfigBackupsDir)
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
    inventory: [installedCodexConfigInventory(codexPaths)]
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

function recommendedLocalConfig(codexPaths: CodexPaths): LocalConfig {
  return createRecommendedLocalConfig(
    detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson)
  );
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
  writeFileSync(path, `${TOML.stringify(config as TOML.JsonMap).trimEnd()}\n`, "utf8");
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
  const backupPath = join(paths.codexConfigBackupsDir, `config-${timestamp}.toml`);
  mkdirSync(paths.codexConfigBackupsDir, { recursive: true });
  copyFileSync(codexPaths.configToml, backupPath);
  return backupPath;
}

function latestCodexConfigBackup(paths: ProjectPaths): string | null {
  if (!existsSync(paths.codexConfigBackupsDir)) {
    return null;
  }

  const backups = readdirSync(paths.codexConfigBackupsDir)
    .map((name) => join(paths.codexConfigBackupsDir, name))
    .sort();

  return backups.at(-1) ?? null;
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
    `mcp servers: ${mcpServers.length}`,
    `mcp server names: ${mcpServers.length === 0 ? "none" : mcpServers.join(", ")}`,
    `enabled plugins: ${enabledPlugins.length}`,
    `plugin names: ${enabledPlugins.length === 0 ? "none" : enabledPlugins.join(", ")}`,
    `trusted projects: ${projects ? Object.keys(projects).length : 0}`,
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
  details.push("note: integrations stay outside bare core profile");

  return {
    status: changes.length === 0 ? "installed" : status,
    recommendedChangeCount: changes.length,
    changes,
    details
  };
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
