import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { InventoryScope, InventoryStatus } from "@sane/core";
import { optionalPackSkillNames } from "@sane/framework-assets";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { appendJsonlRecord, createDecisionRecord, stringifyDecisionRecord } from "@sane/state";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyCodexProfile } from "@sane/control-plane/codex-config.js";
import { exportHooks } from "@sane/control-plane/hooks-custom-agents.js";
import * as controlPlane from "@sane/control-plane";
import * as inventory from "@sane/control-plane/inventory.js";
import { formatInspectOverviewLines as formatSharedInspectOverviewLines, installRuntime } from "@sane/control-plane";
import { saveConfig } from "@sane/control-plane/preferences.js";
import { type InspectOverviewSnapshot } from "@sane/control-plane";
import { statusOverviewLines, loadStatusScreen, loadStatusScreenFromStatusBundle } from "@sane/sane-tui/status-screen.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-tui-status-"));
  tempDirs.push(dir);
  return dir;
}

function expectReadOnlyStatusOverview(overview: string): void {
  expect(overview).toContain("self-hosting shadow (read-only):");
  expect(overview).toContain("runner disabled");
  expect(overview).toContain("outcome readiness (read-only):");
  expect(overview).toContain("autonomous loop disabled");
}

function expectOptionalPackProvenanceOverview(overview: string): void {
  expect(overview).toContain("optional pack provenance:");
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

describe("status screen model", () => {
  it("includes hook repair hints in overview lines", () => {
    const snapshot: InspectOverviewSnapshot = {
      statusBundle: {
        counts: {
          installed: 0,
          configured: 0,
          disabled: 0,
          missing: 0,
          invalid: 1,
          present_without_sane_block: 0,
          removed: 0
        },
        conflictWarnings: [],
        optionalPacks: [
          {
            name: "caveman",
            inventoryName: "pack-caveman",
            status: "configured",
            skillName: "sane-caveman",
            skillNames: ["sane-caveman"],
            provenance: {
              kind: "derived",
              note: "curated from caveman",
              updateStrategy: "manual-curated",
              upstreams: [{ name: "caveman", url: "https://github.com/JuliusBrussee/caveman", ref: "v1.6.0" }]
            }
          },
          {
            name: "rtk",
            inventoryName: "pack-rtk",
            status: "disabled",
            skillName: null,
            skillNames: [],
            provenance: { kind: "internal", note: "local", updateStrategy: "manual-curated" }
          },
          {
            name: "frontend-craft",
            inventoryName: "pack-frontend-craft",
            status: "disabled",
            skillName: "sane-frontend-craft",
            skillNames: optionalPackSkillNames("frontend-craft"),
            provenance: {
              kind: "derived",
              note: "compact frontend craft",
              updateStrategy: "manual-curated",
              upstreams: [
                { name: "taste-skill", url: "https://github.com/Leonxlnx/taste-skill", ref: "main" },
                { name: "impeccable", url: "https://github.com/pbakaus/impeccable", ref: "main" },
                { name: "make-interfaces-feel-better", url: "https://skills.sh/jakubkrehel/make-interfaces-feel-better/make-interfaces-feel-better", ref: null }
              ]
            }
          }
        ],
        driftItems: [
          {
            name: "hooks",
            scope: InventoryScope.CodexNative,
            status: InventoryStatus.Invalid,
            path: "/tmp/.codex/hooks.json",
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
      doctorHeadline: "doctor: hooks invalid",
      runtimeSummary: { summary: "runtime-summary: no local handoff state" },
      runtimeHistory: { events: 0, decisions: 0, artifacts: 0 },
      runtimeHistoryPreview: {
        latestEvent: null,
        latestDecision: null,
        latestArtifact: null
      },
      selfHostingShadow: {
        mode: "shadow-inspect-only",
        runnerEnabled: false,
        status: "blocked",
        checks: [
          { status: "pass" },
          { status: "warn" },
          { status: "block" }
        ]
      },
      outcomeReadiness: {
        mode: "codex-native-outcome-readiness",
        autonomousLoopEnabled: false,
        status: "blocked",
        checks: [
          { status: "pass" },
          { status: "block" },
          { status: "block" }
        ]
      },
      outcomeRescueSignal: {
        status: "block",
        summary: "current-run payload is unavailable",
        reasons: ["current-run payload is unavailable"]
      },
      worktreeReadiness: {
        mode: "read-only-worktree-readiness",
        status: "missing",
        summary: "no git metadata found; parallel lanes need a git repo or explicit workspace copies",
        path: null,
        linkedWorktree: false,
        reasons: ["worktree isolation is unavailable until git metadata exists"]
      },
      runtimeOutcome: {
        phase: null,
        activeTaskCount: 0,
        blockingQuestionCount: 0,
        verificationStatus: null,
        verificationSummary: null,
        lastVerifiedOutputs: [],
        filesTouchedCount: 0
      },
      repoVerifyCommand: null,
      latestPolicyPreview: {
        status: "missing",
        scenarioCount: 0,
        scenarioIds: [],
        scenarios: [],
        tsUnix: null,
        summary: null
      },
      localConfig: { summary: "config: ok" },
      codexConfig: { summary: "codex-config: ok" },
      integrationsAudit: { status: "missing", recommendedChangeCount: 0 },
      integrationsApply: { status: "ready", appliedKeys: [] },
      integrationsPreview: { summary: "integrations-profile preview" },
      statuslineAudit: { status: "missing", recommendedChangeCount: 3 },
      statuslineApply: {
        status: "ready",
        appliedKeys: ["tui.notification_condition", "tui.status_line", "tui.terminal_title"]
      },
      statuslinePreview: { summary: "statusline-profile preview: 3 recommended change(s)" },
      policyPreview: {
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
      },
      driftItems: [
        {
          name: "hooks",
          status: "invalid",
          repairHint: "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
        }
      ]
    };
    const lines = statusOverviewLines(snapshot);

    expect(lines).toContain(
      "hooks: invalid (Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows.)"
    );
    expect(lines).toContain(
      "outcome rescue signal (read-only): block - current-run payload is unavailable"
    );
    expect(lines).toContain(
      "worktree readiness (read-only): missing - no git metadata found; parallel lanes need a git repo or explicit workspace copies"
    );
    expect(lines).toContain("outcome verification (read-only): missing");
    expect(lines).toContain("repo verify (read-only): none");
    expectReadOnlyStatusOverview(lines.join("\n"));
    expectOptionalPackProvenanceOverview(lines.join("\n"));
    expect(lines).toEqual(formatSharedInspectOverviewLines(snapshot));
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
    exportHooks(paths, codexPaths);

    const screen = loadStatusScreen(paths, codexPaths);

    expect(screen.summary).toBe("Status");
    expect(screen.actions.map((action) => action.id)).toEqual([
      "show_status",
      "doctor",
      "show_runtime_summary",
      "show_config",
      "show_codex_config",
      "preview_integrations_profile",
      "preview_statusline_profile",
      "preview_policy",
      "show_outcome_readiness",
      "review_issue_draft",
      "submit_issue_draft",
      "check_updates"
    ]);
    expect(screen.actions.map((action) => action.id)).not.toContain("apply_integrations_profile");
    expect(screen.statusBundle.inventory).toHaveLength(screen.status.inventory.length);
    expect(screen.statusBundle.primary.installBundle).toBe("missing");
    expect(screen.statusBundle.primary.runtime?.status.displayString()).toBe("installed");
    expect(screen.status.summary).toContain("managed targets inspected");
    expect(screen.doctor.summary).toContain("hooks: installed");
    expect(screen.doctorHeadline).toBe("runtime: ok");
    expect(screen.runtimeSummary.summary).toContain("runtime-summary:");
    expect(screen.runtimeSummary.details.join("\n")).toContain("current-run:");
    expect(screen.localConfig.summary).toContain("config: ok");
    expect(screen.codexConfig.summary).toContain("codex-config: ok");
    expect(screen.integrationsPreview.summary).toContain("integrations-profile preview");
    expect(screen.integrationsPreview.details).toContain("context7: missing -> recommended");
    expect(screen.integrationsAudit.status).toBe("missing");
    expect(screen.integrationsAudit.recommendedChangeCount).toBe(3);
    expect(screen.integrationsAudit.recommendedTargets).toEqual(["context7", "playwright", "grep.app"]);
    expect(screen.integrationsApply.status).toBe("ready");
    expect(screen.integrationsApply.appliedKeys).toEqual([
      "mcp_servers.context7",
      "mcp_servers.playwright",
      "mcp_servers.grep_app"
    ]);
    expect(screen.statuslineAudit.status).toBe("missing");
    expect(screen.statuslineAudit.recommendedChangeCount).toBe(3);
    expect(screen.statuslineApply.status).toBe("ready");
    expect(screen.statuslineApply.appliedKeys).toEqual([
      "tui.notification_condition",
      "tui.status_line",
      "tui.terminal_title"
    ]);
    expect(screen.statuslinePreview.summary).toContain("statusline-profile preview");
    expect(screen.runtimeHistory).toEqual({
      events: 0,
      decisions: 0,
      artifacts: 0
    });
    expect(screen.runtimeHistoryPreview).toEqual({
      latestEvent: null,
      latestDecision: null,
      latestArtifact: null
    });
    expect(screen.statusBundle.optionalPacks).toEqual([
      expect.objectContaining({
        name: "caveman",
        status: "configured",
        skillNames: ["sane-caveman"],
        provenance: expect.objectContaining({
          kind: "derived"
        })
      }),
      expect.objectContaining({
        name: "rtk",
        status: "disabled",
        skillNames: ["sane-rtk"],
        provenance: expect.objectContaining({
          kind: "internal"
        })
      }),
      expect.objectContaining({
        name: "frontend-craft",
        status: "disabled",
        skillNames: expect.any(Array),
        provenance: expect.objectContaining({
          kind: "derived"
        })
      }),
      expect.objectContaining({
        name: "docs-craft",
        status: "disabled",
        skillNames: ["sane-docs-writing"],
        provenance: expect.objectContaining({
          kind: "derived"
        })
      })
    ]);
    expect(screen.latestPolicyPreview).toMatchObject({
      status: "missing",
      scenarioCount: 0,
      scenarioIds: [],
      scenarios: [],
      tsUnix: null,
      summary: null
    });
    expect(screen.driftItems).toEqual([]);
    expect(screen.policyPreview.summary).toBe("policy preview: rendered adaptive obligation scenarios");
    expect(screen.overviewLines).toEqual(formatSharedInspectOverviewLines(screen));
    expect(screen.overviewLines.join("\n")).toContain("status counts:");
    expect(screen.overviewLines.join("\n")).toContain("primary surfaces:");
    expect(screen.overviewLines.join("\n")).toContain("setup check:");
    expect(screen.overviewLines.join("\n")).toContain("runtime summary (read-only local visibility):");
    expect(screen.overviewLines.join("\n")).toContain("runtime history (read-only local visibility):");
    expect(screen.overviewLines.join("\n")).toContain("latest event (read-only local visibility): missing");
    expect(screen.overviewLines.join("\n")).toContain(
      "latest decision (read-only local visibility): missing"
    );
    expect(screen.overviewLines.join("\n")).toContain(
      "latest artifact (read-only local visibility): missing"
    );
    expect(screen.overviewLines.join("\n")).toContain("latest policy snapshot: missing (current-run-derived read-only view)");
    expect(screen.overviewLines.join("\n")).toContain(
      "current policy preview: policy preview: rendered adaptive obligation scenarios;"
    );
    expect(screen.overviewLines.join("\n")).toContain("statusline profile: missing (3 recommended changes)");
    expectReadOnlyStatusOverview(screen.overviewLines.join("\n"));
    expectOptionalPackProvenanceOverview(screen.overviewLines.join("\n"));
  });

  it("surfaces invalid drift items for inspect consumers", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.hooksJson, "{", "utf8");

    const screen = loadStatusScreen(paths, codexPaths);

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
            }
          },
          { id: "multi-file-feature" }
        ]
      }
    );
    decision.tsUnix = 1_700_000_004;
    appendJsonlRecord(paths.decisionsPath, decision, stringifyDecisionRecord);

    const screen = loadStatusScreen(paths, codexPaths);

    expect(screen.runtimeHistory).toEqual({
      events: 0,
      decisions: 1,
      artifacts: 0
    });
    expect(screen.runtimeHistoryPreview).toEqual({
      latestEvent: null,
      latestDecision: {
        tsUnix: 1_700_000_004,
        summary: "policy preview: rendered adaptive obligation scenarios",
        rationale: "simple-question: direct_answer | coordinator=gpt-5.4/high"
      },
      latestArtifact: null
    });
    expect(screen.latestPolicyPreview).toMatchObject({
      status: "present",
      scenarioCount: 2,
      scenarioIds: ["simple-question", "multi-file-feature"],
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
            reviewPosture: "inline_only"
          }
        },
        {
          id: "multi-file-feature"
        }
      ],
      tsUnix: 1_700_000_004,
      summary: "policy preview: rendered adaptive obligation scenarios"
    });
    expect(screen.overviewLines.join("\n")).toContain(
      "latest policy snapshot: present (current-run-derived read-only view; ts 1700000004; summary policy preview: rendered adaptive obligation scenarios; 2 scenarios: simple-question, multi-file-feature)"
    );
    expect(screen.overviewLines.join("\n")).toContain(
      "latest decision (read-only local visibility): ts 1700000004, summary policy preview: rendered adaptive obligation scenarios, rationale simple-question: direct_answer | coordinator=gpt-5.4/high"
    );
    expect(screen.overviewLines.join("\n")).toContain(
      "latest policy input simple-question: intent question, task trivial, risk low, ambiguity low, parallelism none, context low, run exploring"
    );
    expect(screen.overviewLines.join("\n")).toContain(
      "latest policy roles simple-question: coordinator on, sidecar off, verifier off"
    );
    expect(screen.overviewLines.join("\n")).toContain(
      "latest policy orchestration simple-question: subagents none, readiness not_needed, review inline_only, verifier inline"
    );
  });

  it("builds from a preloaded status bundle when requested", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const bundle = inventory.inspectStatusBundle(paths, codexPaths);
    const fromBundleSpy = vi.spyOn(controlPlane, "inspectSnapshotFromStatusBundle");
    const screen = loadStatusScreenFromStatusBundle(paths, codexPaths, bundle);

    expect(fromBundleSpy).toHaveBeenCalledTimes(1);
    expect(fromBundleSpy).toHaveBeenCalledWith(paths, codexPaths, bundle);
    expect(screen.summary).toBe("Status");
  });
});
