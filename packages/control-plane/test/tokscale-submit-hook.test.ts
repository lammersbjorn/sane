import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  buildManagedTokscaleSubmitHookCommand,
  isManagedTokscaleSubmitHookCommand
} from "../src/tokscale-submit-hook.js";

describe("tokscale submit hook helper", () => {
  it("builds Tokscale submit commands for SessionEnd only", () => {
    const submitCommand = buildManagedTokscaleSubmitHookCommand("session-end", { dryRun: false });
    const dryRunSubmitCommand = buildManagedTokscaleSubmitHookCommand("session-end", { dryRun: true });

    expect(submitCommand).toContain(process.execPath);
    expect(submitCommand).toContain("hook tokscale-submit --event session-end");
    expect(dryRunSubmitCommand).toContain("hook tokscale-submit --event session-end --dry-run");
    expect(dryRunSubmitCommand).not.toContain("--event session-start");
    if (process.platform !== "win32") {
      expect(execSync(dryRunSubmitCommand, { encoding: "utf8", shell: "/bin/sh" })).toContain(
        "sane tokscale hook: session-end dry-run"
      );
    }
  });

  it("builds shell-quoted Tokscale submit commands", () => {
    expect(buildManagedTokscaleSubmitHookCommand("session-end", {
      dryRun: false,
      executable: "sane"
    })).toBe(
      "'sane' hook tokscale-submit --event session-end"
    );
    expect(buildManagedTokscaleSubmitHookCommand("session-end", {
      dryRun: true,
      executable: "sane"
    })).toBe(
      "'sane' hook tokscale-submit --event session-end --dry-run"
    );
  });

  it("detects managed Tokscale submit commands without treating SessionStart as valid", () => {
    expect(isManagedTokscaleSubmitHookCommand("'sane' hook tokscale-submit --event session-end")).toBe(true);
    expect("'sane' hook tokscale-submit --event session-end").not.toContain("--event session-start");
  });
});
