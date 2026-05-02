import { describe, expect, it } from "vitest";
import { InventoryScope, InventoryStatus } from "@sane/core";
import { optionalPackSkillNames } from "@sane/framework-assets";

import {
  formatInspectDriftItemLines,
  formatInspectDriftSummaryLine,
  formatInspectOptionalPackProvenanceLine,
  formatInspectOverviewLines,
  type InspectOverviewSnapshot
} from "../src/inspect-presenter.js";

function expectOptionalPackProvenanceContract(line: string): void {
    expect(line).toContain("optional guidance provenance:");
  expect(line).toContain("caveman configured");
  expect(line).toContain("derived from caveman");
  expect(line).toContain("rtk disabled (no skills; internal)");
  expect(line).toContain("frontend-craft disabled");
  expect(line).toContain("derived from taste-skill");
  expect(line).toContain("impeccable");
  expect(line).toContain("docs-craft disabled");
  expect(line).toContain("google-gemini-docs-writer");
}

describe("inspect presenter", () => {
  it("formats optional-pack provenance with upstream and internal origins", () => {
    const line = formatInspectOptionalPackProvenanceLine([
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
      },
      {
        name: "docs-craft",
        inventoryName: "pack-docs-craft",
        status: "disabled",
        skillName: "sane-docs-writing",
        skillNames: optionalPackSkillNames("docs-craft"),
        provenance: {
          kind: "derived",
          note: "compact docs writing",
          updateStrategy: "manual-curated",
          upstreams: [
            { name: "google-gemini-docs-writer", url: "https://github.com/google-gemini/gemini-cli", ref: null },
            { name: "aiskillstore-writing-docs", url: "https://agentskill.sh/aiskillstore/writing-docs", ref: null }
          ]
        }
      }
    ]);

    expectOptionalPackProvenanceContract(line);
  });

  it("formats drift summary and detail lines", () => {
    expect(formatInspectDriftSummaryLine([])).toBe("out-of-sync files: none");

    const driftItems = [
      {
        name: "config",
        status: "invalid",
        repairHint: null
      },
      {
        name: "hooks",
        status: "unsupported (use WSL)",
        repairHint: "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
      }
    ];

    expect(formatInspectDriftSummaryLine(driftItems)).toBe("out-of-sync files: config, hooks");
    expect(formatInspectDriftItemLines(driftItems)).toEqual([
      "config: invalid",
      "hooks: unsupported (use WSL)"
    ]);
  });

  it("formats inspect overview lines from shared backend snapshot data", () => {
    const snapshot: InspectOverviewSnapshot = {
      statusBundle: {
        counts: {
          installed: 1,
          configured: 1,
          disabled: 2,
          missing: 3,
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
          hooks: {
            name: "hooks",
            scope: InventoryScope.CodexNative,
            status: InventoryStatus.Invalid,
            path: "/tmp/.codex/hooks.json",
            repairHint: "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
          },
          customAgents: null,
          installBundle: "missing",
          status: {
            runtime: "installed",
            codexConfig: "configured",
            userSkills: "missing",
            hooks: "invalid",
            customAgents: "missing",
            installBundle: "missing"
          }
        }
      },
      doctorHeadline: "runtime: ok",
      runtimeSummary: { summary: "runtime-summary: local handoff state at /tmp/.sane" },
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
        status: "ready",
        checks: [
          { status: "pass" },
          { status: "pass" },
          { status: "warn" },
          { status: "warn" }
        ]
      },
      outcomeRescueSignal: {
        status: "warn",
        summary: "long silence: no persisted progress for 42m while 1 task(s) remain open",
        reasons: ["long silence: no persisted progress for 42m while 1 task(s) remain open"]
      },
      worktreeReadiness: {
        mode: "read-only-worktree-readiness",
        status: "ready",
        summary: "linked git worktree detected",
        path: "/tmp/repo/.git",
        linkedWorktree: true,
        reasons: ["checkout is already backed by a worktree gitdir"]
      },
      runtimeOutcome: {
        phase: "executing",
        activeTaskCount: 1,
        blockingQuestionCount: 0,
        verificationStatus: "pending",
        verificationSummary: "implementation in progress",
        lastVerifiedOutputs: [],
        filesTouchedCount: 0
      },
      repoVerifyCommand: "rtk run 'pnpm test && pnpm typecheck'",
      latestPolicyPreview: {
        status: "missing",
        scenarioCount: 0,
        scenarioIds: [],
        scenarios: [],
        tsUnix: null,
        summary: null
      },
      policyPreview: {
        summary: "policy preview: rendered adaptive obligation scenarios",
        details: ["simple-question: direct_answer | coordinator=gpt-5.4/high"],
        policyPreview: {
          scenarios: [{ id: "simple-question", obligations: [], orchestration: { subagents: "none", subagentReadiness: "not_needed", reviewPosture: "inline_only", verifierTiming: "inline" }, trace: [] }]
        }
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
      driftItems: [
        {
          name: "hooks",
          status: "invalid",
          repairHint: "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
        }
      ]
    };
    const lines = formatInspectOverviewLines(snapshot);

    expect(lines).toContain(
      "status counts: installed 1, configured 1, disabled 2, missing 3, invalid 1, out-of-sync 1"
    );
    expect(lines).toContain("latest policy snapshot: missing (current-run-derived read-only view)");
    expect(lines).toContain(
      "self-hosting shadow (read-only): blocked, runner disabled, checks pass 1, warn 1, block 1"
    );
    expect(lines).toContain(
      "outcome readiness (read-only): ready, autonomous loop disabled, checks pass 2, warn 2, block 0"
    );
    expect(lines).toContain(
      "outcome rescue signal (read-only): warn - long silence: no persisted progress for 42m while 1 task(s) remain open"
    );
    expect(lines).toContain("worktree readiness (read-only): ready - linked git worktree detected");
    expect(lines).toContain(
      "outcome verification (read-only): pending (implementation in progress)"
    );
    expect(lines).toContain(
      "outcome progress (read-only): phase executing, active tasks 1, blocking questions 0, files touched 0"
    );
    expect(lines).toContain("last verified outputs (read-only): none");
    expect(lines).toContain("repo verify (read-only): rtk run 'pnpm test && pnpm typecheck'");
    expect(lines.join("\n")).toContain("optional guidance provenance:");
    expect(lines.join("\n")).toContain("caveman configured");
    expect(lines.join("\n")).toContain("derived from caveman");
    expect(lines).toContain("out-of-sync files: hooks");
    expect(lines).toContain("conflict warnings: none");
    expect(lines).toContain(
      "main files: local setup installed, codex configured, user skills missing, hooks unsupported (use WSL), named agents missing"
    );
    expect(lines.filter((line) => line === "")).toHaveLength(4);
  });
});
