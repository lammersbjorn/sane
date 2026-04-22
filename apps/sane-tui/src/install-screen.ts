import { type CodexPaths, type ProjectPaths } from "@sane/platform";
import { InventoryStatus } from "@sane/core";

import { exportAll } from "@sane/control-plane/bundles.js";
import {
  applyIntegrationsProfile,
  inspectIntegrationsProfileStatus
} from "@sane/control-plane/codex-config.js";
import {
  exportGlobalAgents,
  exportRepoAgents,
  exportRepoSkills,
  exportUserSkills
} from "@sane/control-plane/codex-native.js";
import {
  exportCustomAgents,
  exportHooks
} from "@sane/control-plane/hooks-custom-agents.js";
import { executeOperation } from "@sane/control-plane/history.js";
import { inspectStatusBundle } from "@sane/control-plane/inventory.js";
import { listSectionActions } from "@/command-registry.js";

export interface InstallScreenModel {
  summary: "Install";
  inventory: ReturnType<typeof inspectStatusBundle>["codexNative"];
  bundleStatus: ReturnType<typeof inspectStatusBundle>["primary"]["installBundle"];
  missingTargets: string[];
  recommendedActionId:
    | "export_user_skills"
    | "export_repo_skills"
    | "export_repo_agents"
    | "export_global_agents"
    | "apply_integrations_profile"
    | "export_hooks"
    | "export_custom_agents"
    | "export_all"
    | null;
  actions: InstallAction[];
  handlers: {
    installUserSkills: () => ReturnType<typeof exportUserSkills>;
    installRepoSkills: () => ReturnType<typeof exportRepoSkills>;
    installRepoAgents: () => ReturnType<typeof exportRepoAgents>;
    installGlobalAgents: () => ReturnType<typeof exportGlobalAgents>;
    applyIntegrationsProfile: () => ReturnType<typeof applyIntegrationsProfile>;
    installHooks: () => ReturnType<typeof exportHooks>;
    installCustomAgents: () => ReturnType<typeof exportCustomAgents>;
    installAll: () => ReturnType<typeof exportAll>;
  };
}

export interface InstallAction {
  id:
    | "export_user_skills"
    | "export_repo_skills"
    | "export_repo_agents"
    | "export_global_agents"
    | "apply_integrations_profile"
    | "export_hooks"
    | "export_custom_agents"
    | "export_all";
  title: string;
  status: string;
  repoMutation: boolean;
  includes?: string[];
}

export function loadInstallScreen(paths: ProjectPaths, codexPaths: CodexPaths): InstallScreenModel {
  const statusBundle = inspectStatusBundle(paths, codexPaths);
  const inventory = statusBundle.codexNative;
  const actions = listSectionActions("install").map((action) => ({
    id: action.id as InstallAction["id"],
    title: action.label,
    status:
      action.id === "export_all"
        ? bundleStatus(inventory)
        : action.id === "apply_integrations_profile"
          ? integrationsStatus(codexPaths)
        : inventoryStatus(inventory, inventoryNameForAction(action.id as InstallAction["id"])),
    repoMutation: action.repoMutation,
    includes: action.includes
  }));

  return {
    summary: "Install",
    inventory,
    bundleStatus: statusBundle.primary.installBundle,
    missingTargets: missingBundleTargets(inventory),
    recommendedActionId: recommendedActionId(statusBundle, codexPaths),
    actions,
    handlers: {
      installUserSkills: () => executeOperation(paths, () => exportUserSkills(paths, codexPaths)),
      installRepoSkills: () => executeOperation(paths, () => exportRepoSkills(paths, codexPaths)),
      installRepoAgents: () => executeOperation(paths, () => exportRepoAgents(paths, codexPaths)),
      installGlobalAgents: () => executeOperation(paths, () => exportGlobalAgents(paths, codexPaths)),
      applyIntegrationsProfile: () => executeOperation(paths, () => applyIntegrationsProfile(paths, codexPaths)),
      installHooks: () => executeOperation(paths, () => exportHooks(codexPaths)),
      installCustomAgents: () => executeOperation(paths, () => exportCustomAgents(paths, codexPaths)),
      installAll: () => executeOperation(paths, () => exportAll(paths, codexPaths))
    }
  };
}

function recommendedActionId(
  statusBundle: ReturnType<typeof inspectStatusBundle>,
  codexPaths: CodexPaths
): InstallScreenModel["recommendedActionId"] {
  return statusBundle.primary.installBundle !== "installed"
    ? "export_all"
    : integrationsStatus(codexPaths) !== "installed"
      ? "apply_integrations_profile"
      : null;
}

function inventoryStatus(
  inventory: ReturnType<typeof inspectStatusBundle>["codexNative"],
  name: string
): string {
  return inventory.find((item) => item.name === name)?.status.displayString() ?? "missing";
}

function bundleStatus(inventory: ReturnType<typeof inspectStatusBundle>["codexNative"]): string {
  return missingBundleTargets(inventory).length === 0
    ? "installed"
    : "missing";
}

function missingBundleTargets(
  inventory: ReturnType<typeof inspectStatusBundle>["codexNative"]
): string[] {
  const needed = ["user-skills", "global-agents", "hooks", "custom-agents"] as const;
  return needed.filter(
    (name) => inventory.find((item) => item.name === name)?.status !== InventoryStatus.Installed
  );
}

function integrationsStatus(codexPaths: CodexPaths): string {
  return inspectIntegrationsProfileStatus(codexPaths);
}

function inventoryNameForAction(actionId: InstallAction["id"]): string {
  switch (actionId) {
    case "export_user_skills":
      return "user-skills";
    case "export_repo_skills":
      return "repo-skills";
    case "export_repo_agents":
      return "repo-agents";
    case "export_global_agents":
      return "global-agents";
    case "apply_integrations_profile":
      return "codex-config";
    case "export_hooks":
      return "hooks";
    case "export_custom_agents":
      return "custom-agents";
    case "export_all":
      return "user-skills";
  }
}
