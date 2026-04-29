import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  type CliRunResult,
  parseCliArgs,
  runCliCommandFromDiscovery
} from "@sane/sane-tui/cli.js";

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
  it("routes launch shortcuts and render options onto stable CLI contracts", () => {
    expectLaunch([], "default");
    expectLaunch(["install"], "install");
    expectLaunch(["settings"], "settings");
    expectLaunch(["status"], "status");
    expectLaunch(["inspect"], "status");
    expectLaunch(["--", "inspect"], "status");
    expectLaunch(["repair"], "repair");
    expectLaunch(["uninstall"], "uninstall");
    expectLaunch(["--", "--width", "100", "--height", "32"], "default", {
      width: 100,
      height: 32
    });
    expectLaunch(["settings", "--height", "20"], "settings", {
      width: 100,
      height: 20
    });
  });

  it("routes representative backend aliases onto backend commands", () => {
    expectBackendCommand(["install-runtime"], "install_runtime");
    expectBackendCommand(["show", "status"], "show_status");
    expectBackendCommand(["preview", "integrations-profile"], "preview_integrations_profile");
    expectBackendCommand(["apply", "statusline-profile"], "apply_statusline_profile");
    expectBackendCommand(["outcome-readiness"], "show_outcome_readiness");
    expectBackendCommand(["export", "opencode"], "export_opencode_all");
  });

  it("routes managed hook aliases onto hook commands", () => {
    expect(parseCliArgs(["hook", "session-start"])).toMatchObject({
      kind: "hook",
      event: "session-start"
    });
    expect(parseCliArgs(["hook", "tokscale-submit", "--event", "stop", "--dry-run"])).toMatchObject({
      kind: "hook",
      event: "tokscale-submit",
      submitEvent: "stop",
      dryRun: true
    });
    expect(parseCliArgs(["hook", "tokscale-submit", "--event", "session-end"])).toMatchObject({
      kind: "hook",
      event: "tokscale-submit",
      submitEvent: "stop",
      dryRun: false
    });
    expect(() => parseCliArgs(["hook", "tokscale-submit", "--event", "session-start"])).toThrow(
      /invalid tokscale hook event: session-start/
    );
  });

  it("rejects public outcome runner command rituals", () => {
    expectUnsupportedCommand(["nonsense"]);
    expectUnsupportedCommand(["sane", "runner"]);
    expectUnsupportedCommand(["runner"]);
    expectUnsupportedCommand(["outcome", "step"]);
    expectUnsupportedCommand(["outcome", "runner"]);
    expectUnsupportedCommand(["run", "outcome"]);
    expect(() => parseCliArgs(["--width"])).toThrow(/missing value for --width/);
    expect(() => parseCliArgs(["--height", "0"])).toThrow(/invalid value for --height/);
  });
});

