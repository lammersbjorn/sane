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

class FakeStdout extends EventEmitter {
  columns: number;
  rows: number;
  writes: string[] = [];

  constructor(columns = 120, rows = 40) {
    super();
    this.columns = columns;
    this.rows = rows;
  }

  write(chunk: string) {
    this.writes.push(chunk);
  }
}

describe("terminal loop", () => {
  it("boots raw mode, alternate screen, and renders the first frame", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();

    const controller = startTerminalLoop(runtime, {
      stdin,
      stdout
    });

    expect(stdin.rawModes).toEqual([true]);
    expect(stdin.resumed).toBe(1);
    expect(stdout.writes[0]).toBe("\u001b[?1049h\u001b[?25l");
    expect(stdout.writes[1]).toContain("\u001b[2J\u001b[H");
    expect(stdout.writes[1]).toContain("Section: get_started");

    controller.stop();
    expect(stdin.rawModes).toEqual([true, false]);
    expect(stdin.paused).toBe(1);
    expect(stdout.writes.at(-1)).toBe("\u001b[?25h\u001b[?1049l");
  });

  it("renders updated frames from terminal input and stops on ctrl-c", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();

    startTerminalLoop(runtime, {
      stdin,
      stdout
    });

    stdin.emit("data", "\u001b[B");
    stdin.emit("data", "\r");

    expect(stdout.writes.at(-1)).toContain("[Latest Status]");

    stdin.emit("data", "\u0003");

    expect(stdin.rawModes).toEqual([true, false]);
    expect(stdin.paused).toBe(1);
    expect(stdout.writes.at(-1)).toBe("\u001b[?25h\u001b[?1049l");
  });

  it("stops on q without requiring ctrl-c", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir())
    );
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();

    startTerminalLoop(runtime, {
      stdin,
      stdout
    });

    stdin.emit("data", "q");

    expect(stdin.rawModes).toEqual([true, false]);
    expect(stdin.paused).toBe(1);
    expect(stdout.writes.at(-1)).toBe("\u001b[?25h\u001b[?1049l");
  });

  it("handles batched terminal chunks before quitting", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir()),
      { launchShortcut: "settings" }
    );
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();

    startTerminalLoop(runtime, {
      stdin,
      stdout
    });

    stdin.emit("data", "\tq");

    expect(stdin.rawModes).toEqual([true, false]);
    expect(stdin.paused).toBe(1);
    expect(stdout.writes.at(-1)).toBe("\u001b[?25h\u001b[?1049l");
  });

  it("re-renders within the current viewport on resize", () => {
    const runtime = createTextTuiRuntime(
      createProjectPaths(makeTempDir()),
      createCodexPaths(makeTempDir()),
      { launchShortcut: "settings" }
    );
    const stdin = new FakeStdin();
    const stdout = new FakeStdout(48, 12);

    startTerminalLoop(runtime, {
      stdin,
      stdout
    });

    stdout.columns = 32;
    stdout.rows = 8;
    stdout.emit("resize");

    expect(stdout.writes.at(-1)).toContain("\u001b[2J\u001b[H");
    expect(stdout.writes.at(-1)).toContain("...");
  });
});
