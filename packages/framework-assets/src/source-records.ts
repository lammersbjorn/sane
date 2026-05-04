import { createHash } from "node:crypto";

import { loadCorePackManifest, readCoreAsset } from "./core-pack-assets.js";

export type FrameworkSourceKind =
  | "core-skill"
  | "core-skill-support"
  | "custom-agent"
  | "config-fragment"
  | "hook"
  | "agents-block";
export type FrameworkSourceProvider = "codex";
export type FrameworkSourceMode = "source-managed" | "generated-managed" | "config-managed";

export interface FrameworkSourceRecord {
  id: string;
  kind: FrameworkSourceKind;
  provider: FrameworkSourceProvider;
  name: string;
  sourcePath: string;
  targetPath: string;
  mode: FrameworkSourceMode;
  content: string;
  executable: boolean;
  structuredKeys: string[];
  hash: string;
  sourceId: string;
  blockMarker?: string;
  blockMarkers?: {
    begin: string;
    end: string;
  };
  provenance?: {
    owner: "sane";
    sourcePath: string;
    updateStrategy: string;
  };
}

export interface FrameworkSourceRecordOptions {
  roles?: ModelRoutingGuidance;
  packs?: FrameworkGuidancePacks;
  configFragments?: FrameworkConfigFragments;
}

export interface FrameworkConfigFragments {
  cloudflare?: boolean;
  statusline?: boolean;
}

export interface FrameworkGuidancePacks {
  [configKey: string]: boolean;
  caveman: boolean;
  rtk: boolean;
  frontendCraft: boolean;
  docsCraft: boolean;
}

export interface ModelRoutingGuidance {
  coordinatorModel: string;
  coordinatorReasoning: string;
  executionModel: string;
  executionReasoning: string;
  sidecarModel: string;
  sidecarReasoning: string;
  verifierModel: string;
  verifierReasoning: string;
  realtimeModel: string;
  realtimeReasoning: string;
}

export const SANE_ROUTER_SKILL_NAME = "sane-router";
export const SANE_BOOTSTRAP_RESEARCH_SKILL_NAME = "sane-bootstrap-research";
export const SANE_AGENT_LANES_SKILL_NAME = "sane-agent-lanes";
export const SANE_OUTCOME_CONTINUATION_SKILL_NAME = "sane-outcome-continuation";
export const SANE_CONTINUE_SKILL_NAME = "continue";
export const SANE_AGENT_NAME = "sane-agent";
export const SANE_REVIEWER_AGENT_NAME = "sane-reviewer";
export const SANE_EXPLORER_AGENT_NAME = "sane-explorer";
export const SANE_IMPLEMENTATION_AGENT_NAME = "sane-implementation";
export const SANE_REALTIME_AGENT_NAME = "sane-realtime";
export const SANE_CODEX_PROFILE_FRAGMENT_ID = "codex-profile";
export const SANE_INTEGRATIONS_PROFILE_FRAGMENT_ID = "integrations-profile";
export const SANE_CLOUDFLARE_PROFILE_FRAGMENT_ID = "cloudflare-profile";
export const SANE_STATUSLINE_PROFILE_FRAGMENT_ID = "statusline-profile";
export const SANE_SESSION_START_HOOK_NAME = "session-start";
export const SANE_COMMAND_SAFETY_GUARD_HOOK_NAME = "command-safety-guard";
export const SANE_GENERATED_SURFACE_GUARD_HOOK_NAME = "generated-surface-guard";
export const SANE_BLOCKED_RESPONSE_GUARD_HOOK_NAME = "blocked-response-guard";
export const SANE_RTK_COMMAND_GUARD_HOOK_NAME = "rtk-command-guard";
export const SANE_GLOBAL_AGENTS_BLOCK_ID = "global-agents";
export const SANE_REPO_AGENTS_BLOCK_ID = "repo-agents";
export const SANE_GLOBAL_AGENTS_BEGIN = "<!-- sane:global-agents:start -->";
export const SANE_GLOBAL_AGENTS_END = "<!-- sane:global-agents:end -->";
export const SANE_REPO_AGENTS_BEGIN = "<!-- sane:repo-agents:start -->";
export const SANE_REPO_AGENTS_END = "<!-- sane:repo-agents:end -->";

