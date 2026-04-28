import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createTextTuiRuntime, createTextTuiRuntimeFromDiscovery } from "@sane/sane-tui/text-driver.js";
import { createCodexPaths, createProjectPaths } from "@sane/platform";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-text-driver-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("text driver", () => {
  it("renders the default start-here frame", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );

    expect(runtime.render()).toContain("[Home]");
  });

  it("supports settings launch shortcut and key-driven section changes", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir()),
      { launchShortcut: "settings" }
    );

    expect(runtime.render()).toContain("[Settings]");
    runtime.handleInput("right");
    expect(runtime.render()).toContain("[Add to Codex]");
  });

  it("re-renders visible selection chrome after key navigation", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );

    expect(runtime.render()).toContain("| > 1. Set up Sane files");
    runtime.handleInput("down");
    expect(runtime.render()).toContain("| > 2. Choose defaults");
  });

  it("shows overlay state after entering an editor", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir()),
      { launchShortcut: "settings" }
    );

    runtime.handleInput("enter");
    const frame = runtime.render();

    expect(frame).toContain("[Overlay: Model Defaults]");
    expect(frame).toContain("Field Help");
  });

  it("can bootstrap from discovery", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const nested = join(projectRoot, "apps", "sane-tui", "src");
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const runtime = createTextTuiRuntimeFromDiscovery(nested, { HOME: homeDir }, {
      launchShortcut: "settings"
    });

    expect(runtime.app.paths.projectRoot).toBe(projectRoot);
    expect(runtime.app.codexPaths.homeDir).toBe(homeDir);
    expect(runtime.render()).toContain("[Settings]");
  });
});
