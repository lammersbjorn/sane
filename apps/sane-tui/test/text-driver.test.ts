import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createTextTuiRuntime, createTextTuiRuntimeFromDiscovery } from "@sane/sane-tui/text-driver.js";
import { createCodexPaths, createProjectPaths } from "@sane/control-plane/platform.js";

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

    expect(runtime.render()).toContain("Sane / Setup /");
  });

  it("supports settings launch shortcut and key-driven section changes", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir()),
      { launchShortcut: "settings" }
    );

    expect(runtime.render()).toContain("Sane / Configure /");
    runtime.handleInput("right");
    expect(runtime.render()).toContain("Sane / Install /");
  });

  it("re-renders visible selection chrome after key navigation", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );

    expect(runtime.render()).toContain("| > Prepare repo");
    runtime.handleInput("down");
    expect(runtime.render()).toContain("| > Choose defaults");
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
    expect(runtime.render()).toContain("Sane / Configure /");
  });
});
