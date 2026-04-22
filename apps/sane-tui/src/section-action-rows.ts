import type {
  InstallActionStatus,
  InstallActionStatusId,
  InstallActionStatusMap
} from "@sane/control-plane/install-status.js";
import type {
  RepairActionStatus,
  RepairActionStatusId,
  RepairActionStatusMap
} from "@sane/control-plane/repair-status.js";

import type { SectionActionMetadata } from "@/command-registry.js";

export interface InstallActionRow {
  id: InstallActionStatusId;
  title: string;
  status: InstallActionStatus;
  repoMutation: boolean;
  includes?: string[];
}

export interface RepairActionRow {
  id: RepairActionStatusId;
  title: string;
  status: RepairActionStatus;
  confirmation: string | null;
}

export function buildInstallActionRows(
  actions: SectionActionMetadata[],
  actionStatus: InstallActionStatusMap
): InstallActionRow[] {
  return actions.map((action) => ({
    id: action.id as InstallActionStatusId,
    title: action.label,
    status: actionStatus[action.id as InstallActionStatusId],
    repoMutation: action.repoMutation,
    includes: action.includes
  }));
}

export function buildRepairActionRows(
  actions: SectionActionMetadata[],
  actionStatus: RepairActionStatusMap
): RepairActionRow[] {
  return actions.map((action) => ({
    id: action.id as RepairActionStatusId,
    title: action.label,
    status: actionStatus[action.id as RepairActionStatusId],
    confirmation: action.confirmation?.impactCopy ?? null
  }));
}
