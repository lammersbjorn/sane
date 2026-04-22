import { writeFileSync } from "node:fs";

import { type LocalConfig } from "@sane/config";
import { OperationKind, type OperationResult } from "@sane/core";
import { type ProjectPaths } from "@sane/platform";
import {
  appendJsonlRecord,
  buildRunBrief,
  createDefaultRunSummary,
  createDefaultCurrentRunState,
  createArtifactRecord,
  createDecisionRecord,
  createEventRecord,
  createPolicyPreviewDecisionContext,
  promoteRunSummary,
  parseEventRecordJson,
  readCurrentRunState,
  readJsonlLastRecord,
  readRunSummary,
  stringifyArtifactRecord,
  stringifyDecisionRecord,
  stringifyEventRecord,
  writeRunSummary,
  type CurrentRunState,
  type RunSummary
} from "@sane/state";

import { saveConfig } from "./preferences.js";

export function readLastOperationSummary(paths: ProjectPaths): string | null {
  return readJsonlLastRecord(paths.eventsPath, parseEventRecordJson)?.summary ?? null;
}

export function executeConfigSave(paths: ProjectPaths, config: LocalConfig): OperationResult {
  const result = saveConfig(paths, config);
  recordOperation(paths, result);
  return result;
}

export function executeOperation(
  paths: ProjectPaths,
  run: () => OperationResult
): OperationResult {
  const result = run();
  recordOperation(paths, result);
  return result;
}

export function recordOperation(paths: ProjectPaths, result: OperationResult): void {
  const current = currentRunState(paths);
  const summary = persistOperationState(paths, result);
  refreshBrief(paths, current, summary);
}

function persistOperationState(paths: ProjectPaths, result: OperationResult): RunSummary {
  appendOperationRecord(paths, result);
  appendDecisionRecord(paths, result);
  appendArtifactRecords(paths, result);
  return promoteOperationSummary(paths, result);
}

function appendOperationRecord(paths: ProjectPaths, result: OperationResult): void {
  appendJsonlRecord(
    paths.eventsPath,
    createEventRecord(
      "operation",
      operationKindLabel(result.kind),
      "ok",
      result.summary,
      result.pathsTouched
    ),
    stringifyEventRecord
  );
}

function appendDecisionRecord(paths: ProjectPaths, result: OperationResult): void {
  const milestone = operationMilestone(result.kind);
  const context = decisionContext(result);
  if (!milestone && !context) {
    return;
  }

  const rationale = result.details[0] ?? operationKindLabel(result.kind);
  appendJsonlRecord(
    paths.decisionsPath,
    createDecisionRecord(milestone ?? result.summary, rationale, result.pathsTouched, context),
    stringifyDecisionRecord
  );
}

function appendArtifactRecords(paths: ProjectPaths, result: OperationResult): void {
  for (const artifactPath of result.pathsTouched) {
    appendJsonlRecord(
      paths.artifactsPath,
      createArtifactRecord(
        operationKindLabel(result.kind),
        artifactPath,
        result.summary,
        result.pathsTouched
      ),
      stringifyArtifactRecord
    );
  }
}

function promoteOperationSummary(paths: ProjectPaths, result: OperationResult): RunSummary {
  const baseSummary = readOptionalSummary(paths) ?? createDefaultRunSummary();
  const summary = promoteRunSummary(baseSummary, {
    pathsTouched: result.pathsTouched,
    milestone: operationMilestone(result.kind),
  });

  writeRunSummary(paths.summaryPath, summary);
  return summary;
}

function refreshBrief(paths: ProjectPaths, current: CurrentRunState, summary: RunSummary): void {
  writeFileSync(paths.briefPath, buildRunBrief(summary, current), "utf8");
}

function currentRunState(paths: ProjectPaths): CurrentRunState {
  try {
    return readCurrentRunState(paths.currentRunPath);
  } catch {
    return createDefaultCurrentRunState("unknown");
  }
}

function readOptionalSummary(paths: ProjectPaths): RunSummary | null {
  try {
    return readRunSummary(paths.summaryPath);
  } catch {
    return null;
  }
}

