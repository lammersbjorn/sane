import { describe, expect, it } from "vitest";

import {
  buildManagedTokscaleSubmitHookCommand,
  isManagedTokscaleSubmitHookCommand,
  renderTokscaleSubmitHookOutput
} from "../src/tokscale-submit-hook.js";

describe("tokscale submit hook helper", () => {
  it("builds Tokscale submit commands for Stop only", () => {
    const submitCommand = buildManagedTokscaleSubmitHookCommand("stop", { dryRun: false });
    const dryRunSubmitCommand = buildManagedTokscaleSubmitHookCommand("stop", { dryRun: true });

    expect(submitCommand).toContain(process.execPath);
    expect(submitCommand).toContain("hook tokscale-submit --event stop");
    expect(dryRunSubmitCommand).toContain("hook tokscale-submit --event stop --dry-run");
    expect(dryRunSubmitCommand).not.toContain("--event session-start");
  });

  it("builds shell-quoted Tokscale submit commands", () => {
    expect(buildManagedTokscaleSubmitHookCommand("stop", {
      dryRun: false,
      executable: "sane"
    })).toBe(
      "'sane' hook tokscale-submit --event stop"
    );
    expect(buildManagedTokscaleSubmitHookCommand("stop", {
      dryRun: true,
      executable: "sane"
    })).toBe(
      "'sane' hook tokscale-submit --event stop --dry-run"
    );
  });

  it("detects managed Tokscale submit commands without treating SessionStart as valid", () => {
    expect(isManagedTokscaleSubmitHookCommand("'sane' hook tokscale-submit --event stop")).toBe(true);
    expect("'sane' hook tokscale-submit --event stop").not.toContain("--event session-start");
  });

  it("renders valid Stop hook JSON output", () => {
    expect(JSON.parse(renderTokscaleSubmitHookOutput())).toEqual({});
  });
});
