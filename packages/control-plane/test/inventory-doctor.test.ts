import { createDefaultLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/control-plane/core.js";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
import { describe, expect, it } from "vitest";

import { applyCodexProfile } from "../src/codex-config.js";
import { exportGlobalAgents, exportUserSkills } from "../src/codex-native.js";
import { deployCodexFrameworkArtifactPlan } from "../src/framework-artifact-plan.js";
import { exportCustomAgents, exportHooks } from "../src/hooks-custom-agents.js";
import { installRuntime } from "../src/index.js";
import { doctor, doctorForStatusBundle, inspectDoctorSnapshot, inspectStatusBundle, showStatus } from "../src/inventory.js";
import { saveConfig } from "../src/preferences.js";
import { makeTempDir, writeBackupSiblings } from "./inventory-helpers.js";

describe("inventory doctor snapshot behavior", () => {
  it("surfaces manifest-owned framework artifacts in doctor", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    deployCodexFrameworkArtifactPlan(paths, codexPaths, {
      configFragments: { cloudflare: true, statusline: true }
    });

    const bundle = inspectStatusBundle(paths, codexPaths);
    const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths, bundle);

    expect(doctorSnapshot.lines).toContain("framework-artifacts: installed");
  });

  it("keeps bundle-based doctor aligned with the wrapper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    writeBackupSiblings(paths.configPath, "config.local.toml.bak");
    writeBackupSiblings(paths.summaryPath, "summary.json.bak");

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(doctorForStatusBundle(paths, codexPaths, bundle)).toEqual(doctor(paths, codexPaths));
  });

  it("keeps bundle-based doctor backup history snapshot-consistent", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);

    const bundle = inspectStatusBundle(paths, codexPaths);
    writeBackupSiblings(paths.configPath, "config.local.toml.bak");
    writeBackupSiblings(paths.summaryPath, "summary.json.bak");

    const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths, bundle);

    expect(doctorSnapshot.lines).toContain("config-backups: none");
    expect(doctorSnapshot.lines).toContain("summary-backups: none");
  });

  it("formats doctor install and export hints with exact labels", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths);

    expect(doctorSnapshot.lines).toContain("current-run: missing current-run.json (rerun install)");
    expect(doctorSnapshot.lines).toContain("summary: missing summary.json (rerun install)");
    expect(doctorSnapshot.lines).toContain("codex-config: missing (run `apply codex-profile`)");
    expect(doctorSnapshot.lines).toContain("repo-skills: disabled (optional repo export)");
    expect(doctorSnapshot.lines).toContain("repo-agents: disabled (optional repo export)");
    expect(doctorSnapshot.lines).toContain("hooks: missing (run `export hooks`)");
    expect(doctorSnapshot.lines).toContain("custom-agents: missing (run `export custom-agents`)");
  });

  it("formats overflowed backup history in the doctor snapshot", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    writeBackupSiblings(paths.configPath, "config.local.toml.bak");
    writeBackupSiblings(paths.summaryPath, "summary.json.bak");

    const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths);

    expect(doctorSnapshot.lines).toEqual(
      expect.arrayContaining([
        expect.stringContaining("config-backups: 4 (config.local.toml.bak.4"),
        expect.stringContaining("summary-backups: 4 (summary.json.bak.4")
      ])
    );
    expect(doctorSnapshot.lines.join("\n")).toContain("+1 more)");
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
    exportHooks(paths, codexPaths);
    exportCustomAgents(paths, codexPaths);

    const status = showStatus(paths, codexPaths);
    const doctorResult = doctor(paths, codexPaths);
    const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths);

    expect(status.inventory.find((item) => item.name === "pack-caveman")?.status).toBe(InventoryStatus.Installed);
    expect(doctorResult.summary).toContain("pack-caveman: enabled");
    expect(doctorResult.summary).toContain("codex-config: installed");
    expect(doctorResult.summary).toContain("user-skills: installed");
    expect(doctorResult.summary).toContain("global-agents: installed");
    expect(doctorResult.summary).toContain("hooks: installed");
    expect(doctorResult.summary).toContain("custom-agents: installed");
    expect(doctorSnapshot.headline).toBe("runtime: ok");
    expect(doctorSnapshot.lines[0]).toBe("runtime: ok");
  });
});
