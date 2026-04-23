import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { loadAppView } from "@sane/sane-tui/app-view.js";
import { createTuiShell } from "@sane/sane-tui/shell.js";
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
  it("renders the core app view sections into one text frame", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    const output = renderTextAppView(loadAppView(shell));

    expect(output).toContain("Sane | Codex-native onboarding and setup");
    expect(output).toContain("Sections: [Start here]");
    expect(output).toContain("Set up preferences");
    expect(output).toContain("Install to Codex");
    expect(output).toContain("[Status]");
    expect(output).toContain("Runtime: missing");
    expect(output).toContain("[Actions]");
    expect(output).toContain("> 1. Create Sane's local project files (recommended)");
    expect(output).toContain("[Section Overview]");
    expect(output).toContain("[Selected Step Details]");
    expect(output).toContain("[Latest Status]");
    expect(output).toContain("[Now]");
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

    expect(output).toContain("[Overlay]");
    expect(output).toContain("kind: notice");
    expect(output).toContain("title: Saved");
    expect(output).toContain("saved body");
    expect(output).toContain("Enter, Space, or Esc closes this message.");
  });

  it("shows selection changes in the rendered action list", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    shell.activeActionIndex = 1;

    const output = renderTextAppView(loadAppView(shell));

    expect(output).toContain("  1. Create Sane's local project files (recommended)");
    expect(output).toContain("> 2. View your current Codex settings");
  });

  it("fits output into a bounded viewport", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");

    const output = renderTextAppView(loadAppView(shell), {
      width: 32,
      height: 8
    });

    const lines = output.split("\n");
    expect(lines).toHaveLength(8);
    expect(lines.every((line) => line.length <= 32)).toBe(true);
    expect(output).toContain("...");
    expect(output).toContain("[Now]");
  });

  it("adds ansi styling only when requested", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    const output = renderTextAppView(loadAppView(shell), {
      ansi: true
    });

    expect(output).toContain("\u001b[1mSane | Codex-native onboarding and setup\u001b[0m");
    expect(output).toContain("\u001b[7m> 1. Create Sane's local project files (recommended)\u001b[0m");
    expect(output).toContain("\u001b[1;36m[Actions]\u001b[0m");
  });
});
