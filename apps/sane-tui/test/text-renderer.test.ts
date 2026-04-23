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
});
