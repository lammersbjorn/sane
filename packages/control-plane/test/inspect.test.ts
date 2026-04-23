import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { optionalPackSkillNames } from "@sane/framework-assets";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { appendJsonlRecord, createDecisionRecord, stringifyDecisionRecord } from "@sane/state";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyCodexProfile,
  formatInspectOverviewLines,
  inspectSnapshotFromStatusBundle,
  inspectSnapshot,
  installRuntime
} from "../src/index.js";
import { exportHooks } from "../src/hooks-custom-agents.js";
import { inspectStatusBundle, showStatusFromStatusBundle } from "../src/inventory.js";
import { saveConfig } from "../src/preferences.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-control-plane-inspect-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("inspect snapshot", () => {
  it("aggregates the inspect-facing backend surfaces", () => {
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

    const snapshot = inspectSnapshot(paths, codexPaths);

    expect(snapshot.statusBundle.primary.runtime?.status.displayString()).toBe("installed");
    expect(snapshot.status.summary).toContain("managed targets inspected");
    expect(snapshot.doctor.summary).toContain("hooks: installed");
    expect(snapshot.doctorHeadline).toBe("runtime: ok");
    expect(snapshot.runtimeSummary.summary).toContain("runtime-summary:");
    expect(snapshot.runtimeHistory).toEqual({
      events: 0,
      decisions: 0,
      artifacts: 0
    });
    expect(snapshot.runtimeHistoryPreview).toEqual({
      latestEvent: null,
      latestDecision: null,
      latestArtifact: null
    });
    expect(snapshot.selfHostingShadow).toMatchObject({
      mode: "shadow-inspect-only",
      runnerEnabled: false,
      status: "ready"
    });
    expect(snapshot.latestPolicyPreview).toEqual({
      status: "missing",
      scenarioCount: 0,
      scenarioIds: [],
      scenarios: [],
      tsUnix: null,
      summary: null
    });
    expect(snapshot.localConfig.summary).toContain("config: ok");
    expect(snapshot.localConfig.details).toContain("explorer: gpt-5.4-mini (low) (derived)");
    expect(snapshot.localConfig.details).toContain("execution: gpt-5.3-codex (medium) (derived)");
    expect(snapshot.localConfig.details).toContain("realtime: gpt-5.3-codex-spark (low) (derived)");
    expect(snapshot.codexConfig.summary).toContain("codex-config: ok");
    expect(snapshot.integrationsAudit.status).toBe("missing");
    expect(snapshot.integrationsPreview.summary).toContain("integrations-profile preview");
    expect(snapshot.statuslineAudit.status).toBe("missing");
    expect(snapshot.statuslinePreview.summary).toContain("statusline-profile preview");
    expect(snapshot.driftItems).toEqual([]);
    expect(snapshot.policyPreview.summary).toBe(
      "policy preview: rendered adaptive obligation scenarios"
    );
    expect(snapshot.status).toEqual({
      summary: showStatusFromStatusBundle(snapshot.statusBundle).summary,
      inventory: showStatusFromStatusBundle(snapshot.statusBundle).inventory
    });
    const overview = formatInspectOverviewLines(snapshot).join("\n");

    expect(overview).toContain("status counts:");
    expect(overview).toContain("primary surfaces:");
    expect(overview).toContain(
      "self-hosting shadow (read-only): ready, runner disabled"
    );
    expect(overview).toContain("statusline profile: missing");
    expect(overview).toContain("conflict warnings: none");
    expect(overview).toContain(
      `optional pack provenance: caveman configured (sane-caveman; derived from caveman); rtk disabled (no skills; internal); frontend-craft disabled (${optionalPackSkillNames("frontend-craft").join(" + ")}; derived from taste-skill + impeccable)`
    );
  });

  it("surfaces conflict warnings in inspect overview without mutating Codex config", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        "[mcp_servers.experimental_sidecar]",
        'command = "experimental"'
      ].join("\n")
    );

    const snapshot = inspectSnapshot(paths, codexPaths);
    const overview = formatInspectOverviewLines(snapshot).join("\n");

    expect(snapshot.statusBundle.conflictWarnings).toEqual([
      expect.objectContaining({
        kind: "unmanaged_mcp_server",
        target: "mcp_servers.experimental_sidecar"
      })
    ]);
    expect(overview).toContain("conflict warnings: 1");
    expect(overview).toContain(
      "mcp_servers.experimental_sidecar: unmanaged Codex MCP server 'experimental_sidecar' is outside Sane's known profiles"
    );
  });

  it("surfaces disabled Codex hooks in inspect overview without mutating Codex config", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        "[features]",
        "codex_hooks = false"
      ].join("\n")
    );

    const snapshot = inspectSnapshot(paths, codexPaths);
    const overview = formatInspectOverviewLines(snapshot).join("\n");

    expect(snapshot.statusBundle.conflictWarnings).toEqual([
      expect.objectContaining({
        kind: "disabled_codex_hooks",
        target: "features.codex_hooks"
      })
    ]);
    expect(overview).toContain("conflict warnings: 1");
    expect(overview).toContain(
      "features.codex_hooks: Codex hooks are disabled, so Sane-managed hook exports will not run until features.codex_hooks is enabled"
    );
  });

  it("surfaces latest policy snapshot and invalid drift through one helper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.hooksJson, "{", "utf8");
    const decision = createDecisionRecord(
      "policy preview: rendered adaptive obligation scenarios",
      "simple-question: direct_answer | coordinator=gpt-5.4/high",
      [],
      {
        kind: "policy_preview",
        scenarios: [
          {
            id: "simple-question",
            roles: {
              coordinator: true
            },
            orchestration: {
              subagents: "none",
              subagentReadiness: "not_needed",
              reviewPosture: "inline_only",
              verifierTiming: "inline"
            }
          },
          { id: "multi-file-feature" }
        ]
      }
    );
    decision.tsUnix = 1_700_000_003;
    appendJsonlRecord(paths.decisionsPath, decision, stringifyDecisionRecord);

    const snapshot = inspectSnapshot(paths, codexPaths);

    expect(snapshot.statusBundle.driftItems.map((item) => item.name)).toEqual(["config", "hooks"]);
    expect(snapshot.driftItems).toEqual([
      expect.objectContaining({
        name: "config",
        status: "invalid"
      }),
      expect.objectContaining({
        name: "hooks",
        status: "invalid"
      })
    ]);
    expect(snapshot.latestPolicyPreview).toEqual({
      status: "present",
      scenarioCount: 2,
      scenarioIds: ["simple-question", "multi-file-feature"],
      scenarios: [
        {
          id: "simple-question",
          summary: null,
          input: null,
          roles: {
            coordinator: true,
            sidecar: false,
            verifier: false
          },
          orchestration: {
            subagents: "none",
            subagentReadiness: "not_needed",
            reviewPosture: "inline_only",
            verifierTiming: "inline"
          },
          continuation: null,
          obligationCount: 0,
          traceCount: 0,
          trace: []
        },
        {
          id: "multi-file-feature",
          summary: null,
          input: null,
          roles: null,
          orchestration: null,
          continuation: null,
          obligationCount: 0,
          traceCount: 0,
          trace: []
        }
      ],
      tsUnix: 1_700_000_003,
      summary: "policy preview: rendered adaptive obligation scenarios"
    });
    expect(snapshot.runtimeHistoryPreview).toEqual({
      latestEvent: null,
      latestDecision: {
        tsUnix: 1_700_000_003,
        summary: "policy preview: rendered adaptive obligation scenarios",
        rationale: "simple-question: direct_answer | coordinator=gpt-5.4/high"
      },
      latestArtifact: null
    });
    expect(snapshot.doctorHeadline).toBe("runtime: ok");
    const overview = formatInspectOverviewLines(snapshot).join("\n");

    expect(overview).toContain("export drift view: config, hooks");
    expect(overview).toContain("config: invalid");
    expect(overview).toContain("hooks: invalid (repair ~/.codex/hooks.json or remove conflicting JSON)");
  });

  it("keeps bundle-based inspect snapshot aligned with the wrapper helper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    applyCodexProfile(paths, codexPaths);

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(inspectSnapshotFromStatusBundle(paths, codexPaths, bundle)).toEqual(
      inspectSnapshot(paths, codexPaths)
    );
  });
});
