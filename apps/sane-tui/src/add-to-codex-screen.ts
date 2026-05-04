import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/control-plane/platform.js";

import { exportAll } from "@sane/control-plane/bundles.js";
import {
  applyIntegrationsProfile,
  inspectCodexProfileFamilySnapshot
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
import {
  type InstallActionStatus as AddToCodexActionStatus,
  inspectInstallStatusFromStatusBundle,
  inspectInstallStatus,
  inferHostPlatformFromStatusBundle
} from "@sane/control-plane/install-status.js";
import { inspectStatusBundle } from "@sane/control-plane/inventory.js";
import { listSectionActions } from "@sane/sane-tui/command-registry.js";
import { buildAddToCodexActionRows } from "@sane/sane-tui/section-action-rows.js";

export interface AddToCodexScreenModel {
  summary: "Add to Codex";
  inventory: ReturnType<typeof inspectInstallStatus>["inventory"];
  bundleStatus: ReturnType<typeof inspectInstallStatus>["bundleStatus"];
  missingTargets: string[];
  integrationsStatus: ReturnType<typeof inspectInstallStatus>["integrationsStatus"];
  integrationsRecommendedChangeCount: ReturnType<typeof inspectInstallStatus>["integrationsRecommendedChangeCount"];
  recommendedActionId: ReturnType<typeof inspectInstallStatus>["recommendedActionId"];
  actions: AddToCodexAction[];
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

export interface AddToCodexAction {
  id: ReturnType<typeof listSectionActions>[number]["id"];
  title: string;
  status: AddToCodexActionStatus;
  repoMutation: boolean;
  includes?: string[];
}

type CodexProfileFamilySnapshot = ReturnType<typeof inspectCodexProfileFamilySnapshot>;

export function loadAddToCodexScreen(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform = detectPlatform()
): AddToCodexScreenModel {
  return loadAddToCodexScreenFromStatusBundle(
    paths,
    codexPaths,
    inspectStatusBundle(paths, codexPaths, hostPlatform),
    inspectCodexProfileFamilySnapshot(codexPaths)
  );
}

export function loadAddToCodexScreenFromStatusBundle(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  statusBundle: ReturnType<typeof inspectStatusBundle>,
  profiles: CodexProfileFamilySnapshot = inspectCodexProfileFamilySnapshot(codexPaths)
): AddToCodexScreenModel {
  const hostPlatform = inferHostPlatformFromStatusBundle(statusBundle);
  const status = inspectInstallStatusFromStatusBundle(paths, codexPaths, statusBundle, hostPlatform, profiles);
  const inventory = status.inventory;
  const actions = buildAddToCodexActionRows(listSectionActions("add_to_codex", hostPlatform), status.actionStatus).map((action) =>
    action.id === "export_all"
      ? { ...action, includes: exportAllIncludes(inventory) }
      : action
  );

  return {
    summary: "Add to Codex",
    inventory,
    bundleStatus: status.bundleStatus,
    missingTargets: status.missingTargets,
    integrationsStatus: status.integrationsStatus,
    integrationsRecommendedChangeCount: status.integrationsRecommendedChangeCount,
    recommendedActionId: status.recommendedActionId,
    actions,
    handlers: {
      installUserSkills: () => executeOperation(paths, () => exportUserSkills(paths, codexPaths)),
      installRepoSkills: () => executeOperation(paths, () => exportRepoSkills(paths, codexPaths)),
      installRepoAgents: () => executeOperation(paths, () => exportRepoAgents(paths, codexPaths)),
      installGlobalAgents: () => executeOperation(paths, () => exportGlobalAgents(paths, codexPaths)),
      applyIntegrationsProfile: () => executeOperation(paths, () => applyIntegrationsProfile(paths, codexPaths)),
      installHooks: () => executeOperation(paths, () => exportHooks(paths, codexPaths)),
      installCustomAgents: () => executeOperation(paths, () => exportCustomAgents(paths, codexPaths)),
      installAll: () => executeOperation(paths, () => exportAll(paths, codexPaths))
    }
  };
}

function exportAllIncludes(
  inventory: ReturnType<typeof inspectInstallStatus>["inventory"]
): AddToCodexAction["includes"] {
  const hookInventory = inventory.find((item) => item.name === "hooks");
  return hookInventory?.status.asString() === "invalid"
    && hookInventory.repairHint?.includes("native Windows")
    ? ["user-skills", "global-agents", "custom-agents"]
    : ["user-skills", "global-agents", "hooks", "custom-agents"];
}
