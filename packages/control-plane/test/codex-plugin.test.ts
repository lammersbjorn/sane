import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { InventoryStatus, OperationKind } from "@sane/core";
import { createCodexPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { exportPlugin, inspectPluginInventory, uninstallPlugin } from "../src/codex-plugin.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-codex-plugin-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});

describe("codex plugin artifact", () => {
  it("exports the plugin artifact and merges the marketplace entry without removing other plugins", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);
    writeMarketplace(codexPaths.userPluginsMarketplaceJson, {
      name: "custom-marketplace",
      plugins: [
        {
          name: "other",
          source: { source: "local", path: join(homeDir, "other-plugin") },
          category: "Other"
        },
        {
          name: "sane",
          source: { source: "local", path: join(homeDir, "stale-sane-plugin") },
          category: "Stale"
        }
      ]
    });

    const result = exportPlugin(codexPaths);
    const marketplace = readMarketplace(codexPaths.userPluginsMarketplaceJson);

    expect(result.kind).toBe(OperationKind.ExportPlugin);
    expect(result.summary).toBe("export plugin: installed Sane Codex plugin artifact");
    expect(result.pathsTouched).toEqual([codexPaths.sanePluginDir, codexPaths.userPluginsMarketplaceJson]);
    expect(result.inventory[0]?.status).toBe(InventoryStatus.Installed);
    expect(readFileSync(join(codexPaths.sanePluginDir, ".codex-plugin", "plugin.json"), "utf8")).toContain(
      '"name": "sane"'
    );
    expect(marketplace.name).toBe("custom-marketplace");
    expect(marketplace.plugins).toEqual([
      {
        name: "other",
        source: { source: "local", path: join(homeDir, "other-plugin") },
        category: "Other"
      },
      {
        name: "sane",
        source: { source: "local", path: codexPaths.sanePluginDir },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: "Productivity"
      }
    ]);
  });

  it("inspects missing, installed, and partial invalid plugin states", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectPluginInventory(codexPaths).status).toBe(InventoryStatus.Missing);

    exportPlugin(codexPaths);
    expect(inspectPluginInventory(codexPaths).status).toBe(InventoryStatus.Installed);

    rmSync(codexPaths.sanePluginDir, { force: true, recursive: true });
    expect(inspectPluginInventory(codexPaths)).toEqual(
      expect.objectContaining({
        name: "plugin",
        status: InventoryStatus.Invalid,
        repairHint: "rerun `export plugin`"
      })
    );

    rmSync(codexPaths.userPluginsMarketplaceJson, { force: true });
    exportPlugin(codexPaths);
    rmSync(codexPaths.userPluginsMarketplaceJson, { force: true });
    expect(inspectPluginInventory(codexPaths).status).toBe(InventoryStatus.Invalid);

    writeMarketplace(codexPaths.userPluginsMarketplaceJson, {
      plugins: {
        name: "sane",
        source: { source: "local", path: codexPaths.sanePluginDir }
      }
    });
    expect(inspectPluginInventory(codexPaths).status).toBe(InventoryStatus.Invalid);

    writeMarketplace(codexPaths.userPluginsMarketplaceJson, {
      plugins: [
        {
          name: "sane",
          source: { source: "local", path: codexPaths.sanePluginDir }
        }
      ]
    });
    writeFileSync(join(codexPaths.sanePluginDir, ".codex-plugin", "plugin.json"), "{", "utf8");
    expect(inspectPluginInventory(codexPaths)).toEqual(
      expect.objectContaining({
        status: InventoryStatus.Invalid,
        repairHint: "rerun `export plugin`"
      })
    );

    writeFileSync(codexPaths.userPluginsMarketplaceJson, "{", "utf8");
    expect(inspectPluginInventory(codexPaths)).toEqual(
      expect.objectContaining({
        status: InventoryStatus.Invalid,
        repairHint: "repair ~/.agents/plugins/marketplace.json or rerun `export plugin`"
      })
    );
  });

  it("uninstalls the generated plugin and removes an owned-only marketplace", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);
    exportPlugin(codexPaths);

    const result = uninstallPlugin(codexPaths);

    expect(result.kind).toBe(OperationKind.UninstallPlugin);
    expect(result.summary).toBe("uninstall plugin: removed Sane Codex plugin artifact");
    expect(result.inventory[0]?.status).toBe(InventoryStatus.Removed);
    expect(existsSync(codexPaths.sanePluginDir)).toBe(false);
    expect(existsSync(codexPaths.userPluginsMarketplaceJson)).toBe(false);
    expect(existsSync(codexPaths.userPluginsDir)).toBe(false);
    expect(existsSync(codexPaths.codexPluginsDir)).toBe(false);
  });

  it("uninstalls only the Sane marketplace entry when other plugins remain", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);
    writeMarketplace(codexPaths.userPluginsMarketplaceJson, {
      name: "custom-marketplace",
      plugins: [
        {
          name: "other",
          source: { source: "local", path: join(homeDir, "other-plugin") },
          category: "Other"
        }
      ]
    });
    exportPlugin(codexPaths);

    uninstallPlugin(codexPaths);
    const marketplace = readMarketplace(codexPaths.userPluginsMarketplaceJson);

    expect(existsSync(codexPaths.sanePluginDir)).toBe(false);
    expect(marketplace).toEqual({
      name: "custom-marketplace",
      plugins: [
        {
          name: "other",
          source: { source: "local", path: join(homeDir, "other-plugin") },
          category: "Other"
        }
      ]
    });
  });

  it("reports not installed when uninstalling absent plugin artifacts", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);

    const result = uninstallPlugin(codexPaths);

    expect(result.summary).toBe("uninstall plugin: not installed");
    expect(result.inventory[0]?.status).toBe(InventoryStatus.Missing);
  });

  it("returns operation results when marketplace json is invalid", () => {
    const homeDir = makeTempDir();
    const codexPaths = createCodexPaths(homeDir);
    writeMarketplace(codexPaths.userPluginsMarketplaceJson, {
      plugins: [
        {
          name: "other",
          source: { source: "local", path: join(homeDir, "other-plugin") }
        }
      ]
    });
    writeFileSync(codexPaths.userPluginsMarketplaceJson, "{", "utf8");

    const exportResult = exportPlugin(codexPaths);
    const uninstallResult = uninstallPlugin(codexPaths);

    expect(exportResult.summary).toBe("export plugin: blocked by invalid marketplace JSON");
    expect(exportResult.inventory[0]?.status).toBe(InventoryStatus.Invalid);
    expect(uninstallResult.summary).toBe("uninstall plugin: blocked by invalid marketplace JSON");
    expect(uninstallResult.inventory[0]?.status).toBe(InventoryStatus.Invalid);
  });
});

function writeMarketplace(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readMarketplace(path: string): { name?: string; plugins?: unknown[] } {
  return JSON.parse(readFileSync(path, "utf8")) as { name?: string; plugins?: unknown[] };
}
