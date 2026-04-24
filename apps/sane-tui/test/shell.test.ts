import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InventoryStatus } from "@sane/core";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { parseEventRecordJson, readJsonlRecords } from "@sane/state";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as controlPlane from "@sane/control-plane";
import { exportAll } from "@sane/control-plane/bundles.js";
import { executeOperation } from "@sane/control-plane/history.js";
import * as inventory from "@sane/control-plane/inventory.js";
import { saveConfig } from "@sane/control-plane/preferences.js";
import { createDefaultLocalConfig } from "@sane/config";
import * as runtimeState from "@sane/control-plane/runtime-state.js";
import {
  confirmPendingAction,
  createTuiShell,
  currentAction,
  editActiveValue,
  moveSelection,
  resetLocalTelemetry,
  runSelectedAction,
  saveActiveEditor
} from "@sane/sane-tui/shell.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-tui-shell-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("tui shell", () => {
  it("defaults to get_started and supports settings shortcut", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const shell = createTuiShell(paths, codexPaths);
    const settingsShell = createTuiShell(paths, codexPaths, "settings");

    expect(shell.activeSectionId).toBe("get_started");
    expect(currentAction(shell).id).toBe("install_runtime");
    expect(settingsShell.activeSectionId).toBe("preferences");
    expect(currentAction(settingsShell).id).toBe("open_config_editor");
  });

  it("stores a typed status snapshot and refreshes it after managed actions", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const statusBundleSpy = vi.spyOn(inventory, "inspectStatusBundle");
    const runtimeStateSpy = vi.spyOn(runtimeState, "inspectRuntimeState");
    const shell = createTuiShell(paths, codexPaths);

    expect(shell.statusSnapshot.statusBundle.primary.status.runtime).toBe("missing");
    expect(shell.statusSnapshot.statusBundle.runtimeState.current).toBeNull();

    statusBundleSpy.mockClear();
    runtimeStateSpy.mockClear();
    runSelectedAction(shell);

    expect(statusBundleSpy).toHaveBeenCalledWith(paths, codexPaths);
    expect(runtimeStateSpy).toHaveBeenCalledWith(paths);
    expect(shell.statusSnapshot.statusBundle.primary.status.runtime).toBe("installed");
    expect(shell.statusSnapshot.statusBundle.runtimeState.current?.phase).toBe("setup");
  });

  it("hydrates the initial last-result copy from the canonical runtime snapshot", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    executeOperation(paths, () => exportAll(paths, codexPaths));
    const shell = createTuiShell(paths, codexPaths);

    expect(shell.lastResult.lines).toContain("export all: installed managed targets");
  });

  it("records read-only inspect, show, and preview actions in local history", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths, "settings");

    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    runSelectedAction(shell);

    moveSelection(shell, "section", 1);
    moveSelection(shell, "section", 1);
    runSelectedAction(shell);

    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    runSelectedAction(shell);

    const events = readJsonlRecords(paths.eventsPath, parseEventRecordJson);

    expect(events.slice(-3).map((event) => event.action)).toEqual([
      "show_config",
      "show_status",
      "preview_integrations_profile"
    ]);
  });

  it("uses the captured status bundle for TUI runtime summary before refresh", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    controlPlane.installRuntime(paths, codexPaths);
    const runtimeStateSpy = vi.spyOn(runtimeState, "inspectRuntimeState");
    const shell = createTuiShell(paths, codexPaths);

    while (shell.activeSectionId !== "inspect") {
      moveSelection(shell, "section", 1);
    }
    while (currentAction(shell).id !== "show_runtime_summary") {
      moveSelection(shell, "action", 1);
    }

    runtimeStateSpy.mockClear();
    const result = runSelectedAction(shell);

    expect(result?.summary).toBe(`runtime-summary: local handoff state at ${paths.runtimeRoot}`);
    expect(runtimeStateSpy).toHaveBeenCalledTimes(1);
  });

  it("uses the captured status bundle for TUI status and doctor before refresh", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths);

    while (shell.activeSectionId !== "inspect") {
      moveSelection(shell, "section", 1);
    }

    controlPlane.installRuntime(paths, codexPaths);
    const statusResult = runSelectedAction(shell);

    expect(statusResult?.inventory.find((item) => item.name === "runtime")?.status).toBe(
      InventoryStatus.Missing
    );

    const doctorProjectRoot = makeTempDir();
    const doctorHomeDir = makeTempDir();
    const doctorPaths = createProjectPaths(doctorProjectRoot);
    const doctorCodexPaths = createCodexPaths(doctorHomeDir);
    const doctorShell = createTuiShell(doctorPaths, doctorCodexPaths);

    while (doctorShell.activeSectionId !== "inspect") {
      moveSelection(doctorShell, "section", 1);
    }
    while (currentAction(doctorShell).id !== "doctor") {
      moveSelection(doctorShell, "action", 1);
    }

    controlPlane.installRuntime(doctorPaths, doctorCodexPaths);
    const doctorResult = runSelectedAction(doctorShell);

    expect(doctorResult?.summary).toContain("runtime: missing");
  });

  it("uses the captured runtime snapshot for TUI policy preview before refresh", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths);

    while (shell.activeSectionId !== "inspect") {
      moveSelection(shell, "section", 1);
    }
    while (currentAction(shell).id !== "preview_policy") {
      moveSelection(shell, "action", 1);
    }

    controlPlane.installRuntime(paths, codexPaths);
    const result = runSelectedAction(shell);

    expect(result?.policyPreview?.scenarios.map((scenario) => scenario.id)).not.toContain(
      "current-run-inspect"
    );
  });

  it("uses the captured codex profile snapshot for TUI preview before refresh", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths);

    while (currentAction(shell).id !== "preview_codex_profile") {
      moveSelection(shell, "action", 1);
    }

    mkdirSync(codexPaths.codexHome, { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        'model = "gpt-5.4"',
        'model_reasoning_effort = "high"',
        "",
        "[features]",
        "codex_hooks = true",
        ""
      ].join("\n"),
      "utf8"
    );

    const result = runSelectedAction(shell);

    expect(result?.summary).toBe("codex-profile preview: 3 recommended change(s)");
    expect(result?.details).toContain("model: <missing> -> gpt-5.4");
  });

  it("wraps selection and resets action cursor when section changes", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const shell = createTuiShell(createProjectPaths(projectRoot), createCodexPaths(homeDir));

    moveSelection(shell, "action", -1);
    expect(currentAction(shell).id).toBe("export_all");

    moveSelection(shell, "section", 1);
    expect(shell.activeSectionId).toBe("preferences");
    expect(shell.activeActionIndex).toBe(0);
    expect(currentAction(shell).id).toBe("open_config_editor");
  });

  it("gates risky actions behind confirmation and opens a notice after confirm", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths);

    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);

    expect(currentAction(shell).id).toBe("apply_codex_profile");
    expect(existsSync(codexPaths.configToml)).toBe(false);

    const pending = runSelectedAction(shell);

    expect(pending).toBeNull();
    expect(shell.pendingConfirmation?.heading).toBe("Confirm This Action");
    expect(existsSync(codexPaths.configToml)).toBe(false);

    const result = confirmPendingAction(shell);

    expect(result?.summary).toContain("codex-profile apply");
    expect(shell.pendingConfirmation).toBeNull();
    expect(shell.notice?.title).toBe("Applied");
    expect(shell.activeSectionId).toBe("get_started");
    expect(shell.activeActionIndex).toBe(0);
    expect(existsSync(codexPaths.configToml)).toBe(true);
  });

  it("opens the config editor, mutates draft values, and saves through the shell", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths, "settings");

    expect(currentAction(shell).id).toBe("open_config_editor");

    runSelectedAction(shell);
    expect(shell.activeEditor?.kind).toBe("config");

    const before = shell.activeEditor?.config.models.coordinator.model;
    editActiveValue(shell, 1);
    const after = shell.activeEditor?.config.models.coordinator.model;

    expect(after).not.toBe(before);
    expect(saveActiveEditor(shell)?.summary).toContain("config: saved");
    expect(shell.activeEditor).toBeNull();
    expect(shell.notice?.title).toBe("Saved");
    expect(existsSync(paths.configPath)).toBe(true);
  });

  it("opens the config editor with local current values and recommended defaults from the backend helper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2";
    saveConfig(paths, config);

    const shell = createTuiShell(paths, codexPaths, "settings");
    runSelectedAction(shell);

    expect(shell.activeEditor?.kind).toBe("config");
    if (shell.activeEditor?.kind !== "config") {
      throw new Error("expected config editor");
    }
    expect(shell.activeEditor.initial.models.coordinator.model).toBe("gpt-5.2");
    expect(shell.activeEditor.config.models.coordinator.model).toBe("gpt-5.2");
    expect(shell.activeEditor.defaults.models.coordinator.model).toBe("gpt-5.4");
  });

  it("applies the integrations profile from install after confirmation", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths);

    moveSelection(shell, "section", 1);
    moveSelection(shell, "section", 1);
    while (currentAction(shell).id !== "apply_integrations_profile") {
      moveSelection(shell, "action", 1);
    }

    expect(currentAction(shell).id).toBe("apply_integrations_profile");
    expect(existsSync(codexPaths.configToml)).toBe(false);

    runSelectedAction(shell);
    expect(shell.pendingConfirmation?.heading).toBe("Confirm This Action");
    expect(shell.pendingConfirmation?.commandId).toBe("apply_integrations_profile");

    const result = confirmPendingAction(shell);

    expect(result?.summary).toContain("integrations-profile apply");
    expect(shell.pendingConfirmation).toBeNull();
    expect(shell.notice?.title).toBe("Applied");
    expect(shell.notice?.section).toBe("install");
    expect(shell.activeSectionId).toBe("install");
    expect(currentAction(shell).id).toBe("export_all");
    expect(existsSync(codexPaths.configToml)).toBe(true);
  });

  it("resets local telemetry data from the privacy editor flow", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths, "settings");

    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    expect(currentAction(shell).id).toBe("open_privacy_editor");

    runSelectedAction(shell);
    editActiveValue(shell, 1);
    saveActiveEditor(shell);

    expect(existsSync(paths.telemetryDir)).toBe(true);
    expect(resetLocalTelemetry(shell).summary).toBe("telemetry reset: removed local telemetry data");
    expect(existsSync(paths.telemetryDir)).toBe(false);
  });

  it("surfaces telemetry reset as a first-class confirmed repair action", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths, "settings");

    runSelectedAction(shell);
    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    runSelectedAction(shell);
    editActiveValue(shell, 1);
    saveActiveEditor(shell);

    expect(existsSync(paths.telemetryDir)).toBe(true);

    moveSelection(shell, "section", 1);
    moveSelection(shell, "section", 1);
    moveSelection(shell, "section", 1);
    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    moveSelection(shell, "action", 1);
    expect(currentAction(shell).id).toBe("reset_telemetry_data");

    runSelectedAction(shell);
    expect(shell.pendingConfirmation?.commandId).toBe("reset_telemetry_data");

    const result = confirmPendingAction(shell);

    expect(result?.summary).toBe("telemetry reset: removed local telemetry data");
    expect(shell.pendingConfirmation).toBeNull();
    expect(shell.notice?.title).toBe("Reset");
    expect(shell.notice?.section).toBe("repair");
    expect(existsSync(paths.telemetryDir)).toBe(false);
  });

  it("removes individual managed codex targets from the repair section", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    exportAll(paths, codexPaths);

    const shell = createTuiShell(paths, codexPaths);
    moveSelection(shell, "section", -1);
    for (let index = 0; index < 8; index += 1) {
      moveSelection(shell, "action", 1);
    }
    expect(currentAction(shell).id).toBe("uninstall_hooks");

    runSelectedAction(shell);
    expect(shell.pendingConfirmation?.commandId).toBe("uninstall_hooks");

    const result = confirmPendingAction(shell);

    expect(result?.summary).toContain("uninstall hooks");
    expect(shell.notice?.title).toBe("Uninstalled");
    expect(existsSync(codexPaths.hooksJson)).toBe(false);
  });
});
