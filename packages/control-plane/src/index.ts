import { statSync, writeFileSync } from "node:fs";

import {
  createRecommendedLocalConfig,
  detectCodexEnvironment,
  readLocalConfig,
  stringifyLocalConfig,
  type LocalConfig
} from "@sane/config";
import {
  InventoryScope,
  InventoryStatus,
  OperationKind,
  OperationResult,
  type OperationRewriteMetadata
} from "@sane/core";
import {
  type CodexPaths,
  ensureRuntimeDirs,
  type ProjectPaths
} from "@sane/platform";
import {
  type CanonicalRewriteResult,
  listCanonicalBackupSiblings,
  writeCanonicalWithBackupResult,
  type CurrentRunState,
  type LayeredStateHistoryCounts,
  type LayeredStateHistoryPreview,
  type LatestPolicyPreviewSnapshot,
  type RunSummary
} from "@sane/state";

import {
  inspectCodexProfileFamilySnapshot,
  showCodexConfig
} from "./codex-config.js";
import {
  doctor,
  doctorForStatusBundle,
  inspectDoctorSnapshot,
  inspectStatusBundle,
  showStatusFromStatusBundle
} from "./inventory.js";
import { formatLatestPolicyPreviewLines } from "./policy-preview-presenter.js";
import { previewPolicy, previewPolicyForCurrentRun } from "./policy-preview.js";
import { showConfig } from "./preferences.js";
import { inspectLocalConfigFamily } from "./local-config.js";
import {
  formatLatestHistoryArtifactPreview,
  formatLatestHistoryDecisionPreview,
  formatLatestHistoryEventPreview
} from "./runtime-history-presenter.js";
import {
  ensureRuntimeHandoffBaseline,
  inspectRuntimeState,
  runtimeHistoryPaths,
  runtimeStatePaths
} from "./runtime-state.js";
import { inspectRuntimeInventory } from "./runtime-inventory.js";
import {
  inventoryStatusFromRuntimeLayer,
  isUnsupportedNativeWindowsHooks,
  presentManagedInventoryItem,
  presentInventoryStatus,
  runtimeLayerLabelFromInventory
} from "./status-presenter.js";

interface InstallCanonicalRewrite {
  name: "config" | "current-run" | "summary";
  metadata: OperationRewriteMetadata;
}

export interface RuntimeProgressSnapshot {
  phase: string;
  verificationStatus: string;
}

export interface InspectSnapshot {
  status: {
    summary: string;
    inventory: ReturnType<typeof inspectStatusBundle>["inventory"];
  };
  statusBundle: ReturnType<typeof inspectStatusBundle>;
  doctor: ReturnType<typeof doctor>;
  doctorHeadline: string;
  runtimeSummary: ReturnType<typeof showRuntimeSummary>;
  runtimeHistory: {
    events: number;
    decisions: number;
    artifacts: number;
  };
  runtimeHistoryPreview: LayeredStateHistoryPreview;
  latestPolicyPreview: ReturnType<typeof inspectLatestPolicyPreview>;
  localConfig: ReturnType<typeof showConfig>;
  codexConfig: ReturnType<typeof showCodexConfig>;
  integrationsAudit: ReturnType<typeof inspectCodexProfileFamilySnapshot>["integrations"]["audit"];
  integrationsApply: ReturnType<typeof inspectCodexProfileFamilySnapshot>["integrations"]["apply"];
  integrationsPreview: ReturnType<typeof inspectCodexProfileFamilySnapshot>["integrations"]["preview"];
  statuslineAudit: ReturnType<typeof inspectCodexProfileFamilySnapshot>["statusline"]["audit"];
  statuslineApply: ReturnType<typeof inspectCodexProfileFamilySnapshot>["statusline"]["apply"];
  statuslinePreview: ReturnType<typeof inspectCodexProfileFamilySnapshot>["statusline"]["preview"];
  driftItems: Array<{
    name: string;
    path: string;
    status: string;
    repairHint: string | null;
  }>;
  policyPreview: ReturnType<typeof previewPolicy>;
}

export function installRuntime(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  ensureRuntimeDirs(paths);
  const runtimeBaseline = ensureRuntimeHandoffBaseline(paths);
  const canonicalRewrites = ensureInstallRuntimeBaseline(paths, codexPaths, runtimeBaseline);

  const details: string[] = [];
  for (const rewrite of canonicalRewrites) {
    appendNamedRewriteDetails(details, rewrite.name, rewrite.metadata);
  }
  details.push(`config: ${paths.configPath}`);
  details.push(`current-run: ${paths.currentRunPath}`);
  details.push(`summary: ${paths.summaryPath}`);
  details.push(`brief: ${paths.briefPath}`);
  details.push(`brief write mode: ${runtimeBaseline.briefWriteMode}`);

  const pathsTouched = installPathsTouched(paths);
  for (const rewrite of canonicalRewrites) {
    pathsTouched.push(rewrite.metadata.rewrittenPath);
    if (rewrite.metadata.backupPath) {
      pathsTouched.push(rewrite.metadata.backupPath);
    }
  }
  pathsTouched.sort();

  return new OperationResult({
    kind: OperationKind.InstallRuntime,
    summary: `installed runtime at ${paths.runtimeRoot}`,
    rewrite: canonicalRewrites[0]?.metadata ?? null,
    details,
    pathsTouched: unique(pathsTouched),
    inventory: []
  });
}

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

