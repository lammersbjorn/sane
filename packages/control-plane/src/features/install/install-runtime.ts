import { writeFileSync } from "node:fs";

import {
  createRecommendedLocalConfig,
  detectCodexEnvironment,
  stringifyLocalConfig,
  type LocalConfig
} from "@sane/config";
import {
  OperationKind,
  OperationResult,
  type OperationRewriteMetadata
} from "@sane/control-plane/core.js";
import {
  type CanonicalRewriteResult,
  writeCanonicalWithBackupResult
} from "@sane/state";

import { inspectLocalConfigFamily } from "../config/local-config.js";
import {
  ensureRuntimeHandoffBaseline,
  runtimeHistoryPaths,
  runtimeStatePaths
} from "../runtime-state/runtime-state.js";
import {
  type CodexPaths,
  ensureRuntimeDirs,
  type ProjectPaths
} from "../../platform.js";

interface InstallCanonicalRewrite {
  name: "config" | "current-run" | "summary";
  metadata: OperationRewriteMetadata;
}

export function installRuntime(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  ensureRuntimeDirs(paths);
  const runtimeBaseline = ensureRuntimeHandoffBaseline(paths);
  const canonicalRewrites = ensureInstallRuntimeBaseline(paths, codexPaths, runtimeBaseline);

  const details: string[] = [];
  for (const rewrite of canonicalRewrites) {
    appendNamedRewriteDetails(details, rewrite.name, rewrite.metadata);
  }
  details.push(`config: ${paths.configPath}`);
  details.push(`current-run: ${paths.currentRunPath}`);
  details.push(`summary: ${paths.summaryPath}`);
  details.push(`brief: ${paths.briefPath}`);
  details.push(`brief write mode: ${runtimeBaseline.briefWriteMode}`);

  const pathsTouched = installPathsTouched(paths);
  for (const rewrite of canonicalRewrites) {
    pathsTouched.push(rewrite.metadata.rewrittenPath);
    if (rewrite.metadata.backupPath) {
      pathsTouched.push(rewrite.metadata.backupPath);
    }
  }
  pathsTouched.sort();

  return new OperationResult({
    kind: OperationKind.InstallRuntime,
    summary: `installed runtime at ${paths.runtimeRoot}`,
    rewrite: canonicalRewrites[0]?.metadata ?? null,
    details,
    pathsTouched: unique(pathsTouched),
    inventory: []
  });
}

function ensureInstallRuntimeBaseline(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  runtimeBaseline: ReturnType<typeof ensureRuntimeHandoffBaseline>
): InstallCanonicalRewrite[] {
  const rewrites: InstallCanonicalRewrite[] = [];
  const configRewrite = ensureInstallConfig(paths, codexPaths);
  if (configRewrite) {
    rewrites.push({ name: "config", metadata: configRewrite });
  }

  if (runtimeBaseline.currentRewrite) {
    rewrites.push({
      name: "current-run",
      metadata: operationRewriteMetadata(runtimeBaseline.currentRewrite)
    });
  }

  if (runtimeBaseline.summaryRewrite) {
    rewrites.push({
      name: "summary",
      metadata: operationRewriteMetadata(runtimeBaseline.summaryRewrite)
    });
  }

  for (const path of runtimeHistoryPaths(paths)) {
    ensureFileWithDefault(path, "");
  }

  return rewrites;
}

function ensureInstallConfig(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): OperationRewriteMetadata | null {
  const localConfig = inspectLocalConfigFamily(paths, recommendedLocalConfig(codexPaths));
  if (localConfig.source === "local") {
    return null;
  }

  return operationRewriteMetadata(
    writeCanonicalWithBackupResult(paths.configPath, localConfig.recommended, {
      format: "toml",
      stringify: stringifyLocalConfig
    })
  );
}

function recommendedLocalConfig(codexPaths: CodexPaths): LocalConfig {
  return createRecommendedLocalConfig(
    detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson)
  );
}

function ensureFileWithDefault(path: string, defaultContents: string): void {
  try {
    writeFileSync(path, defaultContents, {
      encoding: "utf8",
      flag: "wx"
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

function installPathsTouched(paths: ProjectPaths): string[] {
  return [paths.configPath, ...runtimeStatePaths(paths)];
}

function appendNamedRewriteDetails(
  details: string[],
  name: string,
  metadata: OperationRewriteMetadata
): void {
  details.push(`${name} rewritten path: ${metadata.rewrittenPath}`);
  if (metadata.backupPath) {
    details.push(`${name} backup path: ${metadata.backupPath}`);
  }
  details.push(`${name} write mode: ${metadata.firstWrite ? "first write" : "rewrite"}`);
}

function operationRewriteMetadata(metadata: CanonicalRewriteResult): OperationRewriteMetadata {
  return {
    rewrittenPath: metadata.rewrittenPath,
    backupPath: metadata.backupPath,
    firstWrite: metadata.firstWrite
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
