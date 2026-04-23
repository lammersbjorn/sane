import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  createRecommendedLocalConfig,
  createRecommendedModelRoutingPresets,
  detectCodexEnvironment
} from "@sane/config";
import { InventoryScope, InventoryStatus, OperationKind, OperationResult } from "@sane/core";
import {
  SANE_AGENT_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  createSaneAgentTemplateWithPacks,
  createSaneExplorerAgentTemplateWithPacks,
  createSaneReviewerAgentTemplateWithPacks,
  type GuidancePacks,
  type ModelRoutingGuidance
} from "@sane/framework-assets";
import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/platform";

import {
  MANAGED_SESSION_START_STATUS_MESSAGE,
  buildManagedSessionStartHookCommand,
  isManagedSessionStartHookCommand
} from "./session-start-hook.js";
import { recommendedLocalConfigFromEnvironment } from "./local-config.js";

export function exportCustomAgents(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  mkdirSync(codexPaths.customAgentsDir, { recursive: true });

  const agentPath = join(codexPaths.customAgentsDir, `${SANE_AGENT_NAME}.toml`);
  const reviewerPath = join(codexPaths.customAgentsDir, `${SANE_REVIEWER_AGENT_NAME}.toml`);
  const explorerPath = join(codexPaths.customAgentsDir, `${SANE_EXPLORER_AGENT_NAME}.toml`);

  writeFileSync(agentPath, createSaneAgentTemplateWithPacks(roles, packs), "utf8");
  writeFileSync(reviewerPath, createSaneReviewerAgentTemplateWithPacks(roles, packs), "utf8");
  writeFileSync(explorerPath, createSaneExplorerAgentTemplateWithPacks(roles, packs), "utf8");

  return new OperationResult({
    kind: OperationKind.ExportCustomAgents,
    summary: "export custom-agents: installed sane-agent, sane-reviewer, and sane-explorer",
    details: [
      `path: ${agentPath}`,
      `path: ${reviewerPath}`,
      `path: ${explorerPath}`,
      "editable role defaults: coordinator->sane-agent, verifier->sane-reviewer, sidecar->sane-explorer",
      `derived routing classes: execution=${roles.executionModel} (${roles.executionReasoning}), realtime=${roles.realtimeModel} (${roles.realtimeReasoning}); not encoded in single-model custom-agent toml`
    ],
    pathsTouched: [agentPath, reviewerPath, explorerPath],
    inventory: [inspectCustomAgentsInventory(paths, codexPaths)]
  });
}

