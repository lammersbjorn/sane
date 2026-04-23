import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import {
  appendJsonlRecord,
  createArtifactRecord,
  createDecisionRecord,
  createEventRecord,
  stringifyArtifactRecord,
  stringifyDecisionRecord,
  stringifyEventRecord
} from "@sane/state";
import { afterEach, describe, expect, it } from "vitest";

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
    expect(result.details).toContain("latest event (read-only local visibility): missing");
    expect(result.details).toContain("latest decision (read-only local visibility): missing");
    expect(result.details).toContain("latest artifact (read-only local visibility): missing");
    expect(result.details).toContain(
      "current policy preview: policy preview: rendered adaptive obligation scenarios; 5 scenarios"
    );
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
    expect(result.details).toContain("latest event (read-only local visibility): missing");
    expect(result.details).toContain("latest decision (read-only local visibility): missing");
    expect(result.details).toContain("latest artifact (read-only local visibility): missing");
    expect(result.details).toContain("objective: initialize sane runtime");
    expect(result.details).toContain("phase: setup");
    expect(result.details).toContain("verification: pending (runtime scaffolding created)");
    expect(result.details).toContain("active tasks: install sane runtime");
    expect(result.details).toContain("completed milestones: none");
    expect(result.details).toContain("brief preview:");
    expect(result.details).toContain("# Sane Brief");
    expect(result.details).toContain(
      "current policy preview: policy preview: rendered adaptive obligation scenarios; 6 scenarios"
    );
    expect(
      result.details.some((line) =>
        line.startsWith("current preview scenario current-run-inspect:")
        && line.includes("trace reasons verify_light via")
      )
    ).toBe(true);
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
    const event = createEventRecord(
      "runtime",
      "install-runtime",
      "ok",
      "created runtime handoff baseline",
      [paths.currentRunPath]
    );
    event.tsUnix = 1_700_000_001;
    appendJsonlRecord(
      paths.eventsPath,
      event,
      stringifyEventRecord
    );
    const decision = createDecisionRecord(
      "policy preview: rendered adaptive obligation scenarios",
      "simple-question: direct_answer | coordinator=gpt-5.4/high",
      [],
      {
        kind: "policy_preview",
        scenarios: [
          {
            id: "simple-question",
            input: {
              intent: "question",
              taskShape: "trivial",
              risk: "low",
              ambiguity: "low",
              parallelism: "none",
              contextPressure: "low",
              runState: "exploring"
            },
            roles: {
              coordinator: true
            },
            orchestration: {
              subagents: "none",
              subagentReadiness: "not_needed",
              reviewPosture: "inline_only",
              verifierTiming: "inline"
            },
            trace: [
              {
                obligation: "keep_direct_answers_light",
                rule: "keep_direct_answers_light"
              }
            ]
          },
          { id: "multi-file-feature" }
        ]
      }
    );
    decision.tsUnix = 1_700_000_002;
    appendJsonlRecord(
      paths.decisionsPath,
      decision,
      stringifyDecisionRecord
    );
    const artifact = createArtifactRecord(
      "brief",
      paths.briefPath,
      "regenerated concise brief",
      [paths.briefPath]
    );
    artifact.tsUnix = 1_700_000_003;
    appendJsonlRecord(
      paths.artifactsPath,
      artifact,
      stringifyArtifactRecord
    );

    const result = showRuntimeSummary(paths);

    expect(result.details).toContain("latest policy preview: 2 scenarios");
    expect(result.details).toContain(
      "latest policy preview provenance: ts 1700000002, summary policy preview: rendered adaptive obligation scenarios"
    );
    expect(result.details).toContain(
      "latest policy input simple-question: intent question, task trivial, risk low, ambiguity low, parallelism none, context low, run exploring"
    );
    expect(result.details).toContain("latest policy scenario simple-question: obligations 0, traces 1");
    expect(result.details).toContain(
      "latest policy roles simple-question: coordinator on, sidecar off, verifier off"
    );
    expect(result.details).toContain(
      "latest policy orchestration simple-question: subagents none, readiness not_needed, review inline_only, verifier inline"
    );
    expect(result.details).toContain(
      "latest policy trace simple-question: keep_direct_answers_light via keep_direct_answers_light"
    );
    expect(result.details).toContain(
      "current policy preview: policy preview: rendered adaptive obligation scenarios; 6 scenarios"
    );
    expect(
      result.details.some((line) =>
        line.startsWith("current preview scenario current-run-inspect:")
        && line.includes("trace reasons verify_light via")
      )
    ).toBe(true);
    expect(result.details.join("\n")).not.toMatch(/\b(runner|self-heal|self heal|executed)\b/i);
    expect(result.details).toContain(
      "latest event (read-only local visibility): ts 1700000001, action install-runtime, result ok, summary created runtime handoff baseline"
    );
    expect(result.details).toContain(
      "latest decision (read-only local visibility): ts 1700000002, summary policy preview: rendered adaptive obligation scenarios, rationale simple-question: direct_answer | coordinator=gpt-5.4/high"
    );
    expect(result.details).toContain(
      `latest artifact (read-only local visibility): ts 1700000003, kind brief, path ${paths.briefPath}, summary regenerated concise brief`
    );
    expect(result.details).toContain(`events: 1 at ${paths.eventsPath}`);
    expect(result.details).toContain(`decisions: 1 at ${paths.decisionsPath}`);
    expect(result.details).toContain(`artifacts: 1 at ${paths.artifactsPath}`);
    expect(inspectLatestPolicyPreview(paths)).toEqual({
      status: "present",
      scenarioCount: 2,
      scenarioIds: ["simple-question", "multi-file-feature"],
      scenarios: [
        {
          id: "simple-question",
          summary: null,
          input: {
            intent: "question",
            taskShape: "trivial",
            risk: "low",
            ambiguity: "low",
            parallelism: "none",
            contextPressure: "low",
            runState: "exploring"
          },
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
          traceCount: 1,
          trace: [
            {
              obligation: "keep_direct_answers_light",
              rule: "keep_direct_answers_light"
            }
          ]
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
    expect(result.details).toContain(`summary: invalid at ${paths.summaryPath}`);
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
      scenarios: [],
      tsUnix: null,
      summary: null
    });
  });
});
