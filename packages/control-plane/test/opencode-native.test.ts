import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/core";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { saveConfig } from "../src/preferences.js";
import {
  exportOpencodeCoreBundle,
  inspectOpencodeAgentsInventory,
  inspectOpencodeCoreInventory,
  uninstallOpencodeCoreBundle
} from "../src/opencode-native.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-opencode-native-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("opencode native installer", () => {
  it("exports full opencode bundle with cost-aware OpenCode Go model mapping", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.5";
    config.subagents.explorer.model = "gpt-5.4-mini";
    config.subagents.verifier.model = "gpt-5.5";
    config.subagents.implementation.model = "gpt-5.3-codex";
    config.subagents.realtime.model = "gpt-5.3-codex-spark";
    config.packs.caveman = true;
    config.packs.rtk = true;
    saveConfig(paths, config);

    const results = exportOpencodeCoreBundle(paths, codexPaths);

    expect(results).toHaveLength(4);
    expect(results.map((result) => result.summary)).toEqual([
      "export opencode-skills: installed core skills",
      "export opencode-global-agents: installed managed block",
      "export opencode-session-start: installed Sane start plugin",
      "export opencode-agents: installed Sane OpenCode agents"
    ]);

    const opencodeRoot = join(homeDir, ".config", "opencode");
    expect(existsSync(join(opencodeRoot, "skills", "sane-router", "SKILL.md"))).toBe(true);
    expect(readFileSync(join(opencodeRoot, "AGENTS.md"), "utf8")).toContain(
      "<!-- sane:global-agents:start -->"
    );
    const pluginBody = readFileSync(
      join(opencodeRoot, "plugins", "sane-session-start.js"),
      "utf8"
    );
    expect(pluginBody).toContain("experimental.chat.system.transform");
    expect(pluginBody).toContain("tool.definition");
    expect(pluginBody).toContain("tool.execute.before");
    expect(pluginBody).toContain("Sane RTK guard: raw bash blocked");
    expect(pluginBody).toContain("Load `sane-router` skill body");
    expect(pluginBody).toContain("Use subagents by default");
    expect(pluginBody).toContain("load `sane-agent-lanes`");
    expect(pluginBody).toContain("call the `task` tool");
    expect(pluginBody).toContain("load `sane-caveman` skill body");
    expect(pluginBody).toContain("load `sane-rtk` skill body");
    expect(JSON.parse(readFileSync(join(opencodeRoot, "opencode.json"), "utf8")).plugin).toContain(
      join(opencodeRoot, "plugins", "sane-session-start.js")
    );

    const agentBody = readFileSync(join(opencodeRoot, "agents", "sane-agent.md"), "utf8");
    expect(agentBody).toMatch(/^---\n/);
    expect(agentBody).toContain("<!-- managed-by: sane opencode-agent -->");
    expect(agentBody).toContain("model: opencode-go/glm-5.1");
    expect(agentBody).not.toContain("kimi-k2.6");
    const explorerBody = readFileSync(join(opencodeRoot, "agents", "sane-explorer.md"), "utf8");
    expect(explorerBody).toContain("model: opencode-go/qwen3.6-plus");
    expect(explorerBody).toContain("permission:");
    expect(explorerBody).toContain("edit: deny");
    const implementationBody = readFileSync(
      join(opencodeRoot, "agents", "sane-implementation.md"),
      "utf8"
    );
    expect(implementationBody).toContain("model: opencode-go/glm-5.1");
    const reviewerBody = readFileSync(join(opencodeRoot, "agents", "sane-reviewer.md"), "utf8");
    expect(reviewerBody).toContain("model: opencode-go/deepseek-v4-pro");
    const realtimeBody = readFileSync(join(opencodeRoot, "agents", "sane-realtime.md"), "utf8");
    expect(realtimeBody).toContain("model: opencode-go/deepseek-v4-flash");

    expect(inspectOpencodeCoreInventory(paths, codexPaths).map((item) => item.status)).toEqual([
      InventoryStatus.Installed,
      InventoryStatus.Installed,
      InventoryStatus.Installed,
      InventoryStatus.Installed
    ]);
  });

  it("preserves existing opencode plugins when adding Sane start plugin", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const opencodeRoot = join(homeDir, ".config", "opencode");
    mkdirSync(opencodeRoot, { recursive: true });
    writeFileSync(
      join(opencodeRoot, "opencode.json"),
      `${JSON.stringify({
        $schema: "https://opencode.ai/config.json",
        autoupdate: true,
        plugin: ["@warp-dot-dev/opencode-warp"]
      }, null, 2)}\n`
    );

    exportOpencodeCoreBundle(paths, codexPaths);

    expect(JSON.parse(readFileSync(join(opencodeRoot, "opencode.json"), "utf8"))).toMatchObject({
      $schema: "https://opencode.ai/config.json",
      autoupdate: true,
      plugin: [
        "@warp-dot-dev/opencode-warp",
        join(opencodeRoot, "plugins", "sane-session-start.js")
      ]
    });
  });

  it("reports invalid when one managed opencode agent drifts", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportOpencodeCoreBundle(paths, codexPaths);
    rmSync(join(homeDir, ".config", "opencode", "agents", "sane-reviewer.md"), { force: true });

    expect(inspectOpencodeAgentsInventory(paths, codexPaths).status).toBe(InventoryStatus.Invalid);
  });

  it("blocks overwrite and delete for unmanaged same-name OpenCode agent files", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const agentsDir = join(homeDir, ".config", "opencode", "agents");
    mkdirSync(agentsDir, { recursive: true });
    const agentPath = join(agentsDir, "sane-agent.md");
    writeFileSync(agentPath, "user custom opencode agent\n", "utf8");

    const results = exportOpencodeCoreBundle(paths, codexPaths);
    expect(results[3]?.summary).toBe("export opencode-agents: blocked by unmanaged same-name agent file");
    expect(readFileSync(agentPath, "utf8")).toBe("user custom opencode agent\n");

    const uninstallResults = uninstallOpencodeCoreBundle(codexPaths);
    expect(uninstallResults[3]?.summary).toContain("preserved unmanaged same-name files");
    expect(readFileSync(agentPath, "utf8")).toBe("user custom opencode agent\n");
  });

  it("treats stale Sane-marked OpenCode agent body as unmanaged", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const agentsDir = join(homeDir, ".config", "opencode", "agents");
    mkdirSync(agentsDir, { recursive: true });
    const agentPath = join(agentsDir, "sane-agent.md");
    writeFileSync(agentPath, "---\nmode: subagent\n---\n<!-- managed-by: sane opencode-agent -->\nstale\n", "utf8");

    const results = exportOpencodeCoreBundle(paths, codexPaths);
    expect(results[3]?.summary).toBe("export opencode-agents: blocked by unmanaged same-name agent file");
    expect(readFileSync(agentPath, "utf8")).toBe(
      "---\nmode: subagent\n---\n<!-- managed-by: sane opencode-agent -->\nstale\n"
    );
  });

  it("uninstalls managed opencode bundle without touching unrelated state", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const opencodeRoot = join(homeDir, ".config", "opencode");

    exportOpencodeCoreBundle(paths, codexPaths);
    const results = uninstallOpencodeCoreBundle(codexPaths);

    expect(results.map((result) => result.summary)).toEqual([
      "uninstall opencode-skills: removed managed skills",
      "uninstall opencode-global-agents: removed managed block",
      "uninstall opencode-session-start: removed Sane start plugin",
      "uninstall opencode-agents: removed Sane OpenCode agents"
    ]);
    expect(existsSync(join(opencodeRoot, "skills", "sane-router"))).toBe(false);
    expect(existsSync(join(opencodeRoot, "agents", "sane-agent.md"))).toBe(false);
    expect(existsSync(join(opencodeRoot, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(opencodeRoot, "plugins", "sane-session-start.js"))).toBe(false);
  });

  it("uninstalls Sane start plugin without removing unrelated opencode plugins", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const opencodeRoot = join(homeDir, ".config", "opencode");
    mkdirSync(opencodeRoot, { recursive: true });
    writeFileSync(
      join(opencodeRoot, "opencode.json"),
      `${JSON.stringify({ plugin: ["@warp-dot-dev/opencode-warp"] }, null, 2)}\n`
    );

    exportOpencodeCoreBundle(paths, codexPaths);
    uninstallOpencodeCoreBundle(codexPaths);

    expect(JSON.parse(readFileSync(join(opencodeRoot, "opencode.json"), "utf8")).plugin).toEqual([
      "@warp-dot-dev/opencode-warp"
    ]);
  });

  it("does not export Tokscale for OpenCode because OpenCode has no compatible Stop hook surface", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const config = createDefaultLocalConfig();
    config.lifecycleHooks.tokscaleSubmit = true;
    saveConfig(paths, config);

    exportOpencodeCoreBundle(paths, codexPaths);

    expect(existsSync(join(homeDir, ".config", "opencode", "plugins", "sane-lifecycle.js"))).toBe(false);
  });

  it("blocks export/uninstall/inventory when opencode.json is invalid and preserves file", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const opencodeRoot = join(homeDir, ".config", "opencode");
    mkdirSync(opencodeRoot, { recursive: true });
    const opencodeJsonPath = join(opencodeRoot, "opencode.json");
    writeFileSync(opencodeJsonPath, "{", "utf8");

    const exportResults = exportOpencodeCoreBundle(paths, codexPaths);
    expect(exportResults[2]?.summary).toBe("export opencode-session-start: blocked by invalid opencode.json");
    expect(readFileSync(opencodeJsonPath, "utf8")).toBe("{");
    expect(existsSync(join(opencodeRoot, "plugins", "sane-session-start.js"))).toBe(false);

    const uninstallResults = uninstallOpencodeCoreBundle(codexPaths);
    expect(uninstallResults[2]?.summary).toBe("uninstall opencode-session-start: blocked by invalid opencode.json");
    expect(readFileSync(opencodeJsonPath, "utf8")).toBe("{");

    const inventory = inspectOpencodeCoreInventory(paths, codexPaths);
    expect(inventory[2]?.status).toBe(InventoryStatus.Invalid);
    expect(readFileSync(opencodeJsonPath, "utf8")).toBe("{");
  });
});
