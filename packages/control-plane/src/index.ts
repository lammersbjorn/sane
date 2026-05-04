import {
  OperationKind,
  OperationResult
} from "@sane/control-plane/core.js";
import {
  type ProjectPaths
} from "./platform.js";
import {
  listCanonicalBackupSiblings
} from "@sane/state";

import {
  doctor,
  inspectStatusBundle
} from "./inventory.js";
import { inspectRuntimeInventory } from "./runtime-inventory.js";
import {
  presentInventoryStatus,
} from "./status-presenter.js";

export function showRuntimeStatus(paths: ProjectPaths): OperationResult {
  const inventory = inspectRuntimeInventory(paths);

  return new OperationResult({
    kind: OperationKind.ShowStatus,
    summary: `status: ${inventory.length} managed targets inspected`,
    details: [],
    pathsTouched: collectPathsTouched(inventory),
    inventory
  });
}

export function doctorRuntime(paths: ProjectPaths): OperationResult {
  const inventory = inspectRuntimeInventory(paths);
  const configBackups = listCanonicalBackupSiblings(paths.configPath);
  const summaryBackups = listCanonicalBackupSiblings(paths.summaryPath);

  return new OperationResult({
    kind: OperationKind.Doctor,
    summary: [
      `runtime: ${findInventory(inventory, "runtime") ? presentInventoryStatus(findInventory(inventory, "runtime")?.status).label : "unknown"}`,
      `config: ${findInventory(inventory, "config") ? presentInventoryStatus(findInventory(inventory, "config")?.status).label : "unknown"}`,
      `config-backups: ${canonicalBackupHistorySummary(configBackups)}`,
      `current-run: ${findInventory(inventory, "current-run") ? presentInventoryStatus(findInventory(inventory, "current-run")?.status).label : "unknown"}`,
      `summary: ${findInventory(inventory, "summary") ? presentInventoryStatus(findInventory(inventory, "summary")?.status).label : "unknown"}`,
      `summary-backups: ${canonicalBackupHistorySummary(summaryBackups)}`,
      `brief: ${findInventory(inventory, "brief") ? presentInventoryStatus(findInventory(inventory, "brief")?.status).label : "unknown"}`,
      `root: ${paths.runtimeRoot}`
    ].join("\n"),
    details: [],
    pathsTouched: collectPathsTouched(inventory),
    inventory
  });
}

// Barrel exports intentionally stay narrow: expose top-level control-plane
// entry points without promoting every implementation module to root API.
export { applyCodexProfile } from "./codex-config.js";
export { exportAll, exportOpencodeCore, uninstallAll, uninstallOpencodeCore } from "./bundles.js";
export { showStatus, doctor } from "./inventory.js";
export { checkForUpdates, inspectUpdateCheck } from "./update-check.js";
export { installRuntime } from "./features/install/install-runtime.js";
export {
  buildIssueRelayDraft,
  setIssueRelayGhRunnerForTest,
  submitIssueRelayDraft,
  submitLatestIssueRelayDraft,
  writeIssueRelayDraft
} from "./issue-relay.js";
export { inspectTelemetryLedger, recordTelemetryEvent } from "./telemetry.js";
export {
  formatInspectOverviewLines,
  type InspectOverviewSnapshot
} from "./inspect-presenter.js";
export {
  formatInspectPolicyPreviewLines,
  formatLatestPolicyPreviewInputLines,
  formatLatestPolicyPreviewLines
} from "./features/status/policy-preview-presenter.js";
export {
  advanceOutcome,
  inspectLatestPolicyPreview,
  inspectSnapshot,
  inspectSnapshotFromStatusBundle,
  showOutcomeReadiness,
  showOutcomeReadinessFromRuntimeState,
  showRuntimeHistory,
  showRuntimeHistoryFromRuntimeState,
  showRuntimeProgress,
  showRuntimeProgressFromRuntimeState,
  showRuntimeSummary,
  showRuntimeSummaryFromRuntimeState,
  type InspectSnapshot,
  type RuntimeProgressSnapshot
} from "./features/status/inspect-runtime.js";

function canonicalBackupHistorySummary(backups: string[]): string {
  if (backups.length === 0) {
    return "none";
  }

  const shown = backups.slice(0, 3).map((path) => path.split(/[/\\]/).pop() ?? path);
  const remaining = backups.length - shown.length;
  if (remaining === 0) {
    return `${backups.length} (${shown.join(", ")})`;
  }

  return `${backups.length} (${shown.join(", ")} +${remaining} more)`;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function collectPathsTouched(
  inventory: Array<{
    path: string;
  }>
): string[] {
  return unique(inventory.map((item) => item.path)).sort();
}

function findInventory<T extends { name: string }>(inventory: T[], name: string): T | undefined {
  return inventory.find((item) => item.name === name);
}

// Repo-local remove helpers stay in root API because Repair uses them as
// first-class control-plane operations. Other native/plugin helpers live behind
// explicit compatibility subpaths.
export { uninstallRepoAgents, uninstallRepoSkills } from "./codex-native.js";
export {
  exportOpencodeAgents,
  exportOpencodeCoreBundle,
  exportOpencodeGlobalAgents,
  exportOpencodeSkills,
  inspectOpencodeAgentsInventory,
  inspectOpencodeCoreInventory,
  inspectOpencodeGlobalAgentsInventory,
  inspectOpencodeSkillsInventory,
  uninstallOpencodeAgents,
  uninstallOpencodeCoreBundle,
  uninstallOpencodeGlobalAgents,
  uninstallOpencodeSkills
} from "./opencode-native.js";