const DEFAULT_ROLES: ModelRoutingGuidance = {
  coordinatorModel: "gpt-5.4",
  coordinatorReasoning: "high",
  executionModel: "gpt-5.3-codex",
  executionReasoning: "medium",
  sidecarModel: "gpt-5.4-mini",
  sidecarReasoning: "medium",
  verifierModel: "gpt-5.4",
  verifierReasoning: "medium",
  realtimeModel: "gpt-5.3-codex-spark",
  realtimeReasoning: "low"
};

const DEFAULT_PACKS: FrameworkGuidancePacks = {
  caveman: false,
  rtk: false,
  frontendCraft: false,
  docsCraft: false
};
const SESSION_START_HOOK_SOURCE_PATH = "codex/hooks/session-start";
const SESSION_START_HOOK_TARGET_PATH = "hooks.json";
const SESSION_START_BASE_GUIDANCE =
  "Before work: read repo AGENTS.md if present; stay quiet when absent. Load `sane-router` skill body for Sane routing; naming it is not enough.";
const CORE_PACK_MANIFEST = loadCorePackManifest();
const CUSTOM_AGENT_STRUCTURED_KEYS = [
  "name",
  "description",
  "model",
  "model_reasoning_effort",
  "sandbox_mode"
];

export function createFrameworkSourceRecords(
  options: FrameworkSourceRecordOptions = {}
): FrameworkSourceRecord[] {
  const roles = options.roles ?? DEFAULT_ROLES;
  const packs = options.packs ?? DEFAULT_PACKS;
  const configFragments = options.configFragments ?? {};

  const records: FrameworkSourceRecord[] = [
    agentsBlockSourceRecord({
      id: SANE_GLOBAL_AGENTS_BLOCK_ID,
      name: SANE_GLOBAL_AGENTS_BLOCK_ID,
      sourcePath: `packs/core/${CORE_PACK_MANIFEST.assets.globalOverlay}`,
      targetPath: "global/AGENTS.md",
      content: renderOverlayTemplate(readCoreAsset(CORE_PACK_MANIFEST.assets.globalOverlay), packs),
      blockMarkers: {
        begin: SANE_GLOBAL_AGENTS_BEGIN,
        end: SANE_GLOBAL_AGENTS_END
      }
    }),
    agentsBlockSourceRecord({
      id: SANE_REPO_AGENTS_BLOCK_ID,
      name: SANE_REPO_AGENTS_BLOCK_ID,
      sourcePath: `packs/core/${CORE_PACK_MANIFEST.assets.repoOverlay}`,
      targetPath: "repo/AGENTS.md",
      content: renderOverlayTemplate(readCoreAsset(CORE_PACK_MANIFEST.assets.repoOverlay), packs),
      blockMarkers: {
        begin: SANE_REPO_AGENTS_BEGIN,
        end: SANE_REPO_AGENTS_END
      }
    }),
    sourceRecord({
      id: SANE_ROUTER_SKILL_NAME,
      kind: "core-skill",
      name: SANE_ROUTER_SKILL_NAME,
      sourcePath: `packs/core/${CORE_PACK_MANIFEST.assets.routerSkill}`,
      targetPath: `skills/${SANE_ROUTER_SKILL_NAME}/SKILL.md`,
      mode: "generated-managed",
      content: renderTemplate(readCoreAsset(CORE_PACK_MANIFEST.assets.routerSkill), {
        COORDINATOR_MODEL: roles.coordinatorModel,
        COORDINATOR_REASONING: roles.coordinatorReasoning,
        EXECUTION_MODEL: roles.executionModel,
        EXECUTION_REASONING: roles.executionReasoning,
        SIDECAR_MODEL: roles.sidecarModel,
        SIDECAR_REASONING: roles.sidecarReasoning,
        VERIFIER_MODEL: roles.verifierModel,
        VERIFIER_REASONING: roles.verifierReasoning,
        REALTIME_MODEL: roles.realtimeModel,
        REALTIME_REASONING: roles.realtimeReasoning,
        ENABLED_PACK_ROUTER_NOTES: enabledPackPolicyNotes(packs),
        ENABLED_PACK_SKILL_SELECTIONS: enabledPackSkillSelections(packs)
      }),
      structuredKeys: ["name", "description"]
    }),
    coreSkillSourceRecord({
      id: SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
      assetPath: CORE_PACK_MANIFEST.assets.bootstrapResearchSkill
    }),
    coreSkillSourceRecord({
      id: SANE_AGENT_LANES_SKILL_NAME,
      assetPath: CORE_PACK_MANIFEST.assets.agentLanesSkill
    }),
    coreSkillSourceRecord({
      id: SANE_OUTCOME_CONTINUATION_SKILL_NAME,
      assetPath: CORE_PACK_MANIFEST.assets.outcomeContinuationSkill
    }),
    coreSkillSourceRecord({
      id: SANE_CONTINUE_SKILL_NAME,
      assetPath: CORE_PACK_MANIFEST.assets.continueSkill
    }),
    ...optionalPackSourceRecords(packs),
    sourceRecord({
      id: SANE_AGENT_NAME,
      kind: "custom-agent",
      name: SANE_AGENT_NAME,
      sourcePath: `packs/core/${CORE_PACK_MANIFEST.assets.agents.primary}`,
      targetPath: `agents/${SANE_AGENT_NAME}.toml`,
      mode: "generated-managed",
      content: renderTemplate(readCoreAsset(CORE_PACK_MANIFEST.assets.agents.primary), {
        MODEL: roles.coordinatorModel,
        MODEL_REASONING: roles.coordinatorReasoning,
        ENABLED_PACK_AGENT_NOTES: enabledPackPolicyNotes(packs)
      }),
      structuredKeys: ["name", "description", "model", "model_reasoning_effort", "sandbox_mode"],
      blockMarker: "# managed-by: sane custom-agent"
    }),
    customAgentSourceRecord({
      id: SANE_REVIEWER_AGENT_NAME,
      sourcePath: `packs/core/${CORE_PACK_MANIFEST.assets.agents.reviewer}`,
      assetPath: CORE_PACK_MANIFEST.assets.agents.reviewer,
      model: roles.verifierModel,
      modelReasoning: roles.verifierReasoning,
      packs
    }),
    customAgentSourceRecord({
      id: SANE_EXPLORER_AGENT_NAME,
      sourcePath: `packs/core/${CORE_PACK_MANIFEST.assets.agents.explorer}`,
      assetPath: CORE_PACK_MANIFEST.assets.agents.explorer,
      model: roles.sidecarModel,
      modelReasoning: roles.sidecarReasoning,
      packs
    }),
    customAgentSourceRecord({
      id: SANE_IMPLEMENTATION_AGENT_NAME,
      sourcePath: `packs/core/${CORE_PACK_MANIFEST.assets.agents.implementation}`,
      assetPath: CORE_PACK_MANIFEST.assets.agents.implementation,
      model: roles.executionModel,
      modelReasoning: roles.executionReasoning,
      packs
    }),
    customAgentSourceRecord({
      id: SANE_REALTIME_AGENT_NAME,
      sourcePath: `packs/core/${CORE_PACK_MANIFEST.assets.agents.realtime}`,
      assetPath: CORE_PACK_MANIFEST.assets.agents.realtime,
      model: roles.realtimeModel,
      modelReasoning: roles.realtimeReasoning,
      packs
    }),
    codexConfigFragmentSourceRecord({
      id: SANE_CODEX_PROFILE_FRAGMENT_ID,
      name: "codex-profile",
      sourcePath: "codex/config/codex-profile",
      content: renderCodexProfileFragment(roles),
      structuredKeys: ["model", "model_reasoning_effort", "compact_prompt", "features.codex_hooks"],
      blockMarker: "codex-profile"
    }),
    codexConfigFragmentSourceRecord({
      id: SANE_INTEGRATIONS_PROFILE_FRAGMENT_ID,
      name: "integrations-profile",
      sourcePath: "codex/config/integrations-profile",
      content: renderIntegrationsProfileFragment(),
      structuredKeys: ["mcp_servers.playwright"],
      blockMarker: "integrations-profile"
    }),
    ...(configFragments.cloudflare
      ? [
        codexConfigFragmentSourceRecord({
          id: SANE_CLOUDFLARE_PROFILE_FRAGMENT_ID,
          name: "cloudflare-profile",
          sourcePath: "codex/config/cloudflare-profile",
          content: renderCloudflareProfileFragment(),
          structuredKeys: ["mcp_servers.cloudflare-api"],
          blockMarker: "cloudflare-profile"
        })
      ]
      : []),
    ...(configFragments.statusline
      ? [
        codexConfigFragmentSourceRecord({
          id: SANE_STATUSLINE_PROFILE_FRAGMENT_ID,
          name: "statusline-profile",
          sourcePath: "codex/config/statusline-profile",
          content: renderStatuslineProfileFragment(),
          structuredKeys: ["tui.notification_condition", "tui.status_line", "tui.terminal_title"],
          blockMarker: "statusline-profile"
        })
      ]
      : []),
    sourceRecord({
      id: SANE_SESSION_START_HOOK_NAME,
      kind: "hook",
      name: SANE_SESSION_START_HOOK_NAME,
      sourcePath: SESSION_START_HOOK_SOURCE_PATH,
      targetPath: SESSION_START_HOOK_TARGET_PATH,
      mode: "config-managed",
      content: renderSessionStartHookSource(),
      executable: true,
      structuredKeys: ["hooks", "SessionStart", "matcher", "type", "command", "statusMessage"],
      blockMarker: "hook session-start"
    }),
    hookSourceRecord({
      id: SANE_COMMAND_SAFETY_GUARD_HOOK_NAME,
      event: "PreToolUse",
      matcher: "Bash",
      sourcePath: "codex/hooks/command-safety-guard",
      structuredKeys: ["hooks", "PreToolUse", "Bash", "destructive", "secret", "unsafe-git"],
      blockMarker: "hook command-safety-guard"
    }),
    hookSourceRecord({
      id: SANE_GENERATED_SURFACE_GUARD_HOOK_NAME,
      event: "PreToolUse",
      matcher: "Write|Edit|MultiEdit|apply_patch",
      sourcePath: "codex/hooks/generated-surface-guard",
      structuredKeys: ["hooks", "PreToolUse", "generated-surface", "provenance"],
      blockMarker: "hook generated-surface-guard"
    }),
    hookSourceRecord({
      id: SANE_BLOCKED_RESPONSE_GUARD_HOOK_NAME,
      event: "Stop",
      matcher: null,
      sourcePath: "codex/hooks/blocked-response-guard",
      structuredKeys: ["hooks", "Stop", "BLOCKED", "attempt", "evidence", "need"],
      blockMarker: "hook blocked-response-guard"
    }),
    ...(packs.rtk
      ? [
        hookSourceRecord({
          id: SANE_RTK_COMMAND_GUARD_HOOK_NAME,
          event: "PreToolUse",
          matcher: "Bash",
          sourcePath: "codex/hooks/rtk-command-guard",
          structuredKeys: ["hooks", "PreToolUse", "Bash", "rtk"],
          blockMarker: "hook rtk-command"
        })
      ]
      : [])
  ];

  return records;
}

