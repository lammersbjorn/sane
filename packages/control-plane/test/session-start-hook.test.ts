import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import {
  buildSaneCompactPrompt,
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

    expect(command).toContain("node -e");
    expect(command).toContain("hook session-start");
    if (process.platform !== "win32") {
      expect(JSON.parse(execSync(command, { encoding: "utf8", shell: "/bin/sh" }))).toEqual({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: expect.stringContaining("Before work: read repo AGENTS.md if present")
        }
      });
      const context = JSON.parse(execSync(command, { encoding: "utf8", shell: "/bin/sh" }))
        .hookSpecificOutput.additionalContext;
      expect(context).toContain("stay quiet when absent");
      expect(context).toContain("Load `sane-router` skill body");
      expect(context).toContain("read that matching SKILL.md before acting");
      expect(context).toContain("Use subagents by default");
      expect(context).toContain("load `sane-agent-lanes`");
      expect(context).toContain("including follow-up implementation after research");
      expect(context).toContain("Attempt lane handoff first");
      expect(context).toContain("ask only if subagent launch is blocked");
      expect(context).toContain("Broad work uses a lane handoff");
      expect(context).toContain("before broad edits");
      expect(context).toContain("Sane obligation receipt:");
      expect(context).toContain("skills=read sane-router + triggered SKILL.md bodies");
      expect(context).toContain("broad_work=visible lane plan + spawn_agent handoff before broad edits");
      expect(context).toContain("blocked_handoff=report blocker + ask once + wait");
      expect(context).toContain("style=normal");
      expect(context).toContain("packs=");
      expect(context).toContain("caveman:off");
      expect(context).not.toContain("Subagent/model routing summary");
      expect(context).not.toContain("Sane command lane:");
      expect(context).not.toContain("sane-outcome-continuation");
      expect(context).not.toContain("continue/SKILL.md");
    }
  });

  it("builds inline hook payloads from fixed continuity pack context", () => {
    const command = buildManagedSessionStartHookCommand(undefined, {
      packs: { caveman: true }
    });

    if (process.platform !== "win32") {
      expect(JSON.parse(execSync(command, { encoding: "utf8", shell: "/bin/sh" }))).toEqual({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: expect.stringContaining("caveman:on")
        }
      });
    }
  });

  it("builds a shell-quoted managed SessionStart hook command", () => {
    expect(buildManagedSessionStartHookCommand("/tmp/Sane Bin/sane")).toBe(
      "'/tmp/Sane Bin/sane' hook session-start"
    );
  });

  it("rejects unsafe executable characters in managed hook commands", () => {
    expect(() => buildManagedSessionStartHookCommand("/tmp/sane; touch /tmp/pwned")).toThrow(
      "unsafe shell characters"
    );
    expect(() => buildManagedSessionEndHookCommand("/tmp/it's/sane")).toThrow(
      "unsafe shell characters"
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
        additionalContext: expect.stringContaining("Before work: read repo AGENTS.md if present")
      }
    });
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "stay quiet when absent"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "Load `sane-router` skill body"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "read that matching SKILL.md before acting"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "Use subagents by default"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "load `sane-agent-lanes`"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "including follow-up implementation after research"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "Attempt lane handoff first"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).toContain(
      "Sane obligation receipt:"
    );
    expect(JSON.parse(renderSessionStartHookOutput()).hookSpecificOutput.additionalContext).not.toContain(
      "sane-outcome-continuation"
    );
  });

  it("renders compact prompt with obligation receipt checklist", () => {
    const prompt = buildSaneCompactPrompt({ caveman: true });
    expect(prompt).toContain("3. Obligation Receipt: Sane obligation receipt:");
    expect(prompt).toContain("skills=read sane-router + triggered SKILL.md bodies");
    expect(prompt).toContain("broad_work=visible lane plan + spawn_agent handoff before broad edits");
    expect(prompt).toContain("blocked_handoff=report blocker + ask once + wait");
    expect(prompt).toContain("style=sane-caveman");
    expect(prompt).toContain("packs=");
    expect(prompt).toContain("caveman:on");
    expect(prompt).toContain("7. BLOCKED: exact blocker, or `none`.");
  });

  it("renders SessionStart hook output with export-time context", () => {
    expect(JSON.parse(renderSessionStartHookOutput({ additionalContext: "RTK route: prefer `rtk grep`; use `rtk run` as fallback." }))).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "RTK route: prefer `rtk grep`; use `rtk run` as fallback."
      }
    });
  });

  it("renders Stop hook output payload JSON", () => {
    expect(JSON.parse(renderSessionEndHookOutput({ rateLimitResume: true }))).toEqual({
      hookSpecificOutput: {
        hookEventName: "Stop",
        additionalContext: expect.stringMatching(/rate-limit.*resume/i)
      }
    });
    expect(JSON.parse(renderSessionEndHookOutput())).toEqual({});
  });
});
