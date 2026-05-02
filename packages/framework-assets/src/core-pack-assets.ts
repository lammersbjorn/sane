import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { type CorePackManifest, parseCorePackManifest } from "./core-pack-manifest.js";

function candidateRepoRootStarts(): string[] {
  const starts = new Set<string>();

  if (process.argv[1]) {
    starts.add(dirname(resolve(process.argv[1])));
  }

  try {
    starts.add(dirname(fileURLToPath(import.meta.url)));
  } catch {
    if (typeof __dirname === "string") {
      starts.add(__dirname);
    }
  }

  return [...starts];
}

function discoverRepoRoot(startDirs: string[]): string {
  for (const startDir of startDirs) {
    let current = startDir;

    while (true) {
      if (existsSync(resolve(current, "packs/core/manifest.json"))) {
        return current;
      }

      const parent = resolve(current, "..");
      if (parent === current) {
        break;
      }

      current = parent;
    }
  }

  throw new Error(`unable to locate repo root from ${startDirs.join(", ")}`);
}

const REPO_ROOT = discoverRepoRoot(candidateRepoRootStarts());
const CORE_PACK_ROOT = resolve(REPO_ROOT, "packs/core");

export function readCoreAsset(path: string): string {
  return readFileSync(resolve(CORE_PACK_ROOT, path), "utf8");
}

export function loadCorePackManifest(): CorePackManifest {
  return parseCorePackManifest(readCoreAsset("manifest.json"));
}
