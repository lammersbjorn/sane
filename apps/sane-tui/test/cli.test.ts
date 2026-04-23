import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseCliArgs, runCliCommandFromDiscovery } from "@/cli.js";

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
    expect(parseCliArgs(["install"])).toEqual({
      kind: "backend",
      commandId: "install_runtime"
    });
    expect(parseCliArgs(["preview", "integrations-profile"])).toEqual({
      kind: "backend",
      commandId: "preview_integrations_profile"
    });
    expect(parseCliArgs(["hook", "session-start"])).toEqual({
      kind: "hook",
      event: "session-start"
    });
  });

  it("rejects unsupported argv", () => {
    expect(() => parseCliArgs([])).toThrow("unsupported command: <none>");
    expect(() => parseCliArgs(["settings"])).toThrow("unsupported command: settings");
  });
});

describe("ts cli command execution", () => {
  it("runs backend commands through discovery", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const nested = join(projectRoot, "apps", "sane-tui", "src");
    writeFileSync(join(projectRoot, "Cargo.toml"), "[workspace]\n");

    const result = runCliCommandFromDiscovery(["install"], nested, { HOME: homeDir });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("installed runtime at");
    expect(result.output).toContain(".sane/state/current-run.json");
    expect(existsSync(join(projectRoot, ".sane"))).toBe(true);
  });

  it("prints the managed session-start hook payload verbatim", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "Cargo.toml"), "[workspace]\n");

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
