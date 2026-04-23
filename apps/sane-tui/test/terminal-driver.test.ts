import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { stepTerminalDriver } from "@sane/sane-tui/terminal-driver.js";
import { createTextTuiRuntime } from "@sane/sane-tui/text-driver.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-terminal-driver-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("terminal driver", () => {
  it("maps raw terminal input through the TS runtime", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );

    const down = stepTerminalDriver(runtime, "\u001b[B");
    expect(down.key).toBe("down");
    expect(down.keys).toEqual(["down"]);
    expect(down.result).toBeNull();

    const enter = stepTerminalDriver(runtime, "\r");
    expect(enter.key).toBe("enter");
    expect(enter.keys).toEqual(["enter"]);
    expect(enter.result?.summary).toContain("codex-config: missing");
    expect(enter.frame).toContain("Latest Status");
    expect(enter.shouldExit).toBe(false);
  });

  it("maps quit input without mutating runtime state", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );

    const step = stepTerminalDriver(runtime, "q");

    expect(step.key).toBe("quit");
    expect(step.keys).toEqual(["quit"]);
    expect(step.result).toBeNull();
    expect(step.shouldExit).toBe(true);
    expect(step.frame).toContain("Section: get_started");
  });

  it("ignores unknown terminal input and keeps rendering", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );

    const step = stepTerminalDriver(runtime, "x");

    expect(step.key).toBeNull();
    expect(step.keys).toEqual([]);
    expect(step.result).toBeNull();
    expect(step.shouldExit).toBe(false);
    expect(step.frame).toContain("Section: get_started");
  });

  it("handles batched terminal chunks in order and still exits on quit", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir()),
      { launchShortcut: "settings" }
    );

    const step = stepTerminalDriver(runtime, "\tq");

    expect(step.keys).toEqual(["tab", "quit"]);
    expect(step.key).toBe("quit");
    expect(step.shouldExit).toBe(true);
    expect(step.frame).toContain("Section: install");
  });
});
