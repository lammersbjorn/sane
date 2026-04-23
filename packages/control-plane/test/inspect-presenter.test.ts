import { describe, expect, it } from "vitest";

import {
  formatInspectDriftItemLines,
  formatInspectDriftSummaryLine,
  formatInspectOptionalPackProvenanceLine,
  formatInspectOverviewLines
} from "../src/inspect-presenter.js";

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
          upstreams: [{ name: "caveman", url: "https://github.com/JuliusBrussee/caveman", ref: "0.1.0" }]
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
        skillName: "design-taste-frontend",
        skillNames: ["design-taste-frontend", "impeccable"],
        provenance: {
          kind: "derived",
          note: "taste + impeccable",
          updateStrategy: "manual-curated",
          upstreams: [
            { name: "taste-skill", url: "https://github.com/Leonxlnx/taste-skill", ref: "main" },
            { name: "impeccable", url: "https://github.com/pbakaus/impeccable", ref: "main" }
          ]
        }
      }
    ]);

    expect(line).toBe(
      "optional pack provenance: caveman configured (sane-caveman; derived from caveman); rtk disabled (no skills; internal); frontend-craft disabled (design-taste-frontend + impeccable; derived from taste-skill + impeccable)"
    );
  });

  it("formats drift summary and detail lines", () => {
    expect(formatInspectDriftSummaryLine([])).toBe("export drift view: no current drift detected");

    const driftItems = [
      {
        name: "config",
        status: "invalid",
        repairHint: null
      },
      {
        name: "hooks",
        status: "invalid",
        repairHint: "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
      }
    ];

    expect(formatInspectDriftSummaryLine(driftItems)).toBe("export drift view: config, hooks");
    expect(formatInspectDriftItemLines(driftItems)).toEqual([
      "config: invalid",
      "hooks: invalid (Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows.)"
    ]);
  });

  it("formats inspect overview lines from shared backend snapshot data", () => {
    const lines = formatInspectOverviewLines({
      statusBundle: {
        counts: {
          installed: 1,
          configured: 1,
          disabled: 2,
          missing: 3,
          invalid: 1
        },
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
              upstreams: [{ name: "caveman", url: "https://github.com/JuliusBrussee/caveman", ref: "0.1.0" }]
            }
          }
        ],
        driftItems: [
          {
            name: "hooks",
            status: "invalid",
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
      latestPolicyPreview: { status: "missing" },
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
      driftItems: [
        {
          name: "hooks",
          status: "invalid",
          repairHint: "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
        }
      ]
    } as any);

    expect(lines).toContain(
      "status counts: installed 1, configured 1, disabled 2, missing 3, invalid 1, drift 1"
    );
    expect(lines).toContain("latest policy snapshot: missing (current-run-derived read-only view)");
    expect(lines).toContain(
      "optional pack provenance: caveman configured (sane-caveman; derived from caveman)"
    );
    expect(lines).toContain("export drift view: hooks");
    expect(lines).toContain(
      "hooks: invalid (Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows.)"
    );
  });
});
