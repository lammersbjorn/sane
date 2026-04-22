import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { InventoryStatus, OperationKind } from "@sane/core";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { exportAll, uninstallAll } from "../src/bundles.js";
import { saveConfig } from "../src/preferences.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-bundles-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("bundled install/remove operations", () => {
  it("exports current managed user-level targets together", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.caveman = true;
    saveConfig(paths, config);

    const result = exportAll(paths, codexPaths);

    expect(result.kind).toBe(OperationKind.ExportAll);
    expect(result.summary).toBe("export all: installed managed targets");
    expect(result.details).toContain("export user-skills: installed sane-router");
    expect(result.details).toContain("export global-agents: installed managed block");
    expect(result.details).toContain("export hooks: installed managed SessionStart hook");
    expect(result.details).toContain(
      "export custom-agents: installed sane-agent, sane-reviewer, and sane-explorer"
    );
    expect(result.inventory.find((item) => item.name === "user-skills")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(result.inventory.find((item) => item.name === "global-agents")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(result.inventory.find((item) => item.name === "hooks")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(result.inventory.find((item) => item.name === "custom-agents")?.status).toBe(
      InventoryStatus.Installed
    );
  });

  it("uninstalls current managed user-level targets together", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportAll(paths, codexPaths);
    const result = uninstallAll(codexPaths);

    expect(result.kind).toBe(OperationKind.UninstallAll);
    expect(result.summary).toBe("uninstall all: removed Sane's Codex changes");
    expect(result.details).toContain("uninstall user-skills: removed sane-router");
    expect(result.details).toContain("uninstall global-agents: removed managed block");
    expect(result.details).toContain("uninstall hooks: removed managed SessionStart hook");
    expect(result.details).toContain(
      "uninstall custom-agents: removed sane-agent, sane-reviewer, and sane-explorer"
    );
    expect(result.inventory.find((item) => item.name === "user-skills")?.status).toBe(
      InventoryStatus.Removed
    );
    expect(result.inventory.find((item) => item.name === "global-agents")?.status).toBe(
      InventoryStatus.Removed
    );
    expect(result.inventory.find((item) => item.name === "hooks")?.status).toBe(
      InventoryStatus.Removed
    );
    expect(result.inventory.find((item) => item.name === "custom-agents")?.status).toBe(
      InventoryStatus.Removed
    );
  });
});
