import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  createRecommendedLocalConfig,
  type LifecycleHooksConfig,
  detectCodexEnvironment
} from "@sane/config";
import { InventoryScope, InventoryStatus, OperationKind, OperationResult, type InventoryItem } from "@sane/control-plane/core.js";
import {
  SANE_AGENT_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_REALTIME_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  createDefaultGuidancePacks,
  createSaneAgentTemplateWithPacks,
  createSaneExplorerAgentTemplateWithPacks,
  createSaneImplementationAgentTemplateWithPacks,
  createSaneRealtimeAgentTemplateWithPacks,
  createSaneReviewerAgentTemplateWithPacks,
  optionalPackConfigKey,
  optionalPackNames,
  type GuidancePacks,
  type ModelRoutingGuidance
} from "@sane/framework-assets";
import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "../../platform.js";
import { writeAtomicTextFile } from "@sane/state";

import { asPlainRecord, type PlainRecord } from "../../config-object.js";
import {
  ensureArrayProperty,
  ensureObjectProperty,
  readHooksJsonOrDefault,
  validateHooksShapeForManagedUpdate,
  writeHooksJson
} from "./hooks/hooks-json.js";
import {
  containsExpectedHookCommand,
  containsManagedBlockedResponseGuardHook,
  containsManagedCommandSafetyGuardHook,
  containsManagedGeneratedSurfaceGuardHook,
  containsManagedLifecycleHook,
  containsManagedRtkCommandHook,
  containsManagedSessionEndHook,
  containsManagedSessionStartHook,
  containsManagedTokscaleHook,
  removeMatchingHookEntries,
  upsertHookEntry
} from "./hooks/hooks-matchers.js";
import {
  MANAGED_SESSION_START_STATUS_MESSAGE,
  MANAGED_SESSION_END_STATUS_MESSAGE,
  buildManagedSessionEndHookCommand,
  buildManagedSessionStartHookCommand,
  buildSaneContinuityContext
} from "./hooks/session-start-hook.js";
import {
  MANAGED_RTK_COMMAND_STATUS_MESSAGE,
  buildManagedRtkCommandHookCommand
} from "./hooks/rtk-command-hook.js";
import { recommendedLocalConfigFromEnvironment } from "../../local-config.js";
import {
  MANAGED_TOKSCALE_STATUS_MESSAGE,
  buildManagedTokscaleSubmitHookCommand
} from "./hooks/tokscale-submit-hook.js";
import {
  MANAGED_BLOCKED_RESPONSE_GUARD_STATUS_MESSAGE,
  MANAGED_COMMAND_SAFETY_GUARD_STATUS_MESSAGE,
  MANAGED_GENERATED_SURFACE_GUARD_STATUS_MESSAGE,
  buildManagedBlockedResponseGuardHookCommand,
  buildManagedCommandSafetyGuardHookCommand,
  buildManagedGeneratedSurfaceGuardHookCommand
} from "../framework-artifacts/safety-guard-hooks.js";

const CUSTOM_AGENT_OWNERSHIP_MARKER = "# managed-by: sane custom-agent\n";

