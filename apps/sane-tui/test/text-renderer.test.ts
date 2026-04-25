import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { loadAppView } from "@sane/sane-tui/app-view.js";
import { createTuiShell, runSelectedAction } from "@sane/sane-tui/shell.js";
import { renderTextAppView } from "@sane/sane-tui/text-renderer.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-text-renderer-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("text renderer", () => {
  it("renders the public tui frame with a rail and dominant detail pane", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    const output = renderTextAppView(loadAppView(shell));

    expect(output).toContain("Sane | Codex-native onboarding and setup");
    expect(output).toContain("Section: get_started");
    expect(output).toContain("Sections: [Start here]");
    expect(output).toContain("Mode: Browse");
    expect(output).toContain("Set up preferences");
    expect(output).toContain("Install to Codex");
    expect(output).toContain("Runtime [missing]");
    expect(output).toContain("| Actions");
    expect(output).toContain("| > 1. Create Sane's local");
    expect(output).toContain("Get Started Details");
    expect(output).toContain("Section overview");
    expect(output).toContain("Selected step");
    expect(output).toContain("Latest Status");
  });

  it("renders a compact statusline with the primary surfaces", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    const output = renderTextAppView(loadAppView(shell));

    expect(output).toContain("Runtime [missing]");
    expect(output).toContain("Codex [missing]");
    expect(output).toContain("Skills [missing]");
    expect(output).toContain("Hooks [missing]");
    expect(output).toContain("Drift [1 issue(s)]");
  });

  it("keeps the standard footer statusline on one line", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    const output = renderTextAppView(loadAppView(shell), {
      width: 112,
      height: 32
    });
    const footerLines = output
      .split("\n")
      .filter((line) => line.startsWith("mode browse"));

    expect(footerLines).toHaveLength(1);
    expect(footerLines[0]!.length).toBeLessThanOrEqual(112);
    expect(footerLines[0]).toContain("runtime");
    expect(footerLines[0]).toContain("drift");
  });

  it("renders overlay state when present", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");
    shell.notice = {
      title: "Saved",
      body: "saved body",
      footer: "Enter, Space, or Esc closes this message.",
      section: "preferences"
    };

    const output = renderTextAppView(loadAppView(shell));

    expect(output).toContain("[Overlay: Saved]");
    expect(output).toContain("| saved body");
    expect(output).toContain("Enter, Space, or Esc closes this message.");
    expect(output).toContain("Mode: Notice");
  });

  it("shows selection changes in the rendered action list", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    shell.activeActionIndex = 1;

    const output = renderTextAppView(loadAppView(shell));

    expect(output).toContain("[recommended]");
    expect(output).toContain("| > 2. View your current Codex");
  });

  it("keeps the selected action visible when the rail is windowed", () => {
    const shell = createTuiShell(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir()),
      "settings"
    );
    shell.activeActionIndex = 8;

    const output = renderTextAppView(loadAppView(shell), {
      width: 56,
      height: 24
    });

    expect(output).toContain("Selected: Apply Cloudflare Codex");
    expect(output).toContain("...");
  });

  it("fits output into a bounded viewport", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");

    const output = renderTextAppView(loadAppView(shell), {
      width: 48,
      height: 16
    });

    const lines = output.split("\n");
    expect(lines).toHaveLength(16);
    expect(lines.every((line) => line.length <= 48)).toBe(true);
    expect(output).toContain("Selected:");
    expect(output).toContain("Sane | Codex-native onboarding");
  });

  it("adds ansi styling only when requested", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    const output = renderTextAppView(loadAppView(shell), {
      ansi: true
    });

    expect(output).toContain("\u001b[1mSane | Codex-native onboarding and setup\u001b[0m");
    expect(output).toContain("\u001b[33mRuntime [missing]\u001b[0m");
    expect(output).toContain("\u001b[7m[Start here]\u001b[0m");
    expect(output).toContain("\u001b[7m| > 1. Create Sane's local");
    expect(output).toContain("\u001b[1;36m| Actions");
  });

  it("renders editor overlays as distinct framed sections", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");
    runSelectedAction(shell);

    const output = renderTextAppView(loadAppView(shell));

    expect(output).toContain("[Overlay: Model Defaults]");
    expect(output).toContain("Mode: Edit Models");
    expect(output).toContain("Last Result");
    expect(output).toContain("Field Help");
  });
});
