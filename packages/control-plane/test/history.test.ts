import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createProjectPaths, createCodexPaths } from "@sane/platform";
import {
  parseArtifactRecordJson,
  parseDecisionRecordJson,
  parseEventRecordJson,
  readJsonlRecords,
  readRunSummary
} from "@sane/state";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { exportAll } from "../src/bundles.js";
import {
  executeConfigSave,
  executeOperation,
  readLastOperationSummary,
  recordOperation
} from "../src/history.js";
import { installRuntime } from "../src/index.js";
import { previewPolicy } from "../src/policy-preview.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-history-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("operation history plumbing", () => {
  it("executeConfigSave updates events, summary, and brief", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();

    const result = executeConfigSave(paths, config);
    const events = readJsonlRecords(paths.eventsPath, parseEventRecordJson);
    const summary = readRunSummary(paths.summaryPath);
    const brief = readFileSync(paths.briefPath, "utf8");

    expect(result.summary).toContain("config: saved");
    expect(events.at(-1)?.action).toBe("show_config");
    expect(summary.filesTouched).toContain(paths.configPath);
    expect(brief).toContain(paths.configPath);
  });

  it("recordOperation promotes milestones and artifact records", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    const result = exportAll(paths, codexPaths);
    recordOperation(paths, result);

    const decisions = readJsonlRecords(paths.decisionsPath, parseDecisionRecordJson);
    const artifacts = readJsonlRecords(paths.artifactsPath, parseArtifactRecordJson);
    const summary = readRunSummary(paths.summaryPath);

    expect(decisions.at(-1)?.summary).toBe("Sane installed into Codex");
    expect(artifacts.some((record) => record.kind === "export_all")).toBe(true);
    expect(summary.completedMilestones).toContain("Sane installed into Codex");
  });

  it("executeOperation wraps backend results and records history", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    const result = executeOperation(paths, () => exportAll(paths, codexPaths));
    const events = readJsonlRecords(paths.eventsPath, parseEventRecordJson);

    expect(result.summary).toBe("export all: installed managed targets");
    expect(events.at(-1)?.action).toBe("export_all");
  });

  it("reads the last recorded operation summary for boot-time consumers", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(readLastOperationSummary(paths)).toBeNull();

    installRuntime(paths, codexPaths);
    executeOperation(paths, () => exportAll(paths, codexPaths));

    expect(readLastOperationSummary(paths)).toBe("export all: installed managed targets");
  });

  it("recordOperation keeps promoted summary entries unique across repeats", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    const result = exportAll(paths, codexPaths);
    recordOperation(paths, result);
    recordOperation(paths, result);

    const summary = readRunSummary(paths.summaryPath);
    const milestoneHits = summary.completedMilestones.filter(
      (milestone) => milestone === "Sane installed into Codex"
    );
    const sortedFiles = [...summary.filesTouched].sort();

    expect(milestoneHits).toHaveLength(1);
    expect(summary.filesTouched.length).toBe(new Set(summary.filesTouched).size);
    expect(summary.filesTouched).toEqual(sortedFiles);
  });

  it("records policy preview metadata without promoting a milestone", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    const result = executeOperation(paths, () => previewPolicy(paths, { HOME: makeTempDir() }));
    const decisions = readJsonlRecords(paths.decisionsPath, parseDecisionRecordJson);
    const summary = readRunSummary(paths.summaryPath);

    expect(result.policyPreview?.scenarios).toHaveLength(5);
    expect(decisions.at(-1)?.summary).toBe("policy preview: rendered adaptive obligation scenarios");
    expect(decisions.at(-1)?.context).toMatchObject({
      kind: "policy_preview",
      scenarios: expect.any(Array)
    });
    expect(summary.completedMilestones).toHaveLength(0);
  });
});
