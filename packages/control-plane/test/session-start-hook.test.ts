import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  buildManagedSessionEndHookCommand,
  buildManagedSessionStartHookCommand,
  isManagedLifecycleHookCommand,
  isManagedSessionEndHookCommand,
  isManagedSessionStartHookCommand,
  renderSessionEndHookOutput,
  renderSessionStartHookOutput
} from "../src/session-start-hook.js";

describe("session-start hook helper", () => {
  it("builds a self-contained managed SessionStart hook command by default", () => {
    const command = buildManagedSessionStartHookCommand();

    expect(command).toContain(process.execPath);
    expect(command).toContain("hook session-start");
    if (process.platform !== "win32") {
      expect(JSON.parse(execSync(command, { encoding: "utf8", shell: "/bin/sh" }))).toEqual({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: expect.stringContaining("Read repo AGENTS.md if present")
        }
      });
      const context = JSON.parse(execSync(command, { encoding: "utf8", shell: "/bin/sh" }))
        .hookSpecificOutput.additionalContext;
      expect(context).toContain("do not report when it is absent");
      expect(context).toContain("Use sane-router for Sane routing");
      expect(context).toContain("load sane-agent-lanes");
      expect(context).not.toContain("Subagent/model routing summary");
      expect(context).not.toContain("Sane command lane:");
      expect(context).not.toContain("sane-outcome-continuation");
      expect(context).not.toContain("continue/SKILL.md");
    }
  });

  it("builds a shell-quoted managed SessionStart hook command", () => {
    expect(buildManagedSessionStartHookCommand("/tmp/Sane Bin/sane")).toBe(
      "'/tmp/Sane Bin/sane' hook session-start"
    );
    expect(buildManagedSessionStartHookCommand("/tmp/it's/sane")).toBe(
      "'/tmp/it'\"'\"'s/sane' hook session-start"
    );
  });

  it("detects managed SessionStart hook commands", () => {
    expect(isManagedSessionStartHookCommand("'sane' hook session-start")).toBe(true);
    expect(isManagedSessionStartHookCommand("echo untouched")).toBe(false);
  });

  it("builds and detects optional lifecycle hook commands", () => {
    expect(buildManagedSessionEndHookCommand("/tmp/Sane Bin/sane", { rateLimitResume: true })).toBe(
      "'/tmp/Sane Bin/sane' hook session-end --rate-limit-resume"
    );
    expect(buildManagedSessionEndHookCommand(undefined, { rateLimitResume: true })).toContain(
      "hook session-end --rate-limit-resume"
    );
    expect(isManagedSessionEndHookCommand("'sane' hook session-end")).toBe(true);
    expect(isManagedLifecycleHookCommand("'sane' hook session-end")).toBe(true);
  });

  it("renders SessionStart hook output payload JSON", () => {
    expect(JSON.parse(renderSessionStartHookOutput())).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: expect.stringContaining("Read repo AGENTS.md if present")
      }
    });
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "do not report when it is absent"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "Use sane-router for Sane routing"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "load sane-agent-lanes"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).not.toContain(
      "sane-outcome-continuation"
    );
  });

  it("renders SessionStart hook output with export-time context", () => {
    expect(JSON.parse(renderSessionStartHookOutput({ additionalContext: "RTK route: prefer `rtk grep`; use `rtk run` as fallback." }))).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "RTK route: prefer `rtk grep`; use `rtk run` as fallback."
      }
    });
  });

  it("renders SessionEnd hook output payload JSON", () => {
    expect(JSON.parse(renderSessionEndHookOutput({ rateLimitResume: true }))).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionEnd",
        additionalContext:
          "Sane managed SessionEnd hook loaded. Rate-limit auto-resume is enabled, but Codex did not provide a reset timestamp in this hook payload."
      }
    });
  });
});
