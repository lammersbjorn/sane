import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
import { appendJsonlRecord, createDecisionRecord, stringifyDecisionRecord } from "@sane/state";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyCodexProfile,
  formatInspectOverviewLines,
  installRuntime
} from "../src/index.js";
import {
  inspectSnapshotFromStatusBundle,
  inspectSnapshot
} from "../src/features/status/inspect-runtime.js";
import { exportHooks } from "../src/hooks-custom-agents.js";
import { inspectStatusBundle, showStatusFromStatusBundle } from "../src/inventory.js";
import { saveConfig } from "../src/preferences.js";
import { inspectRuntimeState } from "../src/runtime-state.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-control-plane-inspect-"));
  tempDirs.push(dir);
  return dir;
}

function expectReadOnlyRunnerDisabledOverview(overview: string): void {
  expect(overview).toContain("self-hosting shadow (read-only): ready, runner disabled");
  expect(overview).toContain("outcome readiness (read-only): ready, autonomous loop disabled");
  expect(overview).toContain("outcome rescue signal (read-only):");
  expect(overview).toContain("worktree readiness (read-only):");
  expect(overview).toContain("outcome verification (read-only):");
  expect(overview).toContain("repo verify (read-only):");
}

function expectOptionalPackProvenanceOverview(overview: string): void {
  expect(overview).toContain("optional guidance provenance:");
  expect(overview).toContain("caveman configured");
  expect(overview).toContain("rtk disabled");
  expect(overview).toContain("frontend-craft disabled");
  expect(overview).toContain("derived from taste-skill");
  expect(overview).toContain("impeccable");
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
    const current = inspectRuntimeState(paths).current;
    expect(current).not.toBeNull();
    writeFileSync(
      paths.currentRunPath,
      JSON.stringify(
        {
          ...current!,
          verification: {
            status: "passed",
            summary: "inspect fixture verified"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    saveConfig(paths, config);
    applyCodexProfile(paths, codexPaths);
    exportHooks(paths, codexPaths);

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
    expect(snapshot.outcomeReadiness).toMatchObject({
      mode: "codex-native-outcome-readiness",
      autonomousLoopEnabled: false,
      status: "ready"
    });
    expect(snapshot.outcomeRescueSignal).toMatchObject({
      status: "pass"
    });
    expect(snapshot.worktreeReadiness).toMatchObject({
      mode: "read-only-worktree-readiness",
      status: "missing"
    });
    expect(snapshot.runtimeOutcome).toMatchObject({
      phase: "setup",
      verificationStatus: "passed",
      verificationSummary: "inspect fixture verified"
    });
    expect(snapshot.repoVerifyCommand).toBeNull();
    expect(snapshot.latestPolicyPreview).toMatchObject({
      status: "missing",
      scenarioCount: 0,
      tsUnix: null,
      summary: null
    });
    expect(snapshot.localConfig.summary).toContain("config: ok");
    expect(snapshot.localConfig.details).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^explorer: .+ \(derived\)$/),
        expect.stringMatching(/^execution: .+ \(derived\)$/),
        expect.stringMatching(/^realtime: .+ \(derived\)$/)
      ])
    );
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
    expect(overview).toContain("main files:");
    expectReadOnlyRunnerDisabledOverview(overview);
    expect(overview).toContain("status line settings: missing");
    expect(overview).toContain("conflict warnings: none");
    expectOptionalPackProvenanceOverview(overview);
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
      "mcp_servers.experimental_sidecar: unmanaged Codex MCP server 'experimental_sidecar' is outside Sane's known tool settings; warning-only, no auto-install or auto-remove"
    );
  });

  it("surfaces worktree readiness from git metadata without mutating the repo", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    writeFileSync(join(projectRoot, ".git"), "gitdir: /tmp/linked-worktree/.git\n", "utf8");

    const snapshot = inspectSnapshot(paths, codexPaths);
    const overview = formatInspectOverviewLines(snapshot).join("\n");

    expect(snapshot.worktreeReadiness).toMatchObject({
      status: "ready",
      linkedWorktree: true,
      summary: "linked git worktree detected"
    });
    expect(overview).toContain("worktree readiness (read-only): ready - linked git worktree detected");
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
    expect(snapshot.latestPolicyPreview).toMatchObject({
      status: "present",
      scenarioCount: 2,
      scenarioIds: ["simple-question", "multi-file-feature"],
      scenarios: [
        {
          id: "simple-question",
          roles: {
            coordinator: true
          },
          orchestration: {
            subagents: "none",
            reviewPosture: "inline_only"
          }
        },
        {
          id: "multi-file-feature"
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

    expect(overview).toContain("out-of-sync files: config, hooks");
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

  it("keeps self-hosting shadow inspect tied to the captured runtime snapshot", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    const bundle = inspectStatusBundle(paths, codexPaths);
    const capturedCurrent = bundle.runtimeState.current;
    expect(capturedCurrent).not.toBeNull();

    writeFileSync(
      paths.currentRunPath,
      JSON.stringify(
        {
          ...capturedCurrent!,
          verification: {
            status: "passed",
            summary: "changed after bundle capture"
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const snapshot = inspectSnapshotFromStatusBundle(paths, codexPaths, bundle);

    expect(snapshot.selfHostingShadow.runtime.current?.verification.status).toBe("pending");
    expect(snapshot.outcomeReadiness.runtime.current?.verification.status).toBe("pending");
    expect(snapshot.selfHostingShadow.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "verification",
          status: "block",
          summary: "verification must pass before shadow readiness"
        })
      ])
    );
    expect(snapshot.outcomeReadiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "verification",
          status: "warn",
          summary: "verification is not complete yet; outcome work must verify before closing"
        }),
        expect.objectContaining({
          id: "policy-preflight",
          status: "pass"
        })
      ])
    );
  });
});
