import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const NAME = "Sane";
export const SANE_ROUTER_SKILL_NAME = "sane-router";
export const SANE_CAVEMAN_PACK_SKILL_NAME = "sane-caveman";
export const SANE_CAVEMEM_PACK_SKILL_NAME = "sane-cavemem";
export const SANE_RTK_PACK_SKILL_NAME = "sane-rtk";
export const SANE_FRONTEND_CRAFT_PACK_SKILL_NAME = "sane-frontend-craft";
export const SANE_FRONTEND_REVIEW_PACK_SKILL_NAME = "sane-frontend-review";
export const SANE_AGENT_NAME = "sane-agent";
export const SANE_REVIEWER_AGENT_NAME = "sane-reviewer";
export const SANE_EXPLORER_AGENT_NAME = "sane-explorer";
export const SANE_GLOBAL_AGENTS_BEGIN = "<!-- sane:global-agents:start -->";
export const SANE_GLOBAL_AGENTS_END = "<!-- sane:global-agents:end -->";
export const SANE_REPO_AGENTS_BEGIN = "<!-- sane:repo-agents:start -->";
export const SANE_REPO_AGENTS_END = "<!-- sane:repo-agents:end -->";

export interface GuidancePacks {
  caveman: boolean;
  cavemem: boolean;
  rtk: boolean;
  frontendCraft: boolean;
}

export interface ModelRoleGuidance {
  coordinatorModel: string;
  coordinatorReasoning: string;
  sidecarModel: string;
  sidecarReasoning: string;
  verifierModel: string;
  verifierReasoning: string;
}

export interface ModelRoutingGuidance extends ModelRoleGuidance {
  executionModel: string;
  executionReasoning: string;
  realtimeModel: string;
  realtimeReasoning: string;
}

export interface PackAssetUpstream {
  name: string;
  url: string;
  ref: string | null;
  role?: string;
  path?: string | null;
  license?: string | null;
}

export type PackAssetProvenance =
  | {
      kind: "upstream" | "derived";
      note: string;
      upstreams: PackAssetUpstream[];
      updateStrategy: "pinned-manual" | "manual-curated";
    }
  | {
      kind: "internal";
      note: string;
      updateStrategy: "manual-curated";
    };

export interface PackAssetSourceProvenance {
  repo: string;
  path: string;
  ref: string;
  license: string;
  updateStrategy: string;
}

interface CorePackAssetSources {
  style: string;
  items: Record<string, PackAssetSourceProvenance>;
}

interface CorePackManifestEntry {
  skillName?: string;
  skillPath?: string;
  skills?: Array<{
    name: string;
    path: string;
    taskKinds?: string[];
  }>;
  routerNote: string;
  overlayNote: string;
  provenance: PackAssetProvenance;
}

interface CorePackManifest {
  name: string;
  assets: {
    routerSkill: string;
    globalOverlay: string;
    repoOverlay: string;
    agents: {
      primary: string;
      reviewer: string;
      explorer: string;
    };
    opencodeAgents: {
      primary: string;
      reviewer: string;
      explorer: string;
    };
  };
  optionalPacks: Record<
    string,
    CorePackManifestEntry
  >;
  assetSources?: CorePackAssetSources;
}

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SRC_DIR, "../../..");
const CORE_PACK_ROOT = resolve(REPO_ROOT, "packs/core");
const CORE_PACK_MANIFEST = readCorePackManifest();

export function createDefaultGuidancePacks(): GuidancePacks {
  return {
    caveman: false,
    cavemem: false,
    rtk: false,
    frontendCraft: false
  };
}

export function createSaneRouterSkill(packs: GuidancePacks, roles: ModelRoutingGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.routerSkill, {
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
    ENABLED_PACK_ROUTER_NOTES: enabledPackEntries(packs)
      .map(([, entry]) => entry.routerNote)
      .join("\n"),
    ENABLED_PACK_SKILL_SELECTIONS: enabledPackSkillSelections(packs)
  });
}

export function createSaneGlobalAgentsOverlay(
  packs: GuidancePacks,
  roles: ModelRoutingGuidance
): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.globalOverlay, {
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
    ENABLED_PACK_OVERLAY_NOTES: enabledPackEntries(packs)
      .map(([, entry]) => entry.overlayNote)
      .join("\n"),
    ENABLED_PACK_SKILL_SELECTIONS: enabledPackSkillSelections(packs)
  });
}

export function optionalPackSkillName(pack: string): string | undefined {
  return optionalPackSkills(pack)[0]?.name;
}

