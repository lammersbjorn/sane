import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { createRecommendedLocalConfig } from "@sane/config";
import { InventoryScope, InventoryStatus, OperationKind, OperationResult } from "@sane/core";
import {
  createOptionalPackSkills,
  optionalPackConfigKey,
  optionalPackNames,
  optionalPackSkillNames,
  optionalPackProvenance,
  type OptionalPackName,
  type PackAssetProvenance
} from "@sane/framework-assets";
import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/platform";
import { listCanonicalBackupSiblings } from "@sane/state";

import { installableCoreInstallBundleTargets } from "./core-install-bundle-targets.js";
import {
  inspectCodexConfigConflictWarnings,
  inspectCodexConfigInventory,
  type CodexConfigConflictWarning
} from "./codex-config.js";
import { inspectCodexSkillsAndAgents } from "./codex-native.js";
import { inspectPluginInventory } from "./codex-plugin.js";
import { inspectCustomAgentsInventory, inspectHooksInventory } from "./hooks-custom-agents.js";
import { inspectSavedLocalConfig } from "./local-config.js";
import {
  isUnsupportedNativeWindowsHooks,
  presentManagedInventoryItem
} from "./status-presenter.js";
import { inspectRuntimeInventory } from "./runtime-inventory.js";
import { inspectRuntimeState } from "./runtime-state.js";

type InventoryItem = OperationResult["inventory"][number];
type InventoryStatusName =
  | "installed"
  | "configured"
  | "disabled"
  | "missing"
  | "invalid"
  | "present_without_sane_block"
  | "removed";

type DoctorInventoryName =
  | "runtime"
  | "config"
  | "current-run"
  | "summary"
  | "brief"
  | "pack-core"
  | "codex-config"
  | "user-skills"
  | "repo-skills"
  | "repo-agents"
  | "global-agents"
  | "hooks"
  | "custom-agents"
  | "plugin";

type PackConfigState =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "loaded"; config: ReturnType<typeof createRecommendedLocalConfig> };

type PackInventoryTarget =
  | {
      inventoryName: "pack-core";
      packName: "core";
    }
  | {
      inventoryName: `pack-${OptionalPackName}`;
      packName: OptionalPackName;
    };

export interface OptionalPackSnapshot {
  name: OptionalPackName;
  inventoryName: `pack-${OptionalPackName}`;
  status: InventoryStatusName;
  skillName: string | null;
  skillNames: string[];
  provenance: PackAssetProvenance | null;
}

export interface StatusBundle {
  inventory: InventoryItem[];
  localRuntime: InventoryItem[];
  codexNative: InventoryItem[];
  compatibility: InventoryItem[];
  runtimeState: ReturnType<typeof inspectRuntimeState>;
  backupHistory: {
    config: string[];
    summary: string[];
  };
  optionalPacks: OptionalPackSnapshot[];
  driftItems: InventoryItem[];
  conflictWarnings: CodexConfigConflictWarning[];
  counts: Record<InventoryStatusName, number>;
  primary: {
    runtime: InventoryItem | null;
    codexConfig: InventoryItem | null;
    userSkills: InventoryItem | null;
    hooks: InventoryItem | null;
    customAgents: InventoryItem | null;
    installBundle: "installed" | "missing";
    status: {
      runtime: InventoryStatusName;
      codexConfig: InventoryStatusName;
      userSkills: InventoryStatusName;
      hooks: InventoryStatusName;
      customAgents: InventoryStatusName;
      installBundle: "installed" | "missing";
    };
  };
}

export type OnboardingReasonId =
  | "install_runtime"
  | "show_codex_config"
  | "export_all"
  | "review_sections";

export type OnboardingAttentionItemId =
  | "runtime"
  | "config"
  | "codex-config"
  | "user-skills"
  | "hooks"
  | "custom-agents";

export interface OnboardingAttentionItem {
  id: OnboardingAttentionItemId;
  status: InventoryStatusName;
}

export interface OnboardingSnapshot {
  recommendedActionId: "install_runtime" | "show_codex_config" | "export_all" | null;
  recommendedReason: OnboardingReasonId;
  attentionItems: OnboardingAttentionItem[];
  primaryStatuses: StatusBundle["primary"]["status"];
}

export interface DoctorSnapshot {
  headline: string;
  lines: string[];
}