export function uninstallCustomAgents(codexPaths: CodexPaths): OperationResult {
  const agentPath = join(codexPaths.customAgentsDir, `${SANE_AGENT_NAME}.toml`);
  const reviewerPath = join(codexPaths.customAgentsDir, `${SANE_REVIEWER_AGENT_NAME}.toml`);
  const explorerPath = join(codexPaths.customAgentsDir, `${SANE_EXPLORER_AGENT_NAME}.toml`);
  const managedPaths = [agentPath, reviewerPath, explorerPath];
  const hadAny = managedPaths.some(fileExists);

  if (!hadAny) {
    return new OperationResult({
      kind: OperationKind.UninstallCustomAgents,
      summary: "uninstall custom-agents: not installed",
      details: [],
      pathsTouched: [codexPaths.customAgentsDir],
      inventory: [
        {
          name: "custom-agents",
          scope: InventoryScope.CodexNative,
          status: InventoryStatus.Missing,
          path: codexPaths.customAgentsDir,
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

  if (fileExists(codexPaths.customAgentsDir) && readdirSync(codexPaths.customAgentsDir).length === 0) {
    rmSync(codexPaths.customAgentsDir, { recursive: true, force: true });
  }

  return new OperationResult({
    kind: OperationKind.UninstallCustomAgents,
    summary: "uninstall custom-agents: removed sane-agent, sane-reviewer, and sane-explorer",
    details: [],
    pathsTouched: managedPaths,
    inventory: [
      {
        name: "custom-agents",
        scope: InventoryScope.CodexNative,
        status: InventoryStatus.Removed,
        path: codexPaths.customAgentsDir,
        repairHint: null
      }
    ]
  });
}

export function inspectCustomAgentsInventory(paths: ProjectPaths, codexPaths: CodexPaths) {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const expected = [
    [join(codexPaths.customAgentsDir, `${SANE_AGENT_NAME}.toml`), createSaneAgentTemplateWithPacks(roles, packs)],
    [
      join(codexPaths.customAgentsDir, `${SANE_REVIEWER_AGENT_NAME}.toml`),
      createSaneReviewerAgentTemplateWithPacks(roles, packs)
    ],
    [
      join(codexPaths.customAgentsDir, `${SANE_EXPLORER_AGENT_NAME}.toml`),
      createSaneExplorerAgentTemplateWithPacks(roles, packs)
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
    name: "custom-agents",
    scope: InventoryScope.CodexNative,
    status,
    path: codexPaths.customAgentsDir,
    repairHint:
      status === InventoryStatus.Installed
        ? null
        : status === InventoryStatus.Missing
          ? "run `export custom-agents`"
          : "rerun `export custom-agents`"
  };
}

export function exportHooks(
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform = detectPlatform()
): OperationResult {
  if (hostPlatform === "windows") {
    return new OperationResult({
      kind: OperationKind.ExportHooks,
      summary: "export hooks: unavailable on native Windows",
      details: ["Use WSL for hook-enabled Codex flows."],
      pathsTouched: [],
      inventory: [inspectHooksInventory(codexPaths, hostPlatform)]
    });
  }

  mkdirSync(join(codexPaths.homeDir, ".codex"), { recursive: true });
  const root = readHooksJson(codexPaths.hooksJson);
  const hooksRoot = ensureObjectProperty(root, "hooks");
  const sessionStart = ensureArrayProperty(hooksRoot, "SessionStart");

  if (!sessionStart.some(containsManagedSessionStartHook)) {
    sessionStart.push({
      matcher: "startup|resume",
      hooks: [
        {
          type: "command",
          command: buildManagedSessionStartHookCommand(),
          statusMessage: MANAGED_SESSION_START_STATUS_MESSAGE
        }
      ]
    });
  }

  writeHooksJson(codexPaths.hooksJson, root);

  return new OperationResult({
    kind: OperationKind.ExportHooks,
    summary: "export hooks: installed managed SessionStart hook",
    details: [`path: ${codexPaths.hooksJson}`],
    pathsTouched: [codexPaths.hooksJson],
    inventory: [inspectHooksInventory(codexPaths)]
  });
}

export function uninstallHooks(codexPaths: CodexPaths): OperationResult {
  if (!fileExists(codexPaths.hooksJson)) {
    return new OperationResult({
      kind: OperationKind.UninstallHooks,
      summary: "uninstall hooks: not installed",
      details: [],
      pathsTouched: [codexPaths.hooksJson],
      inventory: [inspectHooksInventory(codexPaths)]
    });
  }

  const root = readHooksJson(codexPaths.hooksJson);
  const hooks = asObject(root.hooks);
  const sessionStart = Array.isArray(hooks?.SessionStart) ? hooks.SessionStart : null;
  const before = sessionStart?.length ?? 0;

  if (sessionStart) {
    hooks!.SessionStart = sessionStart.filter((entry) => !containsManagedSessionStartHook(entry));
    if (hooks!.SessionStart.length === 0) {
      delete hooks!.SessionStart;
    }
    if (Object.keys(hooks!).length === 0) {
      delete root.hooks;
    }
  }

  if ((sessionStart?.length ?? 0) === before && before === 0) {
    return new OperationResult({
      kind: OperationKind.UninstallHooks,
      summary: "uninstall hooks: not installed",
      details: [],
      pathsTouched: [codexPaths.hooksJson],
      inventory: [inspectHooksInventory(codexPaths)]
    });
  }

  if (Object.keys(root).length === 0) {
    rmSync(codexPaths.hooksJson, { force: true });
  } else {
    writeHooksJson(codexPaths.hooksJson, root);
  }

  return new OperationResult({
    kind: OperationKind.UninstallHooks,
    summary: "uninstall hooks: removed managed SessionStart hook",
    details: [],
    pathsTouched: [codexPaths.hooksJson],
    inventory: [
      {
        name: "hooks",
        scope: InventoryScope.CodexNative,
        status: InventoryStatus.Removed,
        path: codexPaths.hooksJson,
        repairHint: null
      }
    ]
  });
}

export function inspectHooksInventory(
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform = detectPlatform()
) {
  if (hostPlatform === "windows") {
    return {
      name: "hooks",
      scope: InventoryScope.CodexNative,
      status: InventoryStatus.Invalid,
      path: codexPaths.hooksJson,
      repairHint: "Codex hooks are unavailable on native Windows. Use WSL for hook-enabled flows."
    };
  }

  if (!fileExists(codexPaths.hooksJson)) {
    return {
      name: "hooks",
      scope: InventoryScope.CodexNative,
      status: InventoryStatus.Missing,
      path: codexPaths.hooksJson,
      repairHint: "run `export hooks`"
    };
  }

  let root: Record<string, unknown>;
  try {
    root = readHooksJson(codexPaths.hooksJson);
  } catch {
    return {
      name: "hooks",
      scope: InventoryScope.CodexNative,
      status: InventoryStatus.Invalid,
      path: codexPaths.hooksJson,
      repairHint: "repair ~/.codex/hooks.json or remove conflicting JSON"
    };
  }

  const installed = Array.isArray(asObject(root.hooks)?.SessionStart)
    && asObject(root.hooks)!.SessionStart.some((hook: unknown) => containsManagedSessionStartHook(hook));

  return {
    name: "hooks",
    scope: InventoryScope.CodexNative,
    status: installed ? InventoryStatus.Installed : InventoryStatus.Missing,
    path: codexPaths.hooksJson,
    repairHint: installed ? null : "run `export hooks`"
  };
}

function activeGuidance(paths: ProjectPaths, codexPaths: CodexPaths): {
  packs: GuidancePacks;
  roles: ModelRoutingGuidance;
} {
  const environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
  const config = loadOrDefaultConfig(paths, environment);
  const routing = createRecommendedModelRoutingPresets(environment);

  // Custom-agent TOML files are single-model; execution/realtime classes stay in router guidance.
  return {
    packs: {
      caveman: config.packs.caveman,
      rtk: config.packs.rtk,
      frontendCraft: config.packs.frontendCraft
    },
    roles: {
      coordinatorModel: config.models.coordinator.model,
      coordinatorReasoning: config.models.coordinator.reasoningEffort,
      executionModel: routing.execution.model,
      executionReasoning: routing.execution.reasoningEffort,
      sidecarModel: config.models.sidecar.model,
      sidecarReasoning: config.models.sidecar.reasoningEffort,
      verifierModel: config.models.verifier.model,
      verifierReasoning: config.models.verifier.reasoningEffort,
      realtimeModel: routing.realtime.model,
      realtimeReasoning: routing.realtime.reasoningEffort
    }
  };
}

function loadOrDefaultConfig(
  paths: ProjectPaths,
  environment: ReturnType<typeof detectCodexEnvironment>
) {
  return recommendedLocalConfigFromEnvironment(
    paths,
    createRecommendedLocalConfig(environment)
  );
}

function readHooksJson(path: string): Record<string, any> {
  if (!fileExists(path)) {
    return {};
  }

  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

function writeHooksJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureObjectProperty(root: Record<string, any>, key: string): Record<string, any> {
  if (!asObject(root[key])) {
    root[key] = {};
  }
  return root[key];
}

function ensureArrayProperty(root: Record<string, any>, key: string): any[] {
  if (!Array.isArray(root[key])) {
    root[key] = [];
  }
  return root[key];
}

function containsManagedSessionStartHook(entry: unknown): boolean {
  const hooks = Array.isArray(asObject(entry)?.hooks) ? asObject(entry)!.hooks : [];
  return hooks.some((hook: unknown) => {
    const command = asObject(hook)?.command;
    return typeof command === "string" && isManagedSessionStartHookCommand(command);
  });
}

function fileExists(path: string): boolean {
  return existsSync(path);
}

function asObject(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}
