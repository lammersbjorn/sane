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

export function loadOrRecommendedLocalConfig(
  paths: ProjectPaths,
  recommended: LocalConfig
): LocalConfig {
  const saved = inspectSavedLocalConfig(paths);
  return saved.kind === "loaded" ? saved.config : recommended;
}

export function loadOrDefaultLocalConfig(paths: ProjectPaths): LocalConfig {
  return loadOrRecommendedLocalConfig(paths, createDefaultLocalConfig());
}

export function recommendedLocalConfigFromEnvironment(
  paths: ProjectPaths,
  recommended: ReturnType<typeof createRecommendedLocalConfig>
): ReturnType<typeof createRecommendedLocalConfig> {
  const saved = inspectSavedLocalConfig(paths);
  return saved.kind === "loaded" ? saved.config : recommended;
}
