import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/control-plane/platform.js";
import { afterEach, describe, expect, it } from "vitest";

import { loadAppView } from "@sane/sane-tui/app-view.js";
import { createTuiShell, moveSelection, runSelectedAction, selectSection } from "@sane/sane-tui/shell.js";
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
  it("renders a focused base view without tab strip chrome", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    const output = renderTextAppView(loadAppView(shell));

    expect(output).toContain("Focus:");
    expect(output).toContain("Current job");
    expect(output).toContain("Actions");
    expect(output).toContain("Selected:");
    expect(output).toContain("Impact:");
    expect(output).toContain("Undo:");
    expect(output).not.toContain("control center");
    expect(output).not.toContain("Sections:");
    expect(output).not.toContain("[Home]");
  });

  it("uses contextual footer with keys and state", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    const output = renderTextAppView(loadAppView(shell), { width: 112, height: 32 });

    expect(output).toContain("Keys: enter");
    expect(output).toContain("up/down move");
    expect(output).toContain("State:");
    expect(output).toContain("local setup");
    expect(output).toContain("drift");
  });

  it("uses compact state labels in narrow terminals", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    const output = renderTextAppView(loadAppView(shell), { width: 56, height: 20 });

    expect(output).toContain("State: local");
    expect(output).toContain("cx");
    expect(output).toContain("sk");
    expect(output).toContain("hk");
    expect(output).toContain("dr");
  });

  it("keeps install/default/settings/status surfaces visible across viewports", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    selectSection(shell, "home");
    expect(renderTextAppView(loadAppView(shell), { width: 56, height: 20 })).toContain("Set up the local Sane files");

    selectSection(shell, "add_to_codex");
    expect(renderTextAppView(loadAppView(shell), { width: 96, height: 26 })).toContain("Choose what Sane adds to Codex.");

    selectSection(shell, "settings");
    expect(renderTextAppView(loadAppView(shell), { width: 132, height: 34 })).toContain("Configure how Sane guides Codex.");

    selectSection(shell, "status");
    const statusOutput = renderTextAppView(loadAppView(shell), { width: 96, height: 26 });
    expect(statusOutput).toContain("Sane / Check");
    expect(statusOutput).toContain("Focus:");
  });

  it("renders overlay state when present", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");
    shell.notice = {
      title: "Saved",
      body: "saved body",
      footer: "Enter, Space, or Esc closes this message.",
      section: "settings"
    };

    const output = renderTextAppView(loadAppView(shell));

    expect(output).toContain("[Overlay: Saved]");
    expect(output).toContain("saved body");
    expect(output).toContain("Enter, Space, or Esc closes this message.");
  });

  it("keeps overlay lines within viewport width at compact sizes", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");
    shell.notice = {
      title: "Saved",
      body: "saved body with extra words to exercise wrapping behavior in compact mode",
      footer: "Enter, Space, or Esc closes this message.",
      section: "settings"
    };

    const output = renderTextAppView(loadAppView(shell), { width: 40, height: 18 });
    const lines = output.split("\n");

    expect(lines.every((line) => line.length <= 40)).toBe(true);
    expect(output).toContain("[Overlay: Saved]");
  });

  it("shows selection changes in rendered action list", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    shell.activeActionIndex = 1;

    const output = renderTextAppView(loadAppView(shell));

    expect(output).toMatch(/>\s+\w+/);
  });

  it("keeps selected action visible when list is windowed", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");
    shell.activeActionIndex = 8;

    const output = renderTextAppView(loadAppView(shell), { width: 56, height: 24 });

    expect(output).toContain("...");
  });

  it("fits output into bounded viewport", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");

    const output = renderTextAppView(loadAppView(shell), { width: 48, height: 16 });

    const lines = output.split("\n");
    expect(lines).toHaveLength(16);
    expect(lines.every((line) => line.length <= 48)).toBe(true);
    expect(output).toContain("Focus:");
  });

  it("adds ansi styling only when requested", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    const output = renderTextAppView(loadAppView(shell), { ansi: true });

    expect(output).toContain("\u001b[1mSane / Setup");
    expect(output).toContain("\u001b[33mKeys:");
    expect(output).toContain("\u001b[2m+");
  });

  it("renders editor overlays as framed sections", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");
    runSelectedAction(shell);

    const output = renderTextAppView(loadAppView(shell));

    expect(output).toContain("[Overlay: Model Defaults]");
    expect(output).toContain("Fields");
    expect(output).toContain("Field Help");
  });

  it("keeps modal-like states legible at compact, normal, and wide sizes", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");
    runSelectedAction(shell);

    const compactEditor = renderTextAppView(loadAppView(shell), { width: 56, height: 20 });
    expect(compactEditor).toContain("[Overlay: Model Defaults]");
    expect(compactEditor).toContain("Fields");
    expect(compactEditor).toContain("> Main session model:");

    shell.activeEditor = null;
    shell.notice = {
      title: "Saved",
      body: "saved body",
      footer: "Enter, Space, or Esc closes this message.",
      section: "settings"
    };
    const normalNotice = renderTextAppView(loadAppView(shell), { width: 96, height: 26 });
    expect(normalNotice).toContain("[Overlay: Saved]");

    shell.notice = null;
    selectSection(shell, "home");
    for (let index = 0; index < 4; index += 1) {
      moveSelection(shell, "action", 1);
    }
    runSelectedAction(shell);
    const wideConfirm = renderTextAppView(loadAppView(shell), { width: 132, height: 34 });
    expect(wideConfirm).toContain("[Overlay: Confirm action]");
    expect(wideConfirm).toContain("Apply Codex settings");
  });
});
