import { describe, expect, it } from "vitest";

import { OperationKind } from "@sane/core";
import {
  checkForUpdates,
  detectSaneInstallSource,
  inspectUpdateCheck
} from "@sane/control-plane/update-check.js";

describe("update check", () => {
  it("reports newer npm releases with an update command", () => {
    const result = checkForUpdates({
      currentVersion: "1.0.0-beta.1",
      latestVersion: "1.0.0-beta.2"
    });

    expect(result.kind).toBe(OperationKind.CheckUpdates);
    expect(result.summary).toBe("update available: sane-codex 1.0.0-beta.1 -> 1.0.0-beta.2");
    expect(result.details).toContain("update command: pnpm add -g sane-codex");
  });

  it("treats a stable release as newer than its prerelease", () => {
    expect(inspectUpdateCheck({
      currentVersion: "1.0.0-beta.9",
      latestVersion: "1.0.0"
    }).status).toBe("update_available");
  });

  it("handles network lookup failures without failing status", () => {
    const result = checkForUpdates({
      currentVersion: "1.0.0-beta.1",
      exec: () => {
        throw new Error("offline");
      }
    });

    expect(result.summary).toBe("update check: unable to reach registry for sane-codex");
    expect(result.details).toContain("latest: unknown");
  });

  it("detects local, pnpm, and Homebrew installs", () => {
    expect(detectSaneInstallSource("/repo/apps/sane-tui/dist/bin/sane.cjs", {})).toBe("local");
    expect(detectSaneInstallSource("/home/me/.pnpm/sane-codex/1.0.0/bin/sane.cjs", {})).toBe("pnpm");
    expect(detectSaneInstallSource("/opt/homebrew/Cellar/sane-codex/1.0.0/bin/sane", {})).toBe("homebrew");
  });

  it("auto-updates supported package-manager installs only when enabled", () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const result = checkForUpdates({
      currentVersion: "1.0.0-beta.1",
      latestVersion: "1.0.0-beta.2",
      autoUpdate: true,
      executablePath: "/home/me/.pnpm/sane-codex/1.0.0/bin/sane.cjs",
      spawn: ((command: string, args: string[]) => {
        calls.push({ command, args });
        return { status: 0, stdout: "", stderr: "" };
      }) as never
    });

    expect(result.summary).toBe("update applied: sane-codex 1.0.0-beta.1 -> 1.0.0-beta.2");
    expect(calls).toEqual([{ command: "pnpm", args: ["add", "-g", "sane-codex"] }]);
  });
});
