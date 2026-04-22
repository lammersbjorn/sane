import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { applyCodexProfile, backupCodexConfig } from "../src/codex-config.js";
import { exportAll } from "../src/index.js";
import { inspectRepairStatus } from "../src/repair-status.js";
import { installRuntime } from "../src/index.js";
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
  it("reports missing restore/telemetry/install state on fresh setup", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectRepairStatus(paths, codexPaths)).toEqual({
      installBundle: "missing",
      actionStatus: expect.objectContaining({
        install_runtime: "missing",
        restore_codex_config: "missing",
        reset_telemetry_data: "missing",
        uninstall_user_skills: "missing",
        uninstall_global_agents: "missing",
        uninstall_hooks: "missing",
        uninstall_custom_agents: "missing",
        uninstall_all: "missing"
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
      actionStatus: expect.objectContaining({
        backup_codex_config: "installed",
        restore_codex_config: "available",
        reset_telemetry_data: "present",
        uninstall_user_skills: "installed",
        uninstall_global_agents: "installed",
        uninstall_hooks: "installed",
        uninstall_custom_agents: "installed",
        uninstall_all: "installed"
      })
    });
  });
});
