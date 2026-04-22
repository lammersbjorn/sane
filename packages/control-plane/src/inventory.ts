import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createRecommendedLocalConfig, detectCodexEnvironment, readLocalConfig } from "@sane/config";
import { InventoryScope, InventoryStatus, OperationKind, OperationResult } from "@sane/core";
import { createOptionalPackSkill, optionalPackSkillName } from "@sane/framework-assets";
import { type CodexPaths, type ProjectPaths } from "@sane/platform";
import { listCanonicalBackupSiblings } from "@sane/state";

import { CORE_INSTALL_BUNDLE_TARGETS } from "./core-install-bundle-targets.js";
import { inspectCodexConfigInventory } from "./codex-config.js";
import { inspectCodexSkillsAndAgents } from "./codex-native.js";
import { inspectCustomAgentsInventory, inspectHooksInventory } from "./hooks-custom-agents.js";
import { inspectOpencodeAgentsInventory } from "./opencode-native.js";
import { showRuntimeStatus } from "./index.js";

type InventoryItem = OperationResult["inventory"][number];
type InventoryStatusName =
  | "installed"
  | "configured"
  | "disabled"
  | "missing"
  | "invalid"
  | "present_without_sane_block"
  | "removed";

export interface StatusBundle {
  inventory: InventoryItem[];
  localRuntime: InventoryItem[];
  codexNative: InventoryItem[];
  compatibility: InventoryItem[];
  driftItems: InventoryItem[];
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

export function showStatus(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const bundle = inspectStatusBundle(paths, codexPaths);

  return new OperationResult({
    kind: OperationKind.ShowStatus,
    summary: `status: ${bundle.inventory.length} managed targets inspected`,
    details: [],
    pathsTouched: collectPathsTouched(bundle.inventory),
    inventory: bundle.inventory
  });
}

export function doctor(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const bundle = inspectStatusBundle(paths, codexPaths);
  const configBackups = listCanonicalBackupSiblings(paths.configPath);
  const summaryBackups = listCanonicalBackupSiblings(paths.summaryPath);

  return new OperationResult({
    kind: OperationKind.Doctor,
    summary: [
      `runtime: ${doctorStatus(findInventory(bundle.inventory, "runtime"))}`,
      `config: ${doctorStatus(findInventory(bundle.inventory, "config"))}`,
      `config-backups: ${canonicalBackupHistorySummary(configBackups)}`,
      `current-run: ${doctorStatus(findInventory(bundle.inventory, "current-run"))}`,
      `summary: ${doctorStatus(findInventory(bundle.inventory, "summary"))}`,
      `summary-backups: ${canonicalBackupHistorySummary(summaryBackups)}`,
      `brief: ${doctorStatus(findInventory(bundle.inventory, "brief"))}`,
      `pack-core: ${doctorStatus(findInventory(bundle.inventory, "pack-core"))}`,
      `pack-caveman: ${doctorStatus(findInventory(bundle.inventory, "pack-caveman"))}`,
      `pack-cavemem: ${doctorStatus(findInventory(bundle.inventory, "pack-cavemem"))}`,
      `pack-rtk: ${doctorStatus(findInventory(bundle.inventory, "pack-rtk"))}`,
      `pack-frontend-craft: ${doctorStatus(findInventory(bundle.inventory, "pack-frontend-craft"))}`,
      `codex-config: ${doctorStatus(findInventory(bundle.inventory, "codex-config"))}`,
      `user-skills: ${doctorStatus(findInventory(bundle.inventory, "user-skills"))}`,
      `repo-skills: ${doctorStatus(findInventory(bundle.inventory, "repo-skills"))}`,
      `repo-agents: ${doctorStatus(findInventory(bundle.inventory, "repo-agents"))}`,
      `global-agents: ${doctorStatus(findInventory(bundle.inventory, "global-agents"))}`,
      `hooks: ${doctorStatus(findInventory(bundle.inventory, "hooks"))}`,
      `custom-agents: ${doctorStatus(findInventory(bundle.inventory, "custom-agents"))}`,
      `opencode-agents: ${doctorStatus(findInventory(bundle.inventory, "opencode-agents"))}`,
      `root: ${paths.runtimeRoot}`,
      `codex-home: ${codexPaths.codexHome}`
    ].join("\n"),
    details: [],
    pathsTouched: collectPathsTouched(bundle.inventory),
    inventory: bundle.inventory
  });
}

export function inspectStatusBundle(paths: ProjectPaths, codexPaths: CodexPaths): StatusBundle {
  const inventory = [
    ...showRuntimeStatus(paths).inventory,
    ...inspectPackInventory(paths, codexPaths),
    inspectCodexConfigInventory(codexPaths),
    ...inspectCodexSkillsAndAgents(paths, codexPaths),
    inspectHooksInventory(codexPaths),
    inspectCustomAgentsInventory(paths, codexPaths),
    inspectOpencodeAgentsInventory(paths, codexPaths)
  ];

  const localRuntime = inventory.filter((item) => item.scope === InventoryScope.LocalRuntime);
  const codexNative = inventory.filter((item) => item.scope === InventoryScope.CodexNative);
  const compatibility = inventory.filter((item) => item.scope === InventoryScope.Compatibility);
  const driftItems = inventory.filter(
    (item) =>
      item.status === InventoryStatus.Invalid
      || item.status === InventoryStatus.PresentWithoutSaneBlock
  );

  return {
    inventory,
    localRuntime,
    codexNative,
    compatibility,
    driftItems,
    counts: countStatuses(inventory),
    primary: {
      runtime: findInventoryOrNull(inventory, "runtime"),
      codexConfig: findInventoryOrNull(inventory, "codex-config"),
      userSkills: findInventoryOrNull(inventory, "user-skills"),
      hooks: findInventoryOrNull(inventory, "hooks"),
      customAgents: findInventoryOrNull(inventory, "custom-agents"),
      installBundle: bundleInstallState(inventory),
      status: {
        runtime: inventoryStatusName(findInventoryOrNull(inventory, "runtime")),
        codexConfig: inventoryStatusName(findInventoryOrNull(inventory, "codex-config")),
        userSkills: inventoryStatusName(findInventoryOrNull(inventory, "user-skills")),
        hooks: inventoryStatusName(findInventoryOrNull(inventory, "hooks")),
        customAgents: inventoryStatusName(findInventoryOrNull(inventory, "custom-agents")),
        installBundle: bundleInstallState(inventory)
      }
    }
  };
}

export function inspectOnboardingSnapshot(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): OnboardingSnapshot {
  const statusBundle = inspectStatusBundle(paths, codexPaths);
  const recommendedActionId = recommendedOnboardingAction(statusBundle);

  return {
    recommendedActionId,
    recommendedReason: recommendedOnboardingReason(recommendedActionId),
    attentionItems: onboardingAttentionItems(paths, statusBundle),
    primaryStatuses: statusBundle.primary.status
  };
}

function inspectPackInventory(paths: ProjectPaths, codexPaths: CodexPaths): InventoryItem[] {
  const configState = loadConfigState(paths, codexPaths);
  const names = [
    ["pack-core", "core"],
    ["pack-caveman", "caveman"],
    ["pack-cavemem", "cavemem"],
    ["pack-rtk", "rtk"],
    ["pack-frontend-craft", "frontend-craft"]
  ] as const;

  return names.map(([inventoryName, packName]) => {
    const status =
      configState.kind === "missing"
        ? InventoryStatus.Missing
        : configState.kind === "invalid"
          ? InventoryStatus.Invalid
          : packStatusFromConfig(paths, codexPaths, configState.config, packName);

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

function packStatusFromConfig(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  config: ReturnType<typeof createRecommendedLocalConfig>,
  packName: "core" | "caveman" | "cavemem" | "rtk" | "frontend-craft"
) {
  switch (packName) {
    case "core":
      return config.packs.core ? InventoryStatus.Installed : InventoryStatus.Disabled;
    case "caveman":
      return config.packs.caveman ? packSkillStatus(paths, codexPaths, "caveman") : InventoryStatus.Disabled;
    case "cavemem":
      return config.packs.cavemem ? packSkillStatus(paths, codexPaths, "cavemem") : InventoryStatus.Disabled;
    case "rtk":
      return config.packs.rtk ? packSkillStatus(paths, codexPaths, "rtk") : InventoryStatus.Disabled;
    case "frontend-craft":
      return config.packs.frontendCraft
        ? packSkillStatus(paths, codexPaths, "frontend-craft")
        : InventoryStatus.Disabled;
  }
}

function packSkillStatus(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  packName: "caveman" | "cavemem" | "rtk" | "frontend-craft"
) {
  const skillName = optionalPackSkillName(packName);
  const expected = createOptionalPackSkill(packName);
  if (!skillName || !expected) {
    return InventoryStatus.Configured;
  }

  for (const skillPath of [
    join(codexPaths.userSkillsDir, skillName, "SKILL.md"),
    join(paths.repoSkillsDir, skillName, "SKILL.md")
  ]) {
    try {
      const body = readFileSync(skillPath, "utf8");
      return body === expected ? InventoryStatus.Installed : InventoryStatus.Configured;
    } catch {
      continue;
    }
  }

  return InventoryStatus.Configured;
}

function loadConfigState(paths: ProjectPaths, codexPaths: CodexPaths):
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "loaded"; config: ReturnType<typeof createRecommendedLocalConfig> } {
  if (!existsSync(paths.configPath)) {
    return { kind: "missing" };
  }

  try {
    return { kind: "loaded", config: readLocalConfig(paths.configPath) };
  } catch {
    return { kind: "invalid" };
  }
}

function findInventory(inventory: InventoryItem[], name: string): InventoryItem {
  return inventory.find((item) => item.name === name)!;
}

function findInventoryOrNull(inventory: InventoryItem[], name: string): InventoryItem | null {
  return inventory.find((item) => item.name === name) ?? null;
}

function bundleInstallState(inventory: InventoryItem[]): "installed" | "missing" {
  return CORE_INSTALL_BUNDLE_TARGETS.every(
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
  const runtime = statusBundle.primary.runtime;
  const config = findInventoryOrNull(statusBundle.inventory, "config");
  const codexConfig = statusBundle.primary.codexConfig;

  if (isMissingOrInvalid(runtime?.status) || isMissingOrInvalid(config?.status)) {
    return "install_runtime";
  }
  if (isMissingOrInvalid(codexConfig?.status)) {
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
  const items: OnboardingAttentionItem[] = [];
  const runtime = statusBundle.primary.runtime;
  const config = findInventoryOrNull(statusBundle.inventory, "config");
  const codexConfig = statusBundle.primary.codexConfig;
  const userSkills = statusBundle.primary.userSkills;
  const hooks = statusBundle.primary.hooks;
  const customAgents = statusBundle.primary.customAgents;

  if (isMissingOrInvalid(runtime?.status) || isMissingOrInvalid(config?.status)) {
    items.push({ id: "runtime", status: inventoryStatusName(runtime) });
    items.push({
      id: "config",
      status: existsSync(paths.configPath) ? inventoryStatusName(config) : "missing"
    });
  }
  if (isMissingOrInvalid(codexConfig?.status)) {
    items.push({ id: "codex-config", status: inventoryStatusName(codexConfig) });
  }
  if (isMissingOrInvalid(userSkills?.status)) {
    items.push({ id: "user-skills", status: inventoryStatusName(userSkills) });
  }
  if (isMissingOrInvalid(hooks?.status)) {
    items.push({ id: "hooks", status: inventoryStatusName(hooks) });
  }
  if (isMissingOrInvalid(customAgents?.status)) {
    items.push({ id: "custom-agents", status: inventoryStatusName(customAgents) });
  }

  return items;
}

function isMissingOrInvalid(status: InventoryStatus | undefined): boolean {
  return status === InventoryStatus.Missing || status === InventoryStatus.Invalid;
}

function inventoryStatusName(item: InventoryItem | null): InventoryStatusName {
  return (item?.status.asString() as InventoryStatusName | undefined) ?? "missing";
}

function doctorStatus(item: InventoryItem): string {
  switch (item.name) {
    case "config":
      return item.status === InventoryStatus.Installed
        ? "ok"
        : item.status === InventoryStatus.Missing
          ? "missing"
          : item.status === InventoryStatus.Invalid
            ? "invalid (rerun install)"
            : item.status.asString();
    case "current-run":
      return item.status === InventoryStatus.Installed
        ? "ok"
        : item.status === InventoryStatus.Missing
          ? "missing current-run.json (rerun install)"
          : item.status === InventoryStatus.Invalid
            ? "invalid current-run.json (rerun install)"
            : item.status.asString();
    case "summary":
      return item.status === InventoryStatus.Installed
        ? "ok"
        : item.status === InventoryStatus.Missing
          ? "missing summary.json (rerun install)"
          : item.status === InventoryStatus.Invalid
            ? "invalid summary.json (rerun install)"
            : item.status.asString();
    case "brief":
      return item.status === InventoryStatus.Installed ? "ok" : "missing BRIEF.md (rerun install)";
    case "pack-core":
    case "pack-caveman":
    case "pack-cavemem":
    case "pack-rtk":
    case "pack-frontend-craft":
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
    case "runtime":
      return item.status === InventoryStatus.Installed ? "ok" : item.status.asString();
    case "user-skills":
      return codexDoctorStatus(item, "export user-skills");
    case "repo-skills":
      return item.status === InventoryStatus.Disabled
        ? "disabled (optional repo export)"
        : codexDoctorStatus(item, "export repo-skills");
    case "repo-agents":
      return item.status === InventoryStatus.Disabled
        ? "disabled (optional repo export)"
        : item.status === InventoryStatus.PresentWithoutSaneBlock
          ? "present without Sane block"
          : codexDoctorStatus(item, "export repo-agents");
    case "codex-config":
      return item.status === InventoryStatus.Installed
        ? "installed"
        : item.status === InventoryStatus.Missing
          ? "missing (run `apply codex-profile`)"
          : item.status === InventoryStatus.Invalid
            ? "invalid (repair ~/.codex/config.toml)"
            : item.status.displayString();
    case "global-agents":
      return item.status === InventoryStatus.PresentWithoutSaneBlock
        ? "present without Sane block"
        : codexDoctorStatus(item, "export global-agents");
    case "hooks":
      return item.status === InventoryStatus.Installed
        ? "installed"
        : item.status === InventoryStatus.Missing
          ? "missing (run `export hooks`)"
          : item.status === InventoryStatus.Invalid
            ? "invalid (repair ~/.codex/hooks.json)"
            : item.status.displayString();
    case "custom-agents":
      return codexDoctorStatus(item, "export custom-agents");
    default:
      return item.status.asString();
  }
}

function codexDoctorStatus(item: InventoryItem, exportCommand: string): string {
  return item.status === InventoryStatus.Installed
    ? "installed"
    : item.status === InventoryStatus.Missing
      ? `missing (run \`${exportCommand}\`)`
      : item.status === InventoryStatus.Invalid
        ? `invalid (rerun \`${exportCommand}\`)`
        : item.status.displayString();
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