export function frameworkSourceRecordById(
  id: string,
  options: FrameworkSourceRecordOptions = {}
): FrameworkSourceRecord | undefined {
  return createFrameworkSourceRecords(options).find((record) => record.id === id);
}

export function sourceRecordHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function sourceRecordSourceId(
  record: Pick<FrameworkSourceRecord, "provider" | "id" | "content">
): string {
  return `${record.provider}:${record.id}:${sourceRecordHash(record.content)}`;
}

function sourceRecord(
  record: Omit<FrameworkSourceRecord, "provider" | "executable" | "hash" | "sourceId" | "provenance"> & {
    executable?: boolean;
  }
): FrameworkSourceRecord {
  const hash = sourceRecordHash(record.content);

  return {
    ...record,
    provider: "codex",
    executable: record.executable ?? false,
    hash,
    sourceId: `codex:${record.id}:${hash}`,
    provenance: {
      owner: "sane",
      sourcePath: record.sourcePath,
      updateStrategy: record.mode === "source-managed" ? "manual-curated" : "rendered-managed"
    }
  };
}

function coreSkillSourceRecord(options: { id: string; assetPath: string }): FrameworkSourceRecord {
  return sourceRecord({
    id: options.id,
    kind: "core-skill",
    name: options.id,
    sourcePath: `packs/core/${options.assetPath}`,
    targetPath: `skills/${options.id}/SKILL.md`,
    mode: "source-managed",
    content: readCoreAsset(options.assetPath),
    structuredKeys: ["name", "description"]
  });
}

