import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig, writeLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/core";
import {
  SANE_GLOBAL_AGENTS_BEGIN,
  SANE_GLOBAL_AGENTS_END,
  SANE_REPO_AGENTS_BEGIN,
  SANE_REPO_AGENTS_END,
  createOptionalPackSkill,
  createOptionalPackSkills,
  createSaneGlobalAgentsOverlay,
  createSaneRepoAgentsOverlay,
  createSaneRouterSkill
} from "@sane/framework-assets";
import { createProjectPaths, createCodexPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import {
  exportGlobalAgents,
  exportRepoAgents,
  exportRepoSkills,
  exportUserSkills,
  inspectCodexSkillsAndAgents,
  uninstallGlobalAgents,
  uninstallRepoAgents,
  uninstallRepoSkills,
  uninstallUserSkills
} from "../src/codex-native.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-codex-native-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("codex-native skills and agents", () => {
  it("exports user skills from local config and installs enabled optional pack skills", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.caveman = true;
    writeLocalConfig(projectPaths.configPath, config);

    const result = exportUserSkills(projectPaths, codexPaths);
    const routerPath = join(codexPaths.userSkillsDir, "sane-router", "SKILL.md");
    const cavemanPath = join(codexPaths.userSkillsDir, "sane-caveman", "SKILL.md");

    expect(result.summary).toBe("export user-skills: installed sane-router");
    expect(result.pathsTouched).toContain(routerPath);
    expect(result.pathsTouched).toContain(cavemanPath);
    expect(readFileSync(routerPath, "utf8")).toBe(
      createSaneRouterSkill(
        {
          caveman: true,
          cavemem: false,
          rtk: false,
          frontendCraft: false
        },
        {
          coordinatorModel: config.models.coordinator.model,
          coordinatorReasoning: config.models.coordinator.reasoningEffort,
          executionModel: "gpt-5.3-codex",
          executionReasoning: "medium",
          sidecarModel: config.models.sidecar.model,
          sidecarReasoning: config.models.sidecar.reasoningEffort,
          verifierModel: config.models.verifier.model,
          verifierReasoning: config.models.verifier.reasoningEffort,
          realtimeModel: "gpt-5.3-codex-spark",
          realtimeReasoning: "low"
        }
      )
    );
    expect(readFileSync(cavemanPath, "utf8")).toBe(createOptionalPackSkill("caveman"));
  });

  it("exports every skill file for a multi-skill optional pack", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.frontendCraft = true;
    writeLocalConfig(projectPaths.configPath, config);

    const result = exportUserSkills(projectPaths, codexPaths);
    const exportedSkills = createOptionalPackSkills("frontend-craft");
    const skillPaths = exportedSkills.map((skill) => join(codexPaths.userSkillsDir, skill.name, "SKILL.md"));

    expect(skillPaths).toEqual([
      join(codexPaths.userSkillsDir, "design-taste-frontend", "SKILL.md"),
      join(codexPaths.userSkillsDir, "impeccable", "SKILL.md")
    ]);
    expect(result.pathsTouched).toEqual(expect.arrayContaining(skillPaths));
    for (const [index, skill] of exportedSkills.entries()) {
      expect(readFileSync(skillPaths[index]!, "utf8")).toBe(skill.content);
    }
    expect(
      readFileSync(
        join(codexPaths.userSkillsDir, "impeccable", "reference", "typography.md"),
        "utf8"
      )
    ).toBe(
      exportedSkills.find((skill) => skill.name === "impeccable")!.resources.find(
        (resource) => resource.path === "reference/typography.md"
      )!.content
    );
  });

  it("exports AGENTS blocks additively and uninstalls them without removing user content", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.rtk = true;
    writeLocalConfig(projectPaths.configPath, config);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.globalAgentsMd, "# User notes\n", "utf8");
    writeFileSync(projectPaths.repoAgentsMd, "# Repo notes\n", "utf8");

    exportGlobalAgents(projectPaths, codexPaths);
    exportRepoAgents(projectPaths, codexPaths);

    const globalBody = readFileSync(codexPaths.globalAgentsMd, "utf8");
    const repoBody = readFileSync(projectPaths.repoAgentsMd, "utf8");
    const roles = {
      coordinatorModel: config.models.coordinator.model,
      coordinatorReasoning: config.models.coordinator.reasoningEffort,
      executionModel: "gpt-5.3-codex",
      executionReasoning: "medium",
      sidecarModel: config.models.sidecar.model,
      sidecarReasoning: config.models.sidecar.reasoningEffort,
      verifierModel: config.models.verifier.model,
      verifierReasoning: config.models.verifier.reasoningEffort,
      realtimeModel: "gpt-5.3-codex-spark",
      realtimeReasoning: "low"
    };

    expect(globalBody).toContain("# User notes");
    expect(globalBody).toContain(SANE_GLOBAL_AGENTS_BEGIN);
    expect(globalBody).toContain(SANE_GLOBAL_AGENTS_END);
    expect(globalBody).toContain(
      createSaneGlobalAgentsOverlay(
        {
          caveman: false,
          cavemem: false,
          rtk: true,
          frontendCraft: false
        },
        roles
      )
    );
    expect(repoBody).toContain("# Repo notes");
    expect(repoBody).toContain(SANE_REPO_AGENTS_BEGIN);
    expect(repoBody).toContain(SANE_REPO_AGENTS_END);
    expect(repoBody).toContain(
      createSaneRepoAgentsOverlay(
        {
          caveman: false,
          cavemem: false,
          rtk: true,
          frontendCraft: false
        },
        roles
      )
    );
    expect(repoBody).toContain("Prefer repo-local truth over generic memory or stale chat context");
    expect(repoBody).not.toBe(globalBody);

    const inventory = inspectCodexSkillsAndAgents(projectPaths, codexPaths);
    expect(inventory.find((item) => item.name === "repo-agents")?.status).toBe(
      InventoryStatus.Installed
    );

    const uninstallGlobal = uninstallGlobalAgents(codexPaths);
    const uninstallRepo = uninstallRepoAgents(projectPaths);

    expect(uninstallGlobal.summary).toBe("uninstall global-agents: removed managed block");
    expect(uninstallRepo.summary).toBe("uninstall repo-agents: removed managed block");
    expect(readFileSync(codexPaths.globalAgentsMd, "utf8")).toBe("# User notes\n");
    expect(readFileSync(projectPaths.repoAgentsMd, "utf8")).toBe("# Repo notes\n");
  });

  it("uninstalls repo and user skills including optional pack skills", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.cavemem = true;
    writeLocalConfig(projectPaths.configPath, config);

    exportUserSkills(projectPaths, codexPaths);
    exportRepoSkills(projectPaths, codexPaths);

    const uninstallUser = uninstallUserSkills(codexPaths);
    const uninstallRepo = uninstallRepoSkills(projectPaths);

    expect(uninstallUser.summary).toBe("uninstall user-skills: removed sane-router");
    expect(uninstallRepo.summary).toBe("uninstall repo-skills: removed sane-router");
    expect(uninstallUser.pathsTouched.some((path) => path.endsWith("/sane-router"))).toBe(true);
    expect(uninstallRepo.pathsTouched.some((path) => path.endsWith("/sane-router"))).toBe(true);
  });

  it("uninstalls every generated skill directory for a multi-skill pack", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.frontendCraft = true;
    writeLocalConfig(projectPaths.configPath, config);

    exportUserSkills(projectPaths, codexPaths);
    const uninstallUser = uninstallUserSkills(codexPaths);

    expect(uninstallUser.pathsTouched).toEqual(
      expect.arrayContaining([
        join(codexPaths.userSkillsDir, "design-taste-frontend"),
        join(codexPaths.userSkillsDir, "impeccable")
      ])
    );
  });

  it("inspects codex-native skills and agents inventory with expected statuses", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.globalAgentsMd, "# User notes only\n", "utf8");

    const inventory = inspectCodexSkillsAndAgents(projectPaths, codexPaths);

    expect(inventory.find((item) => item.name === "user-skills")?.status).toBe(
      InventoryStatus.Missing
    );
    expect(inventory.find((item) => item.name === "repo-skills")?.status).toBe(
      InventoryStatus.Disabled
    );
    expect(inventory.find((item) => item.name === "repo-agents")?.status).toBe(
      InventoryStatus.Disabled
    );
    expect(inventory.find((item) => item.name === "global-agents")?.status).toBe(
      InventoryStatus.PresentWithoutSaneBlock
    );
  });
});
