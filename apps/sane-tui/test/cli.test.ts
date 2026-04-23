import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseCliArgs, runCliCommandFromDiscovery } from "@sane/sane-tui/cli.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-cli-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("ts cli command parsing", () => {
  it("maps backend argv onto current TS command ids", () => {
    expect(parseCliArgs([])).toEqual({
      kind: "launch",
      launchShortcut: "default"
    });
    expect(parseCliArgs(["settings"])).toEqual({
      kind: "launch",
      launchShortcut: "settings"
    });
    expect(parseCliArgs(["inspect"])).toEqual({
      kind: "launch",
      launchShortcut: "inspect"
    });
    expect(parseCliArgs(["--", "inspect"])).toEqual({
      kind: "launch",
      launchShortcut: "inspect"
    });
    expect(parseCliArgs(["--", "--width", "100", "--height", "32"])).toEqual({
      kind: "launch",
      launchShortcut: "default",
      viewport: {
        width: 100,
        height: 32
      }
    });
    expect(parseCliArgs(["settings", "--height", "20"])).toEqual({
      kind: "launch",
      launchShortcut: "settings",
      viewport: {
        width: 100,
        height: 20
      }
    });
    expect(parseCliArgs(["repair"])).toEqual({
      kind: "launch",
      launchShortcut: "repair"
    });
    expect(parseCliArgs(["install"])).toEqual({
      kind: "backend",
      commandId: "install_runtime"
    });
    expect(parseCliArgs(["preview", "integrations-profile"])).toEqual({
      kind: "backend",
      commandId: "preview_integrations_profile"
    });
    expect(parseCliArgs(["apply", "statusline-profile"])).toEqual({
      kind: "backend",
      commandId: "apply_statusline_profile"
    });
    expect(parseCliArgs(["hook", "session-start"])).toEqual({
      kind: "hook",
      event: "session-start"
    });
  });

  it("rejects unsupported argv", () => {
    expect(() => parseCliArgs(["nonsense"])).toThrow("unsupported command: nonsense");
    expect(() => parseCliArgs(["--width"])).toThrow("missing value for --width");
    expect(() => parseCliArgs(["--height", "0"])).toThrow("invalid value for --height: 0");
  });
});

describe("ts cli command execution", () => {
  it("renders the default TS text runtime for no-args launch and settings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const start = runCliCommandFromDiscovery([], projectRoot, { HOME: homeDir });
    const settings = runCliCommandFromDiscovery(["settings"], projectRoot, { HOME: homeDir });

    expect(start.exitCode).toBe(0);
    expect(start.output).toContain("Section: get_started");
    expect(settings.exitCode).toBe(0);
    expect(settings.output).toContain("Section: preferences");
  });

  it("renders launch output with explicit preview viewport flags", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = runCliCommandFromDiscovery(
      ["--width", "80", "--height", "12"],
      projectRoot,
      { HOME: homeDir }
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Section: get_started");
    expect(result.output.split("\n").length).toBeLessThanOrEqual(12);
  });

  it("renders section launch shortcuts through discovery", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const inspect = runCliCommandFromDiscovery(["inspect"], projectRoot, { HOME: homeDir });
    const repair = runCliCommandFromDiscovery(["repair"], projectRoot, { HOME: homeDir });

    expect(inspect.exitCode).toBe(0);
    expect(inspect.output).toContain("Section: inspect");
    expect(repair.exitCode).toBe(0);
    expect(repair.output).toContain("Section: repair");
  });

  it("runs backend commands through discovery", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const nested = join(projectRoot, "apps", "sane-tui", "src");
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = runCliCommandFromDiscovery(["install"], nested, { HOME: homeDir });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("installed runtime at");
    expect(result.output).toContain(".sane/state/current-run.json");
    expect(existsSync(join(projectRoot, ".sane"))).toBe(true);
  });

  it("prints the managed session-start hook payload verbatim", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = runCliCommandFromDiscovery(["hook", "session-start"], projectRoot, {
      HOME: homeDir
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.output)).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          "Sane active for this session: plain-language first, commands optional, avoid workflow lock-in, adapt model and subagent use to the task."
      }
    });
  });
});