interface OnboardingLookups {
  runtime: InventoryItem | null;
  config: InventoryItem | null;
  codexConfig: InventoryItem | null;
  userSkills: InventoryItem | null;
  hooks: InventoryItem | null;
  customAgents: InventoryItem | null;
}

const DOCTOR_ROW_NAMES: DoctorInventoryName[] = [
  "runtime",
  "config",
  "current-run",
  "summary",
  "brief",
  "pack-core",
  "codex-config",
  "user-skills",
  "repo-skills",
  "repo-agents",
  "global-agents",
  "hooks",
  "custom-agents",
  "plugin"
];

const DOCTOR_STATUS_FORMATTERS: Partial<Record<DoctorInventoryName, (item: InventoryItem) => string>> = {
  runtime: (item) => (item.status === InventoryStatus.Installed ? "ok" : item.status.asString()),
  config: (item) =>
    item.status === InventoryStatus.Installed
      ? "ok"
      : item.status === InventoryStatus.Missing
        ? "missing"
        : item.status === InventoryStatus.Invalid
          ? "invalid (rerun install)"
          : item.status.asString(),
  "current-run": (item) =>
    doctorInstallFileLabel(item, "current-run.json"),
  summary: (item) => doctorInstallFileLabel(item, "summary.json"),
  brief: (item) =>
    item.status === InventoryStatus.Installed ? "ok" : "missing BRIEF.md (rerun install)",
  "pack-core": doctorPackLabel,
  "codex-config": (item) => doctorManagedConfigLabel(item, "apply codex-profile", "~/.codex/config.toml"),
  "user-skills": (item) => doctorExportLabel(item, "export user-skills"),
  "repo-skills": (item) =>
    item.status === InventoryStatus.Disabled ? "disabled (optional repo export)" : doctorExportLabel(item, "export repo-skills"),
  "repo-agents": (item) =>
    item.status === InventoryStatus.Disabled
      ? "disabled (optional repo export)"
      : item.status === InventoryStatus.PresentWithoutSaneBlock
        ? "present without Sane block"
        : doctorExportLabel(item, "export repo-agents"),
  "global-agents": (item) =>
    item.status === InventoryStatus.PresentWithoutSaneBlock
      ? "present without Sane block"
      : doctorExportLabel(item, "export global-agents"),
  hooks: (item) => doctorManagedConfigLabel(item, "export hooks", "~/.codex/hooks.json"),
  "custom-agents": (item) => doctorExportLabel(item, "export custom-agents"),
  plugin: doctorPluginLabel
};

const PACK_INVENTORY_TARGETS: PackInventoryTarget[] = [
  {
    inventoryName: "pack-core",
    packName: "core"
  },
  ...optionalPackNames().map((packName) => ({
    inventoryName: optionalPackInventoryName(packName),
    packName
  }))
];

const OPTIONAL_PACK_INVENTORY_TARGETS = PACK_INVENTORY_TARGETS.filter(
  (target): target is Extract<PackInventoryTarget, { packName: OptionalPackName }> => target.packName !== "core"
);

const GUIDANCE_WARNING_MAX_LINES = 220;
const GUIDANCE_WARNING_MAX_CHARS = 12_000;

export function showStatus(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  return showStatusFromStatusBundle(inspectStatusBundle(paths, codexPaths));
}

export function showStatusFromStatusBundle(bundle: StatusBundle): OperationResult {
  return new OperationResult({
    kind: OperationKind.ShowStatus,
    summary: `status: ${bundle.inventory.length} managed targets inspected`,
    details: [],
    pathsTouched: collectPathsTouched(bundle.inventory),
    inventory: bundle.inventory
  });
}

export function doctor(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  return doctorForStatusBundle(paths, codexPaths, inspectStatusBundle(paths, codexPaths));
}

export function doctorForStatusBundle(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  bundle: StatusBundle
): OperationResult {
  const snapshot = inspectDoctorSnapshot(paths, codexPaths, bundle);

  return new OperationResult({
    kind: OperationKind.Doctor,
    summary: snapshot.lines.join("\n"),
    details: [],
    pathsTouched: collectPathsTouched(bundle.inventory),
    inventory: bundle.inventory
  });
}

