import { InventoryStatus } from "@sane/core";
import { describe, expect, it } from "vitest";

import {
  inventoryStatusFromRuntimeLayer,
  presentInventoryStatus,
  runtimeLayerLabelFromInventory
} from "../src/status-presenter.js";

describe("status presenter", () => {
  it("presents inventory statuses through the shared helper", () => {
    expect(presentInventoryStatus(InventoryStatus.Installed)).toEqual({
      kind: "installed",
      label: "installed",
      tone: "ok"
    });
    expect(presentInventoryStatus(InventoryStatus.PresentWithoutSaneBlock)).toEqual({
      kind: "present_without_sane_block",
      label: "present without Sane block",
      tone: "warn"
    });
    expect(presentInventoryStatus(undefined)).toEqual({
      kind: "missing",
      label: "missing",
      tone: "warn"
    });
  });

  it("converts runtime layer state to and from inventory status", () => {
    expect(inventoryStatusFromRuntimeLayer("present")).toBe(InventoryStatus.Installed);
    expect(inventoryStatusFromRuntimeLayer("invalid")).toBe(InventoryStatus.Invalid);
    expect(inventoryStatusFromRuntimeLayer("missing")).toBe(InventoryStatus.Missing);

    expect(runtimeLayerLabelFromInventory(InventoryStatus.Installed)).toBe("present");
    expect(runtimeLayerLabelFromInventory(InventoryStatus.Invalid)).toBe("invalid");
    expect(runtimeLayerLabelFromInventory(InventoryStatus.Missing)).toBe("missing");
    expect(runtimeLayerLabelFromInventory(InventoryStatus.Configured)).toBe("missing");
  });
});
