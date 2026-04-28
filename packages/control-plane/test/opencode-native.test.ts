import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

    expect(results).toHaveLength(3);
    expect(results.map((result) => result.summary)).toEqual([
      "export opencode-skills: installed core skills",
      "export opencode-global-agents: installed managed block",
      "export opencode-agents: installed Sane OpenCode agents"
    ]);

    const opencodeRoot = join(homeDir, ".config", "opencode");
    expect(existsSync(join(opencodeRoot, "skills", "sane-router", "SKILL.md"))).toBe(true);
    expect(readFileSync(join(opencodeRoot, "AGENTS.md"), "utf8")).toContain(
      "<!-- sane:global-agents:start -->"
    );

    const agentBody = readFileSync(join(opencodeRoot, "agents", "sane-agent.md"), "utf8");
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
      InventoryStatus.Installed
    ]);
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
      "uninstall opencode-agents: removed Sane OpenCode agents"
    ]);
    expect(existsSync(join(opencodeRoot, "skills", "sane-router"))).toBe(false);
    expect(existsSync(join(opencodeRoot, "agents", "sane-agent.md"))).toBe(false);
    expect(existsSync(join(opencodeRoot, "AGENTS.md"))).toBe(false);
  });

  it("does not export Tokscale for OpenCode because OpenCode has no SessionEnd hook surface", () => {
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
});
