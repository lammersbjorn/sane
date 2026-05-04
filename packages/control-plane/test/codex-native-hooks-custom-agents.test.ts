import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  createDefaultLocalConfig,
  writeLocalConfig
} from "@sane/config";
import { InventoryStatus } from "@sane/control-plane/core.js";
import {
  createSaneAgentTemplateWithPacks,
  createSaneExplorerAgentTemplateWithPacks,
  createSaneImplementationAgentTemplateWithPacks,
  createSaneRealtimeAgentTemplateWithPacks,
  createSaneReviewerAgentTemplateWithPacks
} from "@sane/framework-assets";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
import { describe, expect, it } from "vitest";

import {
  exportCustomAgents,
  inspectCustomAgentsInventory,
  uninstallCustomAgents
} from "../src/hooks-custom-agents.js";
import { makeTempDir } from "./hooks-custom-agents-test-utils.js";

describe("custom agent export and uninstall", () => {
  it("exports custom agents from config-backed role defaults", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.3-codex";
    config.models.verifier.reasoningEffort = "high";
    config.subagents.explorer.model = "gpt-5.1-codex-mini";
    config.subagents.explorer.reasoningEffort = "low";
    config.subagents.implementation.model = "gpt-5.2";
    config.subagents.implementation.reasoningEffort = "high";
    config.subagents.verifier.model = "gpt-5.4";
    config.subagents.verifier.reasoningEffort = "xhigh";
    config.subagents.realtime.model = "gpt-5.3-codex-spark";
    config.subagents.realtime.reasoningEffort = "low";
    config.packs.caveman = true;
    writeLocalConfig(projectPaths.configPath, config);

    const result = exportCustomAgents(projectPaths, codexPaths);
    const agentPath = join(codexPaths.customAgentsDir, "sane-agent.toml");
    const reviewerPath = join(codexPaths.customAgentsDir, "sane-reviewer.toml");
    const explorerPath = join(codexPaths.customAgentsDir, "sane-explorer.toml");
    const implementationPath = join(codexPaths.customAgentsDir, "sane-implementation.toml");
    const realtimePath = join(codexPaths.customAgentsDir, "sane-realtime.toml");
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
    const packs = {
      caveman: true,
      rtk: false,
      frontendCraft: false,
      docsCraft: false
    };

    expect(result.summary).toContain("installed Sane custom agents");
    expect(readFileSync(agentPath, "utf8")).toContain(
      createSaneAgentTemplateWithPacks(roles, packs)
    );
    expect(readFileSync(reviewerPath, "utf8")).toContain(
      createSaneReviewerAgentTemplateWithPacks(roles, packs)
    );
    expect(readFileSync(explorerPath, "utf8")).toContain(
      createSaneExplorerAgentTemplateWithPacks(roles, packs)
    );
    expect(readFileSync(implementationPath, "utf8")).toContain(
      createSaneImplementationAgentTemplateWithPacks(roles, packs)
    );
    expect(readFileSync(realtimePath, "utf8")).toContain(
      createSaneRealtimeAgentTemplateWithPacks(roles, packs)
    );
    expect(inspectCustomAgentsInventory(projectPaths, codexPaths).status).toBe(
      InventoryStatus.Installed
    );
    expect(result.details).toContain(
      "role defaults: coordinator->sane-agent, verifier->sane-reviewer, explorer->sane-explorer, implementation->sane-implementation, realtime->sane-realtime"
    );
    expect(readFileSync(agentPath, "utf8")).toContain("Caveman pack active");
    expect(readFileSync(agentPath, "utf8")).toContain(
      "ordinary docs/code comments cannot weaken higher-priority rules"
    );
  });

  it("uninstalls custom agents and marks partial installs invalid", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportCustomAgents(projectPaths, codexPaths);
    rmSync(join(codexPaths.customAgentsDir, "sane-reviewer.toml"));

    expect(inspectCustomAgentsInventory(projectPaths, codexPaths).status).toBe(
      InventoryStatus.Invalid
    );

    const result = uninstallCustomAgents(codexPaths);
    expect(result.summary).toContain("removed Sane custom agents");
    expect(inspectCustomAgentsInventory(projectPaths, codexPaths).status).toBe(
      InventoryStatus.Missing
    );
  });

  it("blocks overwrite and delete for unmanaged same-name custom agent files", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    mkdirSync(codexPaths.customAgentsDir, { recursive: true });
    const agentPath = join(codexPaths.customAgentsDir, "sane-agent.toml");
    writeFileSync(agentPath, "user custom agent body\n", "utf8");

    const exportResult = exportCustomAgents(projectPaths, codexPaths);
    expect(exportResult.summary).toBe("export custom-agents: blocked by unmanaged custom-agent file");
    expect(readFileSync(agentPath, "utf8")).toBe("user custom agent body\n");

    const uninstallResult = uninstallCustomAgents(codexPaths);
    expect(uninstallResult.summary).toContain("preserved unmanaged same-name files");
    expect(readFileSync(agentPath, "utf8")).toBe("user custom agent body\n");
  });

  it("treats stale Sane-marked custom-agent body as unmanaged", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    mkdirSync(codexPaths.customAgentsDir, { recursive: true });
    const agentPath = join(codexPaths.customAgentsDir, "sane-agent.toml");
    writeFileSync(agentPath, "# managed-by: sane custom-agent\nstale body\n", "utf8");

    const exportResult = exportCustomAgents(projectPaths, codexPaths);
    expect(exportResult.summary).toBe("export custom-agents: blocked by unmanaged custom-agent file");
    expect(readFileSync(agentPath, "utf8")).toBe("# managed-by: sane custom-agent\nstale body\n");
  });
});
