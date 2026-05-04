import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

import {
  SANE_AGENT_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_REALTIME_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  SANE_ROUTER_SKILL_NAME,
  renderCodexArtifacts,
  sourceRecordHash,
  type CodexArtifact,
  type RenderCodexArtifactsOptions
} from "@sane/framework-assets";
import {
  InventoryScope,
  InventoryStatus,
  OperationKind,
  OperationResult,
  removeManagedBlock,
  upsertManagedBlock
} from "@sane/control-plane/core.js";
import { type CodexPaths, type ProjectPaths } from "../../platform.js";
import { writeAtomicTextFile } from "@sane/state";

import { asPlainRecord } from "../../config-object.js";
import { ensureArrayProperty, ensureObjectProperty, readHooksJsonOrDefault, writeHooksJson } from "../../hooks-json.js";
import {
  containsManagedBlockedResponseGuardHook,
  containsManagedCommandSafetyGuardHook,
  containsManagedGeneratedSurfaceGuardHook,
  containsManagedRtkCommandHook,
  containsManagedSessionStartHook,
  removeMatchingHookEntries,
  upsertHookEntry
} from "../../hooks-matchers.js";
import {
  MANAGED_SESSION_START_STATUS_MESSAGE,
  buildManagedSessionStartHookCommand
} from "../../session-start-hook.js";
import {
  MANAGED_BLOCKED_RESPONSE_GUARD_STATUS_MESSAGE,
  MANAGED_COMMAND_SAFETY_GUARD_STATUS_MESSAGE,
  MANAGED_GENERATED_SURFACE_GUARD_STATUS_MESSAGE,
  buildManagedBlockedResponseGuardHookCommand,
  buildManagedCommandSafetyGuardHookCommand,
  buildManagedGeneratedSurfaceGuardHookCommand
} from "./safety-guard-hooks.js";
import {
  MANAGED_RTK_COMMAND_STATUS_MESSAGE,
  buildManagedRtkCommandHookCommand
} from "../../rtk-command-hook.js";

const MANIFEST_VERSION = 2;
const MANIFEST_FILE = "framework-artifacts-manifest.json";
const SKILL_OWNERSHIP_MARKER_FILE = ".sane-owned";
const SKILL_OWNERSHIP_MARKER_CONTENT = "managed-by: sane\n";
const CUSTOM_AGENT_OWNERSHIP_MARKER = "# managed-by: sane custom-agent\n";

export interface FrameworkArtifactManifestEntry {
  provider: CodexArtifact["provider"];
  path: string;
  mode: CodexArtifact["mode"];
  hash: string;
  sourceId: string;
  executable: boolean;
  structuredKeys: string[];
  ownershipMode: CodexArtifact["ownershipMode"];
  blockMarker: string | null;
  blockMarkers: CodexArtifact["blockMarkers"] | null;
  provenance: CodexArtifact["provenance"] | null;
}

export interface FrameworkArtifactManifest {
  version: 2;
  artifacts: FrameworkArtifactManifestEntry[];
}

export interface FrameworkArtifactPlan {
  provider: "codex";
  action: "preview" | "deploy" | "uninstall";
  manifestPath: string;
  artifacts: CodexArtifact[];
  manifest: FrameworkArtifactManifest;
}

export function createCodexFrameworkArtifactPlan(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  action: FrameworkArtifactPlan["action"],
  options: RenderCodexArtifactsOptions = {}
): FrameworkArtifactPlan {
  const artifacts = renderCodexArtifacts(options)
    .map((artifact) => absolutizeCodexArtifact(artifact, paths, codexPaths));
  return {
    provider: "codex",
    action,
    manifestPath: frameworkArtifactManifestPath(paths),
    artifacts,
    manifest: createFrameworkArtifactManifest(artifacts)
  };
}

