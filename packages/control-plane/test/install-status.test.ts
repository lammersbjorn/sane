import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { applyIntegrationsProfile } from "../src/codex-config.js";
import { exportAll } from "../src/index.js";
import { inspectInstallStatus } from "../src/install-status.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-install-status-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("install status snapshot", () => {
  it("reports missing bundle targets and recommends export-all first", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectInstallStatus(paths, codexPaths)).toEqual(
      expect.objectContaining({
        bundleStatus: "missing",
        missingTargets: ["user-skills", "global-agents", "hooks", "custom-agents"],
        recommendedActionId: "export_all",
        actionStatus: expect.objectContaining({
          export_user_skills: "missing",
          export_global_agents: "missing",
          export_hooks: "missing",
          export_custom_agents: "missing",
          apply_integrations_profile: "missing",
          export_all: "missing"
        })
      })
    );
  });

  it("reports installed bundle state and integrations follow-up status", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportAll(paths, codexPaths);

    expect(inspectInstallStatus(paths, codexPaths)).toEqual(
      expect.objectContaining({
        bundleStatus: "installed",
        missingTargets: [],
        recommendedActionId: "apply_integrations_profile",
        actionStatus: expect.objectContaining({
          export_all: "installed",
          apply_integrations_profile: "missing"
        })
      })
    );

    applyIntegrationsProfile(paths, codexPaths);
    expect(inspectInstallStatus(paths, codexPaths)).toEqual(
      expect.objectContaining({
        recommendedActionId: null,
        actionStatus: expect.objectContaining({
          apply_integrations_profile: "installed"
        })
      })
    );
  });

  it("surfaces invalid integrations config separately from bundle state", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportAll(paths, codexPaths);
    mkdirSync(codexPaths.codexHome, { recursive: true });
    writeFileSync(codexPaths.configToml, "model = ", "utf8");

    expect(inspectInstallStatus(paths, codexPaths)).toEqual(
      expect.objectContaining({
        bundleStatus: "installed",
        missingTargets: [],
        recommendedActionId: "apply_integrations_profile",
        actionStatus: expect.objectContaining({
          export_all: "installed",
          apply_integrations_profile: "invalid"
        })
      })
    );
  });
});