export function inspectDoctorSnapshot(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  bundle: StatusBundle = inspectStatusBundle(paths, codexPaths)
): DoctorSnapshot {
  const lines = [
    ...DOCTOR_ROW_NAMES.slice(0, 2).map((name) => doctorInventoryLine(bundle.inventory, name)),
    `config-backups: ${canonicalBackupHistorySummary(bundle.backupHistory.config)}`,
    ...DOCTOR_ROW_NAMES.slice(2, 4).map((name) => doctorInventoryLine(bundle.inventory, name)),
    `summary-backups: ${canonicalBackupHistorySummary(bundle.backupHistory.summary)}`,
    ...DOCTOR_ROW_NAMES.slice(4, 6).map((name) => doctorInventoryLine(bundle.inventory, name)),
    ...OPTIONAL_PACK_INVENTORY_TARGETS.map(({ inventoryName }) =>
      doctorInventoryLine(bundle.inventory, inventoryName)
    ),
    ...DOCTOR_ROW_NAMES.slice(6).map((name) => doctorInventoryLine(bundle.inventory, name)),
    `root: ${paths.runtimeRoot}`,
    `codex-home: ${codexPaths.codexHome}`
  ];

  return {
    headline: lines[0] ?? "no doctor output",
    lines
  };
}

export function inspectStatusBundle(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform = detectPlatform()
): StatusBundle {
  const runtimeState = inspectRuntimeState(paths);
  const inventory = [
    ...inspectRuntimeInventory(paths, runtimeState),
    ...inspectPackInventory(paths, codexPaths),
    inspectCodexConfigInventory(codexPaths),
    ...inspectCodexSkillsAndAgents(paths, codexPaths),
    inspectHooksInventory(paths, codexPaths, hostPlatform),
    inspectCustomAgentsInventory(paths, codexPaths),
    inspectPluginInventory(codexPaths)
  ];

  const localRuntime = inventory.filter((item) => item.scope === InventoryScope.LocalRuntime);
  const codexNative = inventory.filter((item) => item.scope === InventoryScope.CodexNative);
  const compatibility = inventory.filter((item) => item.scope === InventoryScope.Compatibility);
  const conflictWarnings = [
    ...inspectCodexConfigConflictWarnings(codexPaths),
    ...inspectGuidanceFileWarnings(paths, codexPaths)
  ];
  const driftItems = inventory.filter(
    (item) =>
      item.status === InventoryStatus.Invalid
      && !isUnsupportedNativeWindowsHooks(item)
      || item.status === InventoryStatus.PresentWithoutSaneBlock
  );
  const countedInventory = inventory.filter((item) => !isUnsupportedNativeWindowsHooks(item));

  return {
    inventory,
    localRuntime,
    codexNative,
    compatibility,
    runtimeState,
    backupHistory: {
      config: listCanonicalBackupSiblings(paths.configPath),
      summary: listCanonicalBackupSiblings(paths.summaryPath)
    },
    optionalPacks: inspectOptionalPackSnapshots(inventory),
    driftItems,
    conflictWarnings,
    counts: countStatuses(countedInventory),
    primary: {
      runtime: findInventoryOrNull(inventory, "runtime"),
      codexConfig: findInventoryOrNull(inventory, "codex-config"),
      userSkills: findInventoryOrNull(inventory, "user-skills"),
      hooks: findInventoryOrNull(inventory, "hooks"),
      customAgents: findInventoryOrNull(inventory, "custom-agents"),
      installBundle: bundleInstallState(inventory, hostPlatform),
      status: {
        runtime: inventoryStatusName(findInventoryOrNull(inventory, "runtime")),
        codexConfig: inventoryStatusName(findInventoryOrNull(inventory, "codex-config")),
        userSkills: inventoryStatusName(findInventoryOrNull(inventory, "user-skills")),
        hooks: inventoryStatusName(findInventoryOrNull(inventory, "hooks")),
        customAgents: inventoryStatusName(findInventoryOrNull(inventory, "custom-agents")),
        installBundle: bundleInstallState(inventory, hostPlatform)
      }
    }
  };
}

export function inspectOnboardingSnapshot(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): OnboardingSnapshot {
  const statusBundle = inspectStatusBundle(paths, codexPaths);
  return inspectOnboardingSnapshotFromStatusBundle(paths, statusBundle);
}

