import { OperationKind, OperationResult } from "@sane/control-plane/core.js";
import { describe, expect, it } from "vitest";

import type { UiCommandId } from "@sane/sane-tui/command-registry.js";

interface ResultNotice {
  title: string;
  body: string;
}

interface LastResultPanel {
  title: "Last Result";
  lines: string[];
}

interface ResultPanelLayerModule {
  renderResultNotice(input: {
    commandId: UiCommandId;
    actionLabel: string;
    result: OperationResult;
  }): ResultNotice | null;
  renderLastResult(input: {
    actionLabel: string;
    result: OperationResult;
    maxLines: number;
  }): LastResultPanel;
}

async function loadResultPanelLayer(): Promise<ResultPanelLayerModule> {
  try {
    return (await import("../src/result-panel-layer.js")) as ResultPanelLayerModule;
  } catch (error) {
    throw new Error(
      "expected ../src/result-panel-layer.ts to define compact notice + last-result rendering",
      { cause: error as Error }
    );
  }
}

describe("result panel layer", () => {
  it("renders success notice copy from command metadata and OperationResult", async () => {
    const panels = await loadResultPanelLayer();
    const result = new OperationResult({
      kind: OperationKind.ApplyCodexProfile,
      summary: "core Codex profile applied",
      details: ["rewritten path: ~/.codex/config.toml"]
    });

    const notice = panels.renderResultNotice({
      commandId: "apply_codex_profile",
      actionLabel: "5. Apply Sane's recommended Codex settings",
      result
    });

    expect(notice).not.toBeNull();
    expect(notice?.title).toBe("Applied");
    expect(notice?.body).toContain("Completed `5. Apply Sane's recommended Codex settings`.");
    expect(notice?.body).toContain("core Codex profile applied");
  });

  it("does not open a notice for non-notice commands", async () => {
    const panels = await loadResultPanelLayer();
    const result = new OperationResult({
      kind: OperationKind.ShowConfig,
      summary: "config: ok",
      details: ["source: local"]
    });

    const notice = panels.renderResultNotice({
      commandId: "show_config",
      actionLabel: "View your current Sane config",
      result
    });

    expect(notice).toBeNull();
  });

  it("renders a compact last-result panel from OperationResult", async () => {
    const panels = await loadResultPanelLayer();
    const result = new OperationResult({
      kind: OperationKind.ShowStatus,
      summary: "managed targets inspected",
      details: [
        "runtime: installed",
        "config: installed",
        "codex-config: installed",
        "user-skills: installed"
      ],
      pathsTouched: ["~/.codex/config.toml", ".sane/config.toml"]
    });

    const panel = panels.renderLastResult({
      actionLabel: "Show everything Sane currently manages",
      result,
      maxLines: 4
    });

    expect(panel.title).toBe("Last Result");
    expect(panel.lines[0]).toBe("Completed `Show everything Sane currently manages`.");
    expect(panel.lines.some((line) => line.includes("managed targets inspected"))).toBe(true);
    expect(panel.lines).toHaveLength(4);
    expect(panel.lines.at(-1)).toMatch(/more line\(s\)$/);
  });
});
