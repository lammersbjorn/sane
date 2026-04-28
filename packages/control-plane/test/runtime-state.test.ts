import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import {
  appendJsonlRecord,
  createMissingLatestPolicyPreviewSnapshot,
  createDecisionRecord,
  readCurrentRunState,
  readRunSummary,
  stringifyDecisionRecord,
  writeCurrentRunState
} from "@sane/state";
import { afterEach, describe, expect, it } from "vitest";

import { installRuntime } from "../src/index.js";
import {
  advanceOutcomeState,
  inspectOutcomeRescueSignalFromRuntimeState,
  inspectRuntimeState,
  inspectOutcomeReadinessSnapshot,
  inspectSelfHostingShadowSnapshot,
  inspectSelfHostingShadowSnapshotFromRuntimeState
} from "../src/runtime-state.js";

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

  it("keeps .sane handoff independent from native Codex memories", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        "[features]",
        "memories = true"
      ].join("\n"),
      "utf8"
    );

    installRuntime(paths, codexPaths);

    expect(inspectRuntimeState(paths)).toMatchObject({
      current: {
        objective: "initialize sane runtime",
        phase: "setup"
      },
      summary: {
        version: 2
      },
      layerStatus: {
        currentRun: "present",
        summary: "present",
        brief: "present"
      },
      latestPolicyPreview: createMissingLatestPolicyPreviewSnapshot()
    });
  });

  it("advances outcome state through Sane handoff files without enabling an autonomous loop", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));

    const result = advanceOutcomeState(paths, {
      objective: "ship B8 outcome orchestration",
      nextTasks: ["write failing tests", "implement state machine"],
      completedTask: "write failing tests",
      verification: {
        status: "pending",
        summary: "implementation in progress"
      },
      milestone: "B8 outcome orchestration started",
      filesTouched: ["packages/control-plane/src/runtime-state.ts"]
    });

    expect(result.status).toBe("advanced");
    expect(result.current).toMatchObject({
      objective: "ship B8 outcome orchestration",
      phase: "executing",
      activeTasks: ["implement state machine"],
      blockingQuestions: [],
      verification: {
        status: "pending",
        summary: "implementation in progress"
      },
      extra: {
        outcome: expect.objectContaining({
          mode: "framework",
          autonomousLoop: false,
          stopCondition: "continue_until_verified"
        })
      }
    });
    expect(readCurrentRunState(paths.currentRunPath)).toEqual(result.current);
    expect(readRunSummary(paths.summaryPath).completedMilestones).toContain(
      "B8 outcome orchestration started"
    );
    expect(inspectRuntimeState(paths).brief).toContain("- Phase: executing");
  });

  it("blocks outcome advancement when unresolved input exists", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));

    const result = advanceOutcomeState(paths, {
      objective: "ship B8 outcome orchestration",
      nextTasks: ["continue implementation"],
      blockingQuestions: ["which repo should this mutate?"]
    });

    expect(result.status).toBe("blocked");
    expect(result.current.phase).toBe("blocked");
    expect(result.current.extra.outcome).toEqual(
      expect.objectContaining({
        autonomousLoop: false,
        stopCondition: "needs_input"
      })
    );
    expect(inspectOutcomeReadinessSnapshot(paths)).toMatchObject({
      status: "needs_input"
    });
  });

  it("warns when outcome work looks stalled from persisted timestamps", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));
    advanceOutcomeState(paths, {
      objective: "ship B15 rescue signal",
      nextTasks: ["patch inspect presenter"],
      verification: {
        status: "pending",
        summary: "waiting on visible output"
      }
    });
    const current = readCurrentRunState(paths.currentRunPath);
    writeCurrentRunState(paths.currentRunPath, {
      ...current,
      extra: {
        ...current.extra,
        outcome: {
          ...((current.extra.outcome as Record<string, unknown> | undefined) ?? {}),
          lastAdvanceTsUnix: 1
        }
      }
    });

    expect(inspectOutcomeReadinessSnapshot(paths).checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "long-silence",
          status: "warn"
        })
      ])
    );
    expect(inspectOutcomeRescueSignalFromRuntimeState(inspectRuntimeState(paths))).toMatchObject({
      status: "warn",
      summary: expect.stringContaining("long silence:")
    });
  });

  it("surfaces repeated phase, no file delta, and repeated tool error rescue signals", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));
    advanceOutcomeState(paths, {
      objective: "ship B15 rescue signals",
      nextTasks: ["keep working"],
      verification: {
        status: "pending",
        summary: "still running"
      },
      repeatedToolErrorCount: 3,
      toolError: "tool timeout"
    });
    for (let index = 0; index < 2; index += 1) {
      advanceOutcomeState(paths, {
        nextTasks: ["keep working"],
        verification: {
          status: "pending",
          summary: "still running"
        },
        repeatedToolErrorCount: 3,
        toolError: "tool timeout"
      });
    }

    const checks = inspectOutcomeReadinessSnapshot(paths).checks;

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "repeated-phase",
          status: "warn",
          summary: expect.stringContaining("repeated phase: executing")
        }),
        expect.objectContaining({
          id: "file-delta",
          status: "warn",
          summary: "no file delta recorded while active unverified work remains"
        }),
        expect.objectContaining({
          id: "repeated-tool-errors",
          status: "warn",
          summary: "repeated tool errors: 3 recent failure(s) (tool timeout)"
        })
      ])
    );
    expect(inspectOutcomeRescueSignalFromRuntimeState(inspectRuntimeState(paths))).toMatchObject({
      status: "warn",
      reasons: expect.arrayContaining([
        expect.stringContaining("repeated phase: executing"),
        "no file delta recorded while active unverified work remains",
        "repeated tool errors: 3 recent failure(s) (tool timeout)"
      ])
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

describe("inspectSelfHostingShadowSnapshot", () => {
  it("matches the from-runtime helper when using a captured runtime snapshot", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));
    const runtime = inspectRuntimeState(paths);

    expect(inspectSelfHostingShadowSnapshotFromRuntimeState(paths, runtime)).toEqual(
      inspectSelfHostingShadowSnapshot(paths)
    );
  });

  it("blocks shadow readiness until canonical handoff layers exist", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    const snapshot = inspectSelfHostingShadowSnapshot(paths);

    expect(snapshot).toMatchObject({
      mode: "shadow-inspect-only",
      runnerEnabled: false,
      status: "blocked"
    });
    expect(snapshot.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "current-run",
          status: "block"
        }),
        expect.objectContaining({
          id: "summary",
          status: "block"
        }),
        expect.objectContaining({
          id: "brief",
          status: "block"
        })
      ])
    );
  });

  it("reports ready shadow inspection after bootstrap without requiring native Codex memories", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        "[features]",
        "memories = true"
      ].join("\n"),
      "utf8"
    );

    installRuntime(paths, codexPaths);
    const current = inspectRuntimeState(paths).current;
    expect(current).not.toBeNull();
    writeFileSync(
      paths.currentRunPath,
      JSON.stringify(
        {
          ...current!,
          verification: {
            status: "passed",
            summary: "bootstrap verified"
          }
        },
        null,
        2
      ),
      "utf8"
    );

    expect(inspectSelfHostingShadowSnapshot(paths)).toMatchObject({
      mode: "shadow-inspect-only",
      runnerEnabled: false,
      status: "ready",
      checks: expect.arrayContaining([
        expect.objectContaining({
          id: "codex-native-memories",
          status: "pass"
        }),
        expect.objectContaining({
          id: "latest-policy-preview",
          status: "warn"
        })
      ])
    });
  });

  it("keeps shadow readiness blocked until current-run verification has passed", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));

    expect(inspectSelfHostingShadowSnapshot(paths)).toMatchObject({
      status: "blocked",
      checks: expect.arrayContaining([
        expect.objectContaining({
          id: "verification",
          status: "block",
          summary: "verification must pass before shadow readiness"
        })
      ])
    });
  });

  it("blocks shadow readiness when current-run still has real blocking questions", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    installRuntime(paths, createCodexPaths(homeDir));
    const current = inspectRuntimeState(paths).current;
    expect(current).not.toBeNull();
    writeFileSync(
      paths.currentRunPath,
      JSON.stringify(
        {
          ...current!,
          blockingQuestions: ["Which target should the self-heal runner mutate?"]
        },
        null,
        2
      ),
      "utf8"
    );

    expect(inspectSelfHostingShadowSnapshot(paths)).toMatchObject({
      status: "blocked",
      checks: expect.arrayContaining([
        expect.objectContaining({
          id: "blocking-questions",
          status: "block"
        })
      ])
    });
  });
});
