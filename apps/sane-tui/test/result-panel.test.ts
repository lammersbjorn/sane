import { describe, expect, it } from "vite-plus/test";

import { OperationKind, OperationResult } from "@sane/core";

import { buildLastResultView, buildNotice } from "@/result-panel.js";

describe("result panel helpers", () => {
  it("renders fallback latest-status lines", () => {
    expect(buildLastResultView(null, "Ready.\nUse arrows.\n").lines).toEqual([
      "Ready.",
      "Use arrows."
    ]);
  });

  it("builds success notices only for commands with notice titles", () => {
    const result = new OperationResult({
      kind: OperationKind.ExportAll,
      summary: "export all: installed managed targets",
      details: ["path: ~/.codex/AGENTS.md"],
      pathsTouched: ["~/.codex/AGENTS.md"]
    });

    expect(buildNotice("export_all", result)?.title).toBe("Installed");
    expect(buildNotice("export_all", result)?.body).toContain("export all: installed managed targets");
    expect(buildNotice("reset_telemetry_data", result)?.title).toBe("Reset");
    expect(buildNotice("show_status", result)).toBeNull();
  });
});
