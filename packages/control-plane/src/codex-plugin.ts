import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { InventoryScope, InventoryStatus, OperationKind, OperationResult } from "@sane/core";
import { type CodexPaths } from "@sane/platform";
import { writeAtomicTextFile } from "@sane/state";

const SANE_PLUGIN_NAME = "sane";
const SANE_PLUGIN_DISPLAY_NAME = "Sane";

interface MarketplacePluginEntry {
  name: string;
  source: {
    source: string;
    path: string;
  };
  policy?: {
    installation?: string;
    authentication?: string;
  };
  category?: string;
}

interface MarketplaceJson {
  name?: string;
  plugins?: MarketplacePluginEntry[];
}

export function exportPlugin(codexPaths: CodexPaths): OperationResult {
  let marketplace: MarketplaceJson;
  try {
    marketplace = readMarketplace(codexPaths.userPluginsMarketplaceJson);
  } catch {
    return invalidMarketplaceOperationResult(
      OperationKind.ExportPlugin,
      "export plugin: blocked by invalid marketplace JSON",
      codexPaths
    );
  }

  const sourceDir = sourcePluginDir();
  mkdirSync(codexPaths.codexPluginsDir, { recursive: true });
  rmSync(codexPaths.sanePluginDir, { recursive: true, force: true });
  cpSync(sourceDir, codexPaths.sanePluginDir, { recursive: true, force: true });

  marketplace.name = marketplace.name ?? "sane-local";
  const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  marketplace.plugins = upsertMarketplacePlugin(plugins, {
    name: SANE_PLUGIN_NAME,
    source: { source: "local", path: codexPaths.sanePluginDir },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Productivity"
  });
  writeMarketplace(codexPaths.userPluginsMarketplaceJson, marketplace);

  return new OperationResult({
    kind: OperationKind.ExportPlugin,
    summary: "export plugin: installed Sane Codex plugin artifact",
    details: [
      `plugin: ${codexPaths.sanePluginDir}`,
      `marketplace: ${codexPaths.userPluginsMarketplaceJson}`,
      "managed surfaces remain TUI-managed by default; plugin install is optional distribution"
    ],
    pathsTouched: [codexPaths.sanePluginDir, codexPaths.userPluginsMarketplaceJson],
    inventory: [inspectPluginInventory(codexPaths)]
  });
}

export function uninstallPlugin(codexPaths: CodexPaths): OperationResult {
  const hadPlugin = existsSync(codexPaths.sanePluginDir);
  let marketplace: MarketplaceJson;
  try {
    marketplace = readMarketplace(codexPaths.userPluginsMarketplaceJson);
  } catch {
    return invalidMarketplaceOperationResult(
      OperationKind.UninstallPlugin,
      "uninstall plugin: blocked by invalid marketplace JSON",
      codexPaths
    );
  }
  const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const nextPlugins = plugins.filter((entry) => entry.name !== SANE_PLUGIN_NAME);
  const hadMarketplaceEntry = nextPlugins.length !== plugins.length;

  if (!hadPlugin && !hadMarketplaceEntry) {
    return new OperationResult({
      kind: OperationKind.UninstallPlugin,
      summary: "uninstall plugin: not installed",
      details: [],
      pathsTouched: [codexPaths.sanePluginDir, codexPaths.userPluginsMarketplaceJson],
      inventory: [inspectPluginInventory(codexPaths)]
    });
  }

  rmSync(codexPaths.sanePluginDir, { recursive: true, force: true });
  if (hadMarketplaceEntry) {
    marketplace.plugins = nextPlugins;
    if (nextPlugins.length === 0) {
      delete marketplace.plugins;
    }
    if (Object.keys(marketplace).length === 0 || (marketplace.name === "sane-local" && !marketplace.plugins)) {
      rmSync(codexPaths.userPluginsMarketplaceJson, { force: true });
      removeEmptyDir(codexPaths.userPluginsDir);
    } else {
      writeMarketplace(codexPaths.userPluginsMarketplaceJson, marketplace);
    }
  }
  removeEmptyDir(codexPaths.codexPluginsDir);

  return new OperationResult({
    kind: OperationKind.UninstallPlugin,
    summary: "uninstall plugin: removed Sane Codex plugin artifact",
    details: [],
    pathsTouched: [codexPaths.sanePluginDir, codexPaths.userPluginsMarketplaceJson],
    inventory: [
      {
        name: "plugin",
        scope: InventoryScope.CodexNative,
        status: InventoryStatus.Removed,
        path: codexPaths.sanePluginDir,
        repairHint: null
      }
    ]
  });
}