export function showRuntimeHistory(paths: ProjectPaths): LayeredStateHistoryCounts {
  return inspectRuntimeState(paths).historyCounts;
}

export function showRuntimeProgress(paths: ProjectPaths): RuntimeProgressSnapshot | null {
  const current = inspectRuntimeState(paths).current;

  if (!current) {
    return null;
  }

  return {
    phase: current.phase,
    verificationStatus: current.verification.status
  };
}

export function inspectSnapshot(paths: ProjectPaths, codexPaths: CodexPaths): InspectSnapshot {
  return inspectSnapshotFromStatusBundle(paths, codexPaths, inspectStatusBundle(paths, codexPaths));
}

export function inspectSnapshotFromStatusBundle(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  statusBundle: ReturnType<typeof inspectStatusBundle>
): InspectSnapshot {
  const runtimeState = statusBundle.runtimeState;
  const doctorResult = doctorForStatusBundle(paths, codexPaths, statusBundle);
  const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths, statusBundle);
  const codexProfileFamily = inspectCodexProfileFamilySnapshot(codexPaths);
  const statusResult = showStatusFromStatusBundle(statusBundle);

  return {
    status: {
      summary: statusResult.summary,
      inventory: statusResult.inventory
    },
    statusBundle,
    doctor: doctorResult,
    doctorHeadline: doctorSnapshot.headline,
    runtimeSummary: buildRuntimeSummary(paths, runtimeState),
    runtimeHistory: runtimeState.historyCounts,
    runtimeHistoryPreview: runtimeState.historyPreview,
    latestPolicyPreview: runtimeState.latestPolicyPreview,
    localConfig: showConfig(paths, codexPaths),
    codexConfig: showCodexConfig(codexPaths),
    integrationsAudit: codexProfileFamily.integrations.audit,
    integrationsApply: codexProfileFamily.integrations.apply,
    integrationsPreview: codexProfileFamily.integrations.preview,
    statuslineAudit: codexProfileFamily.statusline.audit,
    statuslineApply: codexProfileFamily.statusline.apply,
    statuslinePreview: codexProfileFamily.statusline.preview,
    driftItems: statusBundle.driftItems.map((item) => ({
      name: item.name,
      path: item.path,
      status: presentManagedInventoryItem(item).label,
      repairHint: isUnsupportedNativeWindowsHooks(item) ? null : item.repairHint
    })),
    policyPreview: previewPolicyForCurrentRun(paths, runtimeState.current)
  };
}

export function showRuntimeSummary(paths: ProjectPaths): OperationResult {
  return buildRuntimeSummary(paths, inspectRuntimeState(paths));
}

function buildRuntimeSummary(
  paths: ProjectPaths,
  runtimeState: ReturnType<typeof inspectRuntimeState>
): OperationResult {
  const {
    current,
    summary,
    brief,
    latestPolicyPreview,
    historyCounts,
    historyPreview
  } = runtimeState;
  const currentRunStatus = inventoryStatusFromRuntimeLayer(runtimeState.layerStatus.currentRun);
  const summaryStatus = inventoryStatusFromRuntimeLayer(runtimeState.layerStatus.summary);
  const briefStatus = inventoryStatusFromRuntimeLayer(runtimeState.layerStatus.brief);
  const details = [
    `current-run: ${runtimeLayerLabelFromInventory(currentRunStatus)} at ${paths.currentRunPath}`,
    `summary: ${runtimeLayerLabelFromInventory(summaryStatus)} at ${paths.summaryPath}`,
    `brief: ${runtimeLayerLabelFromInventory(briefStatus)} at ${paths.briefPath}`,
    `events: ${historyCounts.events} at ${paths.eventsPath}`,
    `decisions: ${historyCounts.decisions} at ${paths.decisionsPath}`,
    `artifacts: ${historyCounts.artifacts} at ${paths.artifactsPath}`,
    `latest event (read-only local visibility): ${formatLatestHistoryEventPreview(historyPreview.latestEvent)}`,
    `latest decision (read-only local visibility): ${formatLatestHistoryDecisionPreview(historyPreview.latestDecision)}`,
    `latest artifact (read-only local visibility): ${formatLatestHistoryArtifactPreview(historyPreview.latestArtifact)}`
  ];

  if (current) {
    details.push(`objective: ${current.objective}`);
    details.push(`phase: ${current.phase}`);
    details.push(
      current.verification.summary
        ? `verification: ${current.verification.status} (${current.verification.summary})`
        : `verification: ${current.verification.status}`
    );
    details.push(`active tasks: ${joinSummaryList(current.activeTasks)}`);
    details.push(`blocking questions: ${joinSummaryList(current.blockingQuestions)}`);
  }

  if (summary) {
    details.push(`accepted decisions: ${joinSummaryList(summary.acceptedDecisions)}`);
    details.push(`completed milestones: ${joinSummaryList(summary.completedMilestones)}`);
    details.push(`last verified outputs: ${joinSummaryList(summary.lastVerifiedOutputs)}`);
    details.push(`files touched: ${summary.filesTouched.length}`);
  }

  if (brief) {
    details.push("brief preview:");
    details.push(...briefPreviewLines(brief));
  }

  if (latestPolicyPreview.status === "present") {
    details.push(...formatLatestPolicyPreviewLines(latestPolicyPreview, { mode: "runtime-summary" }));
  }

  return new OperationResult({
    kind: OperationKind.ShowRuntimeSummary,
    summary:
      current || summary || brief
        ? `runtime-summary: local handoff state at ${paths.runtimeRoot}`
        : `runtime-summary: no local handoff state at ${paths.runtimeRoot}`,
    details,
    pathsTouched: runtimeStatePaths(paths)
  });
}

