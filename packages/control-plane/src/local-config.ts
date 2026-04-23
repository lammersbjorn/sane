import {
  createDefaultLocalConfig,
  createRecommendedLocalConfig,
  readLocalConfig,
  type LocalConfig
} from "@sane/config";
import { type ProjectPaths } from "@sane/platform";

import { existsSync } from "node:fs";

export type SavedLocalConfigState =
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "loaded"; config: LocalConfig };

export interface LocalConfigFamilySnapshot {
  source: "local" | "recommended";
  current: LocalConfig;
  recommended: LocalConfig;
  saved: SavedLocalConfigState;
}

export function inspectSavedLocalConfig(paths: ProjectPaths): SavedLocalConfigState {
  if (!existsSync(paths.configPath)) {
    return { kind: "missing" };
  }

  try {
    return { kind: "loaded", config: readLocalConfig(paths.configPath) };
  } catch {
    return { kind: "invalid" };
  }
}

export function inspectLocalConfigFamily(
  paths: ProjectPaths,
  recommended: LocalConfig
): LocalConfigFamilySnapshot {
  const saved = inspectSavedLocalConfig(paths);
  return {
    source: saved.kind === "loaded" ? "local" : "recommended",
    current: saved.kind === "loaded" ? saved.config : recommended,
    recommended,
    saved
  };
}

export function loadOrRecommendedLocalConfig(
  paths: ProjectPaths,
  recommended: LocalConfig
): LocalConfig {
  return inspectLocalConfigFamily(paths, recommended).current;
}

export function loadOrDefaultLocalConfig(paths: ProjectPaths): LocalConfig {
  return loadOrRecommendedLocalConfig(paths, createDefaultLocalConfig());
}

export function recommendedLocalConfigFromEnvironment(
  paths: ProjectPaths,
  recommended: ReturnType<typeof createRecommendedLocalConfig>
): ReturnType<typeof createRecommendedLocalConfig> {
  return inspectLocalConfigFamily(paths, recommended).current;
}
