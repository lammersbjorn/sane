import { describe, expect, it } from "vitest";

import {
  InventoryScope,
  InventoryStatus,
  OperationKind,
  OperationResult,
  removeManagedBlock,
  upsertManagedBlock
} from "../src/index.js";

describe("operation result rendering", () => {
  it("renders multiple inventory scopes under separate headings", () => {
    const result = new OperationResult({
      kind: OperationKind.ShowStatus,
      summary: "status ready",
      inventory: [
        {
          name: ".sane runtime",
          scope: InventoryScope.LocalRuntime,
          status: InventoryStatus.Installed,
          path: ".sane",
          repairHint: null
        },
        {
          name: "global AGENTS overlay",
          scope: InventoryScope.CodexNative,
          status: InventoryStatus.Invalid,
          path: "~/.codex/AGENTS.md",
          repairHint: "re-export managed block"
        }
      ]
    });

    expect(result.renderText()).toContain("local runtime:");
    expect(result.renderText()).toContain("  .sane runtime: installed");
    expect(result.renderText()).toContain(
      "  global AGENTS overlay: invalid (re-export managed block)"
    );
  });

  it("renders touched paths after details", () => {
    const result = new OperationResult({
      kind: OperationKind.ExportUserSkills,
      summary: "exported skills",
      details: ["wrote sane-router"],
      pathsTouched: ["~/.agents/skills/sane-router/SKILL.md"],
      policyPreview: {
        scenarios: [
          {
            id: "simple-question",
            summary: "simple low-risk question stays direct",
            input: {
              intent: "question",
              taskShape: "trivial",
              risk: "low",
              ambiguity: "low",
              parallelism: "none",
              contextPressure: "low",
              runState: "exploring"
            },
            obligations: ["direct_answer"],
            roles: {
              coordinator: true,
              sidecar: false,
              verifier: false
            },
            orchestration: {
              subagents: "solo_only",
              subagentReadiness: "task_too_small",
              reviewPosture: "none",
              verifierTiming: "none"
            },
            trace: [
              {
                obligation: "direct_answer",
                rule: "keep_direct_answers_light"
              }
            ]
          }
        ]
      }
    });

    expect(result.renderText()).toContain("exported skills\nwrote sane-router");
    expect(result.renderText()).toContain("paths: ~/.agents/skills/sane-router/SKILL.md");
  });
});

describe("inventory enum helpers", () => {
  it("returns stable display labels", () => {
    expect(InventoryStatus.PresentWithoutSaneBlock.asString()).toBe(
      "present_without_sane_block"
    );
    expect(InventoryStatus.PresentWithoutSaneBlock.displayString()).toBe(
      "present without Sane block"
    );
    expect(InventoryScope.LocalRuntime.displayString()).toBe("local runtime");
    expect(InventoryScope.CodexNative.displayString()).toBe("codex-native");
    expect(InventoryScope.Compatibility.displayString()).toBe("compatibility");
  });
});

describe("managed block helpers", () => {
  it("upserts a managed block without losing surrounding user content", () => {
    const updated = upsertManagedBlock(
      "# User notes\n",
      "<!-- sane:start -->",
      "<!-- sane:end -->",
      "# Sane\n- managed"
    );

    expect(updated).toBe(
      "# User notes\n\n<!-- sane:start -->\n# Sane\n- managed\n<!-- sane:end -->\n"
    );
  });

  it("replaces an existing managed block cleanly", () => {
    const updated = upsertManagedBlock(
      "# User notes\n\n<!-- sane:start -->\nold\n<!-- sane:end -->\n",
      "<!-- sane:start -->",
      "<!-- sane:end -->",
      "new"
    );

    expect(updated).toBe("# User notes\n\n<!-- sane:start -->\nnew\n<!-- sane:end -->\n");
  });

  it("removes only the managed block and keeps user content", () => {
    const updated = removeManagedBlock(
      "# User notes\n\n<!-- sane:start -->\nold\n<!-- sane:end -->\n\n# More notes\n",
      "<!-- sane:start -->",
      "<!-- sane:end -->"
    );

    expect(updated).toBe("# User notes\n\n# More notes\n");
  });
});