function optionalPackSourceRecords(packs: FrameworkGuidancePacks): FrameworkSourceRecord[] {
  return enabledPackEntries(packs).flatMap(([packName, entry]) => {
    const skills = optionalPackSkills(entry);

    return skills.flatMap((skill) => [
      sourceRecord({
        id: skill.name,
        kind: "core-skill",
        name: skill.name,
        sourcePath: `packs/core/${skill.path}`,
        targetPath: `skills/${skill.name}/SKILL.md`,
        mode: "source-managed",
        content: readCoreAsset(skill.path),
        structuredKeys: ["name", "description", "optionalPack", packName]
      }),
      ...(skill.resources ?? []).map((resource) =>
        sourceRecord({
          id: `${skill.name}:${resource.target}`,
          kind: "core-skill-support" as const,
          name: `${skill.name}/${resource.target}`,
          sourcePath: `packs/core/${resource.source}`,
          targetPath: `skills/${skill.name}/${resource.target}`,
          mode: "source-managed" as const,
          content: readCoreAsset(resource.source),
          executable: isLikelyHelperScript(resource.target),
          structuredKeys: ["optionalPack", packName, "skill", skill.name, "supportFile"]
        })
      )
    ]);
  });
}

function optionalPackSkills(entry: (typeof CORE_PACK_MANIFEST.optionalPacks)[string]): Array<{
  name: string;
  path: string;
  taskKinds?: string[];
  resources?: Array<{ source: string; target: string }>;
}> {
  if (entry.skills && entry.skills.length > 0) {
    return entry.skills;
  }

  if (entry.skillName && entry.skillPath) {
    return [{ name: entry.skillName, path: entry.skillPath }];
  }

  return [];
}

