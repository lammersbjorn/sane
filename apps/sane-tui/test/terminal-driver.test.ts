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
    expect(down.result).toBeNull();

    const enter = stepTerminalDriver(runtime, "\r");
    expect(enter.key).toBe("enter");
    expect(enter.result?.summary).toContain("codex-config: missing");
    expect(enter.frame).toContain("[Latest Status]");
  });

  it("ignores unknown terminal input and keeps rendering", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );

    const step = stepTerminalDriver(runtime, "q");

    expect(step.key).toBeNull();
    expect(step.result).toBeNull();
    expect(step.frame).toContain("Section: get_started");
  });
});
