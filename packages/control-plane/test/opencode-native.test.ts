import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InventoryStatus } from "@sane/core";
import {
  createSaneOpencodeAgentTemplate,
  createSaneOpencodeExplorerAgentTemplate,
  createSaneOpencodeReviewerAgentTemplate
} from "@sane/framework-assets";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  exportOpencodeAgents,
  inspectOpencodeAgentsInventory,
  uninstallOpencodeAgents
} from "../src/opencode-native.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-opencode-agents-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("opencode agents", () => {
  it("exports optional global opencode agents from config-backed role defaults", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const result = exportOpencodeAgents(projectPaths, codexPaths);
    const agentPath = join(codexPaths.opencodeGlobalAgentsDir, "sane-agent.md");
    const reviewerPath = join(codexPaths.opencodeGlobalAgentsDir, "sane-reviewer.md");
    const explorerPath = join(codexPaths.opencodeGlobalAgentsDir, "sane-explorer.md");

    expect(result.summary).toContain("installed sane-agent, sane-reviewer, and sane-explorer");
    expect(readFileSync(agentPath, "utf8")).toBe(
      createSaneOpencodeAgentTemplate({
        coordinatorModel: "gpt-5.4",
        coordinatorReasoning: "high",
        sidecarModel: "gpt-5.4-mini",
        sidecarReasoning: "medium",
        verifierModel: "gpt-5.4",
        verifierReasoning: "medium"
      })
    );
    expect(readFileSync(reviewerPath, "utf8")).toBe(
      createSaneOpencodeReviewerAgentTemplate({
        coordinatorModel: "gpt-5.4",
        coordinatorReasoning: "high",
        sidecarModel: "gpt-5.4-mini",
        sidecarReasoning: "medium",
        verifierModel: "gpt-5.4",
        verifierReasoning: "medium"
      })
    );
    expect(readFileSync(explorerPath, "utf8")).toBe(
      createSaneOpencodeExplorerAgentTemplate({
        coordinatorModel: "gpt-5.4",
        coordinatorReasoning: "high",
        sidecarModel: "gpt-5.4-mini",
        sidecarReasoning: "medium",
        verifierModel: "gpt-5.4",
        verifierReasoning: "medium"
      })
    );
    expect(inspectOpencodeAgentsInventory(projectPaths, codexPaths).status).toBe(
      InventoryStatus.Installed
    );
    expect(result.details).toContain(
      "optional compatibility surface only; not part of Sane's default Codex install bundle"
    );
  });

  it("uninstalls opencode agents and marks partial installs invalid", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportOpencodeAgents(projectPaths, codexPaths);
    rmSync(join(codexPaths.opencodeGlobalAgentsDir, "sane-reviewer.md"));

    expect(inspectOpencodeAgentsInventory(projectPaths, codexPaths).status).toBe(
      InventoryStatus.Invalid
    );

    const result = uninstallOpencodeAgents(codexPaths);
    expect(result.summary).toContain("removed sane-agent, sane-reviewer, and sane-explorer");
    expect(inspectOpencodeAgentsInventory(projectPaths, codexPaths).status).toBe(
      InventoryStatus.Missing
    );
  });
});