function isLikelyHelperScript(path: string): boolean {
  return /(^|\/)scripts\//.test(path) || /\.(?:sh|bash|zsh|py|js|mjs|cjs|ts)$/u.test(path);
}

function customAgentSourceRecord(options: {
  id: string;
  sourcePath: string;
  assetPath: string;
  model: string;
  modelReasoning: string;
  packs: FrameworkGuidancePacks;
}): FrameworkSourceRecord {
  return sourceRecord({
    id: options.id,
    kind: "custom-agent",
    name: options.id,
    sourcePath: options.sourcePath,
    targetPath: `agents/${options.id}.toml`,
    mode: "generated-managed",
    content: renderTemplate(readCoreAsset(options.assetPath), {
      MODEL: options.model,
      MODEL_REASONING: options.modelReasoning,
      ENABLED_PACK_AGENT_NOTES: enabledPackPolicyNotes(options.packs)
    }),
    structuredKeys: CUSTOM_AGENT_STRUCTURED_KEYS,
    blockMarker: "# managed-by: sane custom-agent"
  });
}

function agentsBlockSourceRecord(options: {
  id: string;
  name: string;
  sourcePath: string;
  targetPath: string;
  content: string;
  blockMarkers: { begin: string; end: string };
}): FrameworkSourceRecord {
  return sourceRecord({
    id: options.id,
    kind: "agents-block",
    name: options.name,
    sourcePath: options.sourcePath,
    targetPath: options.targetPath,
    mode: "generated-managed",
    content: options.content,
    structuredKeys: ["AGENTS.md", "managedBlock", "begin", "end"],
    blockMarker: `${options.blockMarkers.begin} ${options.blockMarkers.end}`,
    blockMarkers: options.blockMarkers
  });
}

function codexConfigFragmentSourceRecord(options: {
  id: string;
  name: string;
  sourcePath: string;
  content: string;
  structuredKeys: string[];
  blockMarker: string;
}): FrameworkSourceRecord {
  return sourceRecord({
    id: options.id,
    kind: "config-fragment",
    name: options.name,
    sourcePath: options.sourcePath,
    targetPath: "config.toml",
    mode: "config-managed",
    content: options.content,
    structuredKeys: options.structuredKeys,
    blockMarker: options.blockMarker
  });
}

