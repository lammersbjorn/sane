import { detectPlatform, type CodexPaths, type ProjectPaths } from "@sane/platform";

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
  inspectRepairStatusFromStatusBundle,
  inspectRepairStatus,
  type RepairActionStatus,
  type RepairActionStatusId
} from "@sane/control-plane/repair-status.js";
import { inspectStatusBundle } from "@sane/control-plane/inventory.js";
import { uninstallRepoAgents, uninstallRepoSkills } from "@sane/control-plane";
import { installRuntime } from "@sane/control-plane";
import { resetTelemetryData } from "@sane/control-plane/preferences.js";
import { listSectionActions } from "@sane/sane-tui/command-registry.js";
import { buildRepairActionRows } from "@sane/sane-tui/section-action-rows.js";

export interface RepairScreenAction {
  id: RepairActionStatusId;
  title: string;
  status: RepairActionStatus;
  confirmation: string | null;
}

export interface RepairScreenModel {
  summary: "Repair";
  installBundle: ReturnType<typeof inspectRepairStatus>["installBundle"];
  telemetry: ReturnType<typeof inspectRepairStatus>["telemetry"];
  backups: ReturnType<typeof inspectRepairStatus>["backups"];
  restoreStatus: ReturnType<typeof inspectRepairStatus>["restoreStatus"];
  removableInstalls: ReturnType<typeof inspectRepairStatus>["removableInstalls"];
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

export function loadRepairScreen(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): RepairScreenModel {
  return loadRepairScreenFromStatusBundle(paths, codexPaths, inspectStatusBundle(paths, codexPaths));
}

export function loadRepairScreenFromStatusBundle(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  statusBundle: ReturnType<typeof inspectStatusBundle>
): RepairScreenModel {
  const status = inspectRepairStatusFromStatusBundle(paths, codexPaths, statusBundle);
  const actions = buildRepairActionRows(listSectionActions("repair", detectPlatform()), status.actionStatus);

  return {
    summary: "Repair",
    installBundle: status.installBundle,
    telemetry: status.telemetry,
    backups: status.backups,
    restoreStatus: status.restoreStatus,
    removableInstalls: status.removableInstalls,
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