export function inspectOnboardingSnapshotFromStatusBundle(
  paths: ProjectPaths,
  statusBundle: ReturnType<typeof inspectStatusBundle>
): OnboardingSnapshot {
  const recommendedActionId = recommendedOnboardingAction(statusBundle);

  return {
    recommendedActionId,
    recommendedReason: recommendedOnboardingReason(recommendedActionId),
    attentionItems: onboardingAttentionItems(paths, statusBundle),
    primaryStatuses: statusBundle.primary.status
  };
}

function inspectPackInventory(paths: ProjectPaths, codexPaths: CodexPaths): InventoryItem[] {
  const configState = loadConfigState(paths);

  return PACK_INVENTORY_TARGETS.map(({ inventoryName, packName }) => {
    const status = packInventoryStatus(configState, paths, codexPaths, packName);

    return {
      name: inventoryName,
      scope: InventoryScope.LocalRuntime,
      status,
      path: paths.configPath,
      repairHint:
        configState.kind === "missing"
          ? "run `install`"
          : configState.kind === "invalid"
            ? "repair config first"
            : packName === "core"
              ? null
              : status === InventoryStatus.Configured
                ? "run `export user-skills` or `export repo-skills`"
                : null
    };
  });
}

function inspectOptionalPackSnapshots(inventory: InventoryItem[]): OptionalPackSnapshot[] {
  return OPTIONAL_PACK_INVENTORY_TARGETS.map(({ packName, inventoryName }) => {
    const item = findInventoryOrNull(inventory, inventoryName);

    return {
      name: packName,
      inventoryName,
      status: inventoryStatusName(item),
      skillName: optionalPackSkillNames(packName)[0] ?? null,
      skillNames: optionalPackSkillNames(packName),
      provenance: optionalPackProvenance(packName) ?? null
    };
  });
}

function inspectGuidanceFileWarnings(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): CodexConfigConflictWarning[] {
  return [
    inspectGuidanceFileWarning("AGENTS.md", paths.repoAgentsMd),
    inspectGuidanceFileWarning("~/.codex/AGENTS.md", codexPaths.globalAgentsMd)
  ].filter((warning): warning is CodexConfigConflictWarning => warning !== null);
}

function inspectGuidanceFileWarning(
  target: string,
  path: string
): CodexConfigConflictWarning | null {
  if (!existsSync(path)) {
    return null;
  }

  const body = readFileSync(path, "utf8");
  const lineCount = body.split("\n").length;
  if (lineCount <= GUIDANCE_WARNING_MAX_LINES && body.length <= GUIDANCE_WARNING_MAX_CHARS) {
    return null;
  }

  return {
    kind: "oversized_guidance_file",
    target,
    path,
    message: `guidance file is large (${lineCount} lines, ${body.length} chars); prefer narrow skills and repo-native config over always-loaded context`
  };
}

function packStatusFromConfig(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  config: ReturnType<typeof createRecommendedLocalConfig>,
  packName: PackInventoryTarget["packName"]
) {
  if (packName === "core") {
    return config.packs.core ? InventoryStatus.Installed : InventoryStatus.Disabled;
  }

  const configKey = optionalPackConfigKey(packName);
  return config.packs[configKey]
    ? packSkillStatus(paths, codexPaths, packName)
    : InventoryStatus.Disabled;
}

function packSkillStatus(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  packName: OptionalPackName
) {
  const expectedSkills = createOptionalPackSkills(packName);
  if (expectedSkills.length === 0) {
    return InventoryStatus.Configured;
  }

  for (const skillsRoot of [codexPaths.userSkillsDir, paths.repoSkillsDir]) {
    let foundAny = false;
    let matchedAll = true;

    for (const skill of expectedSkills) {
      const skillDir = join(skillsRoot, skill.name);
      const skillPath = join(skillDir, "SKILL.md");
      const skillDirPresent = existsSync(skillDir);
      try {
        const body = readFileSync(skillPath, "utf8");
        foundAny = true;
        if (body !== skill.content) {
          return InventoryStatus.Invalid;
        }

        for (const resource of skill.resources) {
          const resourcePath = join(skillDir, resource.path);
          const resourceBody = readFileSync(resourcePath, "utf8");
          if (resourceBody !== resource.content) {
            return InventoryStatus.Invalid;
          }
        }
      } catch {
        if (skillDirPresent) {
          return InventoryStatus.Invalid;
        }
        matchedAll = false;
      }
    }

    if (matchedAll && foundAny) {
      return InventoryStatus.Installed;
    }

    if (foundAny) {
      return InventoryStatus.Configured;
    }
  }

  return InventoryStatus.Configured;
}

