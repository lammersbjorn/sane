import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createProjectPaths } from "@sane/platform";
import { writeCurrentRunState } from "@sane/state";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildCurrentRunInspectPreview,
  buildPolicyPreviewPayload,
  previewPolicyForCurrentRun,
  previewPolicy
} from "../src/policy-preview.js";
import { formatInspectPolicyPreviewLines } from "../src/policy-preview-presenter.js";
import { saveConfig } from "../src/preferences.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-policy-preview-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("policy preview", () => {
  it("renders canonical adaptive obligation scenarios", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    const result = previewPolicy(paths);

    expect(result.summary).toBe("policy preview: rendered adaptive obligation scenarios");
    expect(result.details).toHaveLength(5);
    expect(result.details[0]).toContain("simple-question:");
    expect(result.details[0]).toContain("direct_answer");
    expect(result.details[0]).toContain("coordinator=");
    expect(result.details[0]).toContain("explorer=");
    expect(result.details[0]).toContain("execution=");
    expect(result.details[0]).toContain("realtime=");
    expect(result.details[0]).toContain("frontend-craft=");
    expect(result.policyPreview?.scenarios).toHaveLength(5);
    expect(result.policyPreview?.scenarios[0]?.id).toBe("simple-question");
    expect(result.policyPreview?.scenarios[0]?.input).toEqual({
      intent: "question",
      taskShape: "trivial",
      risk: "low",
      ambiguity: "low",
      parallelism: "none",
      contextPressure: "low",
      runState: "exploring"
    });
    expect(result.policyPreview?.scenarios[0]?.trace[0]?.rule).toBe("keep_direct_answers_light");
    expect(result.policyPreview?.scenarios[0]?.continuation).toEqual({
      strategy: "answer_directly",
      stopCondition: "answered"
    });
    expect(
      result.policyPreview?.scenarios.find((scenario) => scenario.id === "multi-file-feature")
        ?.continuation
    ).toEqual({
      strategy: "continue_until_verified",
      stopCondition: "verified"
    });
  });

  it("uses current local config roles plus derived routing classes when available", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2";
    config.models.verifier.model = "gpt-5.1-codex-mini";
    saveConfig(paths, config);

    const result = previewPolicy(paths);
    const featureLine = result.details.find((line) => line.startsWith("multi-file-feature:")) ?? "";

    expect(featureLine).toContain("coordinator=gpt-5.2/medium");
    expect(featureLine).toContain("explorer=gpt-5.4-mini/low");
    expect(featureLine).toContain("verifier=gpt-5.1-codex-mini/high");
    expect(featureLine).toContain("execution=gpt-5.3-codex/medium");
    expect(featureLine).toContain("realtime=gpt-5.3-codex-spark/low");
    expect(featureLine).toContain("frontend-craft=gpt-5.5/high");
  });

  it("reads codex environment through platform discovery instead of homedir", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexHome = makeTempDir();
    saveConfig(paths, createDefaultLocalConfig());

    const result = previewPolicy(paths, { HOME: codexHome });
    const featureLine = result.details.find((line) => line.startsWith("multi-file-feature:")) ?? "";

    expect(featureLine).toContain("execution=gpt-5.3-codex/medium");
    expect(featureLine).toContain("realtime=gpt-5.3-codex-spark/low");
    expect(featureLine).toContain("frontend-craft=gpt-5.5/high");
  });

  it("adds a derived inspect-only current-run scenario when current-run exists", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    writeCurrentRunState(paths.currentRunPath, {
      version: 2,
      objective: "inspect runtime drift",
      phase: "inspect",
      activeTasks: ["inspect runtime drift"],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "inspection queued"
      },
      lastCompactionTsUnix: null,
      extra: {}
    });

    const result = previewPolicy(paths);
    const currentRunLine =
      result.details.find((line) => line.startsWith("current-run-inspect:")) ?? "";
    const currentRunScenario = result.policyPreview?.scenarios.find(
      (scenario) => scenario.id === "current-run-inspect"
    );

    expect(result.details).toHaveLength(6);
    expect(result.policyPreview?.scenarios).toHaveLength(6);
    expect(currentRunLine).toContain("verify_light");
    expect(currentRunScenario?.obligations).toEqual(["verify_light", "subagent_eligible"]);
    expect(currentRunScenario?.input).toEqual({
      intent: "inspect",
      taskShape: "local",
      risk: "low",
      ambiguity: "low",
      parallelism: "none",
      contextPressure: "medium",
      runState: "exploring"
    });
  });

  it("keeps current-run policy-preview derivation behind a typed payload helper", () => {
    const withoutCurrentRun = buildPolicyPreviewPayload(null);
    const withCurrentRun = buildPolicyPreviewPayload({
      version: 2,
      objective: "inspect runtime drift",
      phase: "inspect",
      activeTasks: ["inspect runtime drift"],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "inspection queued"
      },
      lastCompactionTsUnix: null,
      extra: {}
    });

    expect(withoutCurrentRun.scenarios.map((scenario) => scenario.id)).toEqual([
      "simple-question",
      "local-edit",
      "unknown-bug",
      "multi-file-feature",
      "blocked-long-run"
    ]);
    expect(withCurrentRun.scenarios.map((scenario) => scenario.id)).toEqual([
      "simple-question",
      "local-edit",
      "unknown-bug",
      "multi-file-feature",
      "blocked-long-run",
      "current-run-inspect"
    ]);
    expect(withCurrentRun.scenarios.at(-1)?.continuation).toEqual({
      strategy: "continue_until_verified",
      stopCondition: "verified"
    });

    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const result = previewPolicyForCurrentRun(paths, {
      version: 2,
      objective: "inspect runtime drift",
      phase: "inspect",
      activeTasks: ["inspect runtime drift"],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "inspection queued"
      },
      lastCompactionTsUnix: null,
      extra: {}
    });

    expect(result.policyPreview?.scenarios.at(-1)?.id).toBe("current-run-inspect");
    expect(result.details.at(-1)).toContain("current-run-inspect: verify_light");
    expect(result.details.at(-1)).toContain("explorer=gpt-5.4-mini/low");
  });

  it("exposes a pure typed helper for current-run inspect preview derivation", () => {
    const scenario = buildCurrentRunInspectPreview({
      version: 2,
      objective: "debug long-running indexing drift",
      phase: "debug",
      activeTasks: [
        "reproduce index drift in staging",
        "trace mismatch across ingestion workers",
        "instrument retry and checkpoint paths",
        "prepare rollback validation checklist"
      ],
      blockingQuestions: ["which shard boundary causes the replay loop?"],
      verification: {
        status: "pending",
        summary: "awaiting replay run"
      },
      lastCompactionTsUnix: null,
      extra: {}
    });

    expect(scenario.id).toBe("current-run-inspect");
    expect(scenario.summary).toBe("inspect-only scenario derived from current-run state");
    expect(scenario.input).toEqual({
      intent: "debug",
      taskShape: "long_running",
      risk: "high",
      ambiguity: "medium",
      parallelism: "clear",
      contextPressure: "high",
      runState: "blocked"
    });
    expect(scenario.obligations).toEqual([
      "debug_rigor",
      "verify_light",
      "planning",
      "tdd",
      "review",
      "subagent_eligible",
      "context_compaction",
      "self_repair"
    ]);
  });

  it("derives blocked debug long-running heuristics from current-run state", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    writeCurrentRunState(paths.currentRunPath, {
      version: 2,
      objective: "debug long-running indexing drift",
      phase: "debug",
      activeTasks: [
        "reproduce index drift in staging",
        "trace mismatch across ingestion workers",
        "instrument retry and checkpoint paths",
        "prepare rollback validation checklist"
      ],
      blockingQuestions: ["which shard boundary causes the replay loop?"],
      verification: {
        status: "pending",
        summary: "awaiting replay run"
      },
      lastCompactionTsUnix: null,
      extra: {}
    });

    const result = previewPolicy(paths);
    const currentRunScenario = result.policyPreview?.scenarios.find(
      (scenario) => scenario.id === "current-run-inspect"
    );

    expect(currentRunScenario?.obligations).toEqual([
      "debug_rigor",
      "verify_light",
      "planning",
      "tdd",
      "review",
      "subagent_eligible",
      "context_compaction",
      "self_repair"
    ]);
  });

  it("derives design architectural executing heuristics from current-run state", () => {
    const scenario = buildCurrentRunInspectPreview({
      version: 2,
      objective: "plan self-hosting migration",
      phase: "implementing",
      activeTasks: ["audit current state", "map migration steps", "draft rollout plan"],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "not yet started"
      },
      lastCompactionTsUnix: 1_700_000_000,
      extra: {}
    });

    expect(scenario.input).toEqual({
      intent: "design",
      taskShape: "architectural",
      risk: "high",
      ambiguity: "low",
      parallelism: "possible",
      contextPressure: "medium",
      runState: "executing"
    });
    expect(scenario.obligations).toEqual(["planning", "review", "subagent_eligible"]);
  });

  it("derives edit multi-file executing heuristics from current-run state", () => {
    const scenario = buildCurrentRunInspectPreview({
      version: 2,
      objective: "update docs",
      phase: "editing",
      activeTasks: ["touch changelog", "patch docs", "sync config"],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "queued"
      },
      lastCompactionTsUnix: 1_700_000_000,
      extra: {}
    });

    expect(scenario.input).toEqual({
      intent: "edit",
      taskShape: "multi_file",
      risk: "medium",
      ambiguity: "low",
      parallelism: "possible",
      contextPressure: "medium",
      runState: "executing"
    });
    expect(scenario.obligations).toEqual(["tdd", "review", "subagent_eligible"]);
  });

  it("derives orchestrate long-running executing heuristics from current-run state", () => {
    const scenario = buildCurrentRunInspectPreview({
      version: 2,
      objective: "keep going with the long run",
      phase: "working",
      activeTasks: [
        "scan backlog",
        "slice work",
        "assign slices",
        "track progress",
        "close loop"
      ],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "in flight"
      },
      lastCompactionTsUnix: 1_700_000_000,
      extra: {}
    });

    expect(scenario.input).toEqual({
      intent: "orchestrate",
      taskShape: "long_running",
      risk: "high",
      ambiguity: "low",
      parallelism: "clear",
      contextPressure: "high",
      runState: "executing"
    });
    expect(scenario.obligations).toEqual([
      "planning",
      "review",
      "subagent_eligible",
      "context_compaction"
    ]);
  });

  it("derives question trivial validating heuristics from current-run state", () => {
    const scenario = buildCurrentRunInspectPreview({
      version: 2,
      objective: "what should we do next?",
      phase: "reviewing",
      activeTasks: [],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "waiting"
      },
      lastCompactionTsUnix: 1_700_000_000,
      extra: {}
    });

    expect(scenario.input).toEqual({
      intent: "question",
      taskShape: "trivial",
      risk: "low",
      ambiguity: "low",
      parallelism: "none",
      contextPressure: "low",
      runState: "validating"
    });
    expect(scenario.obligations).toEqual(["direct_answer", "review"]);
  });

  it("derives question trivial closing heuristics from current-run state", () => {
    const scenario = buildCurrentRunInspectPreview({
      version: 2,
      objective: "what should we close out next?",
      phase: "closing",
      activeTasks: [],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "waiting"
      },
      lastCompactionTsUnix: 1_700_000_000,
      extra: {}
    });

    expect(scenario.input).toEqual({
      intent: "question",
      taskShape: "trivial",
      risk: "low",
      ambiguity: "low",
      parallelism: "none",
      contextPressure: "low",
      runState: "closing"
    });
    expect(scenario.obligations).toEqual(["direct_answer", "review"]);
    expect(scenario.continuation).toEqual({
      strategy: "close_when_verified",
      stopCondition: "closed"
    });
  });

  it("keeps validating current-run previews read-only and open until verified", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    const result = previewPolicyForCurrentRun(paths, {
      version: 2,
      objective: "update docs",
      phase: "validating",
      activeTasks: ["check generated files"],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "waiting for checks"
      },
      lastCompactionTsUnix: 1_700_000_000,
      extra: {}
    });
    const scenario = result.policyPreview?.scenarios.at(-1);

    expect(result.pathsTouched).toEqual([]);
    expect(result.inventory).toEqual([]);
    expect(result.details.at(-1)).toContain("current-run-inspect:");
    expect(scenario?.input.runState).toBe("validating");
    expect(scenario?.continuation).toEqual({
      strategy: "continue_until_verified",
      stopCondition: "verified"
    });
  });

  it("keeps closing current-run previews read-only and closes only after verification", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    const result = previewPolicyForCurrentRun(paths, {
      version: 2,
      objective: "what should we close out next?",
      phase: "closing",
      activeTasks: [],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "waiting"
      },
      lastCompactionTsUnix: 1_700_000_000,
      extra: {}
    });
    const scenario = result.policyPreview?.scenarios.at(-1);

    expect(result.pathsTouched).toEqual([]);
    expect(result.inventory).toEqual([]);
    expect(result.details.at(-1)).toContain("current-run-inspect:");
    expect(scenario?.input.runState).toBe("closing");
    expect(scenario?.continuation).toEqual({
      strategy: "close_when_verified",
      stopCondition: "closed"
    });
  });

  it("maps completed current-run phases to closing policy posture", () => {
    for (const phase of ["done", "complete", "completed", "finished"]) {
      const scenario = buildCurrentRunInspectPreview({
        version: 2,
        objective: "finish docs update",
        phase,
        activeTasks: [],
        blockingQuestions: [],
        verification: {
          status: "passed",
          summary: "checks passed"
        },
        lastCompactionTsUnix: 1_700_000_000,
        extra: {}
      });

      expect(scenario.input.runState).toBe("closing");
      expect(scenario.continuation).toEqual({
        strategy: "close_when_verified",
        stopCondition: "closed"
      });
    }
  });

  it("maps failed current-run phases to blocked self-repair posture", () => {
    for (const phase of ["error", "errored", "failed", "failing"]) {
      const scenario = buildCurrentRunInspectPreview({
        version: 2,
        objective: "finish release checklist",
        phase,
        activeTasks: ["verify release build"],
        blockingQuestions: [],
        verification: {
          status: "failed",
          summary: "release build failed"
        },
        lastCompactionTsUnix: 1_700_000_000,
        extra: {}
      });

      expect(scenario.input.runState).toBe("blocked");
      expect(scenario.continuation).toEqual({
        strategy: "self_repair_until_unblocked",
        stopCondition: "unblocked_or_needs_input"
      });
    }
  });

  it("derives stalled debug high-risk heuristics from failed verification", () => {
    const scenario = buildCurrentRunInspectPreview({
      version: 2,
      objective: "debug deploy error",
      phase: "stalled",
      activeTasks: ["reproduce deploy error"],
      blockingQuestions: [],
      verification: {
        status: "failed",
        summary: "repro failed"
      },
      lastCompactionTsUnix: 1_700_000_000,
      extra: {}
    });

    expect(scenario.input).toEqual({
      intent: "debug",
      taskShape: "local",
      risk: "high",
      ambiguity: "low",
      parallelism: "none",
      contextPressure: "low",
      runState: "blocked"
    });
    expect(scenario.obligations).toEqual([
      "debug_rigor",
      "verify_light",
      "planning",
      "review",
      "subagent_eligible",
      "self_repair"
    ]);
  });

  it("keeps canonical five scenarios when current-run is missing", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    const result = previewPolicy(paths);

    expect(result.details).toHaveLength(5);
    expect(result.policyPreview?.scenarios).toHaveLength(5);
    expect(result.details.some((line) => line.startsWith("current-run-inspect:"))).toBe(false);
    expect(result.policyPreview?.scenarios.some((scenario) => scenario.id === "current-run-inspect"))
      .toBe(false);
  });

  it("formats inspect policy preview lines through one presenter path", () => {
    const lines = formatInspectPolicyPreviewLines(
      {
        status: "present",
        scenarioCount: 1,
        scenarioIds: ["simple-question"],
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
            roles: null,
            orchestration: null,
            continuation: null,
            obligationCount: 0,
            traceCount: 0,
            trace: []
          }
        ],
        tsUnix: 1_700_000_006,
        summary: "policy preview: rendered adaptive obligation scenarios"
      },
      {
        summary: "policy preview: rendered adaptive obligation scenarios",
        details: ["simple-question: direct_answer | coordinator=gpt-5.4/high"],
        policyPreview: {
          scenarios: [
            {
              id: "simple-question",
              obligations: [],
              orchestration: {
                subagents: "none",
                subagentReadiness: "not_needed",
                reviewPosture: "inline_only",
                verifierTiming: "inline"
              },
              trace: []
            }
          ]
        }
      }
    );

    expect(lines).toEqual([
      "latest policy snapshot: present (current-run-derived read-only view; ts 1700000006; summary policy preview: rendered adaptive obligation scenarios; 1 scenarios: simple-question)",
      "latest policy input simple-question: intent question, task trivial, risk low, ambiguity low, parallelism none, context low, run exploring",
      "latest policy scenario simple-question: obligations 0, traces 0",
      "current policy preview: policy preview: rendered adaptive obligation scenarios; 1 scenario"
    ]);
  });

  it("adds current preview scenario details in action mode", () => {
    const lines = formatInspectPolicyPreviewLines(
      {
        status: "missing",
        scenarioCount: 0,
        scenarioIds: [],
        scenarios: [],
        tsUnix: null,
        summary: null
      },
      {
        summary: "policy preview: rendered adaptive obligation scenarios",
        details: [
          "simple-question: direct_answer | coordinator=gpt-5.4/high",
          "multi-file-feature: plan, tdd | coordinator=gpt-5.4/high"
        ],
        policyPreview: {
          scenarios: [
            {
              id: "simple-question",
              obligations: ["direct_answer"],
              orchestration: {
                subagents: "none",
                subagentReadiness: "not_needed",
                reviewPosture: "inline_only",
                verifierTiming: "inline"
              },
              trace: [{ obligation: "direct_answer", rule: "keep_direct_answers_light" }]
            }
          ]
        }
      },
      { mode: "action", currentPrefix: "current preview" }
    );

    expect(lines).toEqual([
      "latest policy snapshot: missing (current-run-derived read-only view)",
      "current preview: policy preview: rendered adaptive obligation scenarios; 1 scenario",
      "simple-question: direct_answer | coordinator=gpt-5.4/high",
      "multi-file-feature: plan, tdd | coordinator=gpt-5.4/high",
      "current preview scenario simple-question: obligations 1, traces 1, subagents none, readiness not_needed, review inline_only, verifier inline, trace reasons direct_answer via keep_direct_answers_light"
    ]);
  });
});
