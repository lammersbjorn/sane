import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import {
  appendJsonlRecord,
  createDecisionRecord,
  stringifyDecisionRecord
} from "@sane/state";
import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  inspectLatestPolicyPreview,
  installRuntime,
  showRuntimeProgress,
  showRuntimeSummary
} from "../src/index.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-runtime-summary-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("showRuntimeSummary", () => {
  it("reports missing handoff state before runtime bootstrap", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    const result = showRuntimeSummary(paths);

    expect(result.summary).toBe(`runtime-summary: no local handoff state at ${paths.runtimeRoot}`);
    expect(result.details).toContain(`current-run: missing at ${paths.currentRunPath}`);
    expect(result.details).toContain(`summary: missing at ${paths.summaryPath}`);
    expect(result.details).toContain(`brief: missing at ${paths.briefPath}`);
    expect(result.pathsTouched).toEqual([
      paths.currentRunPath,
      paths.summaryPath,
      paths.briefPath,
      paths.eventsPath,
      paths.decisionsPath,
      paths.artifactsPath
    ]);
  });

  it("summarizes current-run, summary, and brief after bootstrap", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));
    const result = showRuntimeSummary(paths);

    expect(result.summary).toBe(`runtime-summary: local handoff state at ${paths.runtimeRoot}`);
    expect(result.details).toContain(`current-run: present at ${paths.currentRunPath}`);
    expect(result.details).toContain(`summary: present at ${paths.summaryPath}`);
    expect(result.details).toContain(`brief: present at ${paths.briefPath}`);
    expect(result.details).toContain(`events: 0 at ${paths.eventsPath}`);
    expect(result.details).toContain(`decisions: 0 at ${paths.decisionsPath}`);
    expect(result.details).toContain(`artifacts: 0 at ${paths.artifactsPath}`);
    expect(result.details).toContain("objective: initialize sane runtime");
    expect(result.details).toContain("phase: setup");
    expect(result.details).toContain("verification: pending (runtime scaffolding created)");
    expect(result.details).toContain("active tasks: install sane runtime");
    expect(result.details).toContain("completed milestones: none");
    expect(result.details).toContain("brief preview:");
    expect(result.details).toContain("# Sane Brief");
    expect(showRuntimeProgress(paths)).toEqual({
      phase: "setup",
      verificationStatus: "pending"
    });
  });

  it("includes the latest policy preview snapshot when present", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));
    const decision = createDecisionRecord(
      "policy preview: rendered adaptive obligation scenarios",
      "simple-question: direct_answer | coordinator=gpt-5.4/high",
      [],
      {
        kind: "policy_preview",
        scenarios: [{ id: "simple-question" }, { id: "multi-file-feature" }]
      }
    );
    decision.tsUnix = 1_700_000_002;
    appendJsonlRecord(
      paths.decisionsPath,
      decision,
      stringifyDecisionRecord
    );

    const result = showRuntimeSummary(paths);

    expect(result.details).toContain("latest policy preview: 2 scenarios");
    expect(result.details).toContain(
      "latest policy preview provenance: ts 1700000002, summary policy preview: rendered adaptive obligation scenarios"
    );
    expect(result.details).toContain(`decisions: 1 at ${paths.decisionsPath}`);
    expect(inspectLatestPolicyPreview(paths)).toEqual({
      status: "present",
      scenarioCount: 2,
      scenarioIds: ["simple-question", "multi-file-feature"],
      tsUnix: 1_700_000_002,
      summary: "policy preview: rendered adaptive obligation scenarios"
    });
  });

  it("keeps runtime progress available when summary.json is invalid", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));
    writeFileSync(paths.summaryPath, "{", "utf8");

    expect(showRuntimeProgress(paths)).toEqual({
      phase: "setup",
      verificationStatus: "pending"
    });

    const result = showRuntimeSummary(paths);
    expect(result.details).toContain(`summary: missing at ${paths.summaryPath}`);
    expect(result.details).toContain(`current-run: present at ${paths.currentRunPath}`);
  });

  it("ignores malformed policy preview context safely", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));
    appendJsonlRecord(
      paths.decisionsPath,
      createDecisionRecord(
        "policy preview: malformed",
        "bad context",
        [],
        {
          kind: "policy_preview",
          scenarios: [42 as never]
        }
      ),
      stringifyDecisionRecord
    );

    const result = showRuntimeSummary(paths);

    expect(result.details).not.toContain("latest policy preview: 0 scenarios");
    expect(inspectLatestPolicyPreview(paths)).toEqual({
      status: "missing",
      scenarioCount: 0,
      scenarioIds: [],
      tsUnix: null,
      summary: null
    });
  });
});
