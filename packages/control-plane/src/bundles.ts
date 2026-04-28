import { OperationKind, OperationResult } from "@sane/core";
import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/platform";

import {
  exportCoreInstallBundleTargets,
  uninstallCoreInstallBundleTargets
} from "./core-install-bundle-targets.js";
import {
  exportOpencodeCoreBundle,
  uninstallOpencodeCoreBundle
} from "./opencode-native.js";
import { uninstallPlugin } from "./codex-plugin.js";

export function exportAll(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform = detectPlatform()
): OperationResult {
  return mergeResults(
    OperationKind.ExportAll,
    "export all: installed managed targets",
    exportCoreInstallBundleTargets(paths, codexPaths, hostPlatform)
  );
}

export function uninstallAll(codexPaths: CodexPaths): OperationResult {
  return mergeResults(
    OperationKind.UninstallAll,
    "uninstall all: removed Sane's Codex changes",
    [
      ...uninstallCoreInstallBundleTargets(codexPaths),
      uninstallPlugin(codexPaths)
    ]
  );
}

export function exportOpencodeCore(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): OperationResult {
  return mergeResults(
    OperationKind.ExportAll,
    "export opencode: installed managed OpenCode targets",
    exportOpencodeCoreBundle(paths, codexPaths)
  );
}

export function uninstallOpencodeCore(
  _paths: ProjectPaths,
  codexPaths: CodexPaths
): OperationResult {
  return mergeResults(
    OperationKind.UninstallAll,
    "uninstall opencode: removed Sane OpenCode changes",
    uninstallOpencodeCoreBundle(codexPaths)
  );
}

function mergeResults(
  kind: OperationKind,
  summary: string,
  results: OperationResult[]
): OperationResult {
  const details: string[] = [];
  const pathsTouched: string[] = [];
  const inventory: OperationResult["inventory"] = [];

  for (const result of results) {
    details.push(result.summary);
    details.push(...result.details);
    pathsTouched.push(...result.pathsTouched);
    inventory.push(...result.inventory);
  }

  return new OperationResult({
    kind,
    summary,
    details,
    pathsTouched: [...new Set(pathsTouched)].sort(),
    inventory
  });
}
