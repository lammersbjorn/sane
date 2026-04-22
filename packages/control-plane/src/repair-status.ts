import { InventoryStatus } from "@sane/core";
import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import { inspectCodexConfigBackupSnapshot } from "./codex-config.js";
import { CORE_INSTALL_BUNDLE_TARGETS } from "./core-install-bundle-targets.js";
import { inspectStatusBundle } from "./inventory.js";
import { inspectTelemetrySnapshot } from "./preferences.js";
import {
  managedStatusKindFromInventory,
  presentManagedStatus,
  type ManagedStatusKind
} from "./status-presenter.js";

export type RepairActionStatusId =
  | "install_runtime"
  | "backup_codex_config"
  | "restore_codex_config"
  | "reset_telemetry_data"
  | "uninstall_user_skills"
  | "uninstall_repo_skills"
  | "uninstall_global_agents"
  | "uninstall_repo_agents"
  | "uninstall_hooks"
  | "uninstall_custom_agents"
  | "uninstall_opencode_agents"
  | "uninstall_all";

export type RepairActionStatusKind =
  | ManagedStatusKind
  | "available"
  | "present";

export interface RepairActionStatus {
  kind: RepairActionStatusKind;
  label: string;
}

export interface RepairStatusSnapshot {
  installBundle: ReturnType<typeof inspectStatusBundle>["primary"]["installBundle"];
  telemetry: ReturnType<typeof inspectTelemetrySnapshot>;
  backups: ReturnType<typeof inspectCodexConfigBackupSnapshot>;
  actionStatus: Record<RepairActionStatusId, RepairActionStatus>;
}

export function inspectRepairStatus(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): RepairStatusSnapshot {
  const statusBundle = inspectStatusBundle(paths, codexPaths);
  const telemetry = inspectTelemetrySnapshot(paths);
  const backups = inspectCodexConfigBackupSnapshot(paths);

  return {
    installBundle: statusBundle.primary.installBundle,
    telemetry,
    backups,
    actionStatus: {
      install_runtime: statusFor(statusBundle.inventory, "runtime"),
      backup_codex_config: statusFor(statusBundle.inventory, "codex-config"),
      restore_codex_config: backups.restoreAvailable ? statusDto("available") : statusDto("missing"),
      reset_telemetry_data: telemetry.dirPresent ? statusDto("present") : statusDto("missing"),
      uninstall_user_skills: statusFor(statusBundle.inventory, "user-skills"),
      uninstall_repo_skills: statusFor(statusBundle.inventory, "repo-skills"),
      uninstall_global_agents: statusFor(statusBundle.inventory, "global-agents"),
      uninstall_repo_agents: statusFor(statusBundle.inventory, "repo-agents"),
      uninstall_hooks: statusFor(statusBundle.inventory, "hooks"),
      uninstall_custom_agents: statusFor(statusBundle.inventory, "custom-agents"),
      uninstall_opencode_agents: statusFor(statusBundle.inventory, "opencode-agents"),
      uninstall_all: uninstallAllStatus(statusBundle.inventory)
    }
  };
}

function statusFor(
  inventory: ReturnType<typeof inspectStatusBundle>["inventory"],
  name: string
): RepairActionStatus {
  return fromInventoryStatus(inventory.find((item) => item.name === name)?.status);
}

function uninstallAllStatus(
  inventory: ReturnType<typeof inspectStatusBundle>["inventory"]
): RepairActionStatus {
  return CORE_INSTALL_BUNDLE_TARGETS.some(
    (name) => inventory.find((item) => item.name === name)?.status === InventoryStatus.Installed
  )
    ? statusDto("installed")
    : statusDto("missing");
}

function fromInventoryStatus(status: InventoryStatus | undefined): RepairActionStatus {
  return statusDto(managedStatusKindFromInventory(status));
}

function statusDto(kind: RepairActionStatusKind): RepairActionStatus {
  if (kind === "available" || kind === "present") {
    return { kind, label: kind };
  }

  const presentation = presentManagedStatus(kind);
  return {
    kind: presentation.kind,
    label: presentation.label
  };
}
