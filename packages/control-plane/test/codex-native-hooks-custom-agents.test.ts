import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDefaultLocalConfig,
  createRecommendedModelRoutingPresets,
  detectCodexEnvironment,
  writeLocalConfig
} from "@sane/config";
import { InventoryStatus } from "@sane/core";
import {
  createSaneAgentTemplateWithPacks,
  createSaneExplorerAgentTemplateWithPacks,
  createSaneReviewerAgentTemplateWithPacks
} from "@sane/framework-assets";
import { createProjectPaths, createCodexPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import {
  exportCustomAgents,
  exportHooks,
  inspectCustomAgentsInventory,
  inspectHooksInventory,
  uninstallCustomAgents,
  uninstallHooks
} from "../src/hooks-custom-agents.js";
import {
  MANAGED_SESSION_START_STATUS_MESSAGE,
  buildManagedSessionStartHookCommand,
  isManagedSessionStartHookCommand
} from "../src/session-start-hook.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-hooks-agents-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("hooks and custom agents", () => {
  it("exports custom agents from config-backed role defaults", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.3-codex";
    config.models.verifier.reasoningEffort = "high";
    config.packs.caveman = true;
    writeLocalConfig(projectPaths.configPath, config);

    const result = exportCustomAgents(projectPaths, codexPaths);
    const routing = createRecommendedModelRoutingPresets(
      detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson)
    );
    const agentPath = join(codexPaths.customAgentsDir, "sane-agent.toml");
    const reviewerPath = join(codexPaths.customAgentsDir, "sane-reviewer.toml");
    const explorerPath = join(codexPaths.customAgentsDir, "sane-explorer.toml");

    expect(result.summary).toContain("installed sane-agent, sane-reviewer, and sane-explorer");
    expect(readFileSync(agentPath, "utf8")).toBe(
      createSaneAgentTemplateWithPacks({
        coordinatorModel: config.models.coordinator.model,
        coordinatorReasoning: config.models.coordinator.reasoningEffort,
        sidecarModel: config.models.sidecar.model,
        sidecarReasoning: config.models.sidecar.reasoningEffort,
        verifierModel: config.models.verifier.model,
        verifierReasoning: config.models.verifier.reasoningEffort
      }, {
        caveman: true,
        rtk: false,
        frontendCraft: false
      })
    );
    expect(readFileSync(reviewerPath, "utf8")).toBe(
      createSaneReviewerAgentTemplateWithPacks({
        coordinatorModel: config.models.coordinator.model,
        coordinatorReasoning: config.models.coordinator.reasoningEffort,
        sidecarModel: config.models.sidecar.model,
        sidecarReasoning: config.models.sidecar.reasoningEffort,
        verifierModel: config.models.verifier.model,
        verifierReasoning: config.models.verifier.reasoningEffort
      }, {
        caveman: true,
        rtk: false,
        frontendCraft: false
      })
    );
    expect(readFileSync(explorerPath, "utf8")).toBe(
      createSaneExplorerAgentTemplateWithPacks({
        coordinatorModel: config.models.coordinator.model,
        coordinatorReasoning: config.models.coordinator.reasoningEffort,
        sidecarModel: config.models.sidecar.model,
        sidecarReasoning: config.models.sidecar.reasoningEffort,
        verifierModel: config.models.verifier.model,
        verifierReasoning: config.models.verifier.reasoningEffort
      }, {
        caveman: true,
        rtk: false,
        frontendCraft: false
      })
    );
    expect(inspectCustomAgentsInventory(projectPaths, codexPaths).status).toBe(
      InventoryStatus.Installed
    );
    expect(result.details).toContain(
      "editable role defaults: coordinator->sane-agent, verifier->sane-reviewer, sidecar->sane-explorer"
    );
    expect(result.details).toContain(
      `derived routing classes: execution=${routing.execution.model} (${routing.execution.reasoningEffort}), realtime=${routing.realtime.model} (${routing.realtime.reasoningEffort}); not encoded in single-model custom-agent toml`
    );
    expect(readFileSync(agentPath, "utf8")).toContain(
      "always use terse, token-efficient prose for normal narrative output"
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
    expect(result.summary).toContain("removed sane-agent, sane-reviewer, and sane-explorer");
    expect(inspectCustomAgentsInventory(projectPaths, codexPaths).status).toBe(
      InventoryStatus.Missing
    );
  });

  it("exports hooks additively and uninstalls only the managed hook", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    const hooksPath = codexPaths.hooksJson;
    const initial = {
      hooks: {
        SessionStart: [
          {
            matcher: "other",
            hooks: [
              {
                type: "command",
                command: "echo untouched"
              }
            ]
          }
        ]
      }
    };
    rmSync(hooksPath, { force: true });
    writeFileSync(hooksPath, `${JSON.stringify(initial, null, 2)}\n`, "utf8");

    const exportResult = exportHooks(codexPaths);
    const exportedBody = JSON.parse(readFileSync(hooksPath, "utf8"));

    expect(exportResult.summary).toBe("export hooks: installed managed SessionStart hook");
    expect(exportedBody.hooks.SessionStart).toHaveLength(2);
    const managedEntry = exportedBody.hooks.SessionStart.find((entry: any) =>
      Array.isArray(entry?.hooks) &&
      entry.hooks.some((hook: any) => isManagedSessionStartHookCommand(String(hook?.command ?? "")))
    );
    expect(managedEntry?.hooks?.[0]?.command).toBe(buildManagedSessionStartHookCommand());
    expect(managedEntry?.hooks?.[0]?.statusMessage).toBe(MANAGED_SESSION_START_STATUS_MESSAGE);

    const uninstallResult = uninstallHooks(codexPaths);
    const uninstalledBody = JSON.parse(readFileSync(hooksPath, "utf8"));

    expect(uninstallResult.summary).toBe("uninstall hooks: removed managed SessionStart hook");
    expect(uninstalledBody.hooks.SessionStart).toHaveLength(1);
    expect(JSON.stringify(uninstalledBody)).toContain("echo untouched");
  });

  it("reports missing hook file and invalid hook json", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectHooksInventory(codexPaths).status).toBe(InventoryStatus.Missing);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.hooksJson, "{", "utf8");

    expect(inspectHooksInventory(codexPaths).status).toBe(InventoryStatus.Invalid);
  });

  it("marks hooks invalid on windows with a platform-specific repair hint", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);
    const inventory = inspectHooksInventory(codexPaths, "windows");

    expect(inventory.status).toBe(InventoryStatus.Invalid);
    expect(inventory.repairHint).toBe(
      "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
    );
  });

  it("does not export hooks on native windows", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    const result = exportHooks(codexPaths, "windows");

    expect(result.summary).toBe("export hooks: unavailable on native Windows");
    expect(result.inventory[0]?.status).toBe(InventoryStatus.Invalid);
    expect(result.inventory[0]?.repairHint).toBe(
      "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
    );
    expect(() => readFileSync(codexPaths.hooksJson, "utf8")).toThrow();
  });
});
