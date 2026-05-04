import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createProjectPaths, createCodexPaths } from "../src/platform.js";
import { readCurrentRunState, readRunSummary } from "@sane/state";
import { installRuntime } from "../src/features/install/install-runtime.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-control-plane-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("installRuntime", () => {
  it("creates the canonical .sane runtime and returns typed rewrite details", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const result = installRuntime(projectPaths, codexPaths);
    const currentRun = readCurrentRunState(projectPaths.currentRunPath);
    const summary = readRunSummary(projectPaths.summaryPath);
    const brief = readFileSync(projectPaths.briefPath, "utf8");

    expect(result.kind.value).toBe("InstallRuntime");
    expect(result.summary).toBe(`installed runtime at ${projectPaths.runtimeRoot}`);
    expect(result.details).toContain(`config: ${projectPaths.configPath}`);
    expect(result.details).toContain(`current-run: ${projectPaths.currentRunPath}`);
    expect(result.details).toContain(`summary: ${projectPaths.summaryPath}`);
    expect(result.details).toContain(`brief: ${projectPaths.briefPath}`);
    expect(result.details).toContain(`config write mode: first write`);
    expect(result.details).toContain(`current-run write mode: first write`);
    expect(result.details).toContain(`summary write mode: first write`);
    expect(result.details).toContain(`brief write mode: first write`);
    expect(result.pathsTouched).toEqual([
      projectPaths.briefPath,
      projectPaths.configPath,
      projectPaths.artifactsPath,
      projectPaths.currentRunPath,
      projectPaths.decisionsPath,
      projectPaths.eventsPath,
      projectPaths.summaryPath
    ]);
    expect(result.rewrite?.rewrittenPath).toBe(projectPaths.configPath);
    expect(result.rewrite?.firstWrite).toBe(true);
    expect(result.inventory).toEqual([]);
    expect(existsSync(projectPaths.runtimeRoot)).toBe(true);
    expect(existsSync(projectPaths.eventsPath)).toBe(true);
    expect(existsSync(projectPaths.decisionsPath)).toBe(true);
    expect(existsSync(projectPaths.artifactsPath)).toBe(true);
    expect(existsSync(projectPaths.telemetryDir)).toBe(false);
    expect(currentRun.objective).toBe("initialize sane runtime");
    expect(currentRun.phase).toBe("setup");
    expect(currentRun.activeTasks).toEqual(["install sane runtime"]);
    expect(currentRun.verification.status).toBe("pending");
    expect(summary.acceptedDecisions).toEqual([]);
    expect(brief).toContain("# Sane Brief");
  });

  it("repairs invalid canonical files and reports backup metadata", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(projectPaths, codexPaths);

    writeFileSync(projectPaths.configPath, "not = [valid");
    writeFileSync(projectPaths.currentRunPath, "{");
    writeFileSync(projectPaths.summaryPath, "{");
    writeFileSync(projectPaths.briefPath, "# stale brief\n");

    const result = installRuntime(projectPaths, codexPaths);

    expect(result.details).toContain("config write mode: rewrite");
    expect(result.details).toContain("current-run write mode: rewrite");
    expect(result.details).toContain("summary write mode: rewrite");
    expect(result.details).toContain("brief write mode: rewrite");
    expect(result.pathsTouched.some((path) => path.includes(".bak."))).toBe(true);
    expect(result.rewrite?.backupPath).toContain(".bak.");
    expect(readCurrentRunState(projectPaths.currentRunPath).phase).toBe("setup");
    expect(readRunSummary(projectPaths.summaryPath).version).toBe(2);
    expect(readFileSync(projectPaths.briefPath, "utf8")).toContain("- Phase: setup");
  });
});
