import { execSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  createDefaultLocalConfig,
  writeLocalConfig
} from "@sane/config";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
import { describe, expect, it } from "vitest";

import { exportHooks } from "../src/hooks-custom-agents.js";
import {
  buildManagedBlockedResponseGuardHookCommand,
  buildManagedCommandSafetyGuardHookCommand,
  buildManagedGeneratedSurfaceGuardHookCommand
} from "../src/safety-guard-hooks.js";
import { makeTempDir } from "./hooks-custom-agents-test-utils.js";

function exportRtkHookCommand(projectRoot: string, homeDir: string): string {
  const projectPaths = createProjectPaths(projectRoot);
  const codexPaths = createCodexPaths(homeDir);
  const config = createDefaultLocalConfig();
  config.packs.rtk = true;
  writeLocalConfig(projectPaths.configPath, config);
  mkdirSync(join(homeDir, ".codex"), { recursive: true });

  exportHooks(projectPaths, codexPaths);
  const exportedBody = JSON.parse(readFileSync(codexPaths.hooksJson, "utf8"));
  return exportedBody.hooks.PreToolUse.find((entry: any) =>
    JSON.stringify(entry).includes("hook rtk-command")
  ).hooks[0].command;
}

describe("RTK and safety hook runtime", () => {
  it("denies raw Bash commands when RTK rewrite suggests a route", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const binDir = makeTempDir();
    writeFileSync(join(binDir, "rtk"), "#!/bin/sh\nif [ \"$1\" = \"rewrite\" ]; then printf 'rtk grep foo\\n'; exit 0; fi\nexit 1\n", "utf8");
    chmodSync(join(binDir, "rtk"), 0o755);

    const output = execSync(exportRtkHookCommand(projectRoot, homeDir), {
      encoding: "utf8",
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
      input: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "grep foo" },
        cwd: projectRoot
      }),
      shell: "/bin/sh"
    });

    expect(JSON.parse(output)).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "RTK is required. Use: rtk grep foo"
      }
    });
  });

  it("fails closed for non-rtk Bash commands when rewrite cannot validate route", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const binDir = makeTempDir();
    writeFileSync(join(binDir, "rtk"), "#!/bin/sh\nif [ \"$1\" = \"rewrite\" ]; then printf '%s\\n' \"$2\"; exit 0; fi\nexit 1\n", "utf8");
    chmodSync(join(binDir, "rtk"), 0o755);

    const output = execSync(exportRtkHookCommand(projectRoot, homeDir), {
      encoding: "utf8",
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
      input: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "grep foo" },
        cwd: projectRoot
      }),
      shell: "/bin/sh"
    });

    expect(JSON.parse(output)).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "RTK is required. Command rejected because RTK route could not be validated."
      }
    });
  });

  it("allows RTK-prefixed Bash commands", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const output = execSync(exportRtkHookCommand(projectRoot, homeDir), {
      encoding: "utf8",
      input: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "rtk grep foo" },
        cwd: projectRoot
      }),
      shell: "/bin/sh"
    });

    expect(output).toBe("");
  });

  it("allows non-Bash and malformed PreToolUse payloads", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const command = exportRtkHookCommand(projectRoot, homeDir);

    const nonBashOutput = execSync(command, {
      encoding: "utf8",
      input: JSON.stringify({
        tool_name: "Read",
        tool_input: { path: "README.md" },
        cwd: projectRoot
      }),
      shell: "/bin/sh"
    });
    expect(nonBashOutput).toBe("");

    const malformedOutput = execSync(command, {
      encoding: "utf8",
      input: "{not valid json",
      shell: "/bin/sh"
    });
    expect(malformedOutput).toBe("");
  });

  it("returns expected deny output shape for blocked Bash input", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const binDir = makeTempDir();
    writeFileSync(
      join(binDir, "rtk"),
      "#!/bin/sh\nif [ \"$1\" = \"rewrite\" ]; then printf 'rtk grep foo\\n'; exit 0; fi\nexit 1\n",
      "utf8"
    );
    chmodSync(join(binDir, "rtk"), 0o755);

    const output = execSync(exportRtkHookCommand(projectRoot, homeDir), {
      encoding: "utf8",
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
      input: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "grep foo" },
        cwd: projectRoot
      }),
      shell: "/bin/sh"
    });

    const payload = JSON.parse(output);
    expect(Object.keys(payload)).toEqual(["hookSpecificOutput"]);
    expect(Object.keys(payload.hookSpecificOutput).sort()).toEqual([
      "hookEventName",
      "permissionDecision",
      "permissionDecisionReason"
    ]);
    expect(payload.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(payload.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(payload.hookSpecificOutput.permissionDecisionReason).toMatch(/^RTK is required\./);
  });

  it("blocks destructive, secret, and unsafe git commands with safety guard output", () => {
    const command = buildManagedCommandSafetyGuardHookCommand();

    for (const [inputCommand, reasonPrefix] of [
      ["rm -rf /", "Sane safety guard: destructive command blocked."],
      ["cat .env", "Sane safety guard: secret or credential exposure blocked."],
      ["git reset --hard HEAD", "Sane safety guard: unsafe git operation blocked."]
    ]) {
      const output = execSync(command, {
        encoding: "utf8",
        input: JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: inputCommand }
        }),
        shell: "/bin/sh"
      });
      const payload = JSON.parse(output);
      expect(payload.hookSpecificOutput).toMatchObject({
        hookEventName: "PreToolUse",
        permissionDecision: "deny"
      });
      expect(payload.hookSpecificOutput.permissionDecisionReason).toContain(reasonPrefix);
    }
  });

  it("blocks direct generated-surface edits unless managed provenance is present", () => {
    const command = buildManagedGeneratedSurfaceGuardHookCommand();
    const blocked = execSync(command, {
      encoding: "utf8",
      input: JSON.stringify({
        tool_name: "Edit",
        tool_input: {
          path: "/tmp/repo/.agents/skills/sane-router/SKILL.md",
          new_string: "manual edit"
        }
      }),
      shell: "/bin/sh"
    });
    const allowed = execSync(command, {
      encoding: "utf8",
      input: JSON.stringify({
        tool_name: "Edit",
        tool_input: {
          path: "/tmp/repo/.agents/skills/sane-router/SKILL.md",
          new_string: "managed-by: sane"
        }
      }),
      shell: "/bin/sh"
    });

    expect(JSON.parse(blocked).hookSpecificOutput).toMatchObject({
      hookEventName: "PreToolUse",
      permissionDecision: "deny"
    });
    expect(allowed).toBe("");
  });

  it("allows normal user-owned AGENTS.md edits without Sane managed markers", () => {
    const command = buildManagedGeneratedSurfaceGuardHookCommand();
    const output = execSync(command, {
      encoding: "utf8",
      input: JSON.stringify({
        tool_name: "Edit",
        tool_input: {
          path: "/tmp/repo/AGENTS.md",
          old_string: "# User notes\n",
          new_string: "# User notes\n\n- Keep local context here.\n"
        }
      }),
      shell: "/bin/sh"
    });

    expect(output).toBe("");
  });

  it("blocks weak BLOCKED final responses without evidence and need", () => {
    const command = buildManagedBlockedResponseGuardHookCommand();
    const blocked = execSync(command, {
      encoding: "utf8",
      input: JSON.stringify({ final_response: "BLOCKED." }),
      shell: "/bin/sh"
    });
    const allowed = execSync(command, {
      encoding: "utf8",
      input: JSON.stringify({
        final_response: "BLOCKED: attempted command failed. Evidence: missing credential. Need approval."
      }),
      shell: "/bin/sh"
    });

    expect(JSON.parse(blocked)).toEqual({
      hookSpecificOutput: {
        hookEventName: "Stop",
        additionalContext: "Sane BLOCKED guard: include attempted action, evidence, and exact needed user input."
      }
    });
    expect(allowed).toBe("");
  });
});
