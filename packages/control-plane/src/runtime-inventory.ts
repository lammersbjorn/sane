import { readLocalConfig } from "@sane/config";
import { existsSync } from "node:fs";

import { InventoryScope, InventoryStatus, type OperationResult } from "@sane/core";
import { type ProjectPaths } from "@sane/platform";

import { inspectRuntimeState } from "./runtime-state.js";
import { inventoryStatusFromRuntimeLayer } from "./status-presenter.js";

type InventoryItem = OperationResult["inventory"][number];

export function inspectRuntimeInventory(paths: ProjectPaths): InventoryItem[] {
  const runtimeState = inspectRuntimeState(paths);
  const currentRunStatus = inventoryStatusFromRuntimeLayer(runtimeState.layerStatus.currentRun);
  const summaryStatus = inventoryStatusFromRuntimeLayer(runtimeState.layerStatus.summary);
  const briefStatus = inventoryStatusFromRuntimeLayer(runtimeState.layerStatus.brief);

  return [
    {
      name: "runtime",
      scope: InventoryScope.LocalRuntime,
      status: fileStatus(paths.runtimeRoot),
      path: paths.runtimeRoot,
      repairHint: null
    },
    {
      name: "config",
      scope: InventoryScope.LocalRuntime,
      status: readStatus(() => readLocalConfig(paths.configPath)),
      path: paths.configPath,
      repairHint: repairHintForPath(paths.configPath)
    },
    {
      name: "current-run",
      scope: InventoryScope.LocalRuntime,
      status: currentRunStatus,
      path: paths.currentRunPath,
      repairHint: repairHintForPath(paths.currentRunPath)
    },
    {
      name: "summary",
      scope: InventoryScope.LocalRuntime,
      status: summaryStatus,
      path: paths.summaryPath,
      repairHint: repairHintForPath(paths.summaryPath)
    },
    {
      name: "brief",
      scope: InventoryScope.LocalRuntime,
      status: briefStatus,
      path: paths.briefPath,
      repairHint: repairHintForPath(paths.briefPath)
    }
  ];
}

function readStatus(read: () => unknown): InventoryStatus {
  try {
    read();
    return InventoryStatus.Installed;
  } catch {
    return InventoryStatus.Invalid;
  }
}

function fileStatus(path: string): InventoryStatus {
  return existsSync(path) ? InventoryStatus.Installed : InventoryStatus.Missing;
}

function repairHintForPath(path: string): string | null {
  return existsSync(path) ? "rerun `install runtime`" : "run `install runtime`";
}
