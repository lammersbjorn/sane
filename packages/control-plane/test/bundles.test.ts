import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { InventoryStatus, OperationKind } from "@sane/control-plane/core.js";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
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
    expect(result.details).toContain("export hooks: installed managed SessionStart and safety hooks");
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

  it("exports current managed user-level targets idempotently", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.caveman = true;
    saveConfig(paths, config);

    const first = exportAll(paths, codexPaths);
    const firstSkill = readFileSync(
      join(codexPaths.userSkillsDir, "sane-router", "SKILL.md"),
      "utf8"
    );
    const firstAgents = readFileSync(codexPaths.globalAgentsMd, "utf8");
    const firstHooks = readFileSync(codexPaths.hooksJson, "utf8");
    const firstCustomAgent = readFileSync(
      join(codexPaths.customAgentsDir, "sane-agent.toml"),
      "utf8"
    );

    const second = exportAll(paths, codexPaths);

    expect(second.summary).toBe(first.summary);
    expect(second.details).toEqual(first.details);
    expect(second.pathsTouched).toEqual(first.pathsTouched);
    expect(readFileSync(join(codexPaths.userSkillsDir, "sane-router", "SKILL.md"), "utf8")).toBe(firstSkill);
    expect(readFileSync(codexPaths.globalAgentsMd, "utf8")).toBe(firstAgents);
    expect(readFileSync(codexPaths.hooksJson, "utf8")).toBe(firstHooks);
    expect(readFileSync(join(codexPaths.customAgentsDir, "sane-agent.toml"), "utf8")).toBe(firstCustomAgent);
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
    expect(result.details).not.toContain("export hooks: installed managed SessionStart and safety hooks");
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

  it("keeps user-owned content across export/uninstall and stays idempotent", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const unmanagedSkillDir = join(codexPaths.userSkillsDir, "sane-router");
    const unmanagedSkillFile = join(unmanagedSkillDir, "SKILL.md");
    const unmanagedHookJson = `${JSON.stringify(
      {
        hooks: {
          SessionStart: [
            {
              matcher: "other",
              hooks: [{ type: "command", command: "echo untouched" }]
            }
          ]
        }
      },
      null,
      2
    )}\n`;

    mkdirSync(unmanagedSkillDir, { recursive: true });
    writeFileSync(unmanagedSkillFile, "user-owned skill body\n", "utf8");
    mkdirSync(codexPaths.codexHome, { recursive: true });
    writeFileSync(codexPaths.hooksJson, unmanagedHookJson, "utf8");

    const exportResult = exportAll(paths, codexPaths);
    expect(exportResult.details).toContain(
      "export user-skills: blocked by non-Sane skill directories"
    );
    expect(readFileSync(unmanagedSkillFile, "utf8")).toBe("user-owned skill body\n");

    const uninstallOnce = uninstallAll(codexPaths);
    expect(uninstallOnce.details).toContain(
      "uninstall user-skills: blocked by non-Sane skill directories"
    );
    expect(uninstallOnce.details).toContain(
      "uninstall global-agents: removed managed block"
    );
    expect(uninstallOnce.details).toContain(
      "uninstall hooks: removed managed lifecycle hooks"
    );
    expect(readFileSync(unmanagedSkillFile, "utf8")).toBe("user-owned skill body\n");
    const hooksAfterFirstUninstall = JSON.parse(readFileSync(codexPaths.hooksJson, "utf8"));
    expect(hooksAfterFirstUninstall.hooks.SessionStart).toHaveLength(1);
    expect(JSON.stringify(hooksAfterFirstUninstall)).toContain("echo untouched");

    const uninstallTwice = uninstallAll(codexPaths);
    expect(uninstallTwice.details).toContain(
      "uninstall user-skills: blocked by non-Sane skill directories"
    );
    expect(uninstallTwice.details).toContain("uninstall global-agents: not installed");
    expect(uninstallTwice.details).toContain("uninstall hooks: not installed");
    expect(readFileSync(unmanagedSkillFile, "utf8")).toBe("user-owned skill body\n");
    expect(readFileSync(codexPaths.hooksJson, "utf8")).toBe(unmanagedHookJson);
  });
});
