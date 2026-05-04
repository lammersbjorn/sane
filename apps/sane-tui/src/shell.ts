import { basename } from "node:path";

import { OperationResult } from "@sane/control-plane/core.js";
import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/control-plane/platform.js";

import { exportAll, exportOpencodeCore, uninstallAll } from "@sane/control-plane/bundles.js";
import {
  applyCloudflareProfile,
  applyCodexProfile,
  applyIntegrationsProfile,
  applyStatuslineProfile,
  backupCodexConfig,
  inspectCodexProfileFamilySnapshot,
  previewCloudflareProfile,
  previewCodexProfile,
  previewIntegrationsProfile,
  previewStatuslineProfile,
  restoreCodexConfig,
  showCodexConfig
} from "@sane/control-plane/codex-config.js";
import {
  exportGlobalAgents,
  exportRepoAgents,
  exportRepoSkills,
  exportUserSkills,
  uninstallGlobalAgents,
  uninstallUserSkills
} from "@sane/control-plane/codex-native.js";
import {
  uninstallCustomAgents,
  uninstallHooks,
  exportCustomAgents,
  exportHooks
} from "@sane/control-plane/hooks-custom-agents.js";
import { executeConfigSave, executeOperation, executeOperationWithRuntimeState } from "@sane/control-plane/history.js";
import { checkForUpdates } from "@sane/control-plane/update-check.js";
import { submitLatestIssueRelayDraft, writeIssueRelayDraft } from "@sane/control-plane/issue-relay.js";
import {
  doctor,
  doctorForStatusBundle,
  inspectOnboardingSnapshotFromStatusBundle,
  inspectStatusBundle,
  showStatus,
  showStatusFromStatusBundle
} from "@sane/control-plane/inventory.js";
import { inspectInstallStatusFromStatusBundle } from "@sane/control-plane/install-status.js";
import { previewPolicy, previewPolicyForCurrentRun } from "@sane/control-plane/policy-preview.js";
import {
  exportPortableSettings,
  importPortableSettings,
  inspectEditablePreferencesConfig,
  inspectPreferencesFamilySnapshot,
  resetTelemetryData,
  showConfig,
  toggleAutoUpdates
} from "@sane/control-plane/preferences.js";
import {
  advanceOutcome,
  showOutcomeReadiness,
  showOutcomeReadinessFromRuntimeState,
  showRuntimeSummary,
  showRuntimeSummaryFromRuntimeState
} from "@sane/control-plane/inspect-runtime.js";
import { installRuntime } from "@sane/control-plane/install-runtime.js";
import { uninstallRepoAgents, uninstallRepoSkills } from "@sane/control-plane/codex-native.js";

import {
  COMMAND_METADATA_REGISTRY,
  getCommandSpec,
  getSectionMetadata,
  listSections,
  listSectionActions,
  type SectionActionMetadata,
  type TuiSectionId,
  type UiCommandId
} from "@sane/sane-tui/command-registry.js";
import { defaultLandingSectionId, homeRecommendedActionId } from "@sane/sane-tui/home-screen.js";
import {
  createConfigEditorState,
  createPackEditorState,
  createPrivacyEditorState,
  cycleSelectedConfigField,
  cycleTelemetryLevel,
  moveConfigFieldSelection,
  movePackSelection,
  movePrivacySelection,
  resetConfigEditor,
  resetPackEditor,
  resetPrivacyEditor,
  toggleSelectedPack,
  type ConfigEditorState,
  type PackEditorState,
  type PrivacyEditorState
} from "@sane/sane-tui/preferences-editor-state.js";
import { buildLastResultView, buildNotice, buildResultNotice, type LastResultView, type NoticeView } from "@sane/sane-tui/result-panel.js";
import { SANE_CLI_VERSION } from "@sane/sane-tui/version.js";

export interface PendingConfirmation {
  title: string;
  heading: string;
  footer: string;
  body: string[];
  commandId: UiCommandId;
  label: string;
  section: TuiSectionId;
}

