import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { appendJsonlRecord, createDecisionRecord, stringifyDecisionRecord } from "@sane/state";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { applyCodexProfile } from "@sane/control-plane/codex-config.js";
import { exportHooks } from "@sane/control-plane/hooks-custom-agents.js";
import { installRuntime } from "@sane/control-plane";
import { saveConfig } from "@sane/control-plane/preferences.js";
import { inspectOverviewLines, loadInspectScreen } from "@/inspect-screen.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-tui-inspect-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("inspect screen model", () => {
  it("aggregates backend inspect surfaces for the TUI", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.caveman = true;

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    applyCodexProfile(paths, codexPaths);
    exportHooks(codexPaths);

    const screen = loadInspectScreen(paths, codexPaths);

    expect(screen.summary).toBe("Inspect");
    expect(screen.actions.map((action) => action.id)).toEqual([
      "show_status",
      "doctor",
      "show_runtime_summary",
      "show_config",
      "show_codex_config",
      "preview_integrations_profile",
      "preview_policy"
    ]);
    expect(screen.actions.map((action) => action.id)).not.toContain("apply_integrations_profile");
    expect(screen.statusBundle.inventory).toHaveLength(screen.status.inventory.length);
    expect(screen.statusBundle.primary.installBundle).toBe("missing");
    expect(screen.statusBundle.primary.runtime?.status.displayString()).toBe("installed");
    expect(screen.status.summary).toContain("managed targets inspected");
    expect(screen.doctor.summary).toContain("hooks: installed");
    expect(screen.runtimeSummary.summary).toContain("runtime-summary:");
    expect(screen.runtimeSummary.details.join("\n")).toContain("current-run:");
    expect(screen.localConfig.summary).toContain("config: ok");
    expect(screen.codexConfig.summary).toContain("codex-config: ok");
    expect(screen.integrationsPreview.summary).toContain("integrations-profile preview");
    expect(screen.integrationsPreview.details).toContain("context7: missing -> recommended");
    expect(screen.integrationsAudit.status).toBe("missing");
    expect(screen.integrationsAudit.recommendedChangeCount).toBe(3);
    expect(screen.integrationsAudit.recommendedTargets).toEqual(["context7", "playwright", "grep.app"]);
    expect(screen.runtimeHistory).toEqual({
      events: 0,
      decisions: 0,
      artifacts: 0
    });
    expect(screen.latestPolicyPreview).toEqual({
      status: "missing",
      scenarioCount: 0,
      scenarioIds: []
    });
    expect(screen.driftItems).toEqual([]);
    expect(screen.policyPreview.summary).toBe("policy preview: rendered adaptive obligation scenarios");
    expect(screen.overviewLines).toEqual(inspectOverviewLines(screen));
    expect(screen.overviewLines.join("\n")).toContain("status counts:");
    expect(screen.overviewLines.join("\n")).toContain("primary surfaces:");
    expect(screen.overviewLines.join("\n")).toContain("doctor result:");
  });

  it("surfaces invalid drift items for inspect consumers", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.hooksJson, "{", "utf8");

    const screen = loadInspectScreen(paths, codexPaths);

    expect(screen.runtimeSummary.summary).toContain("no local handoff state");
    expect(screen.integrationsAudit.status).toBe("missing");
    expect(screen.statusBundle.driftItems.map((item) => item.name)).toEqual(["config", "hooks"]);
    expect(screen.driftItems).toEqual([
      expect.objectContaining({
        name: "config",
        status: "invalid"
      }),
      expect.objectContaining({
        name: "hooks",
        status: "invalid"
      })
    ]);
    expect(screen.overviewLines.join("\n")).toContain("hooks: invalid");
  });

  it("surfaces the latest typed policy snapshot for inspect consumers", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    appendJsonlRecord(
      paths.decisionsPath,
      createDecisionRecord(
        "policy preview: rendered adaptive obligation scenarios",
        "simple-question: direct_answer | coordinator=gpt-5.4/high",
        [],
        {
          kind: "policy_preview",
          scenarios: [{ id: "simple-question" }, { id: "multi-file-feature" }]
        }
      ),
      stringifyDecisionRecord
    );

    const screen = loadInspectScreen(paths, codexPaths);

    expect(screen.runtimeHistory).toEqual({
      events: 0,
      decisions: 1,
      artifacts: 0
    });
    expect(screen.latestPolicyPreview).toEqual({
      status: "present",
      scenarioCount: 2,
      scenarioIds: ["simple-question", "multi-file-feature"]
    });
  });
});
