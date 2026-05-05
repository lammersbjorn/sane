import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  inspectHooksInventory
} from "../src/hooks-custom-agents.js";
import {
  MANAGED_SESSION_END_STATUS_MESSAGE,
  MANAGED_SESSION_START_STATUS_MESSAGE,
  buildManagedSessionEndHookCommand
} from "../src/session-start-hook.js";
import {
  MANAGED_TOKSCALE_STATUS_MESSAGE,
  buildManagedTokscaleSubmitHookCommand
} from "../src/tokscale-submit-hook.js";
import { makeTempDir } from "./hooks-custom-agents-test-utils.js";

describe("lifecycle and Tokscale hook compatibility", () => {
  it("executes inline managed SessionStart and Tokscale hooks without deployed .mjs runtime", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.lifecycleHooks.tokscaleSubmit = true;
    writeLocalConfig(projectPaths.configPath, config);
    mkdirSync(join(homeDir, ".codex"), { recursive: true });

    exportHooks(projectPaths, codexPaths);
    const exportedBody = JSON.parse(readFileSync(codexPaths.hooksJson, "utf8"));
    const sessionStartCommand = exportedBody.hooks.SessionStart[0].hooks[0].command;
    const tokscaleCommand = exportedBody.hooks.Stop.find((entry: any) =>
      Array.isArray(entry?.hooks)
      && entry.hooks.some((hook: any) => String(hook?.command ?? "").includes("hook tokscale-submit --event stop"))
    )?.hooks?.[0]?.command;

    expect(sessionStartCommand).toContain("hook session-start");
    expect(sessionStartCommand).not.toContain(".mjs");
    expect(tokscaleCommand).toContain("hook tokscale-submit --event stop");
    expect(tokscaleCommand).not.toContain(".mjs");

    const sessionStartOutput = execSync(sessionStartCommand, {
      encoding: "utf8",
      env: process.env,
      shell: "/bin/sh"
    });
    const tokscaleOutput = execSync(tokscaleCommand, {
      encoding: "utf8",
      env: { ...process.env, PATH: "" },
      shell: "/bin/sh"
    });

    expect(JSON.parse(sessionStartOutput)).toMatchObject({
      hookSpecificOutput: {
        hookEventName: "SessionStart"
      }
    });
    expect(typeof JSON.parse(sessionStartOutput).hookSpecificOutput.additionalContext).toBe("string");
    expect(JSON.parse(tokscaleOutput)).toEqual({});
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
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Before work: read repo AGENTS.md if present");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Load `sane-router` skill body");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("read that matching SKILL.md before acting");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Use subagents by default");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("load `sane-agent-lanes`");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("including follow-up implementation after research");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Sane obligation receipt:");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).not.toContain("sane-outcome-continuation");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).not.toBe("'sane' hook session-start");
    expect(inspectHooksInventory(projectPaths, codexPaths).status).toBe(InventoryStatus.Installed);
  });

  it("exports optional Tokscale only on Stop", () => {
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

    const exportResult = exportHooks(projectPaths, codexPaths);
    const exportedBody = JSON.parse(readFileSync(codexPaths.hooksJson, "utf8"));

    expect(exportResult.summary).toBe("export hooks: installed managed lifecycle and safety hooks");
    expect(exportedBody.hooks.SessionStart).toHaveLength(1);
    expect(exportedBody.hooks.Stop).toHaveLength(3);
    expect(exportedBody.hooks.SessionEnd).toBeUndefined();
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("hook session-start");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Before work: read repo AGENTS.md if present");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Load `sane-router` skill body");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("read that matching SKILL.md before acting");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Use subagents by default");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).toContain("Sane obligation receipt:");
    expect(exportedBody.hooks.SessionStart[0].hooks[0].command).not.toContain("continue/SKILL.md");
    expect(
      exportedBody.hooks.Stop.some((entry: any) =>
        Array.isArray(entry?.hooks)
        && entry.hooks.some((hook: any) =>
          String(hook?.command ?? "") === buildManagedSessionEndHookCommand(undefined, { rateLimitResume: true })
        )
      )
    ).toBe(true);
    const tokscaleHook = exportedBody.hooks.Stop.find((entry: any) =>
      Array.isArray(entry?.hooks)
      && entry.hooks.some((hook: any) => String(hook?.command ?? "").includes("hook tokscale-submit --event stop"))
    );
    expect(tokscaleHook?.hooks?.[0]?.command).toBe(buildManagedTokscaleSubmitHookCommand("stop", { dryRun: true }));
    expect(JSON.stringify(exportedBody)).toContain(MANAGED_SESSION_START_STATUS_MESSAGE);
    expect(JSON.stringify(exportedBody)).toContain(MANAGED_SESSION_END_STATUS_MESSAGE);
    expect(JSON.stringify(exportedBody)).toContain(MANAGED_TOKSCALE_STATUS_MESSAGE);
    expect(inspectHooksInventory(projectPaths, codexPaths).status).toBe(InventoryStatus.Installed);
  });

  it("repairs legacy managed SessionEnd lifecycle hooks onto Stop", () => {
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

    writeFileSync(codexPaths.hooksJson, `${JSON.stringify({
      hooks: {
        SessionStart: [],
        SessionEnd: [
          {
            hooks: [
              {
                type: "command",
                command: buildManagedSessionEndHookCommand(undefined, { rateLimitResume: true })
              }
            ]
          },
          {
            hooks: [
              {
                type: "command",
                command: buildManagedTokscaleSubmitHookCommand("stop", { dryRun: true }).replace("--event stop", "--event session-end")
              }
            ]
          }
        ]
      }
    }, null, 2)}\n`, "utf8");

    exportHooks(projectPaths, codexPaths);
    const exportedBody = JSON.parse(readFileSync(codexPaths.hooksJson, "utf8"));

    expect(exportedBody.hooks.SessionEnd).toBeUndefined();
    expect(exportedBody.hooks.Stop).toHaveLength(3);
    expect(JSON.stringify(exportedBody.hooks.Stop)).toContain("hook tokscale-submit --event stop");
  });

  it("replaces old managed Tokscale Stop hooks instead of duplicating them", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.lifecycleHooks.tokscaleSubmit = true;
    config.lifecycleHooks.tokscaleDryRun = true;
    writeLocalConfig(projectPaths.configPath, config);
    mkdirSync(join(homeDir, ".codex"), { recursive: true });

    const oldPlainTextTokscaleCommand = buildManagedTokscaleSubmitHookCommand("stop", { dryRun: false })
      .replace("process.stdout.write(JSON.stringify({}));", "process.stdout.write('old text');");

    writeFileSync(codexPaths.hooksJson, `${JSON.stringify({
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: oldPlainTextTokscaleCommand,
                statusMessage: MANAGED_TOKSCALE_STATUS_MESSAGE
              }
            ]
          }
        ]
      }
    }, null, 2)}\n`, "utf8");

    exportHooks(projectPaths, codexPaths);
    const exportedBody = JSON.parse(readFileSync(codexPaths.hooksJson, "utf8"));
    const tokscaleEntries = exportedBody.hooks.Stop.filter((entry: any) =>
      Array.isArray(entry?.hooks)
      && entry.hooks.some((hook: any) => String(hook?.command ?? "").includes("hook tokscale-submit --event stop"))
    );

    expect(tokscaleEntries).toHaveLength(1);
    expect(tokscaleEntries[0].hooks[0].command).toBe(buildManagedTokscaleSubmitHookCommand("stop", { dryRun: true }));
  });
});
