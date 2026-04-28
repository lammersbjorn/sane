import type {
  InstallActionStatus as AddToCodexActionStatus,
  InstallActionStatusMap as AddToCodexActionStatusMap
} from "@sane/control-plane/install-status.js";
import type {
  RepairActionStatus,
  RepairActionStatusId,
  RepairActionStatusMap
} from "@sane/control-plane/repair-status.js";

import type { SectionActionMetadata } from "@sane/sane-tui/command-registry.js";

export interface AddToCodexActionRow {
  id: SectionActionMetadata["id"];
  title: string;
  status: AddToCodexActionStatus;
  repoMutation: boolean;
  includes?: string[];
}

export interface RepairActionRow {
  id: RepairActionStatusId;
  title: string;
  status: RepairActionStatus;
  confirmation: string | null;
}

export function buildAddToCodexActionRows(
  actions: SectionActionMetadata[],
  actionStatus: AddToCodexActionStatusMap
): AddToCodexActionRow[] {
  return actions.map((action) => ({
    id: action.id,
    title: action.label,
    status: action.id in actionStatus
      ? actionStatus[action.id as keyof AddToCodexActionStatusMap]
      : { kind: "missing", label: "not tracked by Codex install audit" },
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
