import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InventoryStatus } from "@sane/core";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { parseEventRecordJson, readJsonlRecords } from "@sane/state";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as controlPlane from "@sane/control-plane";
import { exportAll } from "@sane/control-plane/bundles.js";
import * as codexConfig from "@sane/control-plane/codex-config.js";
import { executeOperation } from "@sane/control-plane/history.js";
import * as inventory from "@sane/control-plane/inventory.js";
import { saveConfig } from "@sane/control-plane/preferences.js";
import * as preferencesControlPlane from "@sane/control-plane/preferences.js";
import { createDefaultLocalConfig, readLocalConfig } from "@sane/config";
import * as runtimeState from "@sane/control-plane/runtime-state.js";
import { loadAppView } from "@sane/sane-tui/app-view.js";
import {
  confirmPendingAction,
  createTuiShell,
  currentAction,
  editActiveValue,
  executeUiCommand,
  moveSelection,
  resetLocalTelemetry,
  runSelectedAction,
  saveActiveEditor,
  selectSection
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
  it("defaults to Home while setup is missing and supports settings shortcut", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const shell = createTuiShell(paths, codexPaths);
    const settingsShell = createTuiShell(paths, codexPaths, "settings");

    expect(shell.activeSectionId).toBe("home");
    expect(currentAction(shell).id).toBe("install_runtime");
    expect(settingsShell.activeSectionId).toBe("settings");
    expect(currentAction(settingsShell).id).toBe("open_config_editor");
  });

  it("opens Check by default after onboarding is complete", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    controlPlane.installRuntime(paths, codexPaths);
    codexConfig.applyCodexProfile(paths, codexPaths);
    exportAll(paths, codexPaths);
    const shell = createTuiShell(paths, codexPaths);

    expect(shell.activeSectionId).toBe("status");
    expect(currentAction(shell).id).toBe("show_status");
  });

  it("stores a typed status snapshot and refreshes it after managed actions", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const statusBundleSpy = vi.spyOn(inventory, "inspectStatusBundle");
    const codexProfilesSpy = vi.spyOn(codexConfig, "inspectCodexProfileFamilySnapshot");
    const preferencesSpy = vi.spyOn(preferencesControlPlane, "inspectPreferencesFamilySnapshot");
    const runtimeStateSpy = vi.spyOn(runtimeState, "inspectRuntimeState");
    const shell = createTuiShell(paths, codexPaths);

    expect(shell.statusSnapshot.statusBundle.primary.status.runtime).toBe("missing");
    expect(shell.statusSnapshot.statusBundle.runtimeState.current).toBeNull();
    expect(shell.statusSnapshot.codexProfiles.core.audit.status).toBe("missing");
    expect(shell.statusSnapshot.preferences.preferences.source).toBe("recommended");
    expect(codexProfilesSpy).toHaveBeenCalledWith(codexPaths);
    expect(preferencesSpy).toHaveBeenCalledWith(paths, codexPaths);

    statusBundleSpy.mockClear();
    codexProfilesSpy.mockClear();
    preferencesSpy.mockClear();
    runtimeStateSpy.mockClear();
    runSelectedAction(shell);

    expect(statusBundleSpy).toHaveBeenCalledWith(paths, codexPaths, shell.hostPlatform);
    expect(codexProfilesSpy).toHaveBeenCalledWith(codexPaths);
    expect(preferencesSpy).toHaveBeenCalledWith(paths, codexPaths);
    expect(runtimeStateSpy).toHaveBeenCalledWith(paths);
    expect(shell.statusSnapshot.statusBundle.primary.status.runtime).toBe("installed");
    expect(shell.statusSnapshot.statusBundle.runtimeState.current?.phase).toBe("setup");
    expect(shell.statusSnapshot.codexProfiles.core.audit.status).toBe("missing");
    expect(shell.statusSnapshot.preferences.preferences.source).toBe("local");
    expect(shell.activeSectionId).toBe("home");
    expect(currentAction(shell).id).toBe("preview_codex_profile");
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

    while (currentAction(shell).id !== "show_config") {
      moveSelection(shell, "action", 1);
    }
    runSelectedAction(shell);

    selectSection(shell, "status");
    runSelectedAction(shell);

    while (currentAction(shell).id !== "preview_integrations_profile") {
      moveSelection(shell, "action", 1);
    }
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

    while (shell.activeSectionId !== "status") {
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

    while (shell.activeSectionId !== "status") {
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

    while (doctorShell.activeSectionId !== "status") {
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

    while (shell.activeSectionId !== "status") {
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

  it("uses a fresh codex profile snapshot for TUI preview actions", () => {
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
    expect(result?.details).toContain("model: gpt-5.4 -> gpt-5.5");
    expect(result?.details).toContain("reasoning: high -> low");
    expect(result?.details).toContain("compact prompt: <missing> -> Sane continuity prompt");
    expect(result?.details).toContain("codex hooks: keep enabled");
  });

  it("executes the OpenCode export command through the shell command router", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const result = executeUiCommand(paths, codexPaths, "export_opencode_all");

    expect(result.summary).toBe("export opencode: installed managed OpenCode targets");
    expect(result.details).toContain("export opencode-skills: installed core skills");
    expect(result.details).toContain("export opencode-agents: installed Sane OpenCode agents");
    expect(existsSync(join(homeDir, ".config", "opencode", "agents", "sane-agent.md"))).toBe(true);
  });

  it("executes portable settings export/import/install commands through the shell command router", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2";
    saveConfig(paths, config);

    const exported = executeUiCommand(paths, codexPaths, "export_portable_settings");
    expect(exported.summary).toBe(`portable settings: exported to ${paths.runtimeRoot}/settings.portable.json`);

    const changed = createDefaultLocalConfig();
    changed.models.coordinator.model = "gpt-5.5";
    saveConfig(paths, changed);

    const imported = executeUiCommand(paths, codexPaths, "import_portable_settings");
    expect(imported.summary).toBe(`portable settings: imported from ${paths.runtimeRoot}/settings.portable.json`);
    expect(readLocalConfig(paths.configPath).models.coordinator.model).toBe("gpt-5.2");

    rmSync(paths.configPath, { force: true });
    const installed = executeUiCommand(paths, codexPaths, "install_from_portable_settings");
    expect(installed.summary).toBe(`portable settings: imported from ${paths.runtimeRoot}/settings.portable.json`);
    expect(existsSync(paths.runtimeRoot)).toBe(true);
    expect(readLocalConfig(paths.configPath).models.coordinator.model).toBe("gpt-5.2");
  });

  it("wraps selection and resets action cursor when section changes", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const shell = createTuiShell(createProjectPaths(projectRoot), createCodexPaths(homeDir));

    moveSelection(shell, "action", -1);
    expect(currentAction(shell).id).toBe("doctor");

    moveSelection(shell, "section", 1);
    expect(shell.activeSectionId).toBe("settings");
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
    expect(shell.pendingConfirmation?.title).toBe("Confirm action");
    expect(shell.pendingConfirmation?.heading).toBe("Apply Codex settings");
    expect(existsSync(codexPaths.configToml)).toBe(false);

    const result = confirmPendingAction(shell);

    expect(result?.summary).toContain("codex-profile apply");
    expect(shell.pendingConfirmation).toBeNull();
    expect(shell.notice?.title).toBe("Applied");
    expect(shell.activeSectionId).toBe("home");
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
    expect(shell.activeEditor.defaults.models.coordinator.model).toBe("gpt-5.5");
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
    expect(shell.pendingConfirmation?.title).toBe("Confirm action");
    expect(shell.pendingConfirmation?.heading).toBe("Tool setup");
    expect(shell.pendingConfirmation?.commandId).toBe("apply_integrations_profile");

    const result = confirmPendingAction(shell);

    expect(result?.summary).toContain("integrations-profile apply");
    expect(shell.pendingConfirmation).toBeNull();
    expect(shell.notice?.title).toBe("Applied");
    expect(shell.notice?.section).toBe("add_to_codex");
    expect(shell.activeSectionId).toBe("add_to_codex");
    expect(currentAction(shell).id).toBe("export_all");
    expect(existsSync(codexPaths.configToml)).toBe(true);
  });

  it("returns to Setup when setup is still incomplete after Add to Codex install", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const shell = createTuiShell(paths, codexPaths);

    while (currentAction(shell).id !== "export_all") {
      moveSelection(shell, "action", 1);
    }

    const pending = runSelectedAction(shell);

    expect(pending).toBeNull();
    expect(shell.pendingConfirmation?.commandId).toBe("export_all");

    const result = confirmPendingAction(shell);

    expect(result?.summary).toBe("export all: installed managed targets");
    expect(shell.activeSectionId).toBe("home");
    expect(currentAction(shell).id).toBe("install_runtime");
    expect(shell.notice?.section).toBe("home");
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
    selectSection(shell, "repair");
    expect(loadAppView(shell).sectionOverviewLines.join("\n")).toContain("local telemetry data: present");
    const statusSpy = vi.spyOn(inventory, "inspectStatusBundle");
    statusSpy.mockClear();
    expect(resetLocalTelemetry(shell).summary).toBe("telemetry reset: removed local telemetry data");
    expect(statusSpy).toHaveBeenCalledWith(paths, codexPaths, shell.hostPlatform);
    expect(existsSync(paths.telemetryDir)).toBe(false);
    expect(loadAppView(shell).sectionOverviewLines.join("\n")).toContain("local telemetry data: missing");
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

  it("removes individual managed codex targets from the uninstall section", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    exportAll(paths, codexPaths);

    const shell = createTuiShell(paths, codexPaths);
    moveSelection(shell, "section", -1);
    for (let index = 0; index < 2; index += 1) {
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
