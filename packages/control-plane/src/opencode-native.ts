import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  createRecommendedLocalConfig,
  detectCodexEnvironment,
  readLocalConfig
} from "@sane/config";
import {
  InventoryScope,
  InventoryStatus,
  OperationKind,
  OperationResult
} from "@sane/core";
import {
  SANE_AGENT_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  createSaneOpencodeAgentTemplate,
  createSaneOpencodeExplorerAgentTemplate,
  createSaneOpencodeReviewerAgentTemplate,
  type ModelRoleGuidance
} from "@sane/framework-assets";
import { type CodexPaths, type ProjectPaths } from "@sane/platform";

export function exportOpencodeAgents(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const roles = activeModelRoutingGuidance(paths, codexPaths);
  mkdirSync(codexPaths.opencodeGlobalAgentsDir, { recursive: true });

  const agentPath = join(codexPaths.opencodeGlobalAgentsDir, `${SANE_AGENT_NAME}.md`);
  const reviewerPath = join(codexPaths.opencodeGlobalAgentsDir, `${SANE_REVIEWER_AGENT_NAME}.md`);
  const explorerPath = join(codexPaths.opencodeGlobalAgentsDir, `${SANE_EXPLORER_AGENT_NAME}.md`);

  writeFileSync(agentPath, createSaneOpencodeAgentTemplate(roles), "utf8");
  writeFileSync(reviewerPath, createSaneOpencodeReviewerAgentTemplate(roles), "utf8");
  writeFileSync(explorerPath, createSaneOpencodeExplorerAgentTemplate(roles), "utf8");

  return new OperationResult({
    kind: OperationKind.ExportOpencodeAgents,
    summary: "export opencode-agents: installed sane-agent, sane-reviewer, and sane-explorer",
    details: [
      `path: ${agentPath}`,
      `path: ${reviewerPath}`,
      `path: ${explorerPath}`,
      "optional compatibility surface only; not part of Sane's default Codex install bundle"
    ],
    pathsTouched: [agentPath, reviewerPath, explorerPath],
    inventory: [inspectOpencodeAgentsInventory(paths, codexPaths)]
  });
}

export function uninstallOpencodeAgents(codexPaths: CodexPaths): OperationResult {
  const agentPath = join(codexPaths.opencodeGlobalAgentsDir, `${SANE_AGENT_NAME}.md`);
  const reviewerPath = join(codexPaths.opencodeGlobalAgentsDir, `${SANE_REVIEWER_AGENT_NAME}.md`);
  const explorerPath = join(codexPaths.opencodeGlobalAgentsDir, `${SANE_EXPLORER_AGENT_NAME}.md`);
  const managedPaths = [agentPath, reviewerPath, explorerPath];
  const hadAny = managedPaths.some(fileExists);

  if (!hadAny) {
    return new OperationResult({
      kind: OperationKind.UninstallOpencodeAgents,
      summary: "uninstall opencode-agents: not installed",
      details: [],
      pathsTouched: [codexPaths.opencodeGlobalAgentsDir],
      inventory: [
        {
          name: "opencode-agents",
          scope: InventoryScope.Compatibility,
          status: InventoryStatus.Missing,
          path: codexPaths.opencodeGlobalAgentsDir,
          repairHint: null
        }
      ]
    });
  }

  for (const path of managedPaths) {
    if (fileExists(path)) {
      rmSync(path, { force: true });
    }
  }

  if (fileExists(codexPaths.opencodeGlobalAgentsDir) && readdirSync(codexPaths.opencodeGlobalAgentsDir).length === 0) {
    rmSync(codexPaths.opencodeGlobalAgentsDir, { recursive: true, force: true });
  }

  return new OperationResult({
    kind: OperationKind.UninstallOpencodeAgents,
    summary: "uninstall opencode-agents: removed sane-agent, sane-reviewer, and sane-explorer",
    details: [],
    pathsTouched: managedPaths,
    inventory: [
      {
        name: "opencode-agents",
        scope: InventoryScope.Compatibility,
        status: InventoryStatus.Removed,
        path: codexPaths.opencodeGlobalAgentsDir,
        repairHint: null
      }
    ]
  });
}

export function inspectOpencodeAgentsInventory(paths: ProjectPaths, codexPaths: CodexPaths) {
  const roles = activeModelRoutingGuidance(paths, codexPaths);
  const expected = [
    [join(codexPaths.opencodeGlobalAgentsDir, `${SANE_AGENT_NAME}.md`), createSaneOpencodeAgentTemplate(roles)],
    [
      join(codexPaths.opencodeGlobalAgentsDir, `${SANE_REVIEWER_AGENT_NAME}.md`),
      createSaneOpencodeReviewerAgentTemplate(roles)
    ],
    [
      join(codexPaths.opencodeGlobalAgentsDir, `${SANE_EXPLORER_AGENT_NAME}.md`),
      createSaneOpencodeExplorerAgentTemplate(roles)
    ]
  ] as const;

  const missingCount = expected.filter(([path]) => !fileExists(path)).length;
  const status =
    missingCount === 3
      ? InventoryStatus.Missing
      : missingCount === 0
        ? expected.every(([path, body]) => readFileSync(path, "utf8") === body)
          ? InventoryStatus.Installed
          : InventoryStatus.Invalid
        : InventoryStatus.Invalid;

  return {
    name: "opencode-agents",
    scope: InventoryScope.Compatibility,
    status,
    path: codexPaths.opencodeGlobalAgentsDir,
    repairHint:
      status === InventoryStatus.Installed
        ? null
        : status === InventoryStatus.Missing
          ? "run `export opencode-agents`"
          : "rerun `export opencode-agents`"
  };
}

function activeModelRoutingGuidance(paths: ProjectPaths, codexPaths: CodexPaths): ModelRoleGuidance {
  const environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
  const config = loadOrDefaultConfig(paths, environment);

  return {
    coordinatorModel: config.models.coordinator.model,
    coordinatorReasoning: config.models.coordinator.reasoningEffort,
    sidecarModel: config.models.sidecar.model,
    sidecarReasoning: config.models.sidecar.reasoningEffort,
    verifierModel: config.models.verifier.model,
    verifierReasoning: config.models.verifier.reasoningEffort
  };
}

function loadOrDefaultConfig(
  paths: ProjectPaths,
  environment: ReturnType<typeof detectCodexEnvironment>
) {
  try {
    return readLocalConfig(paths.configPath);
  } catch {
    return createRecommendedLocalConfig(environment);
  }
}

function fileExists(path: string): boolean {
  return existsSync(path);
}
