import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  createRecommendedLocalConfig,
  detectCodexEnvironment,
  stringifyLocalConfig,
  type LocalConfig
} from "@sane/config";
import {
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
  type LayeredStateHistoryCounts,
  type LayeredStateHistoryPreview,
  type LatestPolicyPreviewSnapshot,
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
import { formatRuntimeSummaryPolicyPreviewLines } from "./policy-preview-presenter.js";
import { previewPolicy, previewPolicyForCurrentRun } from "./policy-preview.js";
import { showConfig, showConfigFromPreferencesFamily, type PreferencesFamilySnapshot } from "./preferences.js";
import { inspectWorktreeReadiness } from "./worktree-readiness.js";
import { inspectLocalConfigFamily } from "./local-config.js";
import {
  formatLatestHistoryArtifactPreview,
  formatLatestHistoryDecisionPreview,
  formatLatestHistoryEventPreview
} from "./runtime-history-presenter.js";
import {
  ensureRuntimeHandoffBaseline,
  advanceOutcomeState,
  type AdvanceOutcomeInput,
  inspectOutcomeRescueSignalFromRuntimeState,
  inspectSelfHostingShadowSnapshot,
  inspectSelfHostingShadowSnapshotFromRuntimeState,
  inspectOutcomeReadinessSnapshot,
  inspectOutcomeReadinessSnapshotFromRuntimeState,
  inspectRecentBlockersFromStateEvents,
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
  selfHostingShadow: ReturnType<typeof inspectSelfHostingShadowSnapshot>;
  outcomeReadiness: ReturnType<typeof inspectOutcomeReadinessSnapshot>;
  outcomeRescueSignal: ReturnType<typeof inspectOutcomeRescueSignalFromRuntimeState>;
  worktreeReadiness: ReturnType<typeof inspectWorktreeReadiness>;
  runtimeOutcome: {
    phase: string | null;
    activeTaskCount: number;
    blockingQuestionCount: number;
    verificationStatus: string | null;
    verificationSummary: string | null;
    lastVerifiedOutputs: string[];
    filesTouchedCount: number;
  };
  repoVerifyCommand: string | null;
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
  return showRuntimeHistoryFromRuntimeState(inspectRuntimeState(paths));
}

export function showRuntimeHistoryFromRuntimeState(
  runtimeState: ReturnType<typeof inspectRuntimeState>
): LayeredStateHistoryCounts {
  return runtimeState.historyCounts;
}

export function showRuntimeProgress(paths: ProjectPaths): RuntimeProgressSnapshot | null {
  return showRuntimeProgressFromRuntimeState(inspectRuntimeState(paths));
}

export function showRuntimeProgressFromRuntimeState(
  runtimeState: ReturnType<typeof inspectRuntimeState>
): RuntimeProgressSnapshot | null {
  const current = runtimeState.current;

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
  statusBundle: ReturnType<typeof inspectStatusBundle>,
  codexProfileFamily = inspectCodexProfileFamilySnapshot(codexPaths),
  preferencesFamily?: PreferencesFamilySnapshot
): InspectSnapshot {
  const runtimeState = statusBundle.runtimeState;
  const doctorResult = doctorForStatusBundle(paths, codexPaths, statusBundle);
  const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths, statusBundle);
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
    selfHostingShadow: inspectSelfHostingShadowSnapshotFromRuntimeState(paths, runtimeState),
    outcomeReadiness: inspectOutcomeReadinessSnapshotFromRuntimeState(paths, runtimeState),
    outcomeRescueSignal: inspectOutcomeRescueSignalFromRuntimeState(runtimeState),
    worktreeReadiness: inspectWorktreeReadiness(paths),
    runtimeOutcome: {
      phase: runtimeState.current?.phase ?? null,
      activeTaskCount: runtimeState.current?.activeTasks.length ?? 0,
      blockingQuestionCount:
        runtimeState.current?.blockingQuestions.filter((question) => question.trim().length > 0).length ?? 0,
      verificationStatus: runtimeState.current?.verification.status ?? null,
      verificationSummary: runtimeState.current?.verification.summary ?? null,
      lastVerifiedOutputs: runtimeState.summary?.lastVerifiedOutputs ?? [],
      filesTouchedCount: runtimeState.summary?.filesTouched.length ?? 0
    },
    repoVerifyCommand: inspectRepoVerifyCommand(paths),
    latestPolicyPreview: runtimeState.latestPolicyPreview,
    localConfig: preferencesFamily
      ? showConfigFromPreferencesFamily(paths, preferencesFamily)
      : showConfig(paths, codexPaths),
    codexConfig: codexProfileFamily.codexConfig,
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

export function showOutcomeReadiness(paths: ProjectPaths): OperationResult {
  return showOutcomeReadinessFromRuntimeState(paths, inspectRuntimeState(paths));
}

export function advanceOutcome(
  paths: ProjectPaths,
  input: AdvanceOutcomeInput = {}
): OperationResult {
  const outcome = advanceOutcomeState(paths, input);
  return new OperationResult({
    kind: OperationKind.AdvanceOutcome,
    summary: `outcome ${outcome.status}: ${outcome.current.phase}`,
    details: outcome.details,
    pathsTouched: outcome.pathsTouched
  });
}

export function showOutcomeReadinessFromRuntimeState(
  paths: ProjectPaths,
  runtimeState: ReturnType<typeof inspectRuntimeState>
): OperationResult {
  const snapshot = inspectOutcomeReadinessSnapshotFromRuntimeState(paths, runtimeState);
  const rescueSignal = inspectOutcomeRescueSignalFromRuntimeState(runtimeState);
  return new OperationResult({
    kind: OperationKind.ShowOutcomeReadiness,
    summary: `outcome readiness: ${snapshot.status}`,
    details: [
      `mode: ${snapshot.mode}`,
      `autonomous loop: ${snapshot.autonomousLoopEnabled ? "enabled" : "disabled"}`,
      `checks: ${formatOutcomeReadinessCheckCounts(snapshot.checks)}`,
      `rescue signal: ${rescueSignal.status} (${rescueSignal.summary})`,
      ...snapshot.checks.map((check) => `${check.id}: ${check.status} - ${check.summary}`)
    ],
    pathsTouched: runtimeStatePaths(paths)
  });
}

export function showRuntimeSummary(paths: ProjectPaths): OperationResult {
  return showRuntimeSummaryFromRuntimeState(paths, inspectRuntimeState(paths));
}

export function showRuntimeSummaryFromRuntimeState(
  paths: ProjectPaths,
  runtimeState: ReturnType<typeof inspectRuntimeState>
): OperationResult {
  return buildRuntimeSummary(paths, runtimeState);
}

function formatOutcomeReadinessCheckCounts(
  checks: ReturnType<typeof inspectOutcomeReadinessSnapshot>["checks"]
): string {
  const pass = checks.filter((check) => check.status === "pass").length;
  const warn = checks.filter((check) => check.status === "warn").length;
  const block = checks.filter((check) => check.status === "block").length;

  return `pass ${pass}, warn ${warn}, block ${block}`;
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
  const rescueSignal = inspectOutcomeRescueSignalFromRuntimeState(runtimeState);
  const currentPolicyPreview = previewPolicyForCurrentRun(paths, current);
  const currentRunStatus = inventoryStatusFromRuntimeLayer(runtimeState.layerStatus.currentRun);
  const summaryStatus = inventoryStatusFromRuntimeLayer(runtimeState.layerStatus.summary);
  const briefStatus = inventoryStatusFromRuntimeLayer(runtimeState.layerStatus.brief);
  const details = [
    `runtime handoff layers: current-run ${runtimeLayerLabelFromInventory(currentRunStatus)}, summary ${runtimeLayerLabelFromInventory(summaryStatus)}, brief ${runtimeLayerLabelFromInventory(briefStatus)}`,
    `current-run: ${runtimeLayerLabelFromInventory(currentRunStatus)} at ${paths.currentRunPath}`,
    `summary: ${runtimeLayerLabelFromInventory(summaryStatus)} at ${paths.summaryPath}`,
    `brief: ${runtimeLayerLabelFromInventory(briefStatus)} at ${paths.briefPath}`,
    `events: ${historyCounts.events} at ${paths.eventsPath}`,
    `decisions: ${historyCounts.decisions} at ${paths.decisionsPath}`,
    `artifacts: ${historyCounts.artifacts} at ${paths.artifactsPath}`,
    `latest event (read-only local visibility): ${formatLatestHistoryEventPreview(historyPreview.latestEvent)}`,
    `latest decision (read-only local visibility): ${formatLatestHistoryDecisionPreview(historyPreview.latestDecision)}`,
    `latest artifact (read-only local visibility): ${formatLatestHistoryArtifactPreview(historyPreview.latestArtifact)}`,
    formatRecentBlockersSummary(paths)
  ];

  if (current) {
    details.push(`objective: ${current.objective}`);
    details.push(`phase: ${current.phase}`);
    details.push(
      current.verification.summary
        ? `verification: ${current.verification.status} (${current.verification.summary})`
        : `verification: ${current.verification.status}`
    );
    details.push(`rescue signal: ${rescueSignal.status} (${rescueSignal.summary})`);
    details.push(`active tasks: ${joinSummaryList(current.activeTasks)}`);
    details.push(`blocking questions: ${joinSummaryList(current.blockingQuestions)}`);
  }

  const repoVerifyCommand = inspectRepoVerifyCommand(paths);
  if (repoVerifyCommand) {
    details.push(`repo verify: ${repoVerifyCommand}`);
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

  details.push(...formatRuntimeSummaryPolicyPreviewLines(latestPolicyPreview, currentPolicyPreview));

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

function formatRecentBlockersSummary(paths: ProjectPaths): string {
  const recent = inspectRecentBlockersFromStateEvents(paths);
  if (recent.total === 0) {
    return "recent blockers (events): none";
  }

  return `recent blockers (events): ${recent.total} total; latest ${recent.items.join(" | ")}`;
}

export function inspectLatestPolicyPreview(paths: ProjectPaths): LatestPolicyPreviewSnapshot {
  return inspectRuntimeState(paths).latestPolicyPreview;
}

// Barrel exports intentionally stay narrow: expose top-level control-plane
// entry points without promoting every implementation module to root API.
export { applyCodexProfile } from "./codex-config.js";
export { exportAll, exportOpencodeCore, uninstallAll, uninstallOpencodeCore } from "./bundles.js";
export { showStatus, doctor } from "./inventory.js";
export { checkForUpdates, inspectUpdateCheck } from "./update-check.js";
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
} from "./policy-preview-presenter.js";

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

function inspectRepoVerifyCommand(paths: ProjectPaths): string | null {
  if (!existsSync(paths.repoAgentsMd)) {
    return null;
  }

  const body = readFileSync(paths.repoAgentsMd, "utf8");
  const directMatch = body.match(/Default verify:\s*`([^`]+)`/);
  if (directMatch) {
    return directMatch[1] ?? null;
  }

  let inVerifySection = false;
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      inVerifySection = line === "## Verify";
      continue;
    }

    if (!inVerifySection) {
      continue;
    }

    const codeMatch = line.match(/`([^`]+)`/);
    if (codeMatch) {
      return codeMatch[1] ?? null;
    }
  }

  return null;
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