describe("ts cli command execution", () => {
  it("renders the default TS text runtime for no-args launch and settings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const start = runCliCommandFromDiscovery([], projectRoot, { HOME: homeDir });
    const settings = runCliCommandFromDiscovery(["settings"], projectRoot, { HOME: homeDir });

    expectSuccessfulSectionOutput(start, "home");
    expectSuccessfulSectionOutput(settings, "settings");
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

    expectSuccessfulSectionOutput(result, "home");
    expectRenderedLineCountAtMost(result.output, 12);
  });

  it("renders section launch shortcuts through discovery", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const status = runCliCommandFromDiscovery(["status"], projectRoot, { HOME: homeDir });
    const inspect = runCliCommandFromDiscovery(["inspect"], projectRoot, { HOME: homeDir });
    const repair = runCliCommandFromDiscovery(["repair"], projectRoot, { HOME: homeDir });
    const uninstall = runCliCommandFromDiscovery(["uninstall"], projectRoot, { HOME: homeDir });

    expectSuccessfulSectionOutput(status, "status");
    expectSuccessfulSectionOutput(inspect, "status");
    expectSuccessfulSectionOutput(repair, "repair");
    expectSuccessfulSectionOutput(uninstall, "uninstall");
  });

  it("renders the install wizard through discovery", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const nested = join(projectRoot, "apps", "sane-tui", "src");
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = runCliCommandFromDiscovery(["install"], nested, { HOME: homeDir });

    expectSuccessfulSectionOutput(result, "home");
    expect(result.output).toContain("Set up Sane files");
    expect(existsSync(join(projectRoot, ".sane"))).toBe(false);
  });

  it("keeps explicit advanced runtime install available for non-interactive use", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const nested = join(projectRoot, "apps", "sane-tui", "src");
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = runCliCommandFromDiscovery(["install-runtime"], nested, { HOME: homeDir });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain(".sane/state/current-run.json");
    expect(existsSync(join(projectRoot, ".sane"))).toBe(true);
  });

  it("prints the managed session-start hook event contract", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = runCliCommandFromDiscovery(["hook", "session-start"], projectRoot, {
      HOME: homeDir
    });

    expectHookOutput(result, "SessionStart");
  });

  it("prints the managed session-end hook event contract", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = runCliCommandFromDiscovery(["hook", "session-end", "--rate-limit-resume"], projectRoot, {
      HOME: homeDir
    });

    const hook = expectHookOutput(result, "Stop");
    expect(hook.additionalContext).toMatch(/rate-limit/i);
    expect(hook.additionalContext).toMatch(/resume/i);
  });

  it("prints the managed tokscale Stop hook event contract", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = runCliCommandFromDiscovery(["hook", "tokscale-submit", "--event", "stop", "--dry-run"], projectRoot, {
      HOME: homeDir,
      PATH: ""
    });

    expectEmptyHookOutput(result);
  });
});

function expectLaunch(
  args: readonly string[],
  launchShortcut: "default" | "install" | "settings" | "status" | "repair" | "uninstall",
  viewport?: { width: number; height: number }
): void {
  const parsed = parseCliArgs(args);
  expect(parsed).toMatchObject({
    kind: "launch",
    launchShortcut
  });
  if (parsed.kind !== "launch") {
    throw new Error(`expected launch command, got ${parsed.kind}`);
  }
  expect(parsed.viewport).toEqual(viewport);
}

function expectBackendCommand(args: readonly string[], commandId: string): void {
  expect(parseCliArgs(args)).toMatchObject({
    kind: "backend",
    commandId
  });
}

function expectUnsupportedCommand(args: readonly string[]): void {
  expect(() => parseCliArgs(args)).toThrow(/unsupported command/);
}

function expectSuccessfulSectionOutput(result: CliRunResult, section: string): void {
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain(`[${sectionLabel(section)}]`);
}

function sectionLabel(section: string): string {
  switch (section) {
    case "home":
      return "Home";
    case "settings":
      return "Settings";
    case "add_to_codex":
      return "Add to Codex";
    case "status":
      return "Status";
    case "repair":
      return "Repair";
    case "uninstall":
      return "Uninstall";
    default:
      return section;
  }
}

function expectRenderedLineCountAtMost(output: string, maxLines: number): void {
  expect(output.trimEnd().split("\n").length).toBeLessThanOrEqual(maxLines);
}

function expectHookOutput(
  result: CliRunResult,
  hookEventName: "SessionStart" | "Stop"
): { hookEventName: string; additionalContext: string } {
  expect(result.exitCode).toBe(0);
  const parsed = JSON.parse(result.output) as {
    hookSpecificOutput?: {
      hookEventName?: string;
      additionalContext?: string;
    };
  };
  expect(parsed.hookSpecificOutput).toMatchObject({
    hookEventName,
    additionalContext: expect.any(String)
  });
  return parsed.hookSpecificOutput as { hookEventName: string; additionalContext: string };
}

function expectEmptyHookOutput(result: CliRunResult): void {
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.output)).toEqual({});
}
