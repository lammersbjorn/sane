import { InventoryStatus } from "@sane/core";
import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import { inspectIntegrationsProfileSnapshot } from "./codex-config.js";
import { CORE_INSTALL_BUNDLE_TARGETS } from "./core-install-bundle-targets.js";
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

export function inspectInstallStatus(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): InstallStatusSnapshot {
  const statusBundle = inspectStatusBundle(paths, codexPaths);
  const inventory = statusBundle.codexNative;
  const integrationsProfile = inspectIntegrationsProfileSnapshot(codexPaths);
  const missingTargets = missingBundleTargets(inventory);
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
  return fromInventoryStatus(inventory.find((item) => item.name === name)?.status);
}

function missingBundleTargets(
  inventory: ReturnType<typeof inspectStatusBundle>["codexNative"]
): string[] {
  return CORE_INSTALL_BUNDLE_TARGETS.filter(
    (name) => inventory.find((item) => item.name === name)?.status !== InventoryStatus.Installed
  );
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