export interface TuiShell {
  paths: ProjectPaths;
  codexPaths: CodexPaths;
  hostPlatform: HostPlatform;
  sections: ReturnType<typeof listSections>;
  statusSnapshot: ShellStatusSnapshot;
  activeSectionId: TuiSectionId;
  activeActionIndex: number;
  activeEditor: ConfigEditorState | PackEditorState | PrivacyEditorState | null;
  pendingConfirmation: PendingConfirmation | null;
  notice: (NoticeView & { section: TuiSectionId }) | null;
  helpOpen: boolean;
  lastResult: LastResultView;
}

export interface ShellStatusSnapshot {
  statusBundle: ReturnType<typeof inspectStatusBundle>;
  codexProfiles: ReturnType<typeof inspectCodexProfileFamilySnapshot>;
  preferences: ReturnType<typeof inspectPreferencesFamilySnapshot>;
}

export function createTuiShell(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  launchShortcut: keyof typeof COMMAND_METADATA_REGISTRY.shortcuts = "default"
): TuiShell {
  const hostPlatform = detectPlatform();
  const statusSnapshot = buildStatusSnapshot(paths, codexPaths, hostPlatform);
  const onboarding = inspectOnboardingSnapshotFromStatusBundle(paths, statusSnapshot.statusBundle);
  const sectionId = initialSectionId(launchShortcut, onboarding.recommendedActionId);
  const lastSummary = statusSnapshot.statusBundle.runtimeState.historyPreview.latestEvent?.summary ?? null;
  return {
    paths,
    codexPaths,
    hostPlatform,
    sections: listSections(hostPlatform),
    statusSnapshot,
    activeSectionId: sectionId,
    activeActionIndex: defaultActionIndex(sectionId, statusSnapshot, paths, codexPaths, hostPlatform),
    activeEditor: null,
    pendingConfirmation: null,
    notice: null,
    helpOpen: false,
    lastResult: buildLastResultView(
      null,
      lastSummary
        ?? (
          sectionId === "status"
            ? "Ready. Open `Check` first. Left/right changes job. Up/down changes move. Enter runs selected move."
            : "Ready. Finish `Setup` first. Left/right changes job. Up/down changes move. Enter runs selected move."
        )
    )
  };
}

export function selectSection(shell: TuiShell, sectionId: TuiSectionId): void {
  shell.activeSectionId = sectionId;
  shell.activeActionIndex = defaultActionIndex(
    sectionId,
    shell.statusSnapshot,
    shell.paths,
    shell.codexPaths,
    shell.hostPlatform
  );
  shell.activeEditor = null;
}

export function moveSelection(
  shell: TuiShell,
  target: "section" | "action",
  delta: 1 | -1
): void {
  if (target === "section") {
    const sections = shell.sections;
    const currentIndex = sections.findIndex((section) => section.id === shell.activeSectionId);
    const nextIndex = wrapIndex(currentIndex + delta, sections.length);
    selectSection(shell, sections[nextIndex]!.id);
    return;
  }

  const actions = currentActions(shell);
  shell.activeActionIndex = wrapIndex(shell.activeActionIndex + delta, actions.length);
}

export function currentSection(shell: TuiShell) {
  return getSectionMetadata(shell.activeSectionId, shell.hostPlatform);
}

export function currentActions(shell: TuiShell): SectionActionMetadata[] {
  return listSectionActions(shell.activeSectionId, shell.hostPlatform);
}

export function currentAction(shell: TuiShell): SectionActionMetadata {
  return currentActions(shell)[shell.activeActionIndex]!;
}

export function projectLabel(shell: TuiShell): string {
  return basename(shell.paths.projectRoot);
}

