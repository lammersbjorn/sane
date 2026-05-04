import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/control-plane/core.js";
import { optionalPackSkillNames } from "@sane/framework-assets";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
import { describe, expect, it } from "vitest";

import { exportAll } from "../src/bundles.js";
import { applyCodexProfile } from "../src/codex-config.js";
import { exportGlobalAgents, exportUserSkills } from "../src/codex-native.js";
import { deployCodexFrameworkArtifactPlan } from "../src/framework-artifact-plan.js";
import { exportCustomAgents, exportHooks } from "../src/hooks-custom-agents.js";
import { installRuntime } from "../src/index.js";
import { inspectStatusBundle, showStatus, showStatusFromStatusBundle } from "../src/inventory.js";
import { saveConfig } from "../src/preferences.js";
import { makeTempDir } from "./inventory-helpers.js";

describe("inventory status bundle behavior", () => {
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
      "pack-frontend-craft",
      "pack-docs-craft"
    ]);
    expect(bundle.codexNative.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        "codex-config",
        "user-skills",
        "repo-skills",
        "repo-agents",
        "global-agents",
        "hooks",
        "custom-agents",
        "framework-artifacts"
      ])
    );
    expect(bundle.compatibility).toEqual([]);
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
        provenance: expect.objectContaining({ kind: "derived" })
      }),
      expect.objectContaining({
        name: "rtk",
        inventoryName: "pack-rtk",
        status: "disabled",
        skillName: "sane-rtk",
        skillNames: ["sane-rtk"],
        provenance: expect.objectContaining({ kind: "internal" })
      }),
      expect.objectContaining({
        name: "frontend-craft",
        inventoryName: "pack-frontend-craft",
        status: "disabled",
        skillName: "sane-frontend-craft",
        skillNames: optionalPackSkillNames("frontend-craft"),
        provenance: expect.objectContaining({ kind: "derived" })
      }),
      expect.objectContaining({
        name: "docs-craft",
        inventoryName: "pack-docs-craft",
        status: "disabled",
        skillName: "sane-docs-writing",
        skillNames: optionalPackSkillNames("docs-craft"),
        provenance: expect.objectContaining({ kind: "derived" })
      })
    ]);
    expect(bundle.primary.runtime?.status).toBe(InventoryStatus.Installed);
    expect(bundle.runtimeState.current).toEqual(expect.objectContaining({ phase: "setup" }));
    expect(bundle.primary.codexConfig?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.userSkills?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.hooks?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.customAgents?.status).toBe(InventoryStatus.Missing);
    expect(bundle.inventory.find((item) => item.name === "framework-artifacts")?.status).toBe(InventoryStatus.Missing);
    expect(bundle.primary.installBundle).toBe("missing");
    expect(bundle.counts.installed).toBeGreaterThan(0);
    expect(bundle.counts.missing).toBeGreaterThan(0);
    expect(bundle.driftItems).toEqual([]);
    expect(bundle.conflictWarnings).toEqual([]);
  });

  it("surfaces manifest-owned framework artifacts in status", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectStatusBundle(paths, codexPaths).inventory.find((item) => item.name === "framework-artifacts")?.status).toBe(
      InventoryStatus.Missing
    );

    deployCodexFrameworkArtifactPlan(paths, codexPaths, {
      configFragments: { cloudflare: true, statusline: true }
    });

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.inventory.find((item) => item.name === "framework-artifacts")?.status).toBe(
      InventoryStatus.Installed
    );
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
    expect(result.inventory.find((item) => item.name === "pack-core")?.status).toBe(InventoryStatus.Installed);
    expect(result.inventory.find((item) => item.name === "pack-caveman")?.status).toBe(InventoryStatus.Configured);
    expect(result.inventory.find((item) => item.name === "pack-rtk")?.status).toBe(InventoryStatus.Configured);
    expect(result.inventory.find((item) => item.name === "user-skills")?.status).toBe(InventoryStatus.Missing);
    expect(result.inventory.find((item) => item.name === "repo-skills")?.status).toBe(InventoryStatus.Disabled);
    expect(result.inventory.find((item) => item.name === "hooks")?.status).toBe(InventoryStatus.Missing);
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
        "[mcp_servers.playwright]",
        'command = "npx"',
        'args = ["@playwright/mcp@latest"]',
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
          "unmanaged Codex MCP server 'experimental_sidecar' is outside Sane's known tool settings; warning-only, no auto-install or auto-remove"
      },
      {
        kind: "unmanaged_plugin",
        target: "plugins.local_lab",
        path: codexPaths.configToml,
        message: "enabled Codex plugin 'local_lab' is outside Sane's managed settings; warning-only, no auto-install or auto-remove"
      }
    ]);
  });

  it("surfaces managed Codex MCP drift as a warning-only config conflict", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.configToml, ["[mcp_servers.playwright]", 'command = "playwright"'].join("\n"));

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.primary.codexConfig?.status).toBe(InventoryStatus.Installed);
    expect(bundle.driftItems.map((item) => item.name)).not.toContain("codex-config");
    expect(bundle.conflictWarnings).toEqual([
      {
        kind: "managed_mcp_server_drift",
        target: "mcp_servers.playwright",
        path: codexPaths.configToml,
        message: "managed Codex MCP server 'playwright' differs from Sane's recommended settings; warning-only until you explicitly apply settings"
      }
    ]);
  });

  it("surfaces oversized always-loaded guidance as warning-only context bloat", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(paths.repoAgentsMd, Array.from({ length: 230 }, (_, index) => `repo line ${index}`).join("\n"));
    writeFileSync(codexPaths.globalAgentsMd, `${"global ".repeat(2_100)}\n`);

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.conflictWarnings).toEqual([
      expect.objectContaining({
        kind: "oversized_guidance_file",
        target: "AGENTS.md",
        path: paths.repoAgentsMd,
        message: expect.stringContaining("prefer narrow skills")
      }),
      expect.objectContaining({
        kind: "oversized_guidance_file",
        target: "~/.codex/AGENTS.md",
        path: codexPaths.globalAgentsMd,
        message: expect.stringContaining("always-loaded context")
      })
    ]);
  });

  it("surfaces explicit core profile drift without turning it into inventory drift", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.configToml, ['model = "old-model"', 'model_reasoning_effort = "low"'].join("\n"));

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.primary.codexConfig?.status).toBe(InventoryStatus.Installed);
    expect(bundle.driftItems.map((item) => item.name)).not.toContain("codex-config");
    expect(bundle.conflictWarnings.map((warning) => warning.kind)).toEqual(["codex_profile_drift"]);
    expect(bundle.conflictWarnings.map((warning) => warning.target)).toEqual(["model"]);
  });

  it("does not warn for absent optional statusline or memories settings", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.configToml, "");

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.conflictWarnings).toEqual([]);
  });

  it("surfaces Codex native memories and explicit statusline drift as warning-only conflicts", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(
      codexPaths.configToml,
      ["[features]", "memories = true", "", "[tui]", 'notification_condition = "mentions"'].join("\n")
    );

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.primary.codexConfig?.status).toBe(InventoryStatus.Installed);
    expect(bundle.driftItems.map((item) => item.name)).not.toContain("codex-config");
    expect(bundle.conflictWarnings).toEqual([
      {
        kind: "codex_native_memories_enabled",
        target: "features.memories",
        path: codexPaths.configToml,
        message: "Codex native memories are enabled; Sane keeps default continuity in scoped exports plus .sane state instead"
      },
      {
        kind: "statusline_profile_drift",
        target: "tui.notification_condition",
        path: codexPaths.configToml,
        message: "Codex TUI notifications 'mentions' differ from Sane's status line setting 'always'"
      }
    ]);
  });

  it("surfaces disabled Codex hooks as a warning-only config conflict", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(join(homeDir, ".codex"), { recursive: true });
    writeFileSync(codexPaths.configToml, ["[features]", "codex_hooks = false"].join("\n"));

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.primary.codexConfig?.status).toBe(InventoryStatus.Installed);
    expect(bundle.driftItems.map((item) => item.name)).not.toContain("codex-config");
    expect(bundle.conflictWarnings).toEqual([
      {
        kind: "disabled_codex_hooks",
        target: "features.codex_hooks",
        path: codexPaths.configToml,
        message: "Codex hooks are disabled, so Sane-managed hook exports will not run until features.codex_hooks is enabled"
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

    expect(status.inventory.find((item) => item.name === "pack-caveman")?.status).toBe(InventoryStatus.Installed);
    expect(status.inventory.find((item) => item.name === "codex-config")?.status).toBe(InventoryStatus.Installed);
    expect(status.inventory.find((item) => item.name === "user-skills")?.status).toBe(InventoryStatus.Installed);
    expect(status.inventory.find((item) => item.name === "global-agents")?.status).toBe(InventoryStatus.Installed);
    expect(status.inventory.find((item) => item.name === "hooks")?.status).toBe(InventoryStatus.Installed);
    expect(status.inventory.find((item) => item.name === "custom-agents")?.status).toBe(InventoryStatus.Installed);
  });

  it("keeps installed native Windows bundle status clean when unsupported hooks are exported", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    applyCodexProfile(paths, codexPaths);
    exportAll(paths, codexPaths, "windows");

    const bundle = inspectStatusBundle(paths, codexPaths, "windows");

    expect(bundle.primary.installBundle).toBe("installed");
  });
});
