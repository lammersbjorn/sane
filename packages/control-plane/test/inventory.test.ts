import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/core";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { applyCodexProfile } from "../src/codex-config.js";
import { exportGlobalAgents, exportUserSkills } from "../src/codex-native.js";
import { exportCustomAgents, exportHooks } from "../src/hooks-custom-agents.js";
import {
  doctor,
  inspectDoctorSnapshot,
  inspectOnboardingSnapshot,
  inspectStatusBundle,
  showStatus
} from "../src/inventory.js";
import { installRuntime } from "../src/index.js";
import { saveConfig } from "../src/preferences.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-inventory-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("full inventory and doctor", () => {
  it("builds a canonical status bundle with grouped scopes and drift items", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.caveman = true;

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.inventory).toHaveLength(18);
    expect(bundle.localRuntime.map((item) => item.name)).toEqual([
      "runtime",
      "config",
      "current-run",
      "summary",
      "brief",
      "pack-core",
      "pack-caveman",
      "pack-cavemem",
      "pack-rtk",
      "pack-frontend-craft"
    ]);
    expect(bundle.codexNative.map((item) => item.name)).toEqual([
      "codex-config",
      "user-skills",
      "repo-skills",
      "repo-agents",
      "global-agents",
      "hooks",
      "custom-agents"
    ]);
    expect(bundle.compatibility.map((item) => item.name)).toEqual([
      "opencode-agents"
    ]);
    expect(bundle.optionalPacks).toEqual([
      expect.objectContaining({
        name: "caveman",
        inventoryName: "pack-caveman",
        status: "configured",
        skillName: "sane-caveman",
        skillNames: ["sane-caveman"],
        provenance: expect.objectContaining({
          kind: "derived"
        })
      }),
      expect.objectContaining({
        name: "cavemem",
        inventoryName: "pack-cavemem",
        status: "disabled",
        skillName: "sane-cavemem",
        skillNames: ["sane-cavemem"],
        provenance: expect.objectContaining({
          kind: "derived"
        })
      }),
      expect.objectContaining({
        name: "rtk",
        inventoryName: "pack-rtk",
        status: "disabled",
        skillName: "sane-rtk",
        skillNames: ["sane-rtk"],
        provenance: expect.objectContaining({
          kind: "internal"
        })
      }),
      expect.objectContaining({
        name: "frontend-craft",
        inventoryName: "pack-frontend-craft",
        status: "disabled",
        skillName: "design-taste-frontend",
        skillNames: ["design-taste-frontend", "impeccable"],
        provenance: expect.objectContaining({
          kind: "derived"
        })
      })
    ]);
    expect(bundle.primary.runtime?.status).toBe(InventoryStatus.Installed);
    expect(bundle.primary.codexConfig?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.userSkills?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.hooks?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.customAgents?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.installBundle).toBe("missing");
    expect(bundle.counts.installed).toBeGreaterThan(0);
    expect(bundle.counts.missing).toBeGreaterThan(0);
    expect(bundle.driftItems).toEqual([]);
  });

  it("reports optional packs as configured before export", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.caveman = true;
    config.packs.rtk = true;

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);

    const result = showStatus(paths, codexPaths);

    expect(result.summary).toContain("managed targets inspected");
    expect(result.inventory.find((item) => item.name === "pack-core")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(result.inventory.find((item) => item.name === "pack-caveman")?.status).toBe(
      InventoryStatus.Configured
    );
    expect(result.inventory.find((item) => item.name === "pack-rtk")?.status).toBe(
      InventoryStatus.Configured
    );
    expect(result.inventory.find((item) => item.name === "user-skills")?.status).toBe(
      InventoryStatus.Missing
    );
    expect(result.inventory.find((item) => item.name === "repo-skills")?.status).toBe(
      InventoryStatus.Disabled
    );
    expect(result.inventory.find((item) => item.name === "hooks")?.status).toBe(
      InventoryStatus.Missing
    );
  });

  it("surfaces invalid and unmanaged drift in the canonical bundle", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    rmSync(paths.configPath, { force: true });

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.driftItems.map((item) => item.name)).toContain("config");
    expect(bundle.counts.invalid).toBeGreaterThan(0);
  });

  it("reports installed codex-native surfaces and enabled exported packs", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.caveman = true;

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    applyCodexProfile(paths, codexPaths);
    exportUserSkills(paths, codexPaths);
    exportGlobalAgents(paths, codexPaths);
    exportHooks(codexPaths);
    exportCustomAgents(paths, codexPaths);

    const status = showStatus(paths, codexPaths);
    const doctorResult = doctor(paths, codexPaths);
    const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths);

    expect(status.inventory.find((item) => item.name === "pack-caveman")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(status.inventory.find((item) => item.name === "codex-config")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(status.inventory.find((item) => item.name === "user-skills")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(status.inventory.find((item) => item.name === "global-agents")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(status.inventory.find((item) => item.name === "hooks")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(status.inventory.find((item) => item.name === "custom-agents")?.status).toBe(
      InventoryStatus.Installed
    );
    expect(status.inventory.find((item) => item.name === "opencode-agents")?.status).toBe(
      InventoryStatus.Missing
    );
    expect(doctorResult.summary).toContain("pack-caveman: enabled");
    expect(doctorResult.summary).toContain("codex-config: installed");
    expect(doctorResult.summary).toContain("user-skills: installed");
    expect(doctorResult.summary).toContain("global-agents: installed");
    expect(doctorResult.summary).toContain("hooks: installed");
    expect(doctorResult.summary).toContain("custom-agents: installed");
    expect(doctorResult.summary).toContain("opencode-agents: missing");
    expect(doctorSnapshot.headline).toBe("runtime: ok");
    expect(doctorSnapshot.lines[0]).toBe("runtime: ok");
  });

  it("does not mark a multi-skill pack installed when only one exported skill matches", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.frontendCraft = true;

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    exportUserSkills(paths, codexPaths);
    rmSync(join(codexPaths.userSkillsDir, "impeccable"), { recursive: true, force: true });

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.optionalPacks.find((item) => item.name === "frontend-craft")).toEqual(
      expect.objectContaining({
        status: "configured",
        skillNames: ["design-taste-frontend", "impeccable"]
      })
    );
    expect(bundle.inventory.find((item) => item.name === "pack-frontend-craft")?.status).toBe(
      InventoryStatus.Configured
    );
  });

  it("marks a pack invalid when a shipped frontend reference file goes missing", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.frontendCraft = true;

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    exportUserSkills(paths, codexPaths);
    rmSync(join(codexPaths.userSkillsDir, "impeccable", "reference", "typography.md"), {
      force: true
    });

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.optionalPacks.find((item) => item.name === "frontend-craft")).toEqual(
      expect.objectContaining({
        status: "invalid",
        skillNames: ["design-taste-frontend", "impeccable"]
      })
    );
    expect(bundle.inventory.find((item) => item.name === "pack-frontend-craft")?.status).toBe(
      InventoryStatus.Invalid
    );
  });

  it("derives onboarding recommendations from a narrow backend snapshot", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();

    expect(inspectOnboardingSnapshot(paths, codexPaths)).toMatchObject({
      recommendedActionId: "install_runtime",
      recommendedReason: "install_runtime",
      primaryStatuses: {
        runtime: "missing",
        codexConfig: "missing",
        userSkills: "missing",
        hooks: "missing",
        installBundle: "missing"
      },
      attentionItems: [
        { id: "runtime", status: "missing" },
        { id: "config", status: "missing" },
        { id: "codex-config", status: "missing" },
        { id: "user-skills", status: "missing" },
        { id: "hooks", status: "missing" },
        { id: "custom-agents", status: "missing" }
      ]
    });

    installRuntime(paths, codexPaths);
    expect(inspectOnboardingSnapshot(paths, codexPaths)).toMatchObject({
      recommendedActionId: "show_codex_config",
      recommendedReason: "show_codex_config"
    });

    saveConfig(paths, config);
    applyCodexProfile(paths, codexPaths);
    expect(inspectOnboardingSnapshot(paths, codexPaths)).toMatchObject({
      recommendedActionId: "export_all",
      recommendedReason: "export_all"
    });
  });
});
