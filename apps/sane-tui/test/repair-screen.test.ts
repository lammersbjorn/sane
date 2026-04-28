import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyCodexProfile, backupCodexConfig } from "@sane/control-plane/codex-config.js";
import { exportAll } from "@sane/control-plane";
import { installRuntime } from "@sane/control-plane";
import * as inventory from "@sane/control-plane/inventory.js";
import { saveConfig } from "@sane/control-plane/preferences.js";
import * as repairStatus from "@sane/control-plane/repair-status.js";
import { loadRepairScreen, loadRepairScreenFromStatusBundle } from "@sane/sane-tui/repair-screen.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-tui-repair-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("repair screen model", () => {
  it("lists repair actions in current order with confirmation copy", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const screen = loadRepairScreen(paths, codexPaths);

    expect(screen.summary).toBe("Repair");
    expect(screen.installBundle).toBe("missing");
    expect(screen.telemetry).toEqual({
      dirPresent: false,
      summaryPresent: false,
      eventsPresent: false,
      queuePresent: false
    });
    expect(screen.backups).toEqual({
      restoreAvailable: false,
      backupCount: 0,
      latestBackupPath: null
    });
    expect(screen.restoreStatus).toEqual({ kind: "missing", label: "missing" });
    expect(screen.removableInstalls).toEqual([]);
    expect(screen.actions.map((action) => action.id)).toEqual([
      "install_runtime",
      "backup_codex_config",
      "restore_codex_config",
      "reset_telemetry_data"
    ]);
    expect(
      screen.actions.find((action) => action.id === "restore_codex_config")?.confirmation
    ).toBe("This replaces your current Codex config with the latest backup.");
    expect(screen.actions.find((action) => action.id === "reset_telemetry_data")?.confirmation).toBe(
      "This deletes Sane's local telemetry files from this machine."
    );
  });

  it("reflects backup availability and installed bundle state", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    applyCodexProfile(paths, codexPaths);
    backupCodexConfig(paths, codexPaths);
    exportAll(paths, codexPaths);

    const screen = loadRepairScreen(paths, codexPaths);

    expect(screen.installBundle).toBe("installed");
    expect(screen.telemetry).toEqual({
      dirPresent: true,
      summaryPresent: false,
      eventsPresent: false,
      queuePresent: false
    });
    expect(screen.backups).toEqual({
      restoreAvailable: true,
      backupCount: 1,
      latestBackupPath: expect.stringContaining(paths.codexConfigBackupsDir)
    });
    expect(screen.restoreStatus).toEqual({ kind: "available", label: "available" });
    expect(screen.removableInstalls).toEqual([
      "user-skills",
      "global-agents",
      "hooks",
      "custom-agents"
    ]);
    expect(screen.actions.find((action) => action.id === "backup_codex_config")?.status).toEqual({
      kind: "installed",
      label: "installed"
    });
    expect(screen.actions.find((action) => action.id === "restore_codex_config")?.status).toEqual({
      kind: "available",
      label: "available"
    });
    expect(screen.actions.find((action) => action.id === "reset_telemetry_data")?.status).toEqual({
      kind: "present",
      label: "present"
    });
    expect(screen.actions.some((action) => action.id.startsWith("uninstall_"))).toBe(false);
  });

  it("builds from a preloaded status bundle when requested", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const bundle = inventory.inspectStatusBundle(paths, codexPaths);
    const fromBundleSpy = vi.spyOn(repairStatus, "inspectRepairStatusFromStatusBundle");
    const screen = loadRepairScreenFromStatusBundle(paths, codexPaths, bundle);

    expect(fromBundleSpy).toHaveBeenCalledTimes(1);
    expect(fromBundleSpy).toHaveBeenCalledWith(paths, codexPaths, bundle);
    expect(screen.installBundle).toBe("missing");
  });

  it("shows native Windows hooks as unsupported instead of invalid", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    exportAll(paths, codexPaths, "windows");

    const bundle = inventory.inspectStatusBundle(paths, codexPaths, "windows");
    const screen = loadRepairScreenFromStatusBundle(paths, codexPaths, bundle);

    expect(screen.actions.some((action) => action.id === "uninstall_hooks")).toBe(false);
  });
});
