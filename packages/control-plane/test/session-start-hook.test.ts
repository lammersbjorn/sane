import { describe, expect, it } from "vitest";

import {
  buildManagedSessionStartHookCommand,
  isManagedSessionStartHookCommand,
  renderSessionStartHookOutput
} from "../src/session-start-hook.js";

describe("session-start hook helper", () => {
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

  it("renders SessionStart hook output payload JSON", () => {
    expect(JSON.parse(renderSessionStartHookOutput())).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          "Sane active for this session: plain-language first, commands optional, avoid workflow lock-in, adapt model and subagent use to the task."
      }
    });
  });
});
