import { describe, expect, it } from "vitest";

import { OperationKind, OperationResult } from "@sane/control-plane/core.js";

import { buildLastResultView, buildNotice } from "@sane/sane-tui/result-panel.js";

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

  it("preserves exact rendered result lines before truncating", () => {
    const result = new OperationResult({
      kind: OperationKind.ShowStatus,
      summary: "managed targets inspected",
      details: [
        "runtime: installed",
        "codex-config: installed",
        "hooks: missing",
        "user-skills: missing",
        "custom-agents: missing",
        "drift: 1 issue(s)",
        "doctor: ok",
        "summary: healthy",
        "paths: ~/.codex/config.toml",
        "backups: 3"
      ]
    });

    const view = buildLastResultView(result, "fallback");

    expect(view.lines[0]).toBe("managed targets inspected");
    expect(view.lines).toContain("runtime: installed");
    expect(view.lines.at(-1)).toMatch(/more line\(s\)$/);
  });
});
