import { InventoryStatus } from "@sane/core";

export type ManagedStatusKind =
  | "installed"
  | "configured"
  | "disabled"
  | "missing"
  | "invalid"
  | "present_without_sane_block"
  | "removed";

export interface ManagedStatusPresentation {
  kind: ManagedStatusKind;
  label: string;
  tone: "ok" | "warn" | "muted";
}

export function managedStatusKindFromInventory(status: InventoryStatus | undefined): ManagedStatusKind {
  if (status === InventoryStatus.Installed) {
    return "installed";
  }

  if (status === InventoryStatus.Configured) {
    return "configured";
  }

  if (status === InventoryStatus.Disabled) {
    return "disabled";
  }

  if (status === InventoryStatus.Invalid) {
    return "invalid";
  }

  if (status === InventoryStatus.PresentWithoutSaneBlock) {
    return "present_without_sane_block";
  }

  if (status === InventoryStatus.Removed) {
    return "removed";
  }

  return "missing";
}

export function presentManagedStatus(kind: ManagedStatusKind): ManagedStatusPresentation {
  return {
    kind,
    label: kind === "present_without_sane_block" ? "present without Sane block" : kind,
    tone:
      kind === "installed"
        ? "ok"
        : kind === "missing" || kind === "invalid" || kind === "present_without_sane_block"
          ? "warn"
          : "muted"
  };
}