function defaultActionIndex(
  sectionId: TuiSectionId,
  statusSnapshot: ShellStatusSnapshot,
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform
): number {
  const actions = listSectionActions(sectionId, hostPlatform);
  const recommendedActionId =
    sectionId === "home"
      ? homeRecommendedActionId(inspectOnboardingSnapshotFromStatusBundle(paths, statusSnapshot.statusBundle).recommendedActionId)
      : sectionId === "add_to_codex"
        ? inspectInstallStatusFromStatusBundle(paths, codexPaths, statusSnapshot.statusBundle, hostPlatform).recommendedActionId
        : null;

  if (!recommendedActionId) {
    if (sectionId === "home") {
      const refreshIndex = actions.findIndex((action) => action.id === "export_all");
      return refreshIndex >= 0 ? refreshIndex : 0;
    }
    return 0;
  }

  const recommendedIndex = actions.findIndex((action) => action.id === recommendedActionId);
  return recommendedIndex >= 0 ? recommendedIndex : 0;
}

export function runSelectedAction(shell: TuiShell): OperationResult | null {
  const action = currentAction(shell);

  if (action.confirmation?.required) {
    shell.pendingConfirmation = buildPendingConfirmation(shell, action);
    shell.lastResult = buildLastResultView(
      null,
      `Review \`${action.label}\`. Enter or y confirms. Esc or n cancels.`
    );
    shell.notice = null;
    return null;
  }

  return runCommand(shell, action.id);
}

export function confirmPendingAction(shell: TuiShell): OperationResult | null {
  if (!shell.pendingConfirmation) {
    return null;
  }

  const section = shell.pendingConfirmation.section;
  const commandId = shell.pendingConfirmation.commandId;
  shell.pendingConfirmation = null;
  const result = runCommand(shell, commandId);
  selectSection(shell, section);
  return result;
}

export function cancelPendingAction(shell: TuiShell): void {
  if (shell.pendingConfirmation) {
    selectSection(shell, shell.pendingConfirmation.section);
  }
  shell.pendingConfirmation = null;
  shell.lastResult = buildLastResultView(null, "Cancelled. Nothing changed.");
}

export function dismissNotice(shell: TuiShell): void {
  if (shell.notice) {
    selectSection(shell, shell.notice.section);
  }
  shell.notice = null;
}

export function cancelActiveEditor(shell: TuiShell): void {
  if (!shell.activeEditor) {
    return;
  }

  shell.activeEditor = null;
  shell.lastResult = buildLastResultView(null, "Closed editor. Nothing changed.");
}

export function moveEditorSelection(shell: TuiShell, delta: 1 | -1): void {
  if (!shell.activeEditor) {
    return;
  }

  switch (shell.activeEditor.kind) {
    case "config":
      shell.activeEditor = moveConfigFieldSelection(shell.activeEditor, delta);
      break;
    case "packs":
      shell.activeEditor = movePackSelection(shell.activeEditor, delta);
      break;
    case "privacy":
      shell.activeEditor = movePrivacySelection(shell.activeEditor, delta);
      break;
  }
}

export function editActiveValue(shell: TuiShell, delta: 1 | -1): void {
  if (!shell.activeEditor) {
    return;
  }

  switch (shell.activeEditor.kind) {
    case "config":
      shell.activeEditor = cycleSelectedConfigField(shell.activeEditor, delta);
      break;
    case "privacy":
      shell.activeEditor = cycleTelemetryLevel(shell.activeEditor, delta);
      break;
    case "packs":
      shell.activeEditor = toggleSelectedPack(shell.activeEditor);
      break;
  }
}

export function resetActiveEditor(shell: TuiShell): void {
  if (!shell.activeEditor) {
    return;
  }

  switch (shell.activeEditor.kind) {
    case "config":
      shell.activeEditor = resetConfigEditor(shell.activeEditor);
      break;
    case "packs":
      shell.activeEditor = resetPackEditor(shell.activeEditor);
      break;
    case "privacy":
      shell.activeEditor = resetPrivacyEditor(shell.activeEditor);
      break;
  }
}

export function saveActiveEditor(shell: TuiShell): OperationResult | null {
  if (!shell.activeEditor) {
    return null;
  }

  const result = executeConfigSave(shell.paths, shell.activeEditor.config);
  refreshStatusSnapshot(shell);
  shell.lastResult = buildLastResultView(result, result.renderText());
  shell.notice = {
    title: "Saved",
    body: result.renderText(),
    footer: "Enter, Space, or Esc closes this message.",
    section: shell.activeSectionId
  };
  shell.activeEditor = null;
  return result;
}

