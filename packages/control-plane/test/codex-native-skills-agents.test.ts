import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig, writeLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/core";
import {
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_CONTINUE_SKILL_NAME,
  SANE_OUTCOME_CONTINUATION_SKILL_NAME,
  SANE_GLOBAL_AGENTS_BEGIN,
  SANE_GLOBAL_AGENTS_END,
  SANE_REPO_AGENTS_BEGIN,
  SANE_REPO_AGENTS_END,
  createOptionalPackSkill,
  createOptionalPackSkills,
  optionalPackSkillNames,
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
    config.subagents.explorer.model = "gpt-5.1-codex-mini";
    config.subagents.explorer.reasoningEffort = "low";
    config.subagents.implementation.model = "gpt-5.2";
    config.subagents.implementation.reasoningEffort = "high";
    config.subagents.verifier.model = "gpt-5.4";
    config.subagents.verifier.reasoningEffort = "xhigh";
    config.subagents.realtime.model = "gpt-5.3-codex-spark";
    config.subagents.realtime.reasoningEffort = "low";
    writeLocalConfig(projectPaths.configPath, config);

    const result = exportUserSkills(projectPaths, codexPaths);
    const routerPath = join(codexPaths.userSkillsDir, "sane-router", "SKILL.md");
    const bootstrapResearchPath = join(codexPaths.userSkillsDir, SANE_BOOTSTRAP_RESEARCH_SKILL_NAME, "SKILL.md");
    const agentLanesPath = join(codexPaths.userSkillsDir, SANE_AGENT_LANES_SKILL_NAME, "SKILL.md");
    const outcomeContinuationPath = join(codexPaths.userSkillsDir, SANE_OUTCOME_CONTINUATION_SKILL_NAME, "SKILL.md");
    const continuePath = join(codexPaths.userSkillsDir, SANE_CONTINUE_SKILL_NAME, "SKILL.md");
    const cavemanPath = join(codexPaths.userSkillsDir, "sane-caveman", "SKILL.md");

    expect(result.summary).toBe("export user-skills: installed core skills");
    expect(result.pathsTouched).toContain(routerPath);
    expect(result.pathsTouched).toContain(bootstrapResearchPath);
    expect(result.pathsTouched).toContain(agentLanesPath);
    expect(result.pathsTouched).toContain(outcomeContinuationPath);
    expect(result.pathsTouched).toContain(continuePath);
    expect(result.pathsTouched).toContain(cavemanPath);
    expect(readFileSync(routerPath, "utf8")).toBe(
      createSaneRouterSkill(
        {
          caveman: true,
          rtk: false,
          frontendCraft: false,
          docsCraft: false
        },
        {
          coordinatorModel: config.models.coordinator.model,
          coordinatorReasoning: config.models.coordinator.reasoningEffort,
          executionModel: config.subagents.implementation.model,
          executionReasoning: config.subagents.implementation.reasoningEffort,
          sidecarModel: config.subagents.explorer.model,
          sidecarReasoning: config.subagents.explorer.reasoningEffort,
          verifierModel: config.subagents.verifier.model,
          verifierReasoning: config.subagents.verifier.reasoningEffort,
          realtimeModel: config.subagents.realtime.model,
          realtimeReasoning: config.subagents.realtime.reasoningEffort
        }
      )
    );
    expect(readFileSync(bootstrapResearchPath, "utf8")).toContain("name: sane-bootstrap-research");
    expect(readFileSync(agentLanesPath, "utf8")).toContain("name: sane-agent-lanes");
    expect(readFileSync(outcomeContinuationPath, "utf8")).toContain("name: sane-outcome-continuation");
    expect(readFileSync(continuePath, "utf8")).toContain("name: continue");
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

    expect(exportedSkills.map((skill) => skill.name)).toEqual(optionalPackSkillNames("frontend-craft"));
    expect(skillPaths).toEqual(
      optionalPackSkillNames("frontend-craft").map((name) =>
        join(codexPaths.userSkillsDir, name, "SKILL.md")
      )
    );
    expect(result.pathsTouched).toEqual(expect.arrayContaining(skillPaths));
    for (const [index, skill] of exportedSkills.entries()) {
      expect(readFileSync(skillPaths[index]!, "utf8")).toBe(skill.content);
    }
    expect(readFileSync(join(codexPaths.userSkillsDir, "sane-frontend-craft", "SKILL.md"), "utf8")).toContain(
      "Build frontend work that fits the product"
    );
    expect(readFileSync(join(codexPaths.userSkillsDir, "sane-frontend-visual-assets", "SKILL.md"), "utf8")).toContain(
      "Choose, generate, or direct visual assets"
    );
    expect(readFileSync(join(codexPaths.userSkillsDir, "sane-frontend-review", "SKILL.md"), "utf8")).toContain(
      "Use the strongest available visual tool"
    );
  });

  it("exports AGENTS blocks additively and uninstalls them without removing user content", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.rtk = true;
    config.subagents.explorer.model = "gpt-5.1-codex-mini";
    config.subagents.explorer.reasoningEffort = "low";
    config.subagents.implementation.model = "gpt-5.2";
    config.subagents.implementation.reasoningEffort = "high";
    config.subagents.verifier.model = "gpt-5.4";
    config.subagents.verifier.reasoningEffort = "xhigh";
    config.subagents.realtime.model = "gpt-5.3-codex-spark";
    config.subagents.realtime.reasoningEffort = "low";
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
      executionModel: config.subagents.implementation.model,
      executionReasoning: config.subagents.implementation.reasoningEffort,
      sidecarModel: config.subagents.explorer.model,
      sidecarReasoning: config.subagents.explorer.reasoningEffort,
      verifierModel: config.subagents.verifier.model,
      verifierReasoning: config.subagents.verifier.reasoningEffort,
      realtimeModel: config.subagents.realtime.model,
      realtimeReasoning: config.subagents.realtime.reasoningEffort
    };

    expect(globalBody).toContain("# User notes");
    expect(globalBody).toContain(SANE_GLOBAL_AGENTS_BEGIN);
    expect(globalBody).toContain(SANE_GLOBAL_AGENTS_END);
    expect(globalBody).toContain(
      createSaneGlobalAgentsOverlay(
        {
          caveman: false,
          rtk: true,
          frontendCraft: false,
          docsCraft: false
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
          rtk: true,
          frontendCraft: false,
          docsCraft: false
        },
        roles
      )
    );
    expect(repoBody).toContain("Prefer repo-local evidence over memory or stale chat context.");
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
    config.packs.caveman = true;
    writeLocalConfig(projectPaths.configPath, config);

    exportUserSkills(projectPaths, codexPaths);
    exportRepoSkills(projectPaths, codexPaths);

    const uninstallUser = uninstallUserSkills(codexPaths);
    const uninstallRepo = uninstallRepoSkills(projectPaths);

    expect(uninstallUser.summary).toBe("uninstall user-skills: removed core skills");
    expect(uninstallRepo.summary).toBe("uninstall repo-skills: removed core skills");
    expect(uninstallUser.pathsTouched.some((path) => path.endsWith("/sane-router"))).toBe(true);
    expect(uninstallUser.pathsTouched.some((path) => path.endsWith(`/${SANE_BOOTSTRAP_RESEARCH_SKILL_NAME}`))).toBe(true);
    expect(uninstallUser.pathsTouched.some((path) => path.endsWith(`/${SANE_AGENT_LANES_SKILL_NAME}`))).toBe(true);
    expect(uninstallUser.pathsTouched.some((path) => path.endsWith(`/${SANE_OUTCOME_CONTINUATION_SKILL_NAME}`))).toBe(true);
    expect(uninstallUser.pathsTouched.some((path) => path.endsWith(`/${SANE_CONTINUE_SKILL_NAME}`))).toBe(true);
    expect(uninstallRepo.pathsTouched.some((path) => path.endsWith("/sane-router"))).toBe(true);
    expect(uninstallRepo.pathsTouched.some((path) => path.endsWith(`/${SANE_BOOTSTRAP_RESEARCH_SKILL_NAME}`))).toBe(true);
    expect(uninstallRepo.pathsTouched.some((path) => path.endsWith(`/${SANE_AGENT_LANES_SKILL_NAME}`))).toBe(true);
    expect(uninstallRepo.pathsTouched.some((path) => path.endsWith(`/${SANE_OUTCOME_CONTINUATION_SKILL_NAME}`))).toBe(true);
    expect(uninstallRepo.pathsTouched.some((path) => path.endsWith(`/${SANE_CONTINUE_SKILL_NAME}`))).toBe(true);
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
        join(codexPaths.userSkillsDir, "sane-frontend-craft"),
        join(codexPaths.userSkillsDir, "sane-frontend-review")
      ])
    );
  });

  it("blocks exporting when target skill directory exists without Sane ownership marker", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const routerDir = join(codexPaths.userSkillsDir, "sane-router");
    mkdirSync(routerDir, { recursive: true });
    writeFileSync(join(routerDir, "SKILL.md"), "name: foreign-skill\n", "utf8");

    const result = exportUserSkills(projectPaths, codexPaths);

    expect(result.summary).toBe("export user-skills: blocked by non-Sane skill directories");
    expect(result.inventory[0]?.status).toBe(InventoryStatus.Invalid);
    expect(readFileSync(join(routerDir, "SKILL.md"), "utf8")).toBe("name: foreign-skill\n");
    expect(existsSync(join(routerDir, ".sane-owned"))).toBe(false);
  });

  it("preserves non-Sane optional skill directories on uninstall", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    exportUserSkills(projectPaths, codexPaths);

    const foreignDir = join(codexPaths.userSkillsDir, "sane-frontend-review");
    rmSync(foreignDir, { recursive: true, force: true });
    mkdirSync(foreignDir, { recursive: true });
    writeFileSync(join(foreignDir, "SKILL.md"), "name: foreign-frontend-review\n", "utf8");

    const uninstall = uninstallUserSkills(codexPaths);

    expect(uninstall.summary).toBe("uninstall user-skills: removed managed skills; preserved non-Sane directories");
    expect(uninstall.inventory[0]?.status).toBe(InventoryStatus.Invalid);
    expect(readFileSync(join(foreignDir, "SKILL.md"), "utf8")).toBe("name: foreign-frontend-review\n");
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

  it("marks skills invalid when the exported continue skill is missing", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportUserSkills(projectPaths, codexPaths);
    rmSync(join(codexPaths.userSkillsDir, SANE_CONTINUE_SKILL_NAME), { recursive: true, force: true });

    const inventory = inspectCodexSkillsAndAgents(projectPaths, codexPaths);

    expect(inventory.find((item) => item.name === "user-skills")?.status).toBe(
      InventoryStatus.Invalid
    );
  });
});