export function inspectPluginInventory(codexPaths: CodexPaths) {
  const pluginManifestPath = resolve(codexPaths.sanePluginDir, ".codex-plugin", "plugin.json");
  const pluginInstalled = existsSync(pluginManifestPath);

  let marketplace: MarketplaceJson;
  try {
    marketplace = readMarketplace(codexPaths.userPluginsMarketplaceJson);
  } catch {
    return {
      name: "plugin",
      scope: InventoryScope.CodexNative,
      status: InventoryStatus.Invalid,
      path: codexPaths.sanePluginDir,
      repairHint: "repair ~/.agents/plugins/marketplace.json or rerun `export plugin`"
    };
  }

  const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const marketplaceEntry = plugins.find((entry) => entry.name === SANE_PLUGIN_NAME);
  const marketplaceInstalled = marketplaceEntry?.source?.source === "local"
    && marketplaceEntry.source.path === codexPaths.sanePluginDir;

  if (!pluginInstalled && !marketplaceInstalled) {
    return {
      name: "plugin",
      scope: InventoryScope.CodexNative,
      status: InventoryStatus.Missing,
      path: codexPaths.sanePluginDir,
      repairHint: "run `export plugin`"
    };
  }

  if (!pluginInstalled || !marketplaceInstalled || !pluginManifestLooksManaged(pluginManifestPath)) {
    return {
      name: "plugin",
      scope: InventoryScope.CodexNative,
      status: InventoryStatus.Invalid,
      path: codexPaths.sanePluginDir,
      repairHint: "rerun `export plugin`"
    };
  }

  return {
    name: "plugin",
    scope: InventoryScope.CodexNative,
    status: InventoryStatus.Installed,
    path: codexPaths.sanePluginDir,
    repairHint: null
  };
}

function sourcePluginDir(): string {
  const entryDir = process.argv[1] ? dirname(resolve(process.argv[1])) : process.cwd();
  const candidates = [
    resolve(process.cwd(), "plugins", "sane"),
    resolve(process.cwd(), "..", "..", "plugins", "sane"),
    resolve(entryDir, "..", "..", "..", "plugins", "sane"),
    resolve(entryDir, "..", "..", "..", "..", "plugins", "sane"),
    resolve(entryDir, "..", "..", "..", "..", "..", "plugins", "sane")
  ];
  const found = candidates.find((candidate) => existsSync(resolve(candidate, ".codex-plugin", "plugin.json")));
  if (!found) {
    throw new Error("failed to locate Sane plugin source directory");
  }
  return found;
}

function readMarketplace(path: string): MarketplaceJson {
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(readFileSync(path, "utf8")) as MarketplaceJson;
}

function writeMarketplace(path: string, value: MarketplaceJson): void {
  mkdirSync(dirname(path), { recursive: true });
  writeAtomicTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function upsertMarketplacePlugin(
  plugins: MarketplacePluginEntry[],
  plugin: MarketplacePluginEntry
): MarketplacePluginEntry[] {
  const next = plugins.filter((entry) => entry.name !== plugin.name);
  next.push(plugin);
  return next;
}

function pluginManifestLooksManaged(path: string): boolean {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { name?: string; interface?: { displayName?: string } };
    return parsed.name === SANE_PLUGIN_NAME && parsed.interface?.displayName === SANE_PLUGIN_DISPLAY_NAME;
  } catch {
    return false;
  }
}

function removeEmptyDir(path: string): void {
  try {
    if (existsSync(path) && readdirSync(path).length === 0) {
      rmSync(path, { recursive: true, force: true });
    }
  } catch {
    // Best-effort cleanup only.
  }
}

function invalidMarketplaceOperationResult(
  kind: OperationKind,
  summary: string,
  codexPaths: CodexPaths
): OperationResult {
  return new OperationResult({
    kind,
    summary,
    details: ["repair ~/.agents/plugins/marketplace.json before retrying"],
    pathsTouched: [codexPaths.userPluginsMarketplaceJson],
    inventory: [
      {
        name: "plugin",
        scope: InventoryScope.CodexNative,
        status: InventoryStatus.Invalid,
        path: codexPaths.sanePluginDir,
        repairHint: "repair ~/.agents/plugins/marketplace.json or rerun `export plugin`"
      }
    ]
  });
}
