import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import { uninstallAll } from "@sane/control-plane/bundles.js";
import {
  backupCodexConfig,
  restoreCodexConfig
} from "@sane/control-plane/codex-config.js";
import { executeOperation } from "@sane/control-plane/history.js";
import { uninstallGlobalAgents, uninstallUserSkills } from "@sane/control-plane/codex-native.js";
import { uninstallCustomAgents, uninstallHooks } from "@sane/control-plane/hooks-custom-agents.js";
import { uninstallOpencodeAgents } from "@sane/control-plane/opencode-native.js";
import {
  inspectRepairStatus,
  type RepairActionStatusId
} from "@sane/control-plane/repair-status.js";
import { uninstallRepoAgents, uninstallRepoSkills } from "@sane/control-plane";
import { installRuntime } from "@sane/control-plane";
import { resetTelemetryData } from "@sane/control-plane/preferences.js";
import { listSectionActions } from "@/command-registry.js";

export interface RepairScreenAction {
  id: RepairActionStatusId;
  title: string;
  status: string;
  confirmation: string | null;
}

export interface RepairScreenModel {
  summary: "Repair";
  installBundle: ReturnType<typeof inspectRepairStatus>["installBundle"];
  actions: RepairScreenAction[];
  handlers: {
    repairRuntime: () => ReturnType<typeof installRuntime>;
    backupCodexConfig: () => ReturnType<typeof backupCodexConfig>;
    restoreCodexConfig: () => ReturnType<typeof restoreCodexConfig>;
    resetTelemetryData: () => ReturnType<typeof resetTelemetryData>;
    uninstallUserSkills: () => ReturnType<typeof uninstallUserSkills>;
    uninstallRepoSkills: () => ReturnType<typeof uninstallRepoSkills>;
    uninstallGlobalAgents: () => ReturnType<typeof uninstallGlobalAgents>;
    uninstallRepoAgents: () => ReturnType<typeof uninstallRepoAgents>;
    uninstallHooks: () => ReturnType<typeof uninstallHooks>;
    uninstallCustomAgents: () => ReturnType<typeof uninstallCustomAgents>;
    uninstallOpencodeAgents: () => ReturnType<typeof uninstallOpencodeAgents>;
    uninstallAll: () => ReturnType<typeof uninstallAll>;
  };
}

export function loadRepairScreen(paths: ProjectPaths, codexPaths: CodexPaths): RepairScreenModel {
  const status = inspectRepairStatus(paths, codexPaths);
  const actions = listSectionActions("repair").map((action) => ({
    id: action.id as RepairScreenAction["id"],
    title: action.label,
    status: status.actionStatus[action.id as RepairActionStatusId].label,
    confirmation: action.confirmation?.impactCopy ?? null
  }));

  return {
    summary: "Repair",
    installBundle: status.installBundle,
    actions,
    handlers: {
      repairRuntime: () => executeOperation(paths, () => installRuntime(paths, codexPaths)),
      backupCodexConfig: () => executeOperation(paths, () => backupCodexConfig(paths, codexPaths)),
      restoreCodexConfig: () => executeOperation(paths, () => restoreCodexConfig(paths, codexPaths)),
      resetTelemetryData: () => executeOperation(paths, () => resetTelemetryData(paths)),
      uninstallUserSkills: () => executeOperation(paths, () => uninstallUserSkills(codexPaths)),
      uninstallRepoSkills: () => executeOperation(paths, () => uninstallRepoSkills(paths)),
      uninstallGlobalAgents: () => executeOperation(paths, () => uninstallGlobalAgents(codexPaths)),
      uninstallRepoAgents: () => executeOperation(paths, () => uninstallRepoAgents(paths)),
      uninstallHooks: () => executeOperation(paths, () => uninstallHooks(codexPaths)),
      uninstallCustomAgents: () => executeOperation(paths, () => uninstallCustomAgents(codexPaths)),
      uninstallOpencodeAgents: () => executeOperation(paths, () => uninstallOpencodeAgents(codexPaths)),
      uninstallAll: () => executeOperation(paths, () => uninstallAll(codexPaths))
    }
  };
}
