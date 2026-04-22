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
  it("includes hook repair hints in overview lines", () => {
    const lines = inspectOverviewLines({
      statusBundle: {
        counts: {
          installed: 0,
          configured: 0,
          disabled: 0,
          missing: 0,
          invalid: 1
        },
        driftItems: [
          {
            name: "hooks",
            status: "invalid",
            repairHint: "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
          }
        ],
        primary: {
          runtime: null,
          codexConfig: null,
          userSkills: null,
          hooks: null,
          customAgents: null,
          installBundle: "missing",
          status: {
            runtime: "missing",
            codexConfig: "missing",
            userSkills: "missing",
            hooks: "missing",
            customAgents: "missing",
            installBundle: "missing"
          }
        }
      },
      doctor: { summary: "doctor: hooks invalid" },
      runtimeSummary: { summary: "runtime-summary: no local handoff state" },
      runtimeHistory: { events: 0, decisions: 0, artifacts: 0 },
      latestPolicyPreview: { status: "missing" },
      localConfig: { summary: "config: ok" },
      codexConfig: { summary: "codex-config: ok" },
      integrationsAudit: { status: "missing", recommendedChangeCount: 0 },
      integrationsPreview: { summary: "integrations-profile preview" },
      driftItems: [
        {
          name: "hooks",
          status: "invalid",
          repairHint: "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
        }
      ]
    } as any);

    expect(lines).toContain(
      "hooks: invalid (Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows.)"
    );
  });

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
      scenarioIds: [],
      scenarios: [],
      tsUnix: null,
      summary: null
    });
    expect(screen.driftItems).toEqual([]);
    expect(screen.policyPreview.summary).toBe("policy preview: rendered adaptive obligation scenarios");
    expect(screen.overviewLines).toEqual(inspectOverviewLines(screen));
    expect(screen.overviewLines.join("\n")).toContain("status counts:");
    expect(screen.overviewLines.join("\n")).toContain("primary surfaces:");
    expect(screen.overviewLines.join("\n")).toContain("doctor result:");
    expect(screen.overviewLines.join("\n")).toContain("runtime summary (read-only local visibility):");
    expect(screen.overviewLines.join("\n")).toContain("runtime history (read-only local visibility):");
    expect(screen.overviewLines.join("\n")).toContain("latest policy snapshot: missing (current-run-derived read-only view)");
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
    const decision = createDecisionRecord(
      "policy preview: rendered adaptive obligation scenarios",
      "simple-question: direct_answer | coordinator=gpt-5.4/high",
      [],
      {
        kind: "policy_preview",
        scenarios: [{ id: "simple-question" }, { id: "multi-file-feature" }]
      }
    );
    decision.tsUnix = 1_700_000_004;
    appendJsonlRecord(paths.decisionsPath, decision, stringifyDecisionRecord);

    const screen = loadInspectScreen(paths, codexPaths);

    expect(screen.runtimeHistory).toEqual({
      events: 0,
      decisions: 1,
      artifacts: 0
    });
    expect(screen.latestPolicyPreview).toEqual({
      status: "present",
      scenarioCount: 2,
      scenarioIds: ["simple-question", "multi-file-feature"],
      scenarios: [
        { id: "simple-question", summary: null, obligationCount: 0, traceCount: 0 },
        { id: "multi-file-feature", summary: null, obligationCount: 0, traceCount: 0 }
      ],
      tsUnix: 1_700_000_004,
      summary: "policy preview: rendered adaptive obligation scenarios"
    });
    expect(screen.overviewLines.join("\n")).toContain(
      "latest policy snapshot: present (current-run-derived read-only view; ts 1700000004; summary policy preview: rendered adaptive obligation scenarios; 2 scenarios: simple-question, multi-file-feature)"
    );
  });
});
