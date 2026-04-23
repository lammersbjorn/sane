import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { applyIntegrationsProfile } from "../src/codex-config.js";
import { CORE_INSTALL_BUNDLE_TARGETS } from "../src/core-install-bundle-targets.js";
import { exportAll } from "../src/index.js";
import {
  inspectInstallStatus,
  inspectInstallStatusFromStatusBundle
} from "../src/install-status.js";
import { inspectStatusBundle } from "../src/inventory.js";

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
        missingTargets: [...CORE_INSTALL_BUNDLE_TARGETS],
        integrationsStatus: { kind: "missing", label: "missing" },
        integrationsRecommendedChangeCount: 3,
        recommendedActionId: "export_all",
        actionStatus: expect.objectContaining({
          export_user_skills: { kind: "missing", label: "missing" },
          export_global_agents: { kind: "missing", label: "missing" },
          export_hooks: { kind: "missing", label: "missing" },
          export_custom_agents: { kind: "missing", label: "missing" },
          export_opencode_agents: { kind: "missing", label: "missing" },
          apply_integrations_profile: { kind: "missing", label: "missing" },
          export_all: { kind: "missing", label: "missing" }
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
        integrationsStatus: { kind: "missing", label: "missing" },
        integrationsRecommendedChangeCount: 3,
        recommendedActionId: "apply_integrations_profile",
        actionStatus: expect.objectContaining({
          export_all: { kind: "installed", label: "installed" },
          export_opencode_agents: { kind: "missing", label: "missing" },
          apply_integrations_profile: { kind: "missing", label: "missing" }
        })
      })
    );

    applyIntegrationsProfile(paths, codexPaths);
    expect(inspectInstallStatus(paths, codexPaths)).toEqual(
      expect.objectContaining({
        integrationsStatus: { kind: "installed", label: "installed" },
        integrationsRecommendedChangeCount: 0,
        recommendedActionId: null,
        actionStatus: expect.objectContaining({
          apply_integrations_profile: { kind: "installed", label: "installed" }
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
        integrationsStatus: { kind: "invalid", label: "invalid" },
        integrationsRecommendedChangeCount: 0,
        recommendedActionId: "apply_integrations_profile",
        actionStatus: expect.objectContaining({
          export_all: { kind: "installed", label: "installed" },
          apply_integrations_profile: { kind: "invalid", label: "invalid" }
        })
      })
    );
  });

  it("keeps bundle-based install snapshot aligned with the wrapper helper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportAll(paths, codexPaths);
    applyIntegrationsProfile(paths, codexPaths);

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(inspectInstallStatusFromStatusBundle(paths, codexPaths, bundle)).toEqual(
      inspectInstallStatus(paths, codexPaths)
    );
  });

  it("treats hooks as outside the install bundle on native Windows", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportAll(paths, codexPaths, "windows");
    const bundle = inspectStatusBundle(paths, codexPaths, "windows");
    const status = inspectInstallStatusFromStatusBundle(paths, codexPaths, bundle, "windows");

    expect(status.bundleStatus).toBe("installed");
    expect(status.missingTargets).toEqual([]);
    expect(status.actionStatus.export_all).toEqual({ kind: "installed", label: "installed" });
    expect(status.actionStatus.export_hooks).toEqual({ kind: "disabled", label: "unsupported (use WSL)" });
  });
});