export function previewCodexFrameworkArtifactPlan(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  options: RenderCodexArtifactsOptions = {}
): OperationResult {
  const plan = createCodexFrameworkArtifactPlan(paths, codexPaths, "preview", options);
  return new OperationResult({
    kind: OperationKind.ExportUserSkills,
    summary: "preview framework-artifacts: rendered Codex artifact plan",
    details: [
      `manifest: ${plan.manifestPath}`,
      ...plan.artifacts.map((artifact) =>
        `${artifact.mode}: ${artifact.path} sourceId=${artifact.sourceId}`
      )
    ],
    pathsTouched: plan.artifacts.map((artifact) => artifact.path),
    inventory: [artifactPlanInventory(plan, InventoryStatus.Missing, "run `export framework-artifacts`")]
  });
}

export function deployCodexFrameworkArtifactPlan(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  options: RenderCodexArtifactsOptions = {}
): OperationResult {
  const plan = createCodexFrameworkArtifactPlan(paths, codexPaths, "deploy", options);
  const blocked = plan.artifacts
    .flatMap((artifact) => blockedArtifactPath(artifact));

  if (blocked.length > 0) {
    return new OperationResult({
      kind: OperationKind.ExportUserSkills,
      summary: "export framework-artifacts: blocked by non-Sane skill directories",
      details: [
        "refusing to overwrite artifact-plan skill directories without Sane ownership marker",
        ...blocked.map((path) => `blocked: ${path}`)
      ],
      pathsTouched: blocked,
      inventory: [artifactPlanInventory(plan, InventoryStatus.Invalid, "resolve blocked directories")]
    });
  }

  for (const artifact of plan.artifacts) {
    if (artifact.mode === "file") {
      mkdirSync(dirname(artifact.path), { recursive: true });
      writeAtomicTextFile(artifact.path, deployedFileContent(artifact));
      if (artifact.path.endsWith("/SKILL.md")) {
        writeAtomicTextFile(join(dirname(artifact.path), SKILL_OWNERSHIP_MARKER_FILE), SKILL_OWNERSHIP_MARKER_CONTENT);
      }
      continue;
    }
    if (artifact.mode === "config" && artifact.sourceId.includes(":session-start:")) {
      mkdirSync(dirname(artifact.path), { recursive: true });
      const root = readHooksJsonOrDefault(artifact.path, existsSync(artifact.path));
      const hooks = ensureObjectProperty(root, "hooks");
      const sessionStart = ensureArrayProperty(hooks, "SessionStart");
      upsertHookEntry(sessionStart, containsManagedSessionStartHook, managedSessionStartHookEntry());
      writeHooksJson(artifact.path, root);
    }
    if (artifact.mode === "config" && artifact.sourceId.includes(":command-safety-guard:")) {
      upsertManagedHookConfig(artifact.path, "PreToolUse", containsManagedCommandSafetyGuardHook, {
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
    }
    if (artifact.mode === "config" && artifact.sourceId.includes(":generated-surface-guard:")) {
      upsertManagedHookConfig(artifact.path, "PreToolUse", containsManagedGeneratedSurfaceGuardHook, {
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
    }
    if (artifact.mode === "config" && artifact.sourceId.includes(":blocked-response-guard:")) {
      upsertManagedHookConfig(artifact.path, "Stop", containsManagedBlockedResponseGuardHook, {
        hooks: [
          {
            type: "command",
            command: buildManagedBlockedResponseGuardHookCommand(),
            statusMessage: MANAGED_BLOCKED_RESPONSE_GUARD_STATUS_MESSAGE,
            timeout: 10
          }
        ]
      });
    }
    if (artifact.mode === "config" && artifact.sourceId.includes(":rtk-command-guard:")) {
      upsertManagedHookConfig(artifact.path, "PreToolUse", containsManagedRtkCommandHook, {
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
    }
    if (artifact.mode === "config" && artifact.path.endsWith("/config.toml")) {
      mkdirSync(dirname(artifact.path), { recursive: true });
      applyTomlFragment(artifact.path, artifact.content, artifact.structuredKeys);
    }
    if (artifact.mode === "block" && artifact.blockMarkers) {
      mkdirSync(dirname(artifact.path), { recursive: true });
      const existing = existsSync(artifact.path) ? readFileSync(artifact.path, "utf8") : "";
      writeAtomicTextFile(
        artifact.path,
        upsertManagedBlock(existing, artifact.blockMarkers.begin, artifact.blockMarkers.end, artifact.content)
      );
    }
  }
  writeFrameworkArtifactManifest(plan.manifestPath, plan.manifest);

  return new OperationResult({
    kind: OperationKind.ExportUserSkills,
    summary: "export framework-artifacts: deployed Codex artifact plan",
    details: [
      `manifest: ${plan.manifestPath}`,
      ...plan.manifest.artifacts.map((entry) => `${entry.mode}: ${entry.path} ${entry.sourceId}`)
    ],
    pathsTouched: [plan.manifestPath, ...plan.artifacts.map((artifact) => artifact.path)],
    inventory: [artifactPlanInventory(plan, InventoryStatus.Installed, null)]
  });
}

export function uninstallCodexFrameworkArtifactPlan(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  options: RenderCodexArtifactsOptions = {}
): OperationResult {
  const plan = createCodexFrameworkArtifactPlan(paths, codexPaths, "uninstall", options);
  const existing = readFrameworkArtifactManifest(plan.manifestPath);
  const managed = existing.artifacts.filter((entry) =>
    plan.manifest.artifacts.some((candidate) =>
      candidate.provider === entry.provider
      && candidate.path === entry.path
      && candidate.mode === entry.mode
      && candidate.sourceId === entry.sourceId
    )
  );
  const preserved = existing.artifacts.filter((entry) => !managed.includes(entry));

  for (const entry of managed) {
    if (entry.mode === "file" && entry.path.endsWith("/SKILL.md") && isSaneOwnedSkillDir(dirname(entry.path))) {
      rmSync(dirname(entry.path), { recursive: true, force: true });
    }
    if (entry.mode === "file" && entry.path.includes("/skills/") && isSaneOwnedSkillDir(skillDirForArtifactPath(entry.path))) {
      rmSync(entry.path, { force: true });
    }
    if (entry.mode === "file" && entry.path.endsWith(".toml") && isSaneOwnedCustomAgentFile(entry.path)) {
      rmSync(entry.path, { force: true });
    }
    if (entry.mode === "config" && existsSync(entry.path)) {
      if (entry.path.endsWith("/hooks.json")) {
        uninstallManagedHookConfig(entry.path, entry.sourceId);
      }
      if (entry.path.endsWith("/config.toml")) {
        uninstallTomlFragmentKeys(entry.path, entry.structuredKeys);
      }
    }
    if (entry.mode === "block" && entry.blockMarkers && existsSync(entry.path)) {
      const existing = readFileSync(entry.path, "utf8");
      const updated = removeManagedBlock(existing, entry.blockMarkers.begin, entry.blockMarkers.end);
      if (updated.trim().length === 0) {
        rmSync(entry.path, { force: true });
      } else {
        writeAtomicTextFile(entry.path, updated);
      }
    }
  }

  if (preserved.length > 0) {
    writeFrameworkArtifactManifest(plan.manifestPath, {
      version: MANIFEST_VERSION,
      artifacts: preserved
    });
  } else if (existsSync(plan.manifestPath)) {
    rmSync(plan.manifestPath, { force: true });
  }

  return new OperationResult({
    kind: OperationKind.UninstallUserSkills,
    summary:
      managed.length > 0
        ? "uninstall framework-artifacts: removed manifest-owned Codex artifacts"
        : "uninstall framework-artifacts: no manifest-owned Codex artifacts",
    details: preserved.map((entry) => `preserved: ${entry.path}`),
    pathsTouched: managed.length > 0
      ? [plan.manifestPath, ...managed.map((entry) => entry.path)]
      : [plan.manifestPath],
    inventory: [
      artifactPlanInventory(
        plan,
        preserved.length > 0 ? InventoryStatus.Invalid : InventoryStatus.Removed,
        preserved.length > 0 ? "manifest still contains other artifacts" : null
      )
    ]
  });
}

export function frameworkArtifactManifestPath(paths: ProjectPaths): string {
  return join(paths.stateDir, MANIFEST_FILE);
}

export function createFrameworkArtifactManifest(artifacts: CodexArtifact[]): FrameworkArtifactManifest {
  return {
    version: MANIFEST_VERSION,
    artifacts: artifacts.map((artifact) => ({
      provider: artifact.provider,
      path: artifact.path,
      mode: artifact.mode,
      hash: artifact.hash,
      sourceId: artifact.sourceId,
      executable: artifact.executable,
      structuredKeys: [...artifact.structuredKeys],
      ownershipMode: artifact.ownershipMode,
      blockMarker: artifact.blockMarker ?? null,
      blockMarkers: artifact.blockMarkers ?? null,
      provenance: artifact.provenance ?? null
    }))
  };
}

export function readFrameworkArtifactManifest(path: string): FrameworkArtifactManifest {
  if (!existsSync(path)) {
    return { version: MANIFEST_VERSION, artifacts: [] };
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<FrameworkArtifactManifest>;
  if (parsed.version !== MANIFEST_VERSION || !Array.isArray(parsed.artifacts)) {
    throw new Error(`invalid framework artifact manifest: ${path}`);
  }

  return {
    version: MANIFEST_VERSION,
    artifacts: parsed.artifacts
  };
}

export function inspectFrameworkArtifactPlanInventory(
  paths: ProjectPaths,
  codexPaths: CodexPaths
) {
  const plan = createCodexFrameworkArtifactPlan(paths, codexPaths, "preview", {
    configFragments: {
      cloudflare: true,
      statusline: true
    }
  });
  if (!existsSync(plan.manifestPath)) {
    return artifactPlanInventory(plan, InventoryStatus.Missing, "run `export framework-artifacts`");
  }

  let existing: FrameworkArtifactManifest;
  try {
    existing = readFrameworkArtifactManifest(plan.manifestPath);
  } catch {
    return artifactPlanInventory(plan, InventoryStatus.Invalid, "repair framework artifact manifest");
  }

  const plannedKeys = new Set(
    plan.manifest.artifacts.map((entry) => artifactManifestEntryKey(entry))
  );
  const drift = describeArtifactPlanDrift(plan, existing, plannedKeys);
  const installed = existing.artifacts.length > 0 && drift.length === 0;

  return artifactPlanInventory(
    plan,
    installed ? InventoryStatus.Installed : InventoryStatus.Invalid,
    installed ? null : artifactDriftRepairHint(drift)
  );
}

function describeArtifactPlanDrift(
  plan: FrameworkArtifactPlan,
  existing: FrameworkArtifactManifest,
  plannedKeys: Set<string>
): string[] {
  const plannedByKey = new Map(
    plan.manifest.artifacts.map((entry, index) => [
      artifactManifestEntryKey(entry),
      { entry, artifact: plan.artifacts[index]! }
    ])
  );
  const drift: string[] = [];

  for (const entry of existing.artifacts) {
    const key = artifactManifestEntryKey(entry);
    const planned = plannedByKey.get(key);
    if (!plannedKeys.has(key) || !planned) {
      drift.push(`stale: ${entry.path} ${entry.sourceId}`);
      continue;
    }
    if (entry.hash !== planned.entry.hash) {
      drift.push(`source: ${entry.path} ${entry.sourceId}`);
      continue;
    }
    const liveDrift = describeLiveArtifactDrift(planned.artifact, entry);
    if (liveDrift) {
      drift.push(liveDrift);
    }
  }
  for (const [key, planned] of plannedByKey) {
    if (!existing.artifacts.some((entry) => artifactManifestEntryKey(entry) === key)) {
      drift.push(`missing manifest: ${planned.entry.path} ${planned.entry.sourceId}`);
    }
  }

  return drift;
}

function artifactDriftRepairHint(drift: string[]): string {
  if (drift.length === 0) {
    return "preview or redeploy framework-artifacts";
  }
  const shown = drift.slice(0, 12).join("; ");
  const suffix = drift.length > 12 ? `; +${drift.length - 12} more` : "";
  return `redeploy framework-artifacts (${shown}${suffix})`;
}

function describeLiveArtifactDrift(
  artifact: CodexArtifact,
  entry: FrameworkArtifactManifestEntry
): string | null {
  if (artifact.mode === "file") {
    if (!existsSync(entry.path)) {
      return `missing file: ${entry.path}`;
    }
    const body = readFileSync(entry.path, "utf8");
    const content = entry.path.endsWith(".toml") && body.startsWith(CUSTOM_AGENT_OWNERSHIP_MARKER)
      ? body.slice(CUSTOM_AGENT_OWNERSHIP_MARKER.length)
      : body;
    return sourceRecordHash(content) === entry.hash ? null : `changed file: ${entry.path}`;
  }

  if (artifact.mode === "block" && entry.blockMarkers) {
    if (!existsSync(entry.path)) {
      return `missing block file: ${entry.path}`;
    }
    const block = extractManagedBlockContent(readFileSync(entry.path, "utf8"), entry.blockMarkers.begin, entry.blockMarkers.end);
    if (block === null) {
      return `missing block: ${entry.path}`;
    }
    return block.trimEnd() === artifact.content.trimEnd() ? null : `changed block: ${entry.path}`;
  }

  if (artifact.mode === "config" && entry.path.endsWith("/hooks.json")) {
    const hookDrift = describeHookConfigDrift(entry.path, entry.sourceId);
    return hookDrift;
  }

  if (artifact.mode === "config" && entry.path.endsWith("/config.toml")) {
    return tomlFragmentMatches(entry.path, artifact.content, entry.structuredKeys) ? null : `changed config: ${entry.path} ${entry.sourceId}`;
  }

  return null;
}

function extractManagedBlockContent(body: string, begin: string, end: string): string | null {
  const start = body.indexOf(begin);
  const endIndex = body.indexOf(end);
  if (start === -1 || endIndex === -1 || endIndex < start) {
    return null;
  }
  return body.slice(start + begin.length, endIndex).trim();
}

function describeHookConfigDrift(path: string, sourceId: string): string | null {
  if (!existsSync(path)) {
    return `missing hook: ${sourceId}`;
  }
  try {
    const root = readHooksJsonOrDefault(path, true);
    const hooks = asPlainRecord(root.hooks);
    if (!hooks) {
      return `missing hook: ${sourceId}`;
    }
    if (sourceId.includes(":session-start:")) {
      return hookEventContainsExact(hooks, "SessionStart", managedSessionStartHookEntry())
        ? null
        : hookEventContains(hooks, "SessionStart", containsManagedSessionStartHook)
          ? `changed hook: ${sourceId}`
          : `missing hook: ${sourceId}`;
    }
    if (sourceId.includes(":command-safety-guard:")) {
      return describeExactManagedHookDrift(hooks, "PreToolUse", containsManagedCommandSafetyGuardHook, {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: buildManagedCommandSafetyGuardHookCommand(),
            statusMessage: MANAGED_COMMAND_SAFETY_GUARD_STATUS_MESSAGE,
            timeout: 10
          }
        ]
      }, sourceId);
    }
    if (sourceId.includes(":generated-surface-guard:")) {
      return describeExactManagedHookDrift(hooks, "PreToolUse", containsManagedGeneratedSurfaceGuardHook, {
        matcher: "Write|Edit|MultiEdit|apply_patch",
        hooks: [
          {
            type: "command",
            command: buildManagedGeneratedSurfaceGuardHookCommand(),
            statusMessage: MANAGED_GENERATED_SURFACE_GUARD_STATUS_MESSAGE,
            timeout: 10
          }
        ]
      }, sourceId);
    }
    if (sourceId.includes(":blocked-response-guard:")) {
      return describeExactManagedHookDrift(hooks, "Stop", containsManagedBlockedResponseGuardHook, {
        hooks: [
          {
            type: "command",
            command: buildManagedBlockedResponseGuardHookCommand(),
            statusMessage: MANAGED_BLOCKED_RESPONSE_GUARD_STATUS_MESSAGE,
            timeout: 10
          }
        ]
      }, sourceId);
    }
    if (sourceId.includes(":rtk-command-guard:")) {
      return describeExactManagedHookDrift(hooks, "PreToolUse", containsManagedRtkCommandHook, {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: buildManagedRtkCommandHookCommand(),
            statusMessage: MANAGED_RTK_COMMAND_STATUS_MESSAGE,
            timeout: 10
          }
        ]
      }, sourceId);
    }
    return `missing hook: ${sourceId}`;
  } catch {
    return `missing hook: ${sourceId}`;
  }
}

function describeExactManagedHookDrift(
  hooks: Record<string, unknown>,
  event: "SessionStart" | "PreToolUse" | "Stop",
  matcher: (entry: unknown) => boolean,
  expected: Record<string, unknown>,
  sourceId: string
): string | null {
  if (hookEventContainsExact(hooks, event, expected)) {
    return null;
  }
  return hookEventContains(hooks, event, matcher) ? `changed hook: ${sourceId}` : `missing hook: ${sourceId}`;
}

function hookEventContains(
  hooks: Record<string, unknown>,
  event: "SessionStart" | "PreToolUse" | "Stop",
  matcher: (entry: unknown) => boolean
): boolean {
  const entries = Array.isArray(hooks[event]) ? hooks[event] : [];
  return entries.some((entry) => matcher(entry));
}

function hookEventContainsExact(
  hooks: Record<string, unknown>,
  event: "SessionStart" | "PreToolUse" | "Stop",
  expected: Record<string, unknown>
): boolean {
  const entries = Array.isArray(hooks[event]) ? hooks[event] : [];
  const expectedJson = JSON.stringify(expected);
  return entries.some((entry) => JSON.stringify(entry) === expectedJson);
}

function tomlFragmentMatches(path: string, fragment: string, structuredKeys: string[]): boolean {
  if (!existsSync(path)) {
    return false;
  }
  try {
    const current = readTomlFile(path);
    const patch = parseTomlObject(fragment);
    return structuredKeys.every((key) =>
      JSON.stringify(getDottedKey(current, key)) === JSON.stringify(getDottedKey(patch, key))
    );
  } catch {
    return false;
  }
}

function writeFrameworkArtifactManifest(path: string, manifest: FrameworkArtifactManifest): void {
  mkdirSync(dirname(path), { recursive: true });
  writeAtomicTextFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

function artifactManifestEntryKey(entry: FrameworkArtifactManifestEntry): string {
  return `${entry.provider}\0${entry.path}\0${entry.mode}\0${entry.sourceId}`;
}

function absolutizeCodexArtifact(
  artifact: CodexArtifact,
  paths: ProjectPaths,
  codexPaths: CodexPaths
): CodexArtifact {
  const skillPath = skillArtifactPath(artifact.path);
  if (skillPath) {
    return {
      ...artifact,
      path: resolve(codexPaths.userSkillsDir, skillPath)
    };
  }
  const customAgentName = customAgentArtifactName(artifact.path);
  if (customAgentName) {
    return {
      ...artifact,
      path: resolve(codexPaths.customAgentsDir, `${customAgentName}.toml`)
    };
  }
  if (artifact.path === "hooks.json") {
    return {
      ...artifact,
      path: codexPaths.hooksJson
    };
  }
  if (artifact.path === "config.toml") {
    return {
      ...artifact,
      path: codexPaths.configToml
    };
  }
  if (artifact.path === "global/AGENTS.md") {
    return {
      ...artifact,
      path: codexPaths.globalAgentsMd
    };
  }
  if (artifact.path === "repo/AGENTS.md") {
    return {
      ...artifact,
      path: paths.repoAgentsMd
    };
  }
  return artifact;
}

function skillArtifactPath(path: string): string | null {
  const match = path.match(/^skills\/(.+)$/);
  return match?.[1] ?? null;
}

function customAgentArtifactName(path: string): string | null {
  const names = [
    SANE_AGENT_NAME,
    SANE_REVIEWER_AGENT_NAME,
    SANE_EXPLORER_AGENT_NAME,
    SANE_IMPLEMENTATION_AGENT_NAME,
    SANE_REALTIME_AGENT_NAME
  ];
  return names.find((name) => path === `agents/${name}.toml`) ?? null;
}

function artifactPlanInventory(
  plan: FrameworkArtifactPlan,
  status: InventoryStatus,
  repairHint: string | null
) {
  return {
    name: "framework-artifacts",
    scope: InventoryScope.CodexNative,
    status,
    path: plan.manifestPath,
    repairHint
  };
}

function isSaneOwnedSkillDir(path: string): boolean {
  return existsSync(join(path, SKILL_OWNERSHIP_MARKER_FILE));
}

function blockedArtifactPath(artifact: CodexArtifact): string[] {
  if (artifact.path.includes("/skills/")) {
    const skillDir = skillDirForArtifactPath(artifact.path);
    return existsSync(skillDir) && !isSaneOwnedSkillDir(skillDir) ? [skillDir] : [];
  }
  if (artifact.path.includes("/agents/") && artifact.path.endsWith(".toml")) {
    return existsSync(artifact.path) && !isSaneOwnedCustomAgentFile(artifact.path) ? [artifact.path] : [];
  }
  return [];
}

function skillDirForArtifactPath(path: string): string {
  const skillMdIndex = path.lastIndexOf("/SKILL.md");
  if (skillMdIndex >= 0) {
    return dirname(path);
  }
  const skillsSegment = "/skills/";
  const segmentIndex = path.lastIndexOf(skillsSegment);
  if (segmentIndex < 0) {
    return dirname(path);
  }
  const skillPathStart = segmentIndex + skillsSegment.length;
  const nextSlash = path.indexOf("/", skillPathStart);
  return nextSlash < 0 ? path : path.slice(0, nextSlash);
}

function deployedFileContent(artifact: CodexArtifact): string {
  return artifact.path.endsWith(".toml")
    ? `${CUSTOM_AGENT_OWNERSHIP_MARKER}${artifact.content}`
    : artifact.content;
}

function isSaneOwnedCustomAgentFile(path: string): boolean {
  return existsSync(path) && readFileSync(path, "utf8").startsWith(CUSTOM_AGENT_OWNERSHIP_MARKER);
}

function managedSessionStartHookEntry() {
  return {
    matcher: "startup|resume",
    hooks: [
      {
        type: "command",
        command: buildManagedSessionStartHookCommand(),
        statusMessage: MANAGED_SESSION_START_STATUS_MESSAGE
      }
    ]
  };
}

function upsertManagedHookConfig(
  path: string,
  hookEvent: "PreToolUse" | "Stop",
  matcher: (entry: unknown) => boolean,
  entry: Record<string, unknown>
): void {
  mkdirSync(dirname(path), { recursive: true });
  const root = readHooksJsonOrDefault(path, existsSync(path));
  const hooks = ensureObjectProperty(root, "hooks");
  const target = ensureArrayProperty(hooks, hookEvent);
  upsertHookEntry(target, matcher, entry);
  writeHooksJson(path, root);
}

function applyTomlFragment(path: string, fragment: string, structuredKeys: string[]): void {
  const current = existsSync(path) ? readTomlFile(path) : {};
  const patch = parseTomlObject(fragment);
  for (const key of structuredKeys) {
    const value = getDottedKey(patch, key);
    if (value !== undefined) {
      setDottedKey(current, key, value);
    }
  }
  writeAtomicTextFile(path, `${stringifyToml(current).trimEnd()}\n`);
}

function uninstallTomlFragmentKeys(path: string, structuredKeys: string[]): void {
  const current = readTomlFile(path);
  for (const key of structuredKeys) {
    deleteDottedKey(current, key);
  }
  if (Object.keys(current).length === 0) {
    rmSync(path, { force: true });
    return;
  }
  writeAtomicTextFile(path, `${stringifyToml(current).trimEnd()}\n`);
}

function readTomlFile(path: string): Record<string, unknown> {
  return parseTomlObject(readFileSync(path, "utf8"));
}

function parseTomlObject(body: string): Record<string, unknown> {
  const parsed = parseToml(body);
  if (!isMutableRecord(parsed)) {
    throw new Error("TOML root must be a table");
  }
  return parsed;
}

function getDottedKey(root: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    return isMutableRecord(node) ? node[part] : undefined;
  }, root);
}

function setDottedKey(root: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split(".");
  let node = root;
  for (const part of parts.slice(0, -1)) {
    const existing = node[part];
    if (!isMutableRecord(existing)) {
      node[part] = {};
    }
    node = node[part] as Record<string, unknown>;
  }
  node[parts.at(-1)!] = value;
}

function deleteDottedKey(root: Record<string, unknown>, key: string): void {
  const parts = key.split(".");
  const parents: Array<{ node: Record<string, unknown>; key: string }> = [];
  let node = root;
  for (const part of parts.slice(0, -1)) {
    const child = node[part];
    if (!isMutableRecord(child)) {
      return;
    }
    parents.push({ node, key: part });
    node = child;
  }
  delete node[parts.at(-1)!];
  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const parent = parents[index]!;
    const child = parent.node[parent.key];
    if (isMutableRecord(child) && Object.keys(child).length === 0) {
      delete parent.node[parent.key];
    }
  }
}

function isMutableRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uninstallManagedHookConfig(path: string, sourceId: string): void {
  const root = readHooksJsonOrDefault(path, true);
  const hooks = asPlainRecord(root.hooks);
  if (hooks) {
    removeHookEntriesForSourceId(hooks, sourceId);
  }
  if (hooks && Object.keys(hooks).length === 0) {
    delete root.hooks;
  }
  if (Object.keys(root).length === 0) {
    rmSync(path, { force: true });
  } else {
    writeHooksJson(path, root);
  }
}

function removeHookEntriesForSourceId(hooks: Record<string, unknown>, sourceId: string): void {
  if (sourceId.includes(":session-start:")) {
    removeHookEntries(hooks, "SessionStart", containsManagedSessionStartHook);
  }
  if (sourceId.includes(":command-safety-guard:")) {
    removeHookEntries(hooks, "PreToolUse", containsManagedCommandSafetyGuardHook);
  }
  if (sourceId.includes(":generated-surface-guard:")) {
    removeHookEntries(hooks, "PreToolUse", containsManagedGeneratedSurfaceGuardHook);
  }
  if (sourceId.includes(":blocked-response-guard:")) {
    removeHookEntries(hooks, "Stop", containsManagedBlockedResponseGuardHook);
  }
  if (sourceId.includes(":rtk-command-guard:")) {
    removeHookEntries(hooks, "PreToolUse", containsManagedRtkCommandHook);
  }
}

function removeHookEntries(
  hooks: Record<string, unknown>,
  event: "SessionStart" | "PreToolUse" | "Stop",
  matcher: (entry: unknown) => boolean
): void {
  const entries = Array.isArray(hooks[event]) ? hooks[event] : null;
  if (!entries) {
    return;
  }
  removeMatchingHookEntries(entries, matcher);
  if (entries.length === 0) {
    delete hooks[event];
  }
}