function operationMilestone(kind: OperationKind): string | null {
  switch (kind) {
    case OperationKind.InstallRuntime:
      return "runtime installed";
    case OperationKind.ExportUserSkills:
      return "user skills exported";
    case OperationKind.ExportRepoSkills:
      return "repo skills exported";
    case OperationKind.ExportRepoAgents:
      return "repo AGENTS exported";
    case OperationKind.ExportGlobalAgents:
      return "global agents exported";
    case OperationKind.ExportHooks:
      return "hooks exported";
    case OperationKind.ExportCustomAgents:
      return "custom agents exported";
    case OperationKind.ExportAll:
      return "Sane installed into Codex";
    case OperationKind.UninstallRepoSkills:
      return "repo skills removed";
    case OperationKind.UninstallRepoAgents:
      return "repo AGENTS removed";
    case OperationKind.UninstallAll:
      return "Sane removed from Codex";
    default:
      return null;
  }
}

function decisionContext(
  result: OperationResult
): ReturnType<typeof createPolicyPreviewDecisionContext> | null {
  if (result.kind !== OperationKind.PreviewPolicy || !result.policyPreview) {
    return null;
  }

  return createPolicyPreviewDecisionContext(result.policyPreview.scenarios);
}

function operationKindLabel(kind: OperationKind): string {
  switch (kind) {
    case OperationKind.InstallRuntime:
      return "install_runtime";
    case OperationKind.ShowConfig:
      return "show_config";
    case OperationKind.ShowCodexConfig:
      return "show_codex_config";
    case OperationKind.ShowRuntimeSummary:
      return "show_runtime_summary";
    case OperationKind.PreviewPolicy:
      return "preview_policy";
    case OperationKind.BackupCodexConfig:
      return "backup_codex_config";
    case OperationKind.PreviewCodexProfile:
      return "preview_codex_profile";
    case OperationKind.PreviewIntegrationsProfile:
      return "preview_integrations_profile";
    case OperationKind.PreviewCloudflareProfile:
      return "preview_cloudflare_profile";
    case OperationKind.PreviewOpencodeProfile:
      return "preview_opencode_profile";
    case OperationKind.ApplyCodexProfile:
      return "apply_codex_profile";
    case OperationKind.ApplyIntegrationsProfile:
      return "apply_integrations_profile";
    case OperationKind.ApplyCloudflareProfile:
      return "apply_cloudflare_profile";
    case OperationKind.ApplyOpencodeProfile:
      return "apply_opencode_profile";
    case OperationKind.RestoreCodexConfig:
      return "restore_codex_config";
    case OperationKind.ResetTelemetryData:
      return "reset_telemetry_data";
    case OperationKind.ShowStatus:
      return "show_status";
    case OperationKind.Doctor:
      return "doctor";
    case OperationKind.ExportUserSkills:
      return "export_user_skills";
    case OperationKind.ExportRepoSkills:
      return "export_repo_skills";
    case OperationKind.ExportRepoAgents:
      return "export_repo_agents";
    case OperationKind.ExportGlobalAgents:
      return "export_global_agents";
    case OperationKind.ExportHooks:
      return "export_hooks";
    case OperationKind.ExportCustomAgents:
      return "export_custom_agents";
    case OperationKind.ExportOpencodeAgents:
      return "export_opencode_agents";
    case OperationKind.ExportAll:
      return "export_all";
    case OperationKind.UninstallUserSkills:
      return "uninstall_user_skills";
    case OperationKind.UninstallRepoSkills:
      return "uninstall_repo_skills";
    case OperationKind.UninstallRepoAgents:
      return "uninstall_repo_agents";
    case OperationKind.UninstallGlobalAgents:
      return "uninstall_global_agents";
    case OperationKind.UninstallHooks:
      return "uninstall_hooks";
    case OperationKind.UninstallCustomAgents:
      return "uninstall_custom_agents";
    case OperationKind.UninstallOpencodeAgents:
      return "uninstall_opencode_agents";
    case OperationKind.UninstallAll:
      return "uninstall_all";
    default:
      return kind.value.replace(/[A-Z]/g, (letter, index) =>
        index === 0 ? letter.toLowerCase() : `_${letter.toLowerCase()}`
      );
  }
}
