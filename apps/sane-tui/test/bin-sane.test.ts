import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-bin-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

const BIN_PATH = resolve(process.cwd(), "bin", "sane.mjs");

describe("sane bin shim", () => {
  it("runs the smart preview in text mode for settings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = spawnSync(process.execPath, [BIN_PATH, "settings"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        HOME: homeDir
      },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Sane / Configure /");
  }, 15_000);

  it("runs section shortcuts through the smart preview shim", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = spawnSync(process.execPath, [BIN_PATH, "status"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        HOME: homeDir
      },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Sane / Check /");
  }, 15_000);

  it("opens the install wizard through the same shim", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    writeFileSync(join(projectRoot, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n');

    const result = spawnSync(process.execPath, [BIN_PATH, "install"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        HOME: homeDir
      },
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Sane / Setup /");
    expect(result.stdout).toContain("Set up the local Sane files");
  }, 15_000);
});
