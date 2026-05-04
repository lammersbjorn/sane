import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  createDefaultLocalConfig,
  writeLocalConfig
} from "@sane/config";
import { InventoryStatus } from "@sane/control-plane/core.js";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
import { describe, expect, it } from "vitest";

import {
  exportHooks,
  inspectHooksInventory,
  uninstallHooks
} from "../src/hooks-custom-agents.js";
import {
  MANAGED_SESSION_START_STATUS_MESSAGE,
  isManagedSessionStartHookCommand
} from "../src/session-start-hook.js";
import { makeTempDir } from "./hooks-custom-agents-test-utils.js";

describe("hook export and uninstall", () => {
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

    expect(exportResult.summary).toBe("export hooks: installed managed SessionStart, safety, and RTK hooks");
    expect(exportedBody.hooks.SessionStart).toHaveLength(2);
    expect(exportedBody.hooks.PreToolUse).toHaveLength(3);
    expect(exportedBody.hooks.Stop).toHaveLength(1);
    expect(exportedBody.hooks.PreToolUse[0].matcher).toBe("Bash");
    expect(JSON.stringify(exportedBody.hooks.PreToolUse)).toContain("hook command-safety-guard");
    expect(JSON.stringify(exportedBody.hooks.PreToolUse)).toContain("hook generated-surface-guard");
    expect(JSON.stringify(exportedBody.hooks.PreToolUse)).toContain("hook rtk-command");
    expect(JSON.stringify(exportedBody.hooks.Stop)).toContain("hook blocked-response-guard");
    const managedEntry = exportedBody.hooks.SessionStart.find((entry: any) =>
      Array.isArray(entry?.hooks) &&
      entry.hooks.some((hook: any) => isManagedSessionStartHookCommand(String(hook?.command ?? "")))
    );
    expect(managedEntry?.hooks?.[0]?.command).toContain("hook session-start");
    expect(managedEntry?.hooks?.[0]?.command).toContain("Before work: read repo AGENTS.md if present");
    expect(managedEntry?.hooks?.[0]?.command).toContain("Load `sane-router` skill body");
    expect(managedEntry?.hooks?.[0]?.command).toContain("read that matching SKILL.md before acting");
    expect(managedEntry?.hooks?.[0]?.command).toContain("Use subagents by default");
    expect(managedEntry?.hooks?.[0]?.command).toContain("load `sane-agent-lanes`");
    expect(managedEntry?.hooks?.[0]?.command).toContain("including follow-up implementation after research");
    expect(managedEntry?.hooks?.[0]?.command).toContain("before broad edits");
    expect(managedEntry?.hooks?.[0]?.command).toContain("Sane obligation receipt:");
    expect(managedEntry?.hooks?.[0]?.command).toContain("blocked_handoff=report blocker + ask once + wait");
    expect(managedEntry?.hooks?.[0]?.command).toContain("caveman:");
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
    expect(uninstalledBody.hooks.PreToolUse).toBeUndefined();
    expect(uninstalledBody.hooks.Stop).toBeUndefined();
    expect(JSON.stringify(uninstalledBody)).toContain("echo untouched");
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

  it("removes hooks.json when uninstall leaves no unmanaged hooks", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    mkdirSync(join(homeDir, ".codex"), { recursive: true });

    exportHooks(projectPaths, codexPaths);
    uninstallHooks(codexPaths);

    expect(existsSync(codexPaths.hooksJson)).toBe(false);
  });
});
