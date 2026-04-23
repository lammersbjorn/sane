import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { startTerminalLoop } from "@sane/sane-tui/terminal-loop.js";
import { createTextTuiRuntime } from "@sane/sane-tui/text-driver.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-terminal-loop-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

class FakeStdin extends EventEmitter {
  rawModes: boolean[] = [];
  resumed = 0;
  paused = 0;

  setRawMode(enabled: boolean) {
    this.rawModes.push(enabled);
  }

  resume() {
    this.resumed += 1;
  }

  pause() {
    this.paused += 1;
  }
}

describe("terminal loop", () => {
  it("boots raw mode, alternate screen, and renders the first frame", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );
    const stdin = new FakeStdin();
    const writes: string[] = [];

    const controller = startTerminalLoop(runtime, {
      stdin,
      stdout: {
        write: (chunk) => writes.push(chunk)
      }
    });

    expect(stdin.rawModes).toEqual([true]);
    expect(stdin.resumed).toBe(1);
    expect(writes[0]).toBe("\u001b[?1049h\u001b[?25l");
    expect(writes[1]).toContain("\u001b[2J\u001b[H");
    expect(writes[1]).toContain("Section: get_started");

    controller.stop();
    expect(stdin.rawModes).toEqual([true, false]);
    expect(stdin.paused).toBe(1);
    expect(writes.at(-1)).toBe("\u001b[?25h\u001b[?1049l");
  });

  it("renders updated frames from terminal input and stops on ctrl-c", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );
    const stdin = new FakeStdin();
    const writes: string[] = [];

    startTerminalLoop(runtime, {
      stdin,
      stdout: {
        write: (chunk) => writes.push(chunk)
      }
    });

    stdin.emit("data", "\u001b[B");
    stdin.emit("data", "\r");

    expect(writes.at(-1)).toContain("[Latest Status]");

    stdin.emit("data", "\u0003");

    expect(stdin.rawModes).toEqual([true, false]);
    expect(stdin.paused).toBe(1);
    expect(writes.at(-1)).toBe("\u001b[?25h\u001b[?1049l");
  });
});
