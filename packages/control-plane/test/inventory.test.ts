import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/core";
import { optionalPackSkillNames } from "@sane/framework-assets";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { applyCodexProfile } from "../src/codex-config.js";
import { exportAll } from "../src/bundles.js";
import { exportGlobalAgents, exportUserSkills } from "../src/codex-native.js";
import { exportCustomAgents, exportHooks } from "../src/hooks-custom-agents.js";
import {
  doctor,
  doctorForStatusBundle,
  inspectDoctorSnapshot,
  inspectOnboardingSnapshot,
  inspectOnboardingSnapshotFromStatusBundle,
  inspectStatusBundle,
  showStatusFromStatusBundle,
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

    expect(bundle.localRuntime.map((item) => item.name)).toEqual([
      "runtime",
      "config",
      "current-run",
      "summary",
      "brief",
      "pack-core",
      "pack-caveman",
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
    expect(bundle.inventory).toHaveLength(
      bundle.localRuntime.length + bundle.codexNative.length + bundle.compatibility.length
    );
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
        name: "rtk",
        inventoryName: "pack-rtk",
        status: "disabled",
        skillName: null,
        skillNames: [],
        provenance: expect.objectContaining({
          kind: "internal"
        })
      }),
      expect.objectContaining({
        name: "frontend-craft",
        inventoryName: "pack-frontend-craft",
        status: "disabled",
        skillName: "design-taste-frontend",
        skillNames: optionalPackSkillNames("frontend-craft"),
        provenance: expect.objectContaining({
          kind: "derived"
        })
      })
    ]);
    expect(bundle.primary.runtime?.status).toBe(InventoryStatus.Installed);
    expect(bundle.runtimeState.current).toEqual(
      expect.objectContaining({
        phase: "setup"
      })
    );
    expect(bundle.primary.codexConfig?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.userSkills?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.hooks?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.customAgents?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.installBundle).toBe("missing");
    expect(bundle.counts.installed).toBeGreaterThan(0);
    expect(bundle.counts.missing).toBeGreaterThan(0);
    expect(bundle.driftItems).toEqual([]);
    expect(bundle.conflictWarnings).toEqual([]);
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

  it("keeps bundle-based show-status aligned with the wrapper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(showStatusFromStatusBundle(bundle)).toEqual(showStatus(paths, codexPaths));
  });

  it("keeps bundle-based onboarding snapshot aligned with the wrapper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(inspectOnboardingSnapshotFromStatusBundle(paths, bundle)).toEqual(
      inspectOnboardingSnapshot(paths, codexPaths)
    );
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

  it("surfaces warning-only unmanaged Codex MCP conflicts in the canonical bundle", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        "[mcp_servers.context7]",
        'command = "context7"',
        "",
        "[mcp_servers.experimental_sidecar]",
        'command = "experimental"',
        "",
        "[plugins.local_lab]",
        "enabled = true",
        "",
        "[plugins.disabled_lab]",
        "enabled = false"
      ].join("\n")
    );

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.primary.codexConfig?.status).toBe(InventoryStatus.Installed);
    expect(bundle.driftItems.map((item) => item.name)).not.toContain("codex-config");
    expect(bundle.conflictWarnings).toEqual([
      {
        kind: "unmanaged_mcp_server",
        target: "mcp_servers.experimental_sidecar",
        path: codexPaths.configToml,
        message:
          "unmanaged Codex MCP server 'experimental_sidecar' is outside Sane's known profiles"
      },
      {
        kind: "unmanaged_plugin",
        target: "plugins.local_lab",
        path: codexPaths.configToml,
        message: "enabled Codex plugin 'local_lab' is outside Sane's managed profiles"
      }
    ]);
  });

  it("surfaces disabled Codex hooks as a warning-only config conflict", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      [
        "[features]",
        "codex_hooks = false"
      ].join("\n")
    );

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.primary.codexConfig?.status).toBe(InventoryStatus.Installed);
    expect(bundle.driftItems.map((item) => item.name)).not.toContain("codex-config");
    expect(bundle.conflictWarnings).toEqual([
      {
        kind: "disabled_codex_hooks",
        target: "features.codex_hooks",
        path: codexPaths.configToml,
        message:
          "Codex hooks are disabled, so Sane-managed hook exports will not run until features.codex_hooks is enabled"
      }
    ]);
  });

  it("surfaces invalid Codex config as a warning without replacing inventory drift", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.configToml, "{");

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.primary.codexConfig?.status).toBe(InventoryStatus.Invalid);
    expect(bundle.driftItems.map((item) => item.name)).toContain("codex-config");
    expect(bundle.conflictWarnings).toEqual([
      expect.objectContaining({
        kind: "invalid_config",
        target: "config.toml",
        path: codexPaths.configToml
      })
    ]);
  });

  it("marks hooks invalid but does not block the install bundle on native Windows", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportUserSkills(paths, codexPaths);
    exportGlobalAgents(paths, codexPaths);
    exportCustomAgents(paths, codexPaths);

    const bundle = inspectStatusBundle(paths, codexPaths, "windows");

    expect(bundle.primary.hooks?.status).toBe(InventoryStatus.Invalid);
    expect(bundle.primary.status.hooks).toBe("invalid");
    expect(bundle.primary.installBundle).toBe("installed");
  });

  it("formats native Windows hooks as unsupported in doctor output", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportUserSkills(paths, codexPaths);
    exportGlobalAgents(paths, codexPaths);
    exportCustomAgents(paths, codexPaths);

    const bundle = inspectStatusBundle(paths, codexPaths, "windows");
    const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths, bundle);

    expect(doctorSnapshot.lines).toContain("hooks: unsupported (use WSL)");
  });

  it("does not keep unsupported native Windows hooks in onboarding attention once the bundle is installed", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    applyCodexProfile(paths, codexPaths);
    exportAll(paths, codexPaths, "windows");

    const bundle = inspectStatusBundle(paths, codexPaths, "windows");
    const onboarding = inspectOnboardingSnapshotFromStatusBundle(paths, bundle);

    expect(onboarding.recommendedActionId).toBeNull();
    expect(onboarding.attentionItems.map((item) => item.id)).not.toContain("hooks");
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
    expect(doctorSnapshot.lines).toContain("opencode-agents: missing (run `export opencode-agents`)");
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
        skillNames: optionalPackSkillNames("frontend-craft")
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
        skillNames: optionalPackSkillNames("frontend-craft")
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

function writeBackupSiblings(basePath: string, prefix: string): void {
  for (let index = 1; index <= 4; index += 1) {
    writeFileSync(`${basePath}.bak.${index}`, `${prefix}.${index}\n`, "utf8");
  }
}
