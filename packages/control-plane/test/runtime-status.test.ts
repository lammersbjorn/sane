import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InventoryStatus } from "@sane/core";
import { createProjectPaths, createCodexPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { doctorRuntime, installRuntime, showRuntimeStatus } from "../src/index.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-runtime-status-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("showRuntimeStatus", () => {
  it("reports installed local runtime targets after bootstrap", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);

    installRuntime(projectPaths, createCodexPaths(homeDir));

    const result = showRuntimeStatus(projectPaths);

    expect(result.summary).toBe("status: 5 managed targets inspected");
    expect(result.inventory.map((item) => item.name)).toEqual([
      "runtime",
      "config",
      "current-run",
      "summary",
      "brief"
    ]);
    expect(result.inventory.every((item) => item.scope.displayString() === "local runtime")).toBe(
      true
    );
    expect(result.inventory.every((item) => item.status === InventoryStatus.Installed)).toBe(true);
  });

  it("keeps missing vs invalid runtime layers distinct from canonical bundle status", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);

    installRuntime(projectPaths, createCodexPaths(homeDir));
    writeFileSync(projectPaths.summaryPath, "{", "utf8");
    rmSync(projectPaths.currentRunPath);
    rmSync(projectPaths.briefPath);
    mkdirSync(projectPaths.briefPath, { recursive: true });

    const result = showRuntimeStatus(projectPaths);

    expect(result.inventory).toEqual([
      expect.objectContaining({ name: "runtime", status: InventoryStatus.Installed }),
      expect.objectContaining({ name: "config", status: InventoryStatus.Installed }),
      expect.objectContaining({ name: "current-run", status: InventoryStatus.Missing }),
      expect.objectContaining({ name: "summary", status: InventoryStatus.Invalid }),
      expect.objectContaining({ name: "brief", status: InventoryStatus.Invalid })
    ]);
  });
});

describe("doctorRuntime", () => {
  it("summarizes local runtime health and backup history", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const projectPaths = createProjectPaths(projectRoot);

    installRuntime(projectPaths, createCodexPaths(homeDir));
    writeFileSync(projectPaths.configPath, "not = [valid");
    writeFileSync(projectPaths.summaryPath, "{");
    installRuntime(projectPaths, createCodexPaths(homeDir));

    const result = doctorRuntime(projectPaths);

    expect(result.summary).toContain("runtime: installed");
    expect(result.summary).toContain("config: installed");
    expect(result.summary).toContain("current-run: installed");
    expect(result.summary).toContain("summary: installed");
    expect(result.summary).toContain("brief: installed");
    expect(result.summary).toContain("config-backups: 1 (config.local.toml.bak.");
    expect(result.summary).toContain("summary-backups: 1 (summary.json.bak.");
    expect(result.pathsTouched).toEqual([
      projectPaths.runtimeRoot,
      projectPaths.briefPath,
      projectPaths.configPath,
      projectPaths.currentRunPath,
      projectPaths.summaryPath
    ]);
  });
});
