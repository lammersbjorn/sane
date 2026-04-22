import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import { inspectCodexConfigBackupSnapshot } from "./codex-config.js";
import { inspectStatusBundle } from "./inventory.js";
import { inspectTelemetrySnapshot } from "./preferences.js";

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

export interface RepairStatusSnapshot {
  installBundle: ReturnType<typeof inspectStatusBundle>["primary"]["installBundle"];
  actionStatus: Record<RepairActionStatusId, string>;
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
    actionStatus: {
      install_runtime: statusFor(statusBundle.inventory, "runtime"),
      backup_codex_config: statusFor(statusBundle.inventory, "codex-config"),
      restore_codex_config: backups.restoreAvailable ? "available" : "missing",
      reset_telemetry_data: telemetry.dirPresent ? "present" : "missing",
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
): string {
  return inventory.find((item) => item.name === name)?.status.displayString() ?? "missing";
}

function uninstallAllStatus(inventory: ReturnType<typeof inspectStatusBundle>["inventory"]): string {
  const names = ["user-skills", "global-agents", "hooks", "custom-agents"] as const;
  return names.some((name) => inventory.find((item) => item.name === name)?.status.displayString() === "installed")
    ? "installed"
    : "missing";
}
