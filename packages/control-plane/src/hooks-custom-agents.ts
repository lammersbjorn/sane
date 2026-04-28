import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  createRecommendedLocalConfig,
  type LifecycleHooksConfig,
  detectCodexEnvironment
} from "@sane/config";
import { InventoryScope, InventoryStatus, OperationKind, OperationResult } from "@sane/core";
import {
  SANE_AGENT_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_REALTIME_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  createSaneAgentTemplateWithPacks,
  createSaneExplorerAgentTemplateWithPacks,
  createSaneImplementationAgentTemplateWithPacks,
  createSaneRealtimeAgentTemplateWithPacks,
  createSaneReviewerAgentTemplateWithPacks,
  type GuidancePacks,
  type ModelRoutingGuidance
} from "@sane/framework-assets";
import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/platform";
import { writeAtomicTextFile } from "@sane/state";

import {
  MANAGED_SESSION_START_STATUS_MESSAGE,
  MANAGED_SESSION_END_STATUS_MESSAGE,
  buildManagedSessionEndHookCommand,
  buildManagedSessionStartHookCommand,
  isManagedLifecycleHookCommand,
  isManagedSessionEndHookCommand,
  isManagedSessionStartHookCommand,
  SESSION_START_BASE_GUIDANCE
} from "./session-start-hook.js";
import { recommendedLocalConfigFromEnvironment } from "./local-config.js";
import {
  MANAGED_TOKSCALE_STATUS_MESSAGE,
  buildManagedTokscaleSubmitHookCommand,
  isManagedTokscaleSubmitHookCommand
} from "./tokscale-submit-hook.js";

export function exportCustomAgents(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  mkdirSync(codexPaths.customAgentsDir, { recursive: true });

  const agentPath = join(codexPaths.customAgentsDir, `${SANE_AGENT_NAME}.toml`);
  const reviewerPath = join(codexPaths.customAgentsDir, `${SANE_REVIEWER_AGENT_NAME}.toml`);
  const explorerPath = join(codexPaths.customAgentsDir, `${SANE_EXPLORER_AGENT_NAME}.toml`);
  const implementationPath = join(codexPaths.customAgentsDir, `${SANE_IMPLEMENTATION_AGENT_NAME}.toml`);
  const realtimePath = join(codexPaths.customAgentsDir, `${SANE_REALTIME_AGENT_NAME}.toml`);

  writeAtomicTextFile(agentPath, createSaneAgentTemplateWithPacks(roles, packs));
  writeAtomicTextFile(reviewerPath, createSaneReviewerAgentTemplateWithPacks(roles, packs));
  writeAtomicTextFile(explorerPath, createSaneExplorerAgentTemplateWithPacks(roles, packs));
  writeAtomicTextFile(implementationPath, createSaneImplementationAgentTemplateWithPacks(roles, packs));
  writeAtomicTextFile(realtimePath, createSaneRealtimeAgentTemplateWithPacks(roles, packs));

  return new OperationResult({
    kind: OperationKind.ExportCustomAgents,
    summary: "export custom-agents: installed Sane custom agents",
    details: [
      `path: ${agentPath}`,
      `path: ${reviewerPath}`,
      `path: ${explorerPath}`,
      `path: ${implementationPath}`,
      `path: ${realtimePath}`,
      "role defaults: coordinator->sane-agent, verifier->sane-reviewer, explorer->sane-explorer, implementation->sane-implementation, realtime->sane-realtime"
    ],
    pathsTouched: [agentPath, reviewerPath, explorerPath, implementationPath, realtimePath],
    inventory: [inspectCustomAgentsInventory(paths, codexPaths)]
  });
}

