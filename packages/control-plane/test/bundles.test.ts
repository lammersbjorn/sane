import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { InventoryStatus, OperationKind } from "@sane/core";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { exportAll, uninstallAll } from "../src/bundles.js";
import { CORE_INSTALL_BUNDLE_TARGETS } from "../src/core-install-bundle-targets.js";
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
  it("exposes the canonical managed target order for install bundle operations", () => {
    expect(CORE_INSTALL_BUNDLE_TARGETS).toEqual([
      "user-skills",
      "global-agents",
      "hooks",
      "custom-agents"
    ]);
  });

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
    expect(result.details).toContain("export user-skills: installed core skills");
    expect(result.details).toContain("export global-agents: installed managed block");
    expect(result.details).toContain("export hooks: installed managed SessionStart hook");
    expect(result.details).toContain(
      "export custom-agents: installed Sane custom agents"
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
    expect(result.details).not.toContain("export repo-skills: installed core skills");
    expect(result.details).not.toContain("export repo-agents: installed managed block");
    expect(result.inventory.find((item) => item.name === "repo-skills")).toBeUndefined();
    expect(result.inventory.find((item) => item.name === "repo-agents")).toBeUndefined();
    expect(result.pathsTouched.some((path) => path.startsWith(paths.repoSkillsDir))).toBe(
      false
    );
    expect(result.pathsTouched).not.toContain(paths.repoAgentsMd);
  });

  it("skips hooks from export-all on native Windows", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const result = exportAll(paths, codexPaths, "windows");

    expect(result.kind).toBe(OperationKind.ExportAll);
    expect(result.details).toContain("export user-skills: installed core skills");
    expect(result.details).toContain("export global-agents: installed managed block");
    expect(result.details).toContain(
      "export custom-agents: installed Sane custom agents"
    );
    expect(result.details).not.toContain("export hooks: installed managed SessionStart hook");
    expect(result.inventory.find((item) => item.name === "user-skills")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(result.inventory.find((item) => item.name === "global-agents")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(result.inventory.find((item) => item.name === "custom-agents")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(result.inventory.find((item) => item.name === "hooks")).toBeUndefined();
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
    expect(result.details).toContain("uninstall user-skills: removed core skills");
    expect(result.details).toContain("uninstall global-agents: removed managed block");
    expect(result.details).toContain("uninstall hooks: removed managed lifecycle hooks");
    expect(result.details).toContain(
      "uninstall custom-agents: removed Sane custom agents"
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
    expect(result.details).not.toContain("uninstall repo-skills: removed core skills");
    expect(result.details).not.toContain("uninstall repo-agents: removed managed block");
    expect(result.inventory.find((item) => item.name === "repo-skills")).toBeUndefined();
    expect(result.inventory.find((item) => item.name === "repo-agents")).toBeUndefined();
  });
});
