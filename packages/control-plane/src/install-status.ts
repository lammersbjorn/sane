import { InventoryStatus } from "@sane/core";
import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/platform";

import { inspectCodexProfileFamilySnapshot } from "./codex-config.js";
import { installableCoreInstallBundleTargets } from "./core-install-bundle-targets.js";
import { inspectStatusBundle } from "./inventory.js";
import {
  managedStatusKindFromInventory,
  presentManagedStatus,
  type ManagedStatusKind
} from "./status-presenter.js";

export type InstallActionStatusId =
  | "export_user_skills"
  | "export_repo_skills"
  | "export_repo_agents"
  | "export_global_agents"
  | "apply_integrations_profile"
  | "export_hooks"
  | "export_custom_agents"
  | "export_opencode_agents"
  | "export_all";

export type InstallActionStatusKind = ManagedStatusKind;

export interface InstallActionStatus {
  kind: InstallActionStatusKind;
  label: string;
}

export interface InstallStatusSnapshot {
  inventory: ReturnType<typeof inspectStatusBundle>["codexNative"];
  bundleStatus: ReturnType<typeof inspectStatusBundle>["primary"]["installBundle"];
  missingTargets: string[];
  integrationsStatus: InstallActionStatus;
  integrationsRecommendedChangeCount: number;
  recommendedActionId: InstallActionStatusId | null;
  actionStatus: Record<InstallActionStatusId, InstallActionStatus>;
}

export type InstallActionStatusMap = InstallStatusSnapshot["actionStatus"];

export function inspectInstallStatus(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform = detectPlatform()
): InstallStatusSnapshot {
  return inspectInstallStatusFromStatusBundle(
    paths,
    codexPaths,
    inspectStatusBundle(paths, codexPaths, hostPlatform),
    hostPlatform
  );
}

export function inspectInstallStatusFromStatusBundle(
  _paths: ProjectPaths,
  codexPaths: CodexPaths,
  statusBundle: ReturnType<typeof inspectStatusBundle>,
  hostPlatform: HostPlatform = inferHostPlatformFromStatusBundle(statusBundle)
): InstallStatusSnapshot {
  const inventory = statusBundle.codexNative;
  const integrationsProfile = inspectCodexProfileFamilySnapshot(codexPaths).integrations;
  const missingTargets = missingBundleTargets(inventory, hostPlatform);
  const bundleStatus = statusBundle.primary.installBundle;
  const integrationsStatusSnapshot = integrationsStatus(integrationsProfile.audit.status);

  return {
    inventory,
    bundleStatus,
    missingTargets,
    integrationsStatus: integrationsStatusSnapshot,
    integrationsRecommendedChangeCount: integrationsProfile.audit.recommendedChangeCount,
    recommendedActionId:
      bundleStatus !== "installed"
        ? "export_all"
        : integrationsProfile.audit.status !== "installed"
          ? "apply_integrations_profile"
          : null,
    actionStatus: {
      export_user_skills: inventoryStatus(inventory, "user-skills"),
      export_repo_skills: inventoryStatus(inventory, "repo-skills"),
      export_repo_agents: inventoryStatus(inventory, "repo-agents"),
      export_global_agents: inventoryStatus(inventory, "global-agents"),
      apply_integrations_profile: integrationsStatusSnapshot,
      export_hooks: inventoryStatus(inventory, "hooks"),
      export_custom_agents: inventoryStatus(inventory, "custom-agents"),
      export_opencode_agents: compatibilityStatus(statusBundle, "opencode-agents"),
      export_all: installBundleStatus(bundleStatus)
    }
  };
}

function inventoryStatus(
  inventory: ReturnType<typeof inspectStatusBundle>["codexNative"],
  name: string
): InstallActionStatus {
  const item = inventory.find((entry) => entry.name === name);
  if (
    name === "hooks"
    && item?.status === InventoryStatus.Invalid
    && item.repairHint?.includes("native Windows")
  ) {
    return { kind: "disabled", label: "unsupported (use WSL)" };
  }

  return fromInventoryStatus(item?.status);
}

function missingBundleTargets(
  inventory: ReturnType<typeof inspectStatusBundle>["codexNative"],
  hostPlatform: HostPlatform = detectPlatform()
): string[] {
  return installableCoreInstallBundleTargets(hostPlatform).filter(
    (name) => inventory.find((item) => item.name === name)?.status !== InventoryStatus.Installed
  );
}

function inferHostPlatformFromStatusBundle(
  statusBundle: ReturnType<typeof inspectStatusBundle>
): HostPlatform {
  const hooksInventory = statusBundle.codexNative.find((item) => item.name === "hooks");
  return hooksInventory?.status === InventoryStatus.Invalid
    && hooksInventory.repairHint?.includes("native Windows")
    ? "windows"
    : detectPlatform();
}

function compatibilityStatus(
  statusBundle: ReturnType<typeof inspectStatusBundle>,
  name: string
): InstallActionStatus {
  return fromInventoryStatus(statusBundle.compatibility.find((item) => item.name === name)?.status);
}

function integrationsStatus(status: "installed" | "missing" | "invalid"): InstallActionStatus {
  if (status === "installed") {
    return statusDto("installed");
  }

  if (status === "invalid") {
    return statusDto("invalid");
  }

  return statusDto("missing");
}

function installBundleStatus(status: string): InstallActionStatus {
  return status === "installed" ? statusDto("installed") : statusDto("missing");
}

function fromInventoryStatus(status: InventoryStatus | undefined): InstallActionStatus {
  return statusDto(managedStatusKindFromInventory(status));
}

function statusDto(kind: InstallActionStatusKind): InstallActionStatus {
  const presentation = presentManagedStatus(kind);
  return { kind: presentation.kind, label: presentation.label };
}