export function createOptionalPackSkill(pack: string): string | undefined {
  return createOptionalPackSkills(pack)[0]?.content;
}

export function optionalPackSkillNames(pack: string): string[] {
  return optionalPackSkills(pack).map((skill) => skill.name);
}

export function optionalPackSkills(pack: string): Array<{ name: string; path: string; taskKinds?: string[] }> {
  const entry = CORE_PACK_MANIFEST.optionalPacks[pack];
  if (!entry) {
    return [];
  }

  if (entry.skills && entry.skills.length > 0) {
    return entry.skills;
  }

  if (entry.skillName && entry.skillPath) {
    return [{ name: entry.skillName, path: entry.skillPath }];
  }

  return [];
}

export function optionalPackSkillSelections(pack: string): Array<{ name: string; taskKinds: string[] }> {
  return optionalPackSkills(pack).map((skill) => ({
    name: skill.name,
    taskKinds: Array.isArray(skill.taskKinds) ? skill.taskKinds : []
  }));
}

export function createOptionalPackSkills(pack: string): Array<{ name: string; content: string }> {
  return optionalPackSkills(pack).map((skill) => ({
    name: skill.name,
    content: readCoreAsset(skill.path)
  }));
}

export function optionalPackProvenance(pack: string): PackAssetProvenance | undefined {
  return CORE_PACK_MANIFEST.optionalPacks[pack]?.provenance;
}

export function corePackAssetSourceProvenance(path: string): PackAssetSourceProvenance | undefined {
  return CORE_PACK_MANIFEST.assetSources?.items[path];
}

export function corePackAssetSourceProvenanceStyle(): string | undefined {
  return CORE_PACK_MANIFEST.assetSources?.style;
}

export function createSaneReviewerAgentTemplate(roles: ModelRoleGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.reviewer, {
    MODEL: roles.verifierModel,
    MODEL_REASONING: roles.verifierReasoning
  });
}

export function createSaneAgentTemplate(roles: ModelRoleGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.primary, {
    MODEL: roles.coordinatorModel,
    MODEL_REASONING: roles.coordinatorReasoning
  });
}

export function createSaneExplorerAgentTemplate(roles: ModelRoleGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.explorer, {
    MODEL: roles.sidecarModel,
    MODEL_REASONING: roles.sidecarReasoning
  });
}

export function createSaneOpencodeAgentTemplate(roles: ModelRoleGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.opencodeAgents.primary, {
    MODEL: roles.coordinatorModel
  });
}

export function createSaneOpencodeReviewerAgentTemplate(roles: ModelRoleGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.opencodeAgents.reviewer, {
    MODEL: roles.verifierModel
  });
}

export function createSaneOpencodeExplorerAgentTemplate(roles: ModelRoleGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.opencodeAgents.explorer, {
    MODEL: roles.sidecarModel
  });
}

function readCorePackManifest(): CorePackManifest {
  return JSON.parse(readCoreAsset("manifest.json")) as CorePackManifest;
}

function readCoreAsset(path: string): string {
  return readFileSync(resolve(CORE_PACK_ROOT, path), "utf8");
}

function renderCoreAsset(path: string, replacements: Record<string, string>): string {
  return renderTemplate(readCoreAsset(path), replacements);
}

function renderTemplate(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (body, [key, value]) => body.replaceAll(`{{${key}}}`, value),
    template
  );
}

function enabledPackEntries(
  packs: GuidancePacks
): Array<[string, CorePackManifest["optionalPacks"][string]]> {
  return Object.entries(CORE_PACK_MANIFEST.optionalPacks).filter(([key]) => isPackEnabled(key, packs));
}

function enabledPackSkillSelections(packs: GuidancePacks): string {
  return enabledPackEntries(packs)
    .flatMap(([pack, entry]) =>
      optionalPackSkills(pack).flatMap((skill) => {
        const taskKinds = Array.isArray(skill.taskKinds) ? skill.taskKinds : [];
        if (taskKinds.length === 0) {
          return [];
        }

        return [`- ${pack} task picks: ${taskKinds.join(", ")} -> ${skill.name}`];
      })
    )
    .join("\n");
}

function isPackEnabled(pack: string, packs: GuidancePacks): boolean {
  switch (pack) {
    case "caveman":
      return packs.caveman;
    case "cavemem":
      return packs.cavemem;
    case "rtk":
      return packs.rtk;
    case "frontend-craft":
      return packs.frontendCraft;
    default:
      return false;
  }
}
