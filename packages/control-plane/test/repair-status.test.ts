import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { applyCodexProfile, backupCodexConfig } from "../src/codex-config.js";
import { CORE_INSTALL_BUNDLE_TARGETS } from "../src/core-install-bundle-targets.js";
import { exportAll } from "../src/index.js";
import {
  inspectRepairStatus,
  inspectRepairStatusFromStatusBundle
} from "../src/repair-status.js";
import { installRuntime } from "../src/index.js";
import { inspectStatusBundle } from "../src/inventory.js";
import { saveConfig } from "../src/preferences.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-repair-status-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("repair status snapshot", () => {
  const actionIdForTarget = (target: (typeof CORE_INSTALL_BUNDLE_TARGETS)[number]) =>
    `uninstall_${target.replaceAll("-", "_")}` as const;

  it("reports missing restore/telemetry/install state on fresh setup", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectRepairStatus(paths, codexPaths)).toEqual({
      installBundle: "missing",
      telemetry: {
        dirPresent: false,
        summaryPresent: false,
        eventsPresent: false,
        queuePresent: false
      },
      backups: {
        restoreAvailable: false,
        backupCount: 0,
        latestBackupPath: null
      },
      restoreStatus: { kind: "missing", label: "missing" },
      removableInstalls: [],
      actionStatus: expect.objectContaining({
        install_runtime: { kind: "missing", label: "missing" },
        restore_codex_config: { kind: "missing", label: "missing" },
        reset_telemetry_data: { kind: "missing", label: "missing" },
        ...Object.fromEntries(
          CORE_INSTALL_BUNDLE_TARGETS.map((target) => [
            actionIdForTarget(target),
            { kind: "missing", label: "missing" }
          ])
        ),
        uninstall_opencode_agents: { kind: "missing", label: "missing" },
        uninstall_all: { kind: "missing", label: "missing" }
      })
    });
  });

  it("reports repair affordances from backend state without raw inventory consumers", () => {
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

    expect(inspectRepairStatus(paths, codexPaths)).toEqual({
      installBundle: "installed",
      telemetry: {
        dirPresent: true,
        summaryPresent: false,
        eventsPresent: false,
        queuePresent: false
      },
      backups: {
        restoreAvailable: true,
        backupCount: 1,
        latestBackupPath: expect.stringContaining(paths.codexConfigBackupsDir)
      },
      restoreStatus: { kind: "available", label: "available" },
      removableInstalls: [...CORE_INSTALL_BUNDLE_TARGETS],
      actionStatus: expect.objectContaining({
        backup_codex_config: { kind: "installed", label: "installed" },
        restore_codex_config: { kind: "available", label: "available" },
        reset_telemetry_data: { kind: "present", label: "present" },
        ...Object.fromEntries(
          CORE_INSTALL_BUNDLE_TARGETS.map((target) => [
            actionIdForTarget(target),
            { kind: "installed", label: "installed" }
          ])
        ),
        uninstall_opencode_agents: { kind: "missing", label: "missing" },
        uninstall_all: { kind: "installed", label: "installed" }
      })
    });
  });

  it("keeps bundle-based repair snapshot aligned with the wrapper helper", () => {
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

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(inspectRepairStatusFromStatusBundle(paths, codexPaths, bundle)).toEqual(
      inspectRepairStatus(paths, codexPaths)
    );
  });
});
