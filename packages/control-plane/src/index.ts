import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";

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
  createCanonicalStatePaths,
  loadLayeredStateBundle,
  listCanonicalBackupSiblings,
  readCurrentRunState,
  readLocalStateConfig,
  readRunSummary,
  stringifyCurrentRunState,
  writeCanonicalWithBackupResult,
  type CanonicalRewriteResult,
  type CurrentRunState,
  type LayeredStateBundle,
  type LayeredStateHistoryCounts,
  type LatestPolicyPreviewSnapshot,
  type RunSummary
} from "@sane/state";

import {
  inspectIntegrationsProfileAudit,
  previewIntegrationsProfile,
  showCodexConfig
} from "./codex-config.js";
import { doctor, inspectStatusBundle } from "./inventory.js";
import { previewPolicy } from "./policy-preview.js";
import { showConfig } from "./preferences.js";

interface InstallCanonicalRewrite {
  name: "config" | "current-run" | "summary";
  metadata: OperationRewriteMetadata;
}

export interface RuntimeProgressSnapshot {
  phase: string;
  verificationStatus: string;
}

interface RuntimeStateSnapshot {
  current: CurrentRunState | null;
  summary: RunSummary | null;
  brief: string | null;
  historyCounts: LayeredStateHistoryCounts;
  latestPolicyPreview: LatestPolicyPreviewSnapshot;
  currentRunStatus: InventoryStatus;
  summaryStatus: InventoryStatus;
  briefStatus: InventoryStatus;
}

export interface InspectSnapshot {
  status: {
    summary: string;
    inventory: ReturnType<typeof inspectStatusBundle>["inventory"];
  };
  statusBundle: ReturnType<typeof inspectStatusBundle>;
  doctor: ReturnType<typeof doctor>;
  runtimeSummary: ReturnType<typeof showRuntimeSummary>;
  runtimeHistory: {
    events: number;
    decisions: number;
    artifacts: number;
  };
  latestPolicyPreview: ReturnType<typeof inspectLatestPolicyPreview>;
  localConfig: ReturnType<typeof showConfig>;
  codexConfig: ReturnType<typeof showCodexConfig>;
  integrationsAudit: ReturnType<typeof inspectIntegrationsProfileAudit>;
  integrationsPreview: ReturnType<typeof previewIntegrationsProfile>;
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
  const canonicalRewrites = ensureInstallRuntimeBaseline(paths, codexPaths);

  const layered = tryLoadLayeredState(paths);
  const current =
    layered?.currentRun ??
    readCurrentRunState(paths.currentRunPath);
  const summary = layered?.summary ?? readRunSummary(paths.summaryPath);
  ensureFileWithDefault(paths.briefPath, buildBriefBody(summary, current));

  const details: string[] = [];
  for (const rewrite of canonicalRewrites) {
    appendNamedRewriteDetails(details, rewrite.name, rewrite.metadata);
  }
  details.push(`config: ${paths.configPath}`);
  details.push(`current-run: ${paths.currentRunPath}`);
  details.push(`summary: ${paths.summaryPath}`);
  details.push(`brief: ${paths.briefPath}`);

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
      `runtime: ${doctorStatus(findInventory(inventory, "runtime"))}`,
      `config: ${doctorStatus(findInventory(inventory, "config"))}`,
      `config-backups: ${canonicalBackupHistorySummary(configBackups)}`,
      `current-run: ${doctorStatus(findInventory(inventory, "current-run"))}`,
      `summary: ${doctorStatus(findInventory(inventory, "summary"))}`,
      `summary-backups: ${canonicalBackupHistorySummary(summaryBackups)}`,
      `brief: ${doctorStatus(findInventory(inventory, "brief"))}`,
      `root: ${paths.runtimeRoot}`
    ].join("\n"),
    details: [],
    pathsTouched: collectPathsTouched(inventory),
    inventory
  });
}

export function showRuntimeHistory(paths: ProjectPaths): LayeredStateHistoryCounts {
  return inspectRuntimeStateSnapshot(paths).historyCounts;
}

export function showRuntimeProgress(paths: ProjectPaths): RuntimeProgressSnapshot | null {
  const current = inspectRuntimeStateSnapshot(paths).current;

  if (!current) {
    return null;
  }

  return {
    phase: current.phase,
    verificationStatus: current.verification.status
  };
}

export function inspectSnapshot(paths: ProjectPaths, codexPaths: CodexPaths): InspectSnapshot {
  const statusBundle = inspectStatusBundle(paths, codexPaths);
  const runtimeState = inspectRuntimeStateSnapshot(paths);

  return {
    status: {
      summary: `status: ${statusBundle.inventory.length} managed targets inspected`,
      inventory: statusBundle.inventory
    },
    statusBundle,
    doctor: doctor(paths, codexPaths),
    runtimeSummary: showRuntimeSummary(paths),
    runtimeHistory: runtimeState.historyCounts,
    latestPolicyPreview: runtimeState.latestPolicyPreview,
    localConfig: showConfig(paths),
    codexConfig: showCodexConfig(codexPaths),
    integrationsAudit: inspectIntegrationsProfileAudit(codexPaths),
    integrationsPreview: previewIntegrationsProfile(codexPaths),
    driftItems: statusBundle.driftItems.map((item) => ({
      name: item.name,
      path: item.path,
      status: item.status.displayString(),
      repairHint: item.repairHint
    })),
    policyPreview: previewPolicy(paths)
  };
}