function renderSessionStartHookSource(): string {
  return JSON.stringify(
    {
      hooks: {
        SessionStart: [
          {
            matcher: "startup|resume",
            hooks: [
              {
                type: "command",
                command: "'sane' hook session-start",
                statusMessage: "Loading Sane session defaults"
              }
            ]
          }
        ]
      },
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: SESSION_START_BASE_GUIDANCE
      }
    },
    null,
    2
  );
}

function hookSourceRecord(options: {
  id: string;
  event: "PreToolUse" | "Stop";
  matcher: string | null;
  sourcePath: string;
  structuredKeys: string[];
  blockMarker: string;
}): FrameworkSourceRecord {
  return sourceRecord({
    id: options.id,
    kind: "hook",
    name: options.id,
    sourcePath: options.sourcePath,
    targetPath: "hooks.json",
    mode: "config-managed",
    content: JSON.stringify(
      {
        hook: {
          event: options.event,
          matcher: options.matcher,
          guard: options.id
        }
      },
      null,
      2
    ),
    executable: true,
    structuredKeys: options.structuredKeys,
    blockMarker: options.blockMarker
  });
}

function renderCodexProfileFragment(roles: ModelRoutingGuidance): string {
  return [
    `model = "${roles.coordinatorModel}"`,
    `model_reasoning_effort = "${roles.coordinatorReasoning}"`,
    'compact_prompt = "Sane continuity prompt"',
    "",
    "[features]",
    "codex_hooks = true",
    ""
  ].join("\n");
}

function renderIntegrationsProfileFragment(): string {
  return [
    "[mcp_servers.playwright]",
    'command = "npx"',
    'args = ["@playwright/mcp@latest"]',
    ""
  ].join("\n");
}

function renderCloudflareProfileFragment(): string {
  return [
    "[mcp_servers.cloudflare-api]",
    'url = "https://mcp.cloudflare.com/mcp"',
    ""
  ].join("\n");
}

function renderStatuslineProfileFragment(): string {
  return [
    "[tui]",
    'notification_condition = "always"',
    'status_line = ["model-with-reasoning", "project-root", "git-branch", "context-remaining", "current-dir", "five-hour-limit", "weekly-limit", "context-window-size", "used-tokens"]',
    'terminal_title = ["project", "spinner"]',
    ""
  ].join("\n");
}

function renderOverlayTemplate(template: string, packs: FrameworkGuidancePacks): string {
  return renderTemplate(template, {
    ENABLED_PACK_OVERLAY_NOTES: enabledPackPolicyNotes(packs),
    ENABLED_PACK_SKILL_SELECTIONS: enabledPackSkillSelections(packs)
  });
}

function renderTemplate(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (body, [key, value]) => body.replaceAll(`{{${key}}}`, value),
    template
  );
}

function enabledPackEntries(
  packs: FrameworkGuidancePacks
): Array<[string, (typeof CORE_PACK_MANIFEST.optionalPacks)[string]]> {
  return Object.entries(CORE_PACK_MANIFEST.optionalPacks)
    .filter(([, entry]) => Boolean(entry.configKey && packs[entry.configKey]));
}

function enabledPackPolicyNotes(packs: FrameworkGuidancePacks): string {
  return enabledPackEntries(packs)
    .map(([, entry]) => entry.policyNote ?? entry.routerNote ?? entry.overlayNote ?? "")
    .filter((note) => note.length > 0)
    .join("\n");
}

function enabledPackSkillSelections(packs: FrameworkGuidancePacks): string {
  return enabledPackEntries(packs)
    .flatMap(([pack, entry]) => {
      const skills = entry.skills ?? (
        entry.skillName && entry.skillPath
          ? [{ name: entry.skillName, path: entry.skillPath }]
          : []
      );
      return skills.flatMap((skill) => {
        const taskKinds = Array.isArray(skill.taskKinds) ? skill.taskKinds : [];
        if (taskKinds.length === 0) {
          return [];
        }

        return [`- ${pack} task picks: ${taskKinds.join(", ")} -> ${skill.name}`];
      });
    })
    .join("\n");
}