export function resetLocalTelemetry(shell: TuiShell): OperationResult {
  const result = executeOperation(shell.paths, () => resetTelemetryData(shell.paths));
  refreshStatusSnapshot(shell);
  shell.lastResult = buildLastResultView(result, result.renderText());
  shell.notice = null;
  return result;
}

export function requestTelemetryResetConfirmation(shell: TuiShell): void {
  const action: SectionActionMetadata = {
    ...getCommandSpec("reset_telemetry_data", shell.hostPlatform),
    label: "Delete local telemetry data",
    order: 0,
    section: shell.activeSectionId
  };
  shell.pendingConfirmation = buildPendingConfirmation(shell, action);
  shell.lastResult = buildLastResultView(
    null,
    "Review `Delete local telemetry data`. Enter or y confirms. Esc or n cancels."
  );
  shell.notice = null;
}

function runCommand(shell: TuiShell, commandId: UiCommandId): OperationResult | null {
  switch (commandId) {
    case "open_config_editor":
      shell.activeEditor = createConfigEditorState(...loadEditableConfigArgs(shell));
      shell.lastResult = buildLastResultView(
        null,
        "Model defaults open. Left/right changes value. Enter saves. r resets."
      );
      shell.notice = null;
      return null;
    case "open_pack_editor":
      shell.activeEditor = createPackEditorState(loadEditablePreferencesConfig(shell).current);
      shell.lastResult = buildLastResultView(
        null,
        "Guidance options open. Up/down picks option. Space toggles optional guidance. Enter saves. r resets optional guidance."
      );
      shell.notice = null;
      return null;
    case "open_privacy_editor":
      shell.activeEditor = createPrivacyEditorState(loadEditablePreferencesConfig(shell).current);
      shell.lastResult = buildLastResultView(
        null,
        "Privacy defaults open. Left/right changes telemetry level. Enter saves. d deletes local telemetry data."
      );
      shell.notice = null;
      return null;
    default: {
      const result =
        commandId === "show_runtime_summary"
          ? executeOperationWithRuntimeState(
              shell.paths,
              shell.statusSnapshot.statusBundle.runtimeState,
              () => showRuntimeSummaryFromRuntimeState(shell.paths, shell.statusSnapshot.statusBundle.runtimeState)
            )
          : commandId === "show_status"
            ? executeOperation(shell.paths, () => showStatusFromStatusBundle(shell.statusSnapshot.statusBundle))
          : commandId === "doctor"
            ? executeOperation(shell.paths, () =>
                doctorForStatusBundle(shell.paths, shell.codexPaths, shell.statusSnapshot.statusBundle)
              )
          : commandId === "preview_policy"
            ? executeOperationWithRuntimeState(
                shell.paths,
                shell.statusSnapshot.statusBundle.runtimeState,
                () => previewPolicyForCurrentRun(shell.paths, shell.statusSnapshot.statusBundle.runtimeState.current)
              )
          : commandId === "show_outcome_readiness"
            ? executeOperationWithRuntimeState(
                shell.paths,
                shell.statusSnapshot.statusBundle.runtimeState,
                () => showOutcomeReadinessFromRuntimeState(shell.paths, shell.statusSnapshot.statusBundle.runtimeState)
              )
          : executeUiCommand(shell.paths, shell.codexPaths, commandId);
      refreshStatusSnapshot(shell);
      shell.activeEditor = null;
      shell.lastResult = buildLastResultView(result, result.renderText());
      if (commandId === "install_runtime") {
        selectSection(shell, "home");
      }
      if (commandId === "export_all") {
        selectSection(shell, defaultLandingSectionAfterRefresh(shell));
      }
      const notice = buildNotice(commandId, result);
      shell.notice = {
        ...(notice ?? buildResultNotice(actionLabelForCommand(shell, commandId), result)),
        section: shell.activeSectionId
      };
      return result;
    }
  }
}

