import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";

import {
  createTuiShell,
  moveSelection,
  runSelectedAction as runShellSelectedAction,
  type TuiShell
} from "@sane/sane-tui/shell.js";
import { type LaunchShortcut, type TuiSectionId, type UiCommandId } from "@sane/sane-tui/command-registry.js";

export interface ShellLayerState {
  sectionId: TuiSectionId;
  actionIndex: number;
  screen: "dashboard" | "confirm" | "notice";
  confirm: { commandId: UiCommandId } | null;
  _shell: TuiShell;
}

export function createShellState(input?: {
  launchShortcut?: LaunchShortcut;
}): ShellLayerState {
  const projectRoot = mkdtempSync(join(tmpdir(), "sane-shell-project-"));
  const homeDir = mkdtempSync(join(tmpdir(), "sane-shell-home-"));
  const shell = createTuiShell(
    createProjectPaths(projectRoot),
    createCodexPaths(homeDir),
    input?.launchShortcut ?? "default"
  );

  return toShellLayerState(shell);
}

export function moveSectionSelection(
  state: ShellLayerState,
  step: 1 | -1
): ShellLayerState {
  moveSelection(state._shell, "section", step);
  return toShellLayerState(state._shell);
}

export function moveActionSelection(
  state: ShellLayerState,
  step: 1 | -1
): ShellLayerState {
  moveSelection(state._shell, "action", step);
  return toShellLayerState(state._shell);
}

export function runSelectedAction(state: ShellLayerState): ShellLayerState {
  runShellSelectedAction(state._shell);
  return toShellLayerState(state._shell);
}

function toShellLayerState(shell: TuiShell): ShellLayerState {
  return {
    sectionId: shell.activeSectionId,
    actionIndex: shell.activeActionIndex,
    screen: shell.pendingConfirmation ? "confirm" : shell.notice ? "notice" : "dashboard",
    confirm: shell.pendingConfirmation ? { commandId: shell.pendingConfirmation.commandId } : null,
    _shell: shell
  };
}