export function exportCustomAgents(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  mkdirSync(codexPaths.customAgentsDir, { recursive: true });

  const rendered = [
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
  const blocked = rendered
    .map(([path, body]) => ({ path, body }))
    .filter(({ path, body }) => fileExists(path) && !isManagedCustomAgentBody(readFileSync(path, "utf8"), body))
    .map(({ path }) => path);
  if (blocked.length > 0) {
    return new OperationResult({
      kind: OperationKind.ExportCustomAgents,
      summary: "export custom-agents: blocked by unmanaged custom-agent file",
      details: [
        "refusing to overwrite same-name custom-agent files without Sane ownership marker or expected managed body",
        ...blocked.map((path) => `blocked: ${path}`)
      ],
      pathsTouched: blocked,
      inventory: [inspectCustomAgentsInventory(paths, codexPaths)]
    });
  }

  for (const [path, body] of rendered) {
    writeAtomicTextFile(path, `${CUSTOM_AGENT_OWNERSHIP_MARKER}${body}`);
  }

  return new OperationResult({
    kind: OperationKind.ExportCustomAgents,
    summary: "export custom-agents: installed Sane custom agents",
    details: [
      ...rendered.map(([path]) => `path: ${path}`),
      "role defaults: coordinator->sane-agent, verifier->sane-reviewer, explorer->sane-explorer, implementation->sane-implementation, realtime->sane-realtime"
    ],
    pathsTouched: rendered.map(([path]) => path),
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
  const managed = managedPaths.filter((path) => fileExists(path) && isManagedCustomAgentFile(path));
  const preserved = managedPaths.filter((path) => fileExists(path) && !isManagedCustomAgentFile(path));
  const hadAny = managed.length + preserved.length > 0;

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

  for (const path of managed) {
    rmSync(path, { force: true });
  }

  if (fileExists(codexPaths.customAgentsDir) && readdirSync(codexPaths.customAgentsDir).length === 0) {
    rmSync(codexPaths.customAgentsDir, { recursive: true, force: true });
  }

  return new OperationResult({
    kind: OperationKind.UninstallCustomAgents,
    summary:
      preserved.length > 0
        ? "uninstall custom-agents: removed managed Sane custom agents; preserved unmanaged same-name files"
        : "uninstall custom-agents: removed Sane custom agents",
    details: preserved.map((path) => `preserved: ${path}`),
    pathsTouched: managed.length > 0 ? managed : [codexPaths.customAgentsDir],
    inventory: [
      {
        name: "custom-agents",
        scope: InventoryScope.CodexNative,
        status: preserved.length > 0 ? InventoryStatus.Invalid : InventoryStatus.Removed,
        path: codexPaths.customAgentsDir,
        repairHint: null
      }
    ]
  });
}

export function inspectCustomAgentsInventory(paths: ProjectPaths, codexPaths: CodexPaths): InventoryItem {
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
        ? expected.every(([path, body]) => isManagedCustomAgentBody(readFileSync(path, "utf8"), body))
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
  let root: PlainRecord;
  try {
    root = readHooksJsonOrDefault(codexPaths.hooksJson, fileExists(codexPaths.hooksJson));
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
  const preToolUse = ensureArrayProperty(hooksRoot, "PreToolUse");

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

  upsertHookEntry(preToolUse, containsManagedCommandSafetyGuardHook, {
    matcher: "Bash",
    hooks: [
      {
        type: "command",
        command: buildManagedCommandSafetyGuardHookCommand(),
        statusMessage: MANAGED_COMMAND_SAFETY_GUARD_STATUS_MESSAGE,
        timeout: 10
      }
    ]
  });

  upsertHookEntry(preToolUse, containsManagedGeneratedSurfaceGuardHook, {
    matcher: "Write|Edit|MultiEdit|apply_patch",
    hooks: [
      {
        type: "command",
        command: buildManagedGeneratedSurfaceGuardHookCommand(),
        statusMessage: MANAGED_GENERATED_SURFACE_GUARD_STATUS_MESSAGE,
        timeout: 10
      }
    ]
  });

  if (packs.rtk) {
    upsertHookEntry(preToolUse, containsManagedRtkCommandHook, {
      matcher: "Bash",
      hooks: [
        {
          type: "command",
          command: buildManagedRtkCommandHookCommand(),
          statusMessage: MANAGED_RTK_COMMAND_STATUS_MESSAGE,
          timeout: 10
        }
      ]
    });
  } else {
    removeMatchingHookEntries(preToolUse, containsManagedRtkCommandHook);
  }

  const stop = ensureArrayProperty(hooksRoot, "Stop");
  upsertHookEntry(stop, containsManagedBlockedResponseGuardHook, {
    hooks: [
      {
        type: "command",
        command: buildManagedBlockedResponseGuardHookCommand(),
        statusMessage: MANAGED_BLOCKED_RESPONSE_GUARD_STATUS_MESSAGE,
        timeout: 10
      }
    ]
  });

  if (lifecycleHooks.rateLimitResume || lifecycleHooks.tokscaleSubmit) {
    const legacySessionEnd = Array.isArray(hooksRoot.SessionEnd) ? hooksRoot.SessionEnd : null;
    if (legacySessionEnd) {
      removeMatchingHookEntries(legacySessionEnd, containsManagedLifecycleHook);
      if (legacySessionEnd.length === 0) {
        delete hooksRoot.SessionEnd;
      }
    }
    if (lifecycleHooks.rateLimitResume) {
      upsertHookEntry(stop, containsManagedSessionEndHook, {
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
      upsertHookEntry(stop, containsManagedTokscaleHook, {
        hooks: [
          {
            type: "command",
            command: buildManagedTokscaleSubmitHookCommand("stop", {
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
    summary: exportHooksSummary(lifecycleHooks, packs),
    details: [`path: ${codexPaths.hooksJson}`],
    pathsTouched: [codexPaths.hooksJson],
    inventory: [inspectHooksInventory(paths, codexPaths)]
  });
}

function exportHooksSummary(lifecycleHooks: LifecycleHooksConfig, packs: GuidancePacks): string {
  if (lifecycleHooks.tokscaleSubmit || lifecycleHooks.rateLimitResume) {
    return packs.rtk
      ? "export hooks: installed managed lifecycle, safety, and RTK hooks"
      : "export hooks: installed managed lifecycle and safety hooks";
  }
  return packs.rtk
    ? "export hooks: installed managed SessionStart, safety, and RTK hooks"
    : "export hooks: installed managed SessionStart and safety hooks";
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

  let root: PlainRecord;
  try {
    root = readHooksJsonOrDefault(codexPaths.hooksJson, fileExists(codexPaths.hooksJson));
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
  const hooks = asPlainRecord(root.hooks);
  const sessionStart = Array.isArray(hooks?.SessionStart) ? hooks.SessionStart : null;
  const preToolUse = Array.isArray(hooks?.PreToolUse) ? hooks.PreToolUse : null;
  const sessionEnd = Array.isArray(hooks?.SessionEnd) ? hooks.SessionEnd : null;
  const stop = Array.isArray(hooks?.Stop) ? hooks.Stop : null;
  const before = (sessionStart?.length ?? 0) + (preToolUse?.length ?? 0) + (sessionEnd?.length ?? 0) + (stop?.length ?? 0);

  if (hooks && sessionStart) {
    const retained = sessionStart.filter((entry) => !containsManagedLifecycleHook(entry));
    if (retained.length === 0) {
      delete hooks.SessionStart;
    } else {
      hooks.SessionStart = retained;
    }
  }
  if (hooks && preToolUse) {
    const retained = preToolUse.filter((entry) => !containsManagedLifecycleHook(entry));
    if (retained.length === 0) {
      delete hooks.PreToolUse;
    } else {
      hooks.PreToolUse = retained;
    }
  }
  if (hooks && sessionEnd) {
    const retained = sessionEnd.filter((entry) => !containsManagedLifecycleHook(entry));
    if (retained.length === 0) {
      delete hooks.SessionEnd;
    } else {
      hooks.SessionEnd = retained;
    }
  }
  if (hooks && stop) {
    const retained = stop.filter((entry) => !containsManagedLifecycleHook(entry));
    if (retained.length === 0) {
      delete hooks.Stop;
    } else {
      hooks.Stop = retained;
    }
  }
  if (hooks && Object.keys(hooks).length === 0) {
    delete root.hooks;
  }

  const after =
    (Array.isArray(hooks?.SessionStart) ? hooks.SessionStart.length : 0)
    + (Array.isArray(hooks?.PreToolUse) ? hooks.PreToolUse.length : 0)
    + (Array.isArray(hooks?.SessionEnd) ? hooks.SessionEnd.length : 0)
    + (Array.isArray(hooks?.Stop) ? hooks.Stop.length : 0);
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
): InventoryItem {
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

  let root: PlainRecord;
  try {
    root = readHooksJsonOrDefault(codexPaths.hooksJson, fileExists(codexPaths.hooksJson));
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

  const hooks = asPlainRecord(root.hooks);
  const sessionStart = Array.isArray(hooks?.SessionStart) ? hooks.SessionStart : [];
  const preToolUse = Array.isArray(hooks?.PreToolUse) ? hooks.PreToolUse : [];
  const stop = Array.isArray(hooks?.Stop) ? hooks.Stop : [];
  const hasAnyManagedSessionStart = sessionStart.some((hook: unknown) => containsManagedSessionStartHook(hook));
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const hasSessionStart = sessionStart.some((hook: unknown) =>
    containsExpectedHookCommand(hook, buildManagedSessionStartHookCommand(undefined, {
      additionalContext: managedSessionStartContext(packs, roles)
    }))
  );
  const hasRateLimitStop =
    !lifecycleHooks.rateLimitResume
    || stop.some((hook: unknown) =>
      containsExpectedHookCommand(hook, buildManagedSessionEndHookCommand(undefined, { rateLimitResume: true }))
    );
  const hasTokscaleStop =
    !lifecycleHooks.tokscaleSubmit || stop.some((hook: unknown) => containsManagedTokscaleHook(hook));
  const hasRtkCommandHook =
    !packs.rtk || preToolUse.some((hook: unknown) => containsManagedRtkCommandHook(hook));
  const hasCommandSafetyGuard = preToolUse.some((hook: unknown) => containsManagedCommandSafetyGuardHook(hook));
  const hasGeneratedSurfaceGuard = preToolUse.some((hook: unknown) => containsManagedGeneratedSurfaceGuardHook(hook));
  const hasBlockedResponseGuard = stop.some((hook: unknown) => containsManagedBlockedResponseGuardHook(hook));
  const hasAnyManagedHook =
    hasAnyManagedSessionStart
    || preToolUse.some((hook: unknown) => containsManagedRtkCommandHook(hook))
    || hasCommandSafetyGuard
    || hasGeneratedSurfaceGuard
    || hasBlockedResponseGuard;
  const installed = hasSessionStart
    && hasRtkCommandHook
    && hasCommandSafetyGuard
    && hasGeneratedSurfaceGuard
    && hasBlockedResponseGuard
    && hasRateLimitStop
    && hasTokscaleStop;

  return {
    name: "hooks",
    scope: InventoryScope.CodexNative,
    status: installed ? InventoryStatus.Installed : hasAnyManagedHook ? InventoryStatus.Invalid : InventoryStatus.Missing,
    path: codexPaths.hooksJson,
    repairHint: installed ? null : hasAnyManagedHook ? "rerun `export hooks`" : "run `export hooks`"
  };
}

function loadLifecycleHooks(paths: ProjectPaths, codexPaths: CodexPaths): LifecycleHooksConfig {
  const environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
  return loadOrDefaultConfig(paths, environment).lifecycleHooks;
}

function managedSessionStartContext(packs: GuidancePacks, _roles: ModelRoutingGuidance): string {
  return buildSaneContinuityContext(packs);
}

function activeGuidance(paths: ProjectPaths, codexPaths: CodexPaths): {
  packs: GuidancePacks;
  roles: ModelRoutingGuidance;
} {
  const environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
  const config = loadOrDefaultConfig(paths, environment);

  return {
    packs: guidancePacksFromConfig(config.packs),
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

function guidancePacksFromConfig(config: Record<string, boolean>): GuidancePacks {
  const packs = createDefaultGuidancePacks();
  for (const packName of optionalPackNames()) {
    const configKey = optionalPackConfigKey(packName);
    packs[configKey] = Boolean(config[configKey]);
  }
  return packs;
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

function fileExists(path: string): boolean {
  return existsSync(path);
}

function isManagedCustomAgentFile(path: string): boolean {
  return readFileSync(path, "utf8").startsWith(CUSTOM_AGENT_OWNERSHIP_MARKER);
}

function isManagedCustomAgentBody(current: string, expected: string): boolean {
  return (
    current === expected ||
    current === `${CUSTOM_AGENT_OWNERSHIP_MARKER}${expected}`
  );
}