export function executeUiCommand(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  commandId: Exclude<UiCommandId, "open_config_editor" | "open_pack_editor" | "open_privacy_editor">
): OperationResult {
  switch (commandId) {
    case "install_runtime":
      return executeOperation(paths, () => installRuntime(paths, codexPaths));
    case "show_config":
      return executeOperation(paths, () => showConfig(paths, codexPaths));
    case "export_portable_settings":
      return executeOperation(paths, () => exportPortableSettings(paths));
    case "import_portable_settings":
      return executeOperation(paths, () => importPortableSettings(paths));
    case "install_from_portable_settings":
      return executeOperation(paths, () => {
        installRuntime(paths, codexPaths);
        return importPortableSettings(paths);
      });
    case "show_codex_config":
      return executeOperation(paths, () => showCodexConfig(codexPaths));
    case "show_runtime_summary":
      return executeOperation(paths, () => showRuntimeSummary(paths));
    case "show_outcome_readiness":
      return executeOperation(paths, () => showOutcomeReadiness(paths));
    case "advance_outcome":
      return executeOperation(paths, () => advanceOutcome(paths));
    case "review_issue_draft":
      return executeOperation(paths, () => writeIssueRelayDraft(paths, {
        category: "sane-status",
        sourceCommand: "show_status",
        summary: "Sane status or repair signal needs user review",
        reproductionSteps: [
          "Run sane status",
          "Run sane doctor",
          "Review local Sane status, drift, and repair output"
        ]
      }));
    case "submit_issue_draft":
      return executeOperation(paths, () => submitLatestIssueRelayDraft(paths));
    case "reset_telemetry_data":
      return executeOperation(paths, () => resetTelemetryData(paths));
    case "toggle_auto_updates":
      return executeOperation(paths, () => toggleAutoUpdates(paths, codexPaths));
    case "check_updates":
      return executeOperation(paths, () =>
        checkForUpdates({
          currentVersion: SANE_CLI_VERSION,
          autoUpdate: inspectEditablePreferencesConfig(paths, codexPaths).current.updates.auto,
          executablePath: process.argv[1] ?? null
        })
      );
    case "preview_policy":
      return executeOperation(paths, () => previewPolicy(paths));
    case "backup_codex_config":
      return executeOperation(paths, () => backupCodexConfig(paths, codexPaths));
    case "preview_codex_profile":
      return executeOperation(paths, () => previewCodexProfile(codexPaths));
    case "preview_integrations_profile":
      return executeOperation(paths, () => previewIntegrationsProfile(codexPaths));
    case "preview_cloudflare_profile":
      return executeOperation(paths, () => previewCloudflareProfile(codexPaths));
    case "preview_statusline_profile":
      return executeOperation(paths, () => previewStatuslineProfile(codexPaths));
    case "apply_codex_profile":
      return executeOperation(paths, () => applyCodexProfile(paths, codexPaths));
    case "apply_integrations_profile":
      return executeOperation(paths, () => applyIntegrationsProfile(paths, codexPaths));
    case "apply_cloudflare_profile":
      return executeOperation(paths, () => applyCloudflareProfile(paths, codexPaths));
    case "apply_statusline_profile":
      return executeOperation(paths, () => applyStatuslineProfile(paths, codexPaths));
    case "restore_codex_config":
      return executeOperation(paths, () => restoreCodexConfig(paths, codexPaths));
    case "show_status":
      return executeOperation(paths, () => showStatus(paths, codexPaths));
    case "doctor":
      return executeOperation(paths, () => doctor(paths, codexPaths));
    case "export_user_skills":
      return executeOperation(paths, () => exportUserSkills(paths, codexPaths));
    case "export_repo_skills":
      return executeOperation(paths, () => exportRepoSkills(paths, codexPaths));
    case "export_repo_agents":
      return executeOperation(paths, () => exportRepoAgents(paths, codexPaths));
    case "export_global_agents":
      return executeOperation(paths, () => exportGlobalAgents(paths, codexPaths));
    case "export_hooks":
      return executeOperation(paths, () => exportHooks(paths, codexPaths));
    case "export_custom_agents":
      return executeOperation(paths, () => exportCustomAgents(paths, codexPaths));
    case "export_opencode_all":
      return executeOperation(paths, () => exportOpencodeCore(paths, codexPaths));
    case "export_all":
      return executeOperation(paths, () => exportAll(paths, codexPaths));
    case "uninstall_user_skills":
      return executeOperation(paths, () => uninstallUserSkills(codexPaths));
    case "uninstall_repo_skills":
      return executeOperation(paths, () => uninstallRepoSkills(paths));
    case "uninstall_global_agents":
      return executeOperation(paths, () => uninstallGlobalAgents(codexPaths));
    case "uninstall_repo_agents":
      return executeOperation(paths, () => uninstallRepoAgents(paths));
    case "uninstall_hooks":
      return executeOperation(paths, () => uninstallHooks(codexPaths));
    case "uninstall_custom_agents":
      return executeOperation(paths, () => uninstallCustomAgents(codexPaths));
    case "uninstall_all":
      return executeOperation(paths, () => uninstallAll(codexPaths));
  }
}

