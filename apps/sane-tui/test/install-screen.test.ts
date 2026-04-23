import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyIntegrationsProfile } from "@sane/control-plane/codex-config.js";
import { exportAll } from "@sane/control-plane";
import * as inventory from "@sane/control-plane/inventory.js";
import * as installStatus from "@sane/control-plane/install-status.js";
import { loadInstallScreen, loadInstallScreenFromStatusBundle } from "@/install-screen.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-tui-install-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("install screen model", () => {
  it("lists the full codex-native install surface in Rust order", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const screen = loadInstallScreen(paths, codexPaths);

    expect(screen.summary).toBe("Install");
    expect(screen.recommendedActionId).toBe("export_all");
    expect(screen.bundleStatus).toBe("missing");
    expect(screen.missingTargets).toEqual([
      "user-skills",
      "global-agents",
      "hooks",
      "custom-agents"
    ]);
    expect(screen.integrationsStatus).toEqual({ kind: "missing", label: "missing" });
    expect(screen.integrationsRecommendedChangeCount).toBe(3);
    expect(screen.actions.map((action) => action.id)).toEqual([
      "export_user_skills",
      "export_repo_skills",
      "export_repo_agents",
      "export_global_agents",
      "apply_integrations_profile",
      "export_hooks",
      "export_custom_agents",
      "export_all",
      "export_opencode_agents"
    ]);
    expect(screen.actions.find((action) => action.id === "export_repo_skills")?.repoMutation).toBe(
      true
    );
    expect(screen.actions.find((action) => action.id === "export_all")?.includes).toEqual([
      "user-skills",
      "global-agents",
      "hooks",
      "custom-agents"
    ]);
    expect(screen.actions.find((action) => action.id === "apply_integrations_profile")?.status).toEqual({
      kind: "missing",
      label: "missing"
    });
    expect(screen.actions.find((action) => action.id === "export_opencode_agents")?.status).toEqual({
      kind: "missing",
      label: "missing"
    });
  });

  it("reflects installed user bundle state after export-all", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportAll(paths, codexPaths);
    const screen = loadInstallScreen(paths, codexPaths);

    expect(screen.recommendedActionId).toBe("apply_integrations_profile");
    expect(screen.bundleStatus).toBe("installed");
    expect(screen.missingTargets).toEqual([]);
    expect(screen.integrationsStatus).toEqual({ kind: "missing", label: "missing" });
    expect(screen.integrationsRecommendedChangeCount).toBe(3);
    expect(screen.actions.find((action) => action.id === "export_user_skills")?.status).toEqual({
      kind: "installed",
      label: "installed"
    });
    expect(screen.actions.find((action) => action.id === "export_global_agents")?.status).toEqual({
      kind: "installed",
      label: "installed"
    });
    expect(screen.actions.find((action) => action.id === "export_hooks")?.status).toEqual({
      kind: "installed",
      label: "installed"
    });
    expect(screen.actions.find((action) => action.id === "export_custom_agents")?.status).toEqual({
      kind: "installed",
      label: "installed"
    });
  });

  it("reflects integrations-profile apply status after the codex tools are written", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    applyIntegrationsProfile(paths, codexPaths);
    const screen = loadInstallScreen(paths, codexPaths);

    expect(screen.integrationsStatus).toEqual({ kind: "installed", label: "installed" });
    expect(screen.integrationsRecommendedChangeCount).toBe(0);
    expect(screen.actions.find((action) => action.id === "apply_integrations_profile")?.status).toEqual({
      kind: "installed",
      label: "installed"
    });
  });

  it("clears the recommendation once the bundle and integrations audit are both satisfied", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportAll(paths, codexPaths);
    applyIntegrationsProfile(paths, codexPaths);
    const screen = loadInstallScreen(paths, codexPaths);

    expect(screen.integrationsStatus).toEqual({ kind: "installed", label: "installed" });
    expect(screen.integrationsRecommendedChangeCount).toBe(0);
    expect(screen.bundleStatus).toBe("installed");
    expect(screen.actions.find((action) => action.id === "apply_integrations_profile")?.status).toEqual({
      kind: "installed",
      label: "installed"
    });
    expect(screen.recommendedActionId).toBeNull();
  });

  it("surfaces invalid integrations status when codex config is not parseable", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(codexPaths.codexHome, { recursive: true });
    writeFileSync(codexPaths.configToml, "model = ", "utf8");

    const screen = loadInstallScreen(paths, codexPaths);

    expect(screen.integrationsStatus).toEqual({ kind: "invalid", label: "invalid" });
    expect(screen.integrationsRecommendedChangeCount).toBe(0);
    expect(screen.actions.find((action) => action.id === "apply_integrations_profile")?.status).toEqual({
      kind: "invalid",
      label: "invalid"
    });
  });

  it("builds from a preloaded status bundle when requested", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const bundle = inventory.inspectStatusBundle(paths, codexPaths);
    const fromBundleSpy = vi.spyOn(installStatus, "inspectInstallStatusFromStatusBundle");
    const screen = loadInstallScreenFromStatusBundle(paths, codexPaths, bundle);

    expect(fromBundleSpy).toHaveBeenCalledTimes(1);
    expect(fromBundleSpy).toHaveBeenCalledWith(paths, codexPaths, bundle);
    expect(screen.recommendedActionId).toBe("export_all");
  });
});