export function inspectLatestPolicyPreview(paths: ProjectPaths): LatestPolicyPreviewSnapshot {
  return inspectRuntimeState(paths).latestPolicyPreview;
}

export * from "./codex-config.js";
export * from "./bundles.js";
export * from "./history.js";
export * from "./inventory.js";
export * from "./inspect-presenter.js";
export * from "./opencode-native.js";
export * from "./policy-preview.js";
export * from "./policy-preview-presenter.js";
export * from "./preferences.js";
export * from "./runtime-history-presenter.js";

function ensureInstallRuntimeBaseline(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  runtimeBaseline: ReturnType<typeof ensureRuntimeHandoffBaseline>
): InstallCanonicalRewrite[] {
  const rewrites: InstallCanonicalRewrite[] = [];
  const configRewrite = ensureInstallConfig(paths, codexPaths);
  if (configRewrite) {
    rewrites.push({ name: "config", metadata: configRewrite });
  }

  if (runtimeBaseline.currentRewrite) {
    rewrites.push({
      name: "current-run",
      metadata: operationRewriteMetadata(runtimeBaseline.currentRewrite)
    });
  }

  if (runtimeBaseline.summaryRewrite) {
    rewrites.push({
      name: "summary",
      metadata: operationRewriteMetadata(runtimeBaseline.summaryRewrite)
    });
  }

  for (const path of runtimeHistoryPaths(paths)) {
    ensureFileWithDefault(path, "");
  }

  return rewrites;
}

function ensureInstallConfig(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): OperationRewriteMetadata | null {
  const localConfig = inspectLocalConfigFamily(paths, recommendedLocalConfig(codexPaths));
  if (localConfig.source === "local") {
    return null;
  }

  return operationRewriteMetadata(
    writeCanonicalWithBackupResult(paths.configPath, localConfig.recommended, {
      format: "toml",
      stringify: stringifyLocalConfig
    })
  );
}

function recommendedLocalConfig(codexPaths: CodexPaths): LocalConfig {
  return createRecommendedLocalConfig(
    detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson)
  );
}

function ensureFileWithDefault(path: string, defaultContents: string): void {
  try {
    writeFileSync(path, defaultContents, {
      encoding: "utf8",
      flag: "wx"
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

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

function joinSummaryList(values: string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function briefPreviewLines(brief: string): string[] {
  return brief
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 4);
}

function installPathsTouched(paths: ProjectPaths): string[] {
  return [paths.configPath, ...runtimeStatePaths(paths)];
}

function appendNamedRewriteDetails(
  details: string[],
  name: string,
  metadata: OperationRewriteMetadata
): void {
  details.push(`${name} rewritten path: ${metadata.rewrittenPath}`);
  if (metadata.backupPath) {
    details.push(`${name} backup path: ${metadata.backupPath}`);
  }
  details.push(`${name} write mode: ${metadata.firstWrite ? "first write" : "rewrite"}`);
}

function operationRewriteMetadata(metadata: CanonicalRewriteResult): OperationRewriteMetadata {
  return {
    rewrittenPath: metadata.rewrittenPath,
    backupPath: metadata.backupPath,
    firstWrite: metadata.firstWrite
  };
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

export * from "./codex-native.js";
export * from "./hooks-custom-agents.js";
export * from "./session-start-hook.js";