function packInventoryStatus(
  configState: PackConfigState,
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  packName: PackInventoryTarget["packName"]
): InventoryStatus {
  return configState.kind === "missing"
    ? InventoryStatus.Missing
    : configState.kind === "invalid"
      ? InventoryStatus.Invalid
      : packStatusFromConfig(paths, codexPaths, configState.config, packName);
}

function loadConfigState(paths: ProjectPaths): PackConfigState {
  return inspectSavedLocalConfig(paths);
}

function findInventory(inventory: InventoryItem[], name: string): InventoryItem {
  return inventory.find((item) => item.name === name)!;
}

function findInventoryOrNull(inventory: InventoryItem[], name: string): InventoryItem | null {
  return inventory.find((item) => item.name === name) ?? null;
}

function bundleInstallState(
  inventory: InventoryItem[],
  hostPlatform: HostPlatform = detectPlatform()
): "installed" | "missing" {
  return installableCoreInstallBundleTargets(hostPlatform).every(
    (name) => findInventory(inventory, name).status === InventoryStatus.Installed
  )
    ? "installed"
    : "missing";
}

function countStatuses(inventory: InventoryItem[]): Record<InventoryStatusName, number> {
  const counts: Record<InventoryStatusName, number> = {
    installed: 0,
    configured: 0,
    disabled: 0,
    missing: 0,
    invalid: 0,
    present_without_sane_block: 0,
    removed: 0
  };

  for (const item of inventory) {
    counts[item.status.asString() as InventoryStatusName] += 1;
  }

  return counts;
}

function recommendedOnboardingAction(
  statusBundle: StatusBundle
): OnboardingSnapshot["recommendedActionId"] {
  const lookups = loadOnboardingLookups(statusBundle);

  if (isMissingOrInvalid(lookups.runtime?.status) || isMissingOrInvalid(lookups.config?.status)) {
    return "install_runtime";
  }
  if (isMissingOrInvalid(lookups.codexConfig?.status)) {
    return "show_codex_config";
  }
  if (statusBundle.primary.installBundle !== "installed") {
    return "export_all";
  }
  return null;
}

function recommendedOnboardingReason(action: OnboardingSnapshot["recommendedActionId"]): OnboardingReasonId {
  switch (action) {
    case "install_runtime":
      return "install_runtime";
    case "show_codex_config":
      return "show_codex_config";
    case "export_all":
      return "export_all";
    default:
      return "review_sections";
  }
}

function onboardingAttentionItems(
  paths: ProjectPaths,
  statusBundle: StatusBundle
): OnboardingAttentionItem[] {
  const lookups = loadOnboardingLookups(statusBundle);
  const items: OnboardingAttentionItem[] = [];

  if (isMissingOrInvalid(lookups.runtime?.status) || isMissingOrInvalid(lookups.config?.status)) {
    items.push({ id: "runtime", status: inventoryStatusName(lookups.runtime) });
    items.push({
      id: "config",
      status: existsSync(paths.configPath) ? inventoryStatusName(lookups.config) : "missing"
    });
  }
  if (isMissingOrInvalid(lookups.codexConfig?.status)) {
    items.push({ id: "codex-config", status: inventoryStatusName(lookups.codexConfig) });
  }
  if (isMissingOrInvalid(lookups.userSkills?.status)) {
    items.push({ id: "user-skills", status: inventoryStatusName(lookups.userSkills) });
  }
  if (isMissingOrInvalid(lookups.hooks?.status) && !isUnsupportedNativeWindowsHooks(lookups.hooks)) {
    items.push({ id: "hooks", status: inventoryStatusName(lookups.hooks) });
  }
  if (isMissingOrInvalid(lookups.customAgents?.status)) {
    items.push({ id: "custom-agents", status: inventoryStatusName(lookups.customAgents) });
  }

  return items;
}

