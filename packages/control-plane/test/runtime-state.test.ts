import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import {
  appendJsonlRecord,
  createMissingLatestPolicyPreviewSnapshot,
  createDecisionRecord,
  stringifyDecisionRecord
} from "@sane/state";
import { afterEach, describe, expect, it } from "vitest";

import { installRuntime } from "../src/index.js";
import { inspectRuntimeState } from "../src/runtime-state.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-runtime-state-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("inspectRuntimeState", () => {
  it("reports missing layers before bootstrap", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    expect(inspectRuntimeState(paths)).toEqual({
      current: null,
      summary: null,
      brief: null,
      layerStatus: {
        currentRun: "missing",
        summary: "missing",
        brief: "missing"
      },
      historyCounts: {
        events: 0,
        decisions: 0,
        artifacts: 0
      },
      historyPreview: {
        latestEvent: null,
        latestDecision: null,
        latestArtifact: null
      },
      latestPolicyPreview: createMissingLatestPolicyPreviewSnapshot()
    });
  });

  it("preserves invalid summary status while keeping current run readable", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));
    writeFileSync(paths.summaryPath, "{", "utf8");

    expect(inspectRuntimeState(paths)).toMatchObject({
      current: expect.objectContaining({
        phase: "setup"
      }),
      summary: null,
      brief: expect.any(String),
      layerStatus: {
        currentRun: "present",
        summary: "invalid",
        brief: "present"
      },
      historyCounts: {
        events: 0,
        decisions: 0,
        artifacts: 0
      }
    });
  });

  it("surfaces canonical latest policy preview and history preview from layered state", () => {
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
        scenarios: [{ id: "simple-question" }]
      }
    );
    decision.tsUnix = 1_700_000_005;
    appendJsonlRecord(paths.decisionsPath, decision, stringifyDecisionRecord);

    expect(inspectRuntimeState(paths)).toMatchObject({
      historyCounts: {
        events: 0,
        decisions: 1,
        artifacts: 0
      },
      historyPreview: {
        latestDecision: {
          tsUnix: 1_700_000_005,
          summary: "policy preview: rendered adaptive obligation scenarios",
          rationale: "simple-question: direct_answer | coordinator=gpt-5.4/high"
        }
      },
      latestPolicyPreview: {
        status: "present",
        scenarioCount: 1,
        scenarioIds: ["simple-question"],
        tsUnix: 1_700_000_005,
        summary: "policy preview: rendered adaptive obligation scenarios"
      }
    });
  });

  it("surfaces bounded latest policy preview through inspectRuntimeState", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));
    appendJsonlRecord(
      paths.decisionsPath,
      createDecisionRecord(
        "policy preview: rendered adaptive obligation scenarios",
        "bounded",
        [],
        {
          kind: "policy_preview",
          scenarios: Array.from({ length: 80 }, (_, index) => ({
            id: `s-${index}`,
            trace: Array.from({ length: 40 }, (_, traceIndex) => ({
              obligation: `o-${traceIndex}`,
              rule: `r-${traceIndex}`
            }))
          }))
        }
      ),
      stringifyDecisionRecord
    );

    const snapshot = inspectRuntimeState(paths);

    expect(snapshot.latestPolicyPreview.status).toBe("present");
    expect(snapshot.latestPolicyPreview.scenarioCount).toBe(32);
    expect(snapshot.latestPolicyPreview.scenarios).toHaveLength(32);
    expect(snapshot.latestPolicyPreview.scenarios[0]?.traceCount).toBe(16);
    expect(snapshot.latestPolicyPreview.scenarios[0]?.trace).toHaveLength(16);
  });
});
