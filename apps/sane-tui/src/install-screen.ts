import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import { exportAll } from "@sane/control-plane/bundles.js";
import { applyIntegrationsProfile } from "@sane/control-plane/codex-config.js";
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
  inspectInstallStatus,
  type InstallActionStatusId
} from "@sane/control-plane/install-status.js";
import { exportOpencodeAgents } from "@sane/control-plane/opencode-native.js";
import { listSectionActions } from "@/command-registry.js";

export interface InstallScreenModel {
  summary: "Install";
  inventory: ReturnType<typeof inspectInstallStatus>["inventory"];
  bundleStatus: ReturnType<typeof inspectInstallStatus>["bundleStatus"];
  missingTargets: string[];
  recommendedActionId: ReturnType<typeof inspectInstallStatus>["recommendedActionId"];
  actions: InstallAction[];
  handlers: {
    installUserSkills: () => ReturnType<typeof exportUserSkills>;
    installRepoSkills: () => ReturnType<typeof exportRepoSkills>;
    installRepoAgents: () => ReturnType<typeof exportRepoAgents>;
    installGlobalAgents: () => ReturnType<typeof exportGlobalAgents>;
    applyIntegrationsProfile: () => ReturnType<typeof applyIntegrationsProfile>;
    installHooks: () => ReturnType<typeof exportHooks>;
    installCustomAgents: () => ReturnType<typeof exportCustomAgents>;
    installOpencodeAgents: () => ReturnType<typeof exportOpencodeAgents>;
    installAll: () => ReturnType<typeof exportAll>;
  };
}

export interface InstallAction {
  id: InstallActionStatusId;
  title: string;
  status: string;
  repoMutation: boolean;
  includes?: string[];
}

export function loadInstallScreen(paths: ProjectPaths, codexPaths: CodexPaths): InstallScreenModel {
  const status = inspectInstallStatus(paths, codexPaths);
  const inventory = status.inventory;
  const actions = listSectionActions("install").map((action) => ({
    id: action.id as InstallAction["id"],
    title: action.label,
    status: status.actionStatus[action.id as InstallActionStatusId].label,
    repoMutation: action.repoMutation,
    includes: action.includes
  }));

  return {
    summary: "Install",
    inventory,
    bundleStatus: status.bundleStatus,
    missingTargets: status.missingTargets,
    recommendedActionId: status.recommendedActionId,
    actions,
    handlers: {
      installUserSkills: () => executeOperation(paths, () => exportUserSkills(paths, codexPaths)),
      installRepoSkills: () => executeOperation(paths, () => exportRepoSkills(paths, codexPaths)),
      installRepoAgents: () => executeOperation(paths, () => exportRepoAgents(paths, codexPaths)),
      installGlobalAgents: () => executeOperation(paths, () => exportGlobalAgents(paths, codexPaths)),
      applyIntegrationsProfile: () => executeOperation(paths, () => applyIntegrationsProfile(paths, codexPaths)),
      installHooks: () => executeOperation(paths, () => exportHooks(codexPaths)),
      installCustomAgents: () => executeOperation(paths, () => exportCustomAgents(paths, codexPaths)),
      installOpencodeAgents: () => executeOperation(paths, () => exportOpencodeAgents(paths, codexPaths)),
      installAll: () => executeOperation(paths, () => exportAll(paths, codexPaths))
    }
  };
}