export function showRuntimeSummary(paths: ProjectPaths): OperationResult {
  const runtimeState = inspectRuntimeStateSnapshot(paths);
  const { current, summary, brief, latestPolicyPreview, historyCounts } = runtimeState;
  const details = [
    `current-run: ${current ? "present" : "missing"} at ${paths.currentRunPath}`,
    `summary: ${summary ? "present" : "missing"} at ${paths.summaryPath}`,
    `brief: ${brief ? "present" : "missing"} at ${paths.briefPath}`,
    `events: ${historyCounts.events} at ${paths.eventsPath}`,
    `decisions: ${historyCounts.decisions} at ${paths.decisionsPath}`,
    `artifacts: ${historyCounts.artifacts} at ${paths.artifactsPath}`
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
    details.push(`latest policy preview: ${latestPolicyPreview.scenarioCount} scenarios`);
    if (latestPolicyPreview.tsUnix !== null && latestPolicyPreview.summary) {
      details.push(
        `latest policy preview provenance: ts ${latestPolicyPreview.tsUnix}, summary ${latestPolicyPreview.summary}`
      );
    }
  }

  return new OperationResult({
    kind: OperationKind.ShowRuntimeSummary,
    summary:
      current || summary || brief
        ? `runtime-summary: local handoff state at ${paths.runtimeRoot}`
        : `runtime-summary: no local handoff state at ${paths.runtimeRoot}`,
    details,
    pathsTouched: [
      paths.currentRunPath,
      paths.summaryPath,
      paths.briefPath,
      paths.eventsPath,
      paths.decisionsPath,
      paths.artifactsPath
    ]
  });
}

export function inspectLatestPolicyPreview(paths: ProjectPaths): LatestPolicyPreviewSnapshot {
  return inspectRuntimeStateSnapshot(paths).latestPolicyPreview;
}

export * from "./codex-config.js";
export * from "./bundles.js";
export * from "./history.js";
export * from "./inventory.js";
export * from "./opencode-native.js";
export * from "./policy-preview.js";
export * from "./preferences.js";

function tryLoadLayeredState(paths: ProjectPaths): LayeredStateBundle | null {
  try {
    return loadLayeredStateBundle(
      createCanonicalStatePaths(
        paths.configPath,
        paths.summaryPath,
        paths.currentRunPath,
        paths.briefPath,
        paths.eventsPath,
        paths.decisionsPath,
        paths.artifactsPath
      )
    );
  } catch {
    return null;
  }
}

function inspectRuntimeStateSnapshot(paths: ProjectPaths): RuntimeStateSnapshot {
  const layeredState = tryLoadLayeredState(paths);
  const current =
    layeredState?.currentRun ??
    safeRead(() => readCurrentRunState(paths.currentRunPath));
  const summary =
    layeredState?.summary ??
    safeRead(() => readRunSummary(paths.summaryPath));
  const brief =
    layeredState?.brief ??
    safeRead(() => readFileSync(paths.briefPath, "utf8"));
  const stateDirPresent = existsSync(paths.stateDir);

  return {
    current,
    summary,
    brief,
    historyCounts: layeredState?.historyCounts ?? { events: 0, decisions: 0, artifacts: 0 },
    latestPolicyPreview: layeredState?.latestPolicyPreview ?? missingLatestPolicyPreview(),
    currentRunStatus: !stateDirPresent
      ? InventoryStatus.Missing
      : current
        ? InventoryStatus.Installed
        : readStatus(() => readCurrentRunState(paths.currentRunPath)),
    summaryStatus: !stateDirPresent
      ? InventoryStatus.Missing
      : summary
        ? InventoryStatus.Installed
        : readStatus(() => readRunSummary(paths.summaryPath)),
    briefStatus: brief ? InventoryStatus.Installed : fileStatus(paths.briefPath)
  };
}

function ensureInstallRuntimeBaseline(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): InstallCanonicalRewrite[] {
  const rewrites: InstallCanonicalRewrite[] = [];
  const configRewrite = ensureInstallConfig(paths, codexPaths);
  if (configRewrite) {
    rewrites.push({ name: "config", metadata: configRewrite });
  }

  const currentRunRewrite = ensureInstallCurrentRun(paths);
  if (currentRunRewrite) {
    rewrites.push({ name: "current-run", metadata: currentRunRewrite });
  }

  const summaryRewrite = ensureInstallSummary(paths);
  if (summaryRewrite) {
    rewrites.push({ name: "summary", metadata: summaryRewrite });
  }

  ensureFileWithDefault(paths.eventsPath, "");
  ensureFileWithDefault(paths.decisionsPath, "");
  ensureFileWithDefault(paths.artifactsPath, "");

  return rewrites;
}