function buildStatusSnapshot(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform
): ShellStatusSnapshot {
  return {
    statusBundle: inspectStatusBundle(paths, codexPaths, hostPlatform),
    codexProfiles: inspectCodexProfileFamilySnapshot(codexPaths),
    preferences: inspectPreferencesFamilySnapshot(paths, codexPaths)
  };
}

function initialSectionId(
  launchShortcut: keyof typeof COMMAND_METADATA_REGISTRY.shortcuts,
  recommendedActionId: ReturnType<typeof inspectOnboardingSnapshotFromStatusBundle>["recommendedActionId"]
): TuiSectionId {
  const sectionId = COMMAND_METADATA_REGISTRY.shortcuts[launchShortcut];
  if (launchShortcut !== "default") {
    return sectionId;
  }

  return defaultLandingSectionId(recommendedActionId);
}

function refreshStatusSnapshot(shell: TuiShell): void {
  shell.statusSnapshot = buildStatusSnapshot(shell.paths, shell.codexPaths, shell.hostPlatform);
}

function actionLabelForCommand(shell: TuiShell, commandId: UiCommandId): string {
  return listSections(shell.hostPlatform)
    .flatMap((section) => listSectionActions(section.id, shell.hostPlatform))
    .find((action) => action.id === commandId)?.label
    ?? getCommandSpec(commandId, shell.hostPlatform).id;
}

function buildPendingConfirmation(shell: TuiShell, action: SectionActionMetadata): PendingConfirmation {
  const confirmation = getCommandSpec(action.id, shell.hostPlatform).confirmation!;
  const body = [confirmation.impactCopy];
  if (confirmation.remindPreviewOrBackup) {
    body.push("Preview or back up first if you want a rollback point.");
  }

  return {
    title: "Confirm action",
    heading: action.label,
    footer: "Enter/y runs it. Esc/n cancels.",
    body,
    commandId: action.id,
    label: action.label,
    section: action.section
  };
}

export function openHelp(shell: TuiShell): void {
  shell.helpOpen = true;
}

export function closeHelp(shell: TuiShell): void {
  shell.helpOpen = false;
}

export function jumpToFirst(shell: TuiShell): void {
  shell.activeActionIndex = 0;
}

export function jumpToLast(shell: TuiShell): void {
  const actions = currentActions(shell);
  shell.activeActionIndex = Math.max(0, actions.length - 1);
}

function wrapIndex(index: number, length: number): number {
  return (index + length) % length;
}

function loadEditablePreferencesConfig(shell: TuiShell) {
  return inspectEditablePreferencesConfig(shell.paths, shell.codexPaths);
}

function loadEditableConfigArgs(shell: TuiShell) {
  const snapshot = loadEditablePreferencesConfig(shell);
  return [snapshot.current, snapshot.recommended] as const;
}

function defaultLandingSectionAfterRefresh(shell: TuiShell): TuiSectionId {
  const onboarding = inspectOnboardingSnapshotFromStatusBundle(shell.paths, shell.statusSnapshot.statusBundle);
  return defaultLandingSectionId(onboarding.recommendedActionId);
}
