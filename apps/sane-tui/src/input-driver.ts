import { type OperationResult } from "@sane/core";

import {
  cancelActiveEditor,
  cancelPendingAction,
  confirmPendingAction,
  dismissNotice,
  editActiveValue,
  moveEditorSelection,
  moveSelection,
  resetActiveEditor,
  resetLocalTelemetry,
  runSelectedAction,
  saveActiveEditor,
  type TuiShell
} from "@sane/sane-tui/shell.js";

export type TuiInputKey =
  | "left"
  | "right"
  | "up"
  | "down"
  | "enter"
  | "escape"
  | "space"
  | "r"
  | "d"
  | "y"
  | "n";

export function handleTuiInput(shell: TuiShell, key: TuiInputKey): OperationResult | null {
  if (shell.notice) {
    if (key === "enter" || key === "space" || key === "escape") {
      dismissNotice(shell);
    }
    return null;
  }

  if (shell.pendingConfirmation) {
    if (key === "enter" || key === "y") {
      return confirmPendingAction(shell);
    }
    if (key === "escape" || key === "n") {
      cancelPendingAction(shell);
    }
    return null;
  }

  if (shell.activeEditor) {
    switch (shell.activeEditor.kind) {
      case "config":
        return handleConfigEditorInput(shell, key);
      case "packs":
        return handlePackEditorInput(shell, key);
      case "privacy":
        return handlePrivacyEditorInput(shell, key);
    }
  }

  switch (key) {
    case "left":
      moveSelection(shell, "section", -1);
      return null;
    case "right":
      moveSelection(shell, "section", 1);
      return null;
    case "up":
      moveSelection(shell, "action", -1);
      return null;
    case "down":
      moveSelection(shell, "action", 1);
      return null;
    case "enter":
      return runSelectedAction(shell);
    default:
      return null;
  }
}

function handleConfigEditorInput(shell: TuiShell, key: TuiInputKey): OperationResult | null {
  switch (key) {
    case "up":
      moveEditorSelection(shell, -1);
      return null;
    case "down":
      moveEditorSelection(shell, 1);
      return null;
    case "left":
      editActiveValue(shell, -1);
      return null;
    case "right":
      editActiveValue(shell, 1);
      return null;
    case "enter":
      return saveActiveEditor(shell);
    case "r":
      resetActiveEditor(shell);
      return null;
    case "escape":
      cancelActiveEditor(shell);
      return null;
    default:
      return null;
  }
}

function handlePackEditorInput(shell: TuiShell, key: TuiInputKey): OperationResult | null {
  switch (key) {
    case "up":
      moveEditorSelection(shell, -1);
      return null;
    case "down":
      moveEditorSelection(shell, 1);
      return null;
    case "space":
      editActiveValue(shell, 1);
      return null;
    case "enter":
      return saveActiveEditor(shell);
    case "r":
      resetActiveEditor(shell);
      return null;
    case "escape":
      cancelActiveEditor(shell);
      return null;
    default:
      return null;
  }
}

function handlePrivacyEditorInput(shell: TuiShell, key: TuiInputKey): OperationResult | null {
  switch (key) {
    case "left":
      editActiveValue(shell, -1);
      return null;
    case "right":
      editActiveValue(shell, 1);
      return null;
    case "enter":
      return saveActiveEditor(shell);
    case "r":
      resetActiveEditor(shell);
      return null;
    case "d":
      return resetLocalTelemetry(shell);
    case "escape":
      cancelActiveEditor(shell);
      return null;
    default:
      return null;
  }
}
