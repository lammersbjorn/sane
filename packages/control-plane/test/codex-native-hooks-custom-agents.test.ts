import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDefaultLocalConfig,
  writeLocalConfig
} from "@sane/config";
import { InventoryStatus } from "@sane/core";
import {
  createSaneAgentTemplateWithPacks,
  createSaneExplorerAgentTemplateWithPacks,
  createSaneImplementationAgentTemplateWithPacks,
  createSaneRealtimeAgentTemplateWithPacks,
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
  MANAGED_SESSION_END_STATUS_MESSAGE,
  MANAGED_SESSION_START_STATUS_MESSAGE,
  buildManagedSessionEndHookCommand,
  isManagedSessionStartHookCommand
} from "../src/session-start-hook.js";
import {
  MANAGED_TOKSCALE_STATUS_MESSAGE,
  buildManagedTokscaleSubmitHookCommand
} from "../src/tokscale-submit-hook.js";

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
      frontendCraft: false
    };

    expect(result.summary).toContain("installed Sane custom agents");
    expect(readFileSync(agentPath, "utf8")).toBe(
      createSaneAgentTemplateWithPacks(roles, packs)
    );
    expect(readFileSync(reviewerPath, "utf8")).toBe(
      createSaneReviewerAgentTemplateWithPacks(roles, packs)
    );
    expect(readFileSync(explorerPath, "utf8")).toBe(
      createSaneExplorerAgentTemplateWithPacks(roles, packs)
    );
    expect(readFileSync(implementationPath, "utf8")).toBe(
      createSaneImplementationAgentTemplateWithPacks(roles, packs)
    );
    expect(readFileSync(realtimePath, "utf8")).toBe(
      createSaneRealtimeAgentTemplateWithPacks(roles, packs)
    );
    expect(inspectCustomAgentsInventory(projectPaths, codexPaths).status).toBe(
      InventoryStatus.Installed
    );
    expect(result.details).toContain(
      "role defaults: coordinator->sane-agent, verifier->sane-reviewer, explorer->sane-explorer, implementation->sane-implementation, realtime->sane-realtime"
    );
    expect(readFileSync(agentPath, "utf8")).toContain(
      "Caveman pack active"
    );
    expect(readFileSync(agentPath, "utf8")).toContain(
      "repo AGENTS.md and repo-local skills can override Sane defaults"
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

  it("exports hooks additively and uninstalls only the managed hook", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.caveman = true;
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

    const exportResult = exportHooks(projectPaths, codexPaths);
    const exportedBody = JSON.parse(readFileSync(hooksPath, "utf8"));

    expect(exportResult.summary).toBe("export hooks: installed managed SessionStart hook");
    expect(exportedBody.hooks.SessionStart).toHaveLength(2);
    const managedEntry = exportedBody.hooks.SessionStart.find((entry: any) =>
      Array.isArray(entry?.hooks) &&
      entry.hooks.some((hook: any) => isManagedSessionStartHookCommand(String(hook?.command ?? "")))
    );
    expect(managedEntry?.hooks?.[0]?.command).toContain("hook session-start");
    expect(managedEntry?.hooks?.[0]?.command).toContain("Read repo AGENTS.md if present");
    expect(managedEntry?.hooks?.[0]?.command).toContain("Use sane-router for Sane routing");
    expect(managedEntry?.hooks?.[0]?.command).toContain("load sane-agent-lanes");
    expect(managedEntry?.hooks?.[0]?.command).toContain("Caveman pack active:");
    expect(managedEntry?.hooks?.[0]?.command).toContain("RTK pack active:");
    expect(managedEntry?.hooks?.[0]?.command).toContain("sane-rtk");
    expect(managedEntry?.hooks?.[0]?.command).not.toContain("explorer gpt-5.1-codex-mini/low");
    expect(managedEntry?.hooks?.[0]?.command).not.toContain("Sane command lane:");
    expect(managedEntry?.hooks?.[0]?.command).not.toContain("Subagent/model routing summary:");
    expect(managedEntry?.hooks?.[0]?.command).not.toContain("Concrete skill routes:");
    expect(managedEntry?.hooks?.[0]?.command).not.toContain("sane-outcome-continuation");
    expect(managedEntry?.hooks?.[0]?.command).not.toContain("continue/SKILL.md");
    expect(managedEntry?.hooks?.[0]?.command.length).toBeLessThan(2200);
    expect(managedEntry?.hooks?.[0]?.statusMessage).toBe(MANAGED_SESSION_START_STATUS_MESSAGE);

    const uninstallResult = uninstallHooks(codexPaths);
    const uninstalledBody = JSON.parse(readFileSync(hooksPath, "utf8"));

    expect(uninstallResult.summary).toBe("uninstall hooks: removed managed lifecycle hooks");
    expect(uninstalledBody.hooks.SessionStart).toHaveLength(1);
    expect(JSON.stringify(uninstalledBody)).toContain("echo untouched");
  });

  it("repairs legacy managed hooks that depended on sane being on PATH", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.hooksJson, `${JSON.stringify({
      hooks: {
        SessionStart: [
          {
            matcher: "startup|resume",
            hooks: [
              {
                type: "command",
                command: "'sane' hook session-start",
                statusMessage: MANAGED_SESSION_START_STATUS_MESSAGE
              }
            ]
          }
        ]
      }
    }, null, 2)}\n`, "utf8");

    expect(inspectHooksInventory(projectPaths, codexPaths).status).toBe(InventoryStatus.Invalid);

    exportHooks(projectPaths, codexPaths);
    const exportedBody = JSON.parse(readFileSync(codexPaths.hooksJson, "utf8"));

    expect(exportedBody.hooks.SessionStart).toHaveLength(1);
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("hook session-start");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Read repo AGENTS.md if present");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Use sane-router for Sane routing");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("load sane-agent-lanes");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).not.toContain("sane-outcome-continuation");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).not.toBe("'sane' hook session-start");
    expect(inspectHooksInventory(projectPaths, codexPaths).status).toBe(InventoryStatus.Installed);
  });

  it("exports optional Tokscale only on SessionEnd", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.lifecycleHooks.tokscaleSubmit = true;
    config.lifecycleHooks.tokscaleDryRun = true;
    config.lifecycleHooks.rateLimitResume = true;
    writeLocalConfig(projectPaths.configPath, config);
    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    rmSync(codexPaths.hooksJson, { force: true });

    const exportResult = exportHooks(projectPaths, codexPaths);
    const exportedBody = JSON.parse(readFileSync(codexPaths.hooksJson, "utf8"));

    expect(exportResult.summary).toBe("export hooks: installed managed lifecycle hooks");
    expect(exportedBody.hooks.SessionStart).toHaveLength(1);
    expect(exportedBody.hooks.SessionEnd).toHaveLength(2);
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("hook session-start");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Read repo AGENTS.md if present");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Use sane-router for Sane routing");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).not.toContain("continue/SKILL.md");
    expect(exportedBody.hooks.SessionEnd[0].hooks[0].command).toBe(
      buildManagedSessionEndHookCommand(undefined, { rateLimitResume: true })
    );
    const tokscaleHook = exportedBody.hooks.SessionEnd.find((entry: any) =>
      Array.isArray(entry?.hooks)
      && entry.hooks.some((hook: any) => String(hook?.command ?? "").includes("hook tokscale-submit --event session-end"))
    );
    expect(tokscaleHook?.hooks?.[0]?.command).toBe(buildManagedTokscaleSubmitHookCommand("session-end", { dryRun: true }));
    expect(JSON.stringify(exportedBody)).toContain(MANAGED_SESSION_START_STATUS_MESSAGE);
    expect(JSON.stringify(exportedBody)).toContain(MANAGED_SESSION_END_STATUS_MESSAGE);
    expect(JSON.stringify(exportedBody)).toContain(MANAGED_TOKSCALE_STATUS_MESSAGE);
    expect(inspectHooksInventory(projectPaths, codexPaths).status).toBe(InventoryStatus.Installed);

    uninstallHooks(codexPaths);
    expect(existsSync(codexPaths.hooksJson)).toBe(false);
  });

  it("reports missing hook file and invalid hook json", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectHooksInventory(projectPaths, codexPaths).status).toBe(InventoryStatus.Missing);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.hooksJson, "{", "utf8");

    expect(inspectHooksInventory(projectPaths, codexPaths).status).toBe(InventoryStatus.Invalid);
  });

  it("blocks hook export when hooks.json has unexpected shape", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.hooksJson, `${JSON.stringify({
      hooks: {
        SessionStart: { invalid: true }
      }
    }, null, 2)}\n`, "utf8");

    const result = exportHooks(projectPaths, codexPaths);

    expect(result.summary).toBe("export hooks: blocked by unexpected hooks.json shape");
    expect(result.inventory[0]?.status).toBe(InventoryStatus.Invalid);
    expect(inspectHooksInventory(projectPaths, codexPaths).status).toBe(InventoryStatus.Invalid);
  });

  it("returns operation results for invalid hooks json on export and uninstall", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.hooksJson, "{", "utf8");

    const exportResult = exportHooks(projectPaths, codexPaths);
    const uninstallResult = uninstallHooks(codexPaths);

    expect(exportResult.summary).toBe("export hooks: blocked by invalid hooks JSON");
    expect(exportResult.inventory[0]?.status).toBe(InventoryStatus.Invalid);
    expect(uninstallResult.summary).toBe("uninstall hooks: blocked by invalid hooks JSON");
    expect(uninstallResult.inventory[0]?.status).toBe(InventoryStatus.Invalid);
  });

  it("marks hooks invalid on windows with a platform-specific repair hint", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const inventory = inspectHooksInventory(projectPaths, codexPaths, "windows");

    expect(inventory.status).toBe(InventoryStatus.Invalid);
    expect(inventory.repairHint).toBe(
      "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
    );
  });

  it("does not export hooks on native windows", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const result = exportHooks(projectPaths, codexPaths, "windows");

    expect(result.summary).toBe("export hooks: unavailable on native Windows");
    expect(result.inventory[0]?.status).toBe(InventoryStatus.Invalid);
    expect(result.inventory[0]?.repairHint).toBe(
      "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
    );
    expect(() => readFileSync(codexPaths.hooksJson, "utf8")).toThrow();
  });
});
