import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { applyCodexProfile, backupCodexConfig } from "@sane/control-plane/codex-config.js";
import { exportAll } from "@sane/control-plane";
import { installRuntime } from "@sane/control-plane";
import { saveConfig } from "@sane/control-plane/preferences.js";
import { loadRepairScreen } from "@/repair-screen.js";

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
  it("lists repair actions in Rust order with confirmation copy", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const screen = loadRepairScreen(paths, codexPaths);

    expect(screen.summary).toBe("Repair");
    expect(screen.installBundle).toBe("missing");
    expect(screen.actions.map((action) => action.id)).toEqual([
      "install_runtime",
      "backup_codex_config",
      "restore_codex_config",
      "reset_telemetry_data",
      "uninstall_user_skills",
      "uninstall_repo_skills",
      "uninstall_global_agents",
      "uninstall_repo_agents",
      "uninstall_hooks",
      "uninstall_custom_agents",
      "uninstall_opencode_agents",
      "uninstall_all"
    ]);
    expect(
      screen.actions.find((action) => action.id === "uninstall_user_skills")?.confirmation
    ).toBe("This removes Sane's user-level Codex skill install.");
    expect(
      screen.actions.find((action) => action.id === "uninstall_global_agents")?.confirmation
    ).toBe("This removes Sane's managed block from your global `~/.codex/AGENTS.md`.");
    expect(screen.actions.find((action) => action.id === "uninstall_hooks")?.confirmation).toBe(
      "This removes Sane's managed Codex hook entry."
    );
    expect(
      screen.actions.find((action) => action.id === "uninstall_opencode_agents")?.confirmation
    ).toBe("This removes Sane's optional OpenCode-agent export.");
    expect(
      screen.actions.find((action) => action.id === "restore_codex_config")?.confirmation
    ).toBe("This replaces your current Codex config with the latest backup.");
    expect(screen.actions.find((action) => action.id === "reset_telemetry_data")?.confirmation).toBe(
      "This deletes Sane's local telemetry files from this machine."
    );
    expect(screen.actions.find((action) => action.id === "uninstall_all")?.confirmation).toBe(
      "This removes all Sane-managed Codex pieces."
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
    expect(screen.actions.find((action) => action.id === "backup_codex_config")?.status).toBe(
      "installed"
    );
    expect(screen.actions.find((action) => action.id === "restore_codex_config")?.status).toBe(
      "available"
    );
    expect(screen.actions.find((action) => action.id === "reset_telemetry_data")?.status).toBe(
      "present"
    );
    expect(screen.actions.find((action) => action.id === "uninstall_user_skills")?.status).toBe(
      "installed"
    );
    expect(screen.actions.find((action) => action.id === "uninstall_global_agents")?.status).toBe(
      "installed"
    );
    expect(screen.actions.find((action) => action.id === "uninstall_hooks")?.status).toBe(
      "installed"
    );
    expect(screen.actions.find((action) => action.id === "uninstall_custom_agents")?.status).toBe(
      "installed"
    );
    expect(screen.actions.find((action) => action.id === "uninstall_all")?.status).toBe(
      "installed"
    );
  });
});