function ensureInstallConfig(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): OperationRewriteMetadata | null {
  let shouldRewrite = false;
  try {
    readLocalConfig(paths.configPath);
  } catch {
    shouldRewrite = true;
  }

  if (!shouldRewrite) {
    return null;
  }

  return operationRewriteMetadata(
    writeCanonicalWithBackupResult(paths.configPath, recommendedLocalConfig(codexPaths), {
      format: "toml",
      stringify: stringifyLocalConfig
    })
  );
}

function ensureInstallCurrentRun(paths: ProjectPaths): OperationRewriteMetadata | null {
  let shouldRewrite = false;
  try {
    readCurrentRunState(paths.currentRunPath);
  } catch {
    shouldRewrite = true;
  }

  if (!shouldRewrite) {
    return null;
  }

  return operationRewriteMetadata(
    writeCanonicalWithBackupResult(paths.currentRunPath, installCurrentRunState(), {
      format: "json",
      stringify: stringifyCurrentRunState
    })
  );
}

function ensureInstallSummary(paths: ProjectPaths): OperationRewriteMetadata | null {
  let shouldRewrite = false;
  try {
    readRunSummary(paths.summaryPath);
  } catch {
    shouldRewrite = true;
  }

  if (!shouldRewrite) {
    return null;
  }

  return operationRewriteMetadata(
    writeCanonicalWithBackupResult(paths.summaryPath, defaultRunSummary(), {
      format: "json"
    })
  );
}

function recommendedLocalConfig(codexPaths: CodexPaths): LocalConfig {
  return createRecommendedLocalConfig(
    detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson)
  );
}

function inspectRuntimeInventory(paths: ProjectPaths) {
  const runtimeState = inspectRuntimeStateSnapshot(paths);

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
      status: runtimeState.currentRunStatus,
      path: paths.currentRunPath,
      repairHint: repairHintForPath(paths.currentRunPath)
    },
    {
      name: "summary",
      scope: InventoryScope.LocalRuntime,
      status: runtimeState.summaryStatus,
      path: paths.summaryPath,
      repairHint: repairHintForPath(paths.summaryPath)
    },
    {
      name: "brief",
      scope: InventoryScope.LocalRuntime,
      status: runtimeState.briefStatus,
      path: paths.briefPath,
      repairHint: repairHintForPath(paths.briefPath)
    }
  ];
}

function installCurrentRunState(): CurrentRunState {
  return {
    version: 2,
    objective: "initialize sane runtime",
    phase: "setup",
    activeTasks: ["install sane runtime"],
    blockingQuestions: [],
    verification: {
      status: "pending",
      summary: "runtime scaffolding created"
    },
    lastCompactionTsUnix: null,
    extra: {}
  };
}

function defaultRunSummary(): RunSummary {
  return {
    version: 2,
    acceptedDecisions: [],
    completedMilestones: [],
    constraints: [],
    lastVerifiedOutputs: [],
    filesTouched: [],
    extra: {}
  };
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

function buildBriefBody(summary: RunSummary, current: CurrentRunState): string {
  return [
    "# Sane Brief",
    "",
    "## Current Run",
    `- Objective: ${current.objective}`,
    `- Phase: ${current.phase}`,
    `- Verification: ${current.verification.status}`,
    `- Last compaction: ${current.lastCompactionTsUnix ?? "none"}`,
    "",
    "## Active Tasks",
    ...renderBullets(current.activeTasks),
    "",
    "## Blocking Questions",
    ...renderBullets(current.blockingQuestions),
    "",
    "## Accepted Decisions",
    ...renderBullets(summary.acceptedDecisions),
    "",
    "## Completed Milestones",
    ...renderBullets(summary.completedMilestones),
    "",
    "## Last Verified Outputs",
    ...renderBullets(summary.lastVerifiedOutputs),
    "",
    "## Files Touched",
    ...renderBullets(summary.filesTouched),
    ""
  ].join("\n");
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

function doctorStatus(
  item:
    | {
        status: InventoryStatus;
      }
    | undefined
): string {
  return item?.status.displayString() ?? "unknown";
}

function renderBullets(items: string[]): string[] {
  if (items.length === 0) {
    return ["- none"];
  }

  return items.map((item) => `- ${item}`);
}

function installPathsTouched(paths: ProjectPaths): string[] {
  return [
    paths.configPath,
    paths.currentRunPath,
    paths.summaryPath,
    paths.eventsPath,
    paths.decisionsPath,
    paths.artifactsPath,
    paths.briefPath
  ];
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

function missingLatestPolicyPreview(): LatestPolicyPreviewSnapshot {
  return {
    status: "missing",
    scenarioCount: 0,
    scenarioIds: [],
    scenarios: [],
    tsUnix: null,
    summary: null
  };
}

function safeRead<T>(reader: () => T): T | null {
  try {
    return reader();
  } catch {
    return null;
  }
}

function repairHintForPath(path: string): string | null {
  return existsSync(path) ? null : "rerun `install`";
}

export * from "./codex-native.js";
export * from "./hooks-custom-agents.js";
export * from "./session-start-hook.js";