export function uninstallCustomAgents(codexPaths: CodexPaths): OperationResult {
  const agentPath = join(codexPaths.customAgentsDir, `${SANE_AGENT_NAME}.toml`);
  const reviewerPath = join(codexPaths.customAgentsDir, `${SANE_REVIEWER_AGENT_NAME}.toml`);
  const explorerPath = join(codexPaths.customAgentsDir, `${SANE_EXPLORER_AGENT_NAME}.toml`);
  const implementationPath = join(codexPaths.customAgentsDir, `${SANE_IMPLEMENTATION_AGENT_NAME}.toml`);
  const realtimePath = join(codexPaths.customAgentsDir, `${SANE_REALTIME_AGENT_NAME}.toml`);
  const managedPaths = [agentPath, reviewerPath, explorerPath, implementationPath, realtimePath];
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
    summary: "uninstall custom-agents: removed Sane custom agents",
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
    ],
    [
      join(codexPaths.customAgentsDir, `${SANE_IMPLEMENTATION_AGENT_NAME}.toml`),
      createSaneImplementationAgentTemplateWithPacks(roles, packs)
    ],
    [
      join(codexPaths.customAgentsDir, `${SANE_REALTIME_AGENT_NAME}.toml`),
      createSaneRealtimeAgentTemplateWithPacks(roles, packs)
    ]
  ] as const;

  const missingCount = expected.filter(([path]) => !fileExists(path)).length;
  const status =
    missingCount === expected.length
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
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform = detectPlatform()
): OperationResult {
  if (hostPlatform === "windows") {
    return new OperationResult({
      kind: OperationKind.ExportHooks,
      summary: "export hooks: unavailable on native Windows",
      details: ["Use WSL for hook-enabled Codex flows."],
      pathsTouched: [],
      inventory: [inspectHooksInventory(paths, codexPaths, hostPlatform)]
    });
  }

  const lifecycleHooks = loadLifecycleHooks(paths, codexPaths);
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const sessionStartCommand = buildManagedSessionStartHookCommand(undefined, {
    additionalContext: managedSessionStartContext(packs, roles)
  });
  mkdirSync(join(codexPaths.homeDir, ".codex"), { recursive: true });
  let root: Record<string, any>;
  try {
    root = readHooksJson(codexPaths.hooksJson);
  } catch {
    return new OperationResult({
      kind: OperationKind.ExportHooks,
      summary: "export hooks: blocked by invalid hooks JSON",
      details: ["repair ~/.codex/hooks.json before rerunning `export hooks`"],
      pathsTouched: [codexPaths.hooksJson],
      inventory: [
        {
          name: "hooks",
          scope: InventoryScope.CodexNative,
          status: InventoryStatus.Invalid,
          path: codexPaths.hooksJson,
          repairHint: "repair ~/.codex/hooks.json before rerunning `export hooks`"
        }
      ]
    });
  }
  const shapeError = validateHooksShapeForManagedUpdate(root);
  if (shapeError) {
    return new OperationResult({
      kind: OperationKind.ExportHooks,
      summary: "export hooks: blocked by unexpected hooks.json shape",
      details: [shapeError],
      pathsTouched: [codexPaths.hooksJson],
      inventory: [
        {
          name: "hooks",
          scope: InventoryScope.CodexNative,
          status: InventoryStatus.Invalid,
          path: codexPaths.hooksJson,
          repairHint: "repair ~/.codex/hooks.json shape before rerunning `export hooks`"
        }
      ]
    });
  }
  const hooksRoot = ensureObjectProperty(root, "hooks");
  const sessionStart = ensureArrayProperty(hooksRoot, "SessionStart");

  upsertHookEntry(sessionStart, containsManagedSessionStartHook, {
    matcher: "startup|resume",
    hooks: [
      {
        type: "command",
        command: sessionStartCommand,
        statusMessage: MANAGED_SESSION_START_STATUS_MESSAGE
      }
    ]
  });

  if (lifecycleHooks.rateLimitResume || lifecycleHooks.tokscaleSubmit) {
    const sessionEnd = ensureArrayProperty(hooksRoot, "SessionEnd");
    if (lifecycleHooks.rateLimitResume) {
      upsertHookEntry(sessionEnd, containsManagedSessionEndHook, {
        hooks: [
          {
            type: "command",
            command: buildManagedSessionEndHookCommand(undefined, { rateLimitResume: true }),
            statusMessage: MANAGED_SESSION_END_STATUS_MESSAGE
          }
        ]
      });
    }
    if (lifecycleHooks.tokscaleSubmit) {
      pushHookEntry(sessionEnd, {
        hooks: [
          {
            type: "command",
            command: buildManagedTokscaleSubmitHookCommand("session-end", {
              dryRun: lifecycleHooks.tokscaleDryRun
            }),
            statusMessage: MANAGED_TOKSCALE_STATUS_MESSAGE,
            timeout: 25
          }
        ]
      });
    }
  }

  writeHooksJson(codexPaths.hooksJson, root);

  return new OperationResult({
    kind: OperationKind.ExportHooks,
    summary: lifecycleHooks.tokscaleSubmit || lifecycleHooks.rateLimitResume
      ? "export hooks: installed managed lifecycle hooks"
      : "export hooks: installed managed SessionStart hook",
    details: [`path: ${codexPaths.hooksJson}`],
    pathsTouched: [codexPaths.hooksJson],
    inventory: [inspectHooksInventory(paths, codexPaths)]
  });
}

