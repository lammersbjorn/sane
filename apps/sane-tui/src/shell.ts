import { basename } from "node:path";

import { type OperationResult } from "@sane/core";
import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/platform";

import { exportAll, uninstallAll } from "@sane/control-plane/bundles.js";
import {
  applyCloudflareProfile,
  applyCodexProfile,
  applyIntegrationsProfile,
  applyOpencodeProfile,
  applyStatuslineProfile,
  backupCodexConfig,
  inspectCodexProfileFamilySnapshot,
  previewCloudflareProfile,
  previewCodexProfile,
  previewIntegrationsProfile,
  previewOpencodeProfile,
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
import { exportOpencodeAgents, uninstallOpencodeAgents } from "@sane/control-plane/opencode-native.js";
import { executeConfigSave, executeOperation, executeOperationWithRuntimeState } from "@sane/control-plane/history.js";
import {
  doctor,
  doctorForStatusBundle,
  inspectOnboardingSnapshotFromStatusBundle,
  inspectStatusBundle,
  showStatusFromStatusBundle
} from "@sane/control-plane/inventory.js";
import { inspectInstallStatusFromStatusBundle } from "@sane/control-plane/install-status.js";
import { showStatus } from "@sane/control-plane";
import { previewPolicy, previewPolicyForCurrentRun } from "@sane/control-plane/policy-preview.js";
import {
  inspectEditablePreferencesConfig,
  inspectPreferencesFamilySnapshot,
  resetTelemetryData,
  showConfig
} from "@sane/control-plane/preferences.js";
import {
  installRuntime,
  showRuntimeSummary,
  showRuntimeSummaryFromRuntimeState,
  uninstallRepoAgents,
  uninstallRepoSkills
} from "@sane/control-plane";

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
import {
  createConfigEditorState,
  createPackEditorState,
  createPrivacyEditorState,
  cycleSelectedConfigField,
  cycleTelemetryLevel,
  moveConfigFieldSelection,
  movePackSelection,
  resetConfigEditor,
  resetPackEditor,
  resetPrivacyEditor,
  toggleSelectedPack,
  type ConfigEditorState,
  type PackEditorState,
  type PrivacyEditorState
} from "@sane/sane-tui/preferences-editor-state.js";
import { buildLastResultView, buildNotice, type LastResultView, type NoticeView } from "@sane/sane-tui/result-panel.js";

export interface PendingConfirmation {
  title: "Confirm";
  heading: "Confirm This Action";
  footer: "Enter or y runs it. Esc or n cancels.";
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
  const sectionId = COMMAND_METADATA_REGISTRY.shortcuts[launchShortcut];
  const hostPlatform = detectPlatform();
  const statusSnapshot = buildStatusSnapshot(paths, codexPaths, hostPlatform);
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
    lastResult: buildLastResultView(
      null,
      lastSummary
        ?? "Ready. Start in `Start here`. Left/right changes section. Up/down changes option. Enter runs the selected step."
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
    sectionId === "get_started"
      ? inspectOnboardingSnapshotFromStatusBundle(paths, statusSnapshot.statusBundle).recommendedActionId
      : sectionId === "install"
        ? inspectInstallStatusFromStatusBundle(paths, codexPaths, statusSnapshot.statusBundle, hostPlatform).recommendedActionId
        : null;

  if (!recommendedActionId) {
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
    section: "preferences"
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

function runCommand(shell: TuiShell, commandId: UiCommandId): OperationResult | null {
  switch (commandId) {
    case "open_config_editor":
      shell.activeEditor = createConfigEditorState(...loadEditableConfigArgs(shell));
      shell.lastResult = buildLastResultView(
        null,
        "Config editor open. Left/right cycles values. Enter saves. r resets."
      );
      shell.notice = null;
      return null;
    case "open_pack_editor":
      shell.activeEditor = createPackEditorState(loadEditablePreferencesConfig(shell).current);
      shell.lastResult = buildLastResultView(
        null,
        "Pack screen open. Up/down picks pack. Space toggles optional packs. Enter saves. r resets optional packs."
      );
      shell.notice = null;
      return null;
    case "open_privacy_editor":
      shell.activeEditor = createPrivacyEditorState(loadEditablePreferencesConfig(shell).current);
      shell.lastResult = buildLastResultView(
        null,
        "Privacy screen open. Left/right cycles telemetry level. Enter saves. d deletes local telemetry data."
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
          : executeUiCommand(shell.paths, shell.codexPaths, commandId);
      refreshStatusSnapshot(shell);
      shell.activeEditor = null;
      shell.lastResult = buildLastResultView(result, result.renderText());
      const notice = buildNotice(commandId, result);
      shell.notice = notice
        ? {
            ...notice,
            section: shell.activeSectionId
          }
        : null;
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
    case "show_codex_config":
      return executeOperation(paths, () => showCodexConfig(codexPaths));
    case "show_runtime_summary":
      return executeOperation(paths, () => showRuntimeSummary(paths));
    case "reset_telemetry_data":
      return executeOperation(paths, () => resetTelemetryData(paths));
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
    case "preview_opencode_profile":
      return executeOperation(paths, () => previewOpencodeProfile(codexPaths));
    case "preview_statusline_profile":
      return executeOperation(paths, () => previewStatuslineProfile(codexPaths));
    case "apply_codex_profile":
      return executeOperation(paths, () => applyCodexProfile(paths, codexPaths));
    case "apply_integrations_profile":
      return executeOperation(paths, () => applyIntegrationsProfile(paths, codexPaths));
    case "apply_cloudflare_profile":
      return executeOperation(paths, () => applyCloudflareProfile(paths, codexPaths));
    case "apply_opencode_profile":
      return executeOperation(paths, () => applyOpencodeProfile(paths, codexPaths));
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
      return executeOperation(paths, () => exportHooks(codexPaths));
    case "export_custom_agents":
      return executeOperation(paths, () => exportCustomAgents(paths, codexPaths));
    case "export_opencode_agents":
      return executeOperation(paths, () => exportOpencodeAgents(paths, codexPaths));
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
    case "uninstall_opencode_agents":
      return executeOperation(paths, () => uninstallOpencodeAgents(codexPaths));
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

function refreshStatusSnapshot(shell: TuiShell): void {
  shell.statusSnapshot = buildStatusSnapshot(shell.paths, shell.codexPaths, shell.hostPlatform);
}

function buildPendingConfirmation(shell: TuiShell, action: SectionActionMetadata): PendingConfirmation {
  const confirmation = getCommandSpec(action.id, shell.hostPlatform).confirmation!;
  const body = [`Selected action: ${action.label}`, "", confirmation.impactCopy];
  if (confirmation.remindPreviewOrBackup) {
    body.push("Use preview or backup first when available.");
  }

  return {
    title: "Confirm",
    heading: "Confirm This Action",
    footer: "Enter or y runs it. Esc or n cancels.",
    body,
    commandId: action.id,
    label: action.label,
    section: action.section
  };
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