function loadOnboardingLookups(statusBundle: StatusBundle): OnboardingLookups {
  return {
    runtime: statusBundle.primary.runtime,
    config: findInventoryOrNull(statusBundle.inventory, "config"),
    codexConfig: statusBundle.primary.codexConfig,
    userSkills: statusBundle.primary.userSkills,
    hooks: statusBundle.primary.hooks,
    customAgents: statusBundle.primary.customAgents
  };
}

function isMissingOrInvalid(status: InventoryStatus | undefined): boolean {
  return status === InventoryStatus.Missing || status === InventoryStatus.Invalid;
}

function inventoryStatusName(item: InventoryItem | null): InventoryStatusName {
  return (item?.status.asString() as InventoryStatusName | undefined) ?? "missing";
}

function doctorStatus(item: InventoryItem): string {
  if (item.name.startsWith("pack-")) {
    return doctorPackLabel(item);
  }

  const formatter = DOCTOR_STATUS_FORMATTERS[item.name as DoctorInventoryName];
  return formatter ? formatter(item) : item.status.asString();
}

function optionalPackInventoryName(pack: OptionalPackName): `pack-${OptionalPackName}` {
  return `pack-${pack}`;
}

function doctorInventoryLine(inventory: InventoryItem[], name: string): string {
  return `${name}: ${doctorStatus(findInventory(inventory, name))}`;
}

function doctorManagedFallback(item: InventoryItem): string {
  return presentManagedInventoryItem(item).label;
}

function doctorInstallFileLabel(item: InventoryItem, filename: string): string {
  return item.status === InventoryStatus.Installed
    ? "ok"
    : item.status === InventoryStatus.Missing
      ? `missing ${filename} (rerun install)`
      : item.status === InventoryStatus.Invalid
        ? `invalid ${filename} (rerun install)`
        : item.status.asString();
}

function doctorPackLabel(item: InventoryItem): string {
  return item.status === InventoryStatus.Installed
    ? "enabled"
    : item.status === InventoryStatus.Configured
      ? "enabled (config only)"
      : item.status === InventoryStatus.Disabled
        ? "disabled"
        : item.status === InventoryStatus.Missing
          ? "missing config (run `install`)"
          : item.status === InventoryStatus.Invalid
            ? "invalid config (repair config first)"
            : item.status.asString();
}

function doctorManagedConfigLabel(item: InventoryItem, applyCommand: string, repairPath: string): string {
  const presentation = presentManagedInventoryItem(item);

  if (presentation.label === "unsupported (use WSL)") {
    return presentation.label;
  }

  return item.status === InventoryStatus.Installed
    ? "installed"
    : item.status === InventoryStatus.Missing
      ? `missing (run \`${applyCommand}\`)`
      : item.status === InventoryStatus.Invalid
        ? `invalid (repair ${repairPath})`
        : doctorManagedFallback(item);
}

function doctorExportLabel(item: InventoryItem, exportCommand: string): string {
  return item.status === InventoryStatus.Installed
    ? "installed"
    : item.status === InventoryStatus.Missing
      ? `missing (run \`${exportCommand}\`)`
      : item.status === InventoryStatus.Invalid
        ? `invalid (rerun \`${exportCommand}\`)`
        : doctorManagedFallback(item);
}

function doctorPluginLabel(item: InventoryItem): string {
  if (item.status !== InventoryStatus.Installed) {
    return doctorExportLabel(item, "export plugin");
  }

  const version = installedPluginVersion(item.path);
  return version ? `installed (version ${version})` : "installed";
}

function installedPluginVersion(pluginDir: string): string | null {
  try {
    const parsed = JSON.parse(
      readFileSync(resolve(pluginDir, ".codex-plugin", "plugin.json"), "utf8")
    ) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version.length > 0 ? parsed.version : null;
  } catch {
    return null;
  }
}

function collectPathsTouched(inventory: InventoryItem[]): string[] {
  return [...new Set(inventory.map((item) => item.path))].sort();
}

function canonicalBackupHistorySummary(backups: string[]): string {
  if (backups.length === 0) {
    return "none";
  }

  const shown = backups.slice(0, 3).map((path) => path.split("/").at(-1) ?? path);
  const remaining = backups.length - shown.length;
  return remaining === 0
    ? `${backups.length} (${shown.join(", ")})`
    : `${backups.length} (${shown.join(", ")} +${remaining} more)`;
}