export function uninstallHooks(codexPaths: CodexPaths): OperationResult {
  if (!fileExists(codexPaths.hooksJson)) {
    return new OperationResult({
      kind: OperationKind.UninstallHooks,
      summary: "uninstall hooks: not installed",
      details: [],
      pathsTouched: [codexPaths.hooksJson],
      inventory: []
    });
  }

  let root: Record<string, any>;
  try {
    root = readHooksJson(codexPaths.hooksJson);
  } catch {
    return new OperationResult({
      kind: OperationKind.UninstallHooks,
      summary: "uninstall hooks: blocked by invalid hooks JSON",
      details: ["repair ~/.codex/hooks.json before rerunning `uninstall hooks`"],
      pathsTouched: [codexPaths.hooksJson],
      inventory: [
        {
          name: "hooks",
          scope: InventoryScope.CodexNative,
          status: InventoryStatus.Invalid,
          path: codexPaths.hooksJson,
          repairHint: "repair ~/.codex/hooks.json before rerunning `uninstall hooks`"
        }
      ]
    });
  }
  const hooks = asObject(root.hooks);
  const sessionStart = Array.isArray(hooks?.SessionStart) ? hooks.SessionStart : null;
  const sessionEnd = Array.isArray(hooks?.SessionEnd) ? hooks.SessionEnd : null;
  const before = (sessionStart?.length ?? 0) + (sessionEnd?.length ?? 0);

  if (sessionStart) {
    hooks!.SessionStart = sessionStart.filter((entry) => !containsManagedLifecycleHook(entry));
    if (hooks!.SessionStart.length === 0) {
      delete hooks!.SessionStart;
    }
  }
  if (sessionEnd) {
    hooks!.SessionEnd = sessionEnd.filter((entry) => !containsManagedLifecycleHook(entry));
    if (hooks!.SessionEnd.length === 0) {
      delete hooks!.SessionEnd;
    }
  }
  if (hooks && Object.keys(hooks).length === 0) {
    delete root.hooks;
  }

  const after =
    (Array.isArray(hooks?.SessionStart) ? hooks.SessionStart.length : 0)
    + (Array.isArray(hooks?.SessionEnd) ? hooks.SessionEnd.length : 0);
  if (before === after) {
    return new OperationResult({
      kind: OperationKind.UninstallHooks,
      summary: "uninstall hooks: not installed",
      details: [],
      pathsTouched: [codexPaths.hooksJson],
      inventory: []
    });
  }

  if (Object.keys(root).length === 0) {
    rmSync(codexPaths.hooksJson, { force: true });
  } else {
    writeHooksJson(codexPaths.hooksJson, root);
  }

  return new OperationResult({
    kind: OperationKind.UninstallHooks,
    summary: "uninstall hooks: removed managed lifecycle hooks",
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
  paths: ProjectPaths,
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

  const lifecycleHooks = loadLifecycleHooks(paths, codexPaths);
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
  const shapeError = validateHooksShapeForManagedUpdate(root);
  if (shapeError) {
    return {
      name: "hooks",
      scope: InventoryScope.CodexNative,
      status: InventoryStatus.Invalid,
      path: codexPaths.hooksJson,
      repairHint: shapeError
    };
  }

  const hooks = asObject(root.hooks);
  const sessionStart = Array.isArray(hooks?.SessionStart) ? hooks.SessionStart : [];
  const sessionEnd = Array.isArray(hooks?.SessionEnd) ? hooks.SessionEnd : [];
  const hasAnyManagedSessionStart = sessionStart.some((hook: unknown) => containsManagedSessionStartHook(hook));
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const hasSessionStart = sessionStart.some((hook: unknown) =>
    containsExpectedHookCommand(hook, buildManagedSessionStartHookCommand(undefined, {
      additionalContext: managedSessionStartContext(packs, roles)
    }))
  );
  const hasRateLimitSessionEnd =
    !lifecycleHooks.rateLimitResume
    || sessionEnd.some((hook: unknown) =>
      containsExpectedHookCommand(hook, buildManagedSessionEndHookCommand(undefined, { rateLimitResume: true }))
    );
  const hasTokscaleSessionEnd =
    !lifecycleHooks.tokscaleSubmit || sessionEnd.some((hook: unknown) => containsManagedTokscaleHook(hook));
  const installed = hasSessionStart && hasRateLimitSessionEnd && hasTokscaleSessionEnd;

  return {
    name: "hooks",
    scope: InventoryScope.CodexNative,
    status: installed ? InventoryStatus.Installed : hasAnyManagedSessionStart ? InventoryStatus.Invalid : InventoryStatus.Missing,
    path: codexPaths.hooksJson,
    repairHint: installed ? null : hasAnyManagedSessionStart ? "rerun `export hooks`" : "run `export hooks`"
  };
}

function loadLifecycleHooks(paths: ProjectPaths, codexPaths: CodexPaths): LifecycleHooksConfig {
  const environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
  return loadOrDefaultConfig(paths, environment).lifecycleHooks;
}

function managedSessionStartContext(packs: GuidancePacks, _roles: ModelRoutingGuidance): string {
  const lines = [
    SESSION_START_BASE_GUIDANCE
  ];

  if (packs.caveman) {
    lines.push("Caveman pack active: load `sane-caveman` for prose rules.");
  }
  if (packs.rtk) {
    lines.push("RTK pack active: load `sane-rtk` for shell/search/test/log routing.");
  }
  return lines.join(" ");
}

function activeGuidance(paths: ProjectPaths, codexPaths: CodexPaths): {
  packs: GuidancePacks;
  roles: ModelRoutingGuidance;
} {
  const environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
  const config = loadOrDefaultConfig(paths, environment);

  return {
    packs: {
      caveman: config.packs.caveman,
      rtk: config.packs.rtk,
      frontendCraft: config.packs.frontendCraft
    },
    roles: {
      coordinatorModel: config.models.coordinator.model,
      coordinatorReasoning: config.models.coordinator.reasoningEffort,
      executionModel: config.subagents.implementation.model,
      executionReasoning: config.subagents.implementation.reasoningEffort,
      sidecarModel: config.subagents.explorer.model,
      sidecarReasoning: config.subagents.explorer.reasoningEffort,
      verifierModel: config.subagents.verifier.model,
      verifierReasoning: config.subagents.verifier.reasoningEffort,
      realtimeModel: config.subagents.realtime.model,
      realtimeReasoning: config.subagents.realtime.reasoningEffort
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
  writeAtomicTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
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

function containsManagedSessionEndHook(entry: unknown): boolean {
  const hooks = Array.isArray(asObject(entry)?.hooks) ? asObject(entry)!.hooks : [];
  return hooks.some((hook: unknown) => {
    const command = asObject(hook)?.command;
    return typeof command === "string" && isManagedSessionEndHookCommand(command);
  });
}

function containsManagedTokscaleHook(entry: unknown): boolean {
  const hooks = Array.isArray(asObject(entry)?.hooks) ? asObject(entry)!.hooks : [];
  return hooks.some((hook: unknown) => {
    const command = asObject(hook)?.command;
    return typeof command === "string"
      && isManagedTokscaleSubmitHookCommand(command)
      && command.includes("--event session-end");
  });
}

function containsManagedLifecycleHook(entry: unknown): boolean {
  const hooks = Array.isArray(asObject(entry)?.hooks) ? asObject(entry)!.hooks : [];
  return hooks.some((hook: unknown) => {
    const command = asObject(hook)?.command;
    return typeof command === "string"
      && (isManagedLifecycleHookCommand(command) || isManagedTokscaleSubmitHookCommand(command));
  });
}

function pushHookEntry(target: any[], entry: Record<string, any>): void {
  const expectedCommands = hookCommands(entry);
  const alreadyPresent = target.some((candidate) => {
    const candidateCommands = hookCommands(candidate);
    return expectedCommands.every((command) => candidateCommands.includes(command));
  });
  if (!alreadyPresent) {
    target.push(entry);
  }
}

function upsertHookEntry(
  target: any[],
  isManagedEntry: (entry: unknown) => boolean,
  entry: Record<string, any>
): void {
  const existingIndex = target.findIndex(isManagedEntry);
  if (existingIndex >= 0) {
    target[existingIndex] = entry;
    return;
  }
  target.push(entry);
}

function removeMatchingHookEntries(target: any[], shouldRemove: (entry: unknown) => boolean): void {
  const retained = target.filter((entry) => !shouldRemove(entry));
  target.splice(0, target.length, ...retained);
}

function containsExpectedHookCommand(entry: unknown, expectedCommand: string): boolean {
  return hookCommands(entry).includes(expectedCommand);
}

function hookCommands(entry: unknown): string[] {
  const hooks = Array.isArray(asObject(entry)?.hooks) ? asObject(entry)!.hooks : [];
  return hooks.flatMap((hook: unknown) => {
    const command = asObject(hook)?.command;
    return typeof command === "string" ? [command] : [];
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

function validateHooksShapeForManagedUpdate(root: Record<string, any>): string | null {
  if (root.hooks === undefined) {
    return null;
  }
  const hooks = asObject(root.hooks);
  if (!hooks) {
    return "hooks.json must use object at top-level `hooks` key";
  }
  if (hooks.SessionStart !== undefined && !Array.isArray(hooks.SessionStart)) {
    return "hooks.json must use array at `hooks.SessionStart`";
  }
  if (hooks.SessionEnd !== undefined && !Array.isArray(hooks.SessionEnd)) {
    return "hooks.json must use array at `hooks.SessionEnd`";
  }
  return null;
}
