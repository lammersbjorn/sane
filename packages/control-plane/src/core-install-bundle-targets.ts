import { type OperationResult } from "@sane/core";
import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/platform";

import {
  exportGlobalAgents,
  exportUserSkills,
  uninstallGlobalAgents,
  uninstallUserSkills
} from "./codex-native.js";
import {
  exportCustomAgents,
  exportHooks,
  uninstallCustomAgents,
  uninstallHooks
} from "./hooks-custom-agents.js";

export const CORE_INSTALL_BUNDLE_TARGETS = [
  "user-skills",
  "global-agents",
  "hooks",
  "custom-agents"
] as const;

export type CoreInstallBundleTarget = (typeof CORE_INSTALL_BUNDLE_TARGETS)[number];

export function installableCoreInstallBundleTargets(
  hostPlatform: HostPlatform = detectPlatform()
): CoreInstallBundleTarget[] {
  return hostPlatform === "windows"
    ? CORE_INSTALL_BUNDLE_TARGETS.filter((target) => target !== "hooks")
    : [...CORE_INSTALL_BUNDLE_TARGETS];
}

const EXPORT_ACTIONS: Record<
  CoreInstallBundleTarget,
  (paths: ProjectPaths, codexPaths: CodexPaths) => OperationResult
> = {
  "user-skills": (paths, codexPaths) => exportUserSkills(paths, codexPaths),
  "global-agents": (paths, codexPaths) => exportGlobalAgents(paths, codexPaths),
  hooks: (_paths, codexPaths) => exportHooks(codexPaths),
  "custom-agents": (paths, codexPaths) => exportCustomAgents(paths, codexPaths)
};

const UNINSTALL_ACTIONS: Record<CoreInstallBundleTarget, (codexPaths: CodexPaths) => OperationResult> = {
  "user-skills": (codexPaths) => uninstallUserSkills(codexPaths),
  "global-agents": (codexPaths) => uninstallGlobalAgents(codexPaths),
  hooks: (codexPaths) => uninstallHooks(codexPaths),
  "custom-agents": (codexPaths) => uninstallCustomAgents(codexPaths)
};

export function exportCoreInstallBundleTargets(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform = detectPlatform()
): OperationResult[] {
  return installableCoreInstallBundleTargets(hostPlatform).map((target) =>
    EXPORT_ACTIONS[target](paths, codexPaths)
  );
}

export function uninstallCoreInstallBundleTargets(codexPaths: CodexPaths): OperationResult[] {
  return CORE_INSTALL_BUNDLE_TARGETS.map((target) => UNINSTALL_ACTIONS[target](codexPaths));
}
