import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { appendJsonlRecord, createDecisionRecord, stringifyDecisionRecord } from "@sane/state";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { applyCodexProfile, inspectSnapshot, installRuntime } from "../src/index.js";
import { exportHooks } from "../src/hooks-custom-agents.js";
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
    expect(snapshot.runtimeSummary.summary).toContain("runtime-summary:");
    expect(snapshot.runtimeHistory).toEqual({
      events: 0,
      decisions: 0,
      artifacts: 0
    });
    expect(snapshot.latestPolicyPreview).toEqual({
      status: "missing",
      scenarioCount: 0,
      scenarioIds: []
    });
    expect(snapshot.localConfig.summary).toContain("config: ok");
    expect(snapshot.codexConfig.summary).toContain("codex-config: ok");
    expect(snapshot.integrationsAudit.status).toBe("missing");
    expect(snapshot.integrationsPreview.summary).toContain("integrations-profile preview");
    expect(snapshot.driftItems).toEqual([]);
    expect(snapshot.policyPreview.summary).toBe(
      "policy preview: rendered adaptive obligation scenarios"
    );
  });

  it("surfaces latest policy snapshot and invalid drift through one helper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.hooksJson, "{", "utf8");
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

    const snapshot = inspectSnapshot(paths, codexPaths);

    expect(snapshot.statusBundle.driftItems.map((item) => item.name)).toEqual([
      "config",
      "current-run",
      "summary",
      "hooks"
    ]);
    expect(snapshot.driftItems).toEqual([
      expect.objectContaining({
        name: "config",
        status: "invalid"
      }),
      expect.objectContaining({
        name: "current-run",
        status: "invalid"
      }),
      expect.objectContaining({
        name: "summary",
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
      scenarioIds: ["simple-question", "multi-file-feature"]
    });
  });
});
