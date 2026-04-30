import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const NAME = "Sane";
export const SANE_ROUTER_SKILL_NAME = "sane-router";
export const SANE_BOOTSTRAP_RESEARCH_SKILL_NAME = "sane-bootstrap-research";
export const SANE_AGENT_LANES_SKILL_NAME = "sane-agent-lanes";
export const SANE_OUTCOME_CONTINUATION_SKILL_NAME = "sane-outcome-continuation";
export const SANE_CONTINUE_SKILL_NAME = "continue";
export const SANE_CAVEMAN_PACK_SKILL_NAME = "sane-caveman";
export const SANE_FRONTEND_CRAFT_PACK_SKILL_NAME = "sane-frontend-craft";
export const SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME = "sane-frontend-visual-assets";
export const SANE_FRONTEND_REVIEW_PACK_SKILL_NAME = "sane-frontend-review";
export const SANE_DOCS_WRITING_PACK_SKILL_NAME = "sane-docs-writing";
export const SANE_AGENT_NAME = "sane-agent";
export const SANE_REVIEWER_AGENT_NAME = "sane-reviewer";
export const SANE_EXPLORER_AGENT_NAME = "sane-explorer";
export const SANE_IMPLEMENTATION_AGENT_NAME = "sane-implementation";
export const SANE_REALTIME_AGENT_NAME = "sane-realtime";
export const SANE_GLOBAL_AGENTS_BEGIN = "<!-- sane:global-agents:start -->";
export const SANE_GLOBAL_AGENTS_END = "<!-- sane:global-agents:end -->";
export const SANE_REPO_AGENTS_BEGIN = "<!-- sane:repo-agents:start -->";
export const SANE_REPO_AGENTS_END = "<!-- sane:repo-agents:end -->";
export type OptionalPackName = string;
export interface OptionalPackMetadata {
  name: OptionalPackName;
  configKey: string;
}

export interface GuidancePacks {
  [configKey: string]: boolean;
  caveman: boolean;
  rtk: boolean;
  frontendCraft: boolean;
  docsCraft: boolean;
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
  configKey?: string;
  skillName?: string;
  skillPath?: string;
  skills?: Array<{
    name: string;
    path: string;
    taskKinds?: string[];
    resources?: Array<{
      source: string;
      target: string;
    }>;
  }>;
  policyNote?: string;
  continuityNote?: string;
  routerNote?: string;
  overlayNote?: string;
  provenance: PackAssetProvenance;
}

interface OptionalPackSkillAsset {
  name: string;
  path: string;
  taskKinds?: string[];
  resources?: Array<{
    source: string;
    target: string;
  }>;
}

interface CorePackManifest {
  name: string;
  assets: {
    routerSkill: string;
    bootstrapResearchSkill: string;
    agentLanesSkill: string;
    outcomeContinuationSkill: string;
    continueSkill: string;
    globalOverlay: string;
    repoOverlay: string;
    agents: {
      primary: string;
      reviewer: string;
      explorer: string;
      implementation: string;
      realtime: string;
    };
  };
  optionalPacks: Record<
    string,
    CorePackManifestEntry
  >;
  assetSources?: CorePackAssetSources;
}

const REPO_ROOT = discoverRepoRoot(candidateRepoRootStarts());
const CORE_PACK_ROOT = resolve(REPO_ROOT, "packs/core");
const CORE_PACK_MANIFEST = readCorePackManifest();
export const OPTIONAL_PACK_METADATA: OptionalPackMetadata[] = optionalPackNames().map((name) =>
  optionalPackMetadata(name)
);

export function createDefaultGuidancePacks(): GuidancePacks {
  return {
    caveman: false,
    rtk: false,
    frontendCraft: false,
    docsCraft: false
  };
}

export function optionalPackNames(): OptionalPackName[] {
  return Object.keys(CORE_PACK_MANIFEST.optionalPacks);
}

export function optionalPackConfigKey(pack: OptionalPackName): string {
  return optionalPackMetadata(pack).configKey;
}

export function isOptionalPackEnabled(pack: OptionalPackName, packs: GuidancePacks): boolean {
  return packs[optionalPackConfigKey(pack)];
}

export function enabledOptionalPackNames(packs: GuidancePacks): OptionalPackName[] {
  return optionalPackNames().filter((pack) => isOptionalPackEnabled(pack, packs));
}

export function disabledOptionalPackNames(packs: GuidancePacks): OptionalPackName[] {
  return optionalPackNames().filter((pack) => !isOptionalPackEnabled(pack, packs));
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
    ENABLED_PACK_ROUTER_NOTES: enabledPackPolicyNotes(packs),
    ENABLED_PACK_SKILL_SELECTIONS: enabledPackSkillSelections(packs)
  });
}

export function createSaneContinueSkill(): string {
  return readCoreAsset(CORE_PACK_MANIFEST.assets.continueSkill);
}

export function createSaneBootstrapResearchSkill(): string {
  return readCoreAsset(CORE_PACK_MANIFEST.assets.bootstrapResearchSkill);
}

export function createSaneAgentLanesSkill(): string {
  return readCoreAsset(CORE_PACK_MANIFEST.assets.agentLanesSkill);
}

export function createSaneOutcomeContinuationSkill(): string {
  return readCoreAsset(CORE_PACK_MANIFEST.assets.outcomeContinuationSkill);
}

export function createCoreSkills(
  packs: GuidancePacks = createDefaultGuidancePacks(),
  roles: ModelRoutingGuidance = {
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
  }
): Array<{
  name: string;
  content: string;
  resources: Array<{ path: string; content: string }>;
}> {
  return [
    {
      name: SANE_ROUTER_SKILL_NAME,
      content: createSaneRouterSkill(packs, roles),
      resources: []
    },
    {
      name: SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
      content: createSaneBootstrapResearchSkill(),
      resources: []
    },
    {
      name: SANE_AGENT_LANES_SKILL_NAME,
      content: createSaneAgentLanesSkill(),
      resources: []
    },
    {
      name: SANE_OUTCOME_CONTINUATION_SKILL_NAME,
      content: createSaneOutcomeContinuationSkill(),
      resources: []
    },
    {
      name: SANE_CONTINUE_SKILL_NAME,
      content: createSaneContinueSkill(),
      resources: []
    }
  ];
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
    ENABLED_PACK_OVERLAY_NOTES: enabledPackPolicyNotes(packs),
    ENABLED_PACK_SKILL_SELECTIONS: enabledPackSkillSelections(packs)
  });
}

export function createSaneRepoAgentsOverlay(
  packs: GuidancePacks,
  roles: ModelRoutingGuidance
): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.repoOverlay, {
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
    ENABLED_PACK_OVERLAY_NOTES: enabledPackPolicyNotes(packs),
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

export function optionalPackSkills(pack: string): OptionalPackSkillAsset[] {
  const entry = optionalPackManifestEntry(pack);
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

export function createOptionalPackSkills(pack: string): Array<{
  name: string;
  content: string;
  resources: Array<{ path: string; content: string }>;
}> {
  return optionalPackSkills(pack).map((skill) => ({
    name: skill.name,
    content: readCoreAsset(skill.path),
    resources: (skill.resources ?? []).map((resource) => ({
      path: resource.target,
      content: readCoreAsset(resource.source)
    }))
  }));
}

export function optionalPackProvenance(pack: string): PackAssetProvenance | undefined {
  return optionalPackManifestEntry(pack)?.provenance;
}

export function optionalPackPolicyLine(pack: string): string | undefined {
  const entry = optionalPackManifestEntry(pack);
  if (!entry) {
    return undefined;
  }

  const note = packPolicyNote(entry).trim();
  return note.startsWith("- ") ? note.slice(2) : note;
}

export function enabledOptionalPackPolicyLines(packs: GuidancePacks): string[] {
  return enabledPackEntries(packs)
    .map(([pack]) => optionalPackPolicyLine(pack))
    .filter((line): line is string => Boolean(line));
}

export function optionalPackContinuityLine(pack: string): string | undefined {
  const entry = optionalPackManifestEntry(pack);
  if (!entry) {
    return undefined;
  }

  return entry.continuityNote ?? optionalPackPolicyLine(pack);
}

export function enabledOptionalPackContinuityLines(packs: GuidancePacks): string[] {
  return enabledPackEntries(packs)
    .map(([pack]) => optionalPackContinuityLine(pack))
    .filter((line): line is string => Boolean(line));
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
    MODEL_REASONING: roles.verifierReasoning,
    ENABLED_PACK_AGENT_NOTES: ""
  });
}

export function createSaneReviewerAgentTemplateWithPacks(
  roles: ModelRoleGuidance,
  packs: GuidancePacks
): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.reviewer, {
    MODEL: roles.verifierModel,
    MODEL_REASONING: roles.verifierReasoning,
    ENABLED_PACK_AGENT_NOTES: enabledPackAgentNotes(packs)
  });
}

export function createSaneAgentTemplate(roles: ModelRoleGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.primary, {
    MODEL: roles.coordinatorModel,
    MODEL_REASONING: roles.coordinatorReasoning,
    ENABLED_PACK_AGENT_NOTES: ""
  });
}

export function createSaneAgentTemplateWithPacks(
  roles: ModelRoleGuidance,
  packs: GuidancePacks
): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.primary, {
    MODEL: roles.coordinatorModel,
    MODEL_REASONING: roles.coordinatorReasoning,
    ENABLED_PACK_AGENT_NOTES: enabledPackAgentNotes(packs)
  });
}

export function createSaneExplorerAgentTemplate(roles: ModelRoleGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.explorer, {
    MODEL: roles.sidecarModel,
    MODEL_REASONING: roles.sidecarReasoning,
    ENABLED_PACK_AGENT_NOTES: ""
  });
}

export function createSaneExplorerAgentTemplateWithPacks(
  roles: ModelRoleGuidance,
  packs: GuidancePacks
): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.explorer, {
    MODEL: roles.sidecarModel,
    MODEL_REASONING: roles.sidecarReasoning,
    ENABLED_PACK_AGENT_NOTES: enabledPackAgentNotes(packs)
  });
}

export function createSaneImplementationAgentTemplate(roles: ModelRoutingGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.implementation, {
    MODEL: roles.executionModel,
    MODEL_REASONING: roles.executionReasoning,
    ENABLED_PACK_AGENT_NOTES: ""
  });
}

export function createSaneImplementationAgentTemplateWithPacks(
  roles: ModelRoutingGuidance,
  packs: GuidancePacks
): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.implementation, {
    MODEL: roles.executionModel,
    MODEL_REASONING: roles.executionReasoning,
    ENABLED_PACK_AGENT_NOTES: enabledPackAgentNotes(packs)
  });
}

export function createSaneRealtimeAgentTemplate(roles: ModelRoutingGuidance): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.realtime, {
    MODEL: roles.realtimeModel,
    MODEL_REASONING: roles.realtimeReasoning,
    ENABLED_PACK_AGENT_NOTES: ""
  });
}

export function createSaneRealtimeAgentTemplateWithPacks(
  roles: ModelRoutingGuidance,
  packs: GuidancePacks
): string {
  return renderCoreAsset(CORE_PACK_MANIFEST.assets.agents.realtime, {
    MODEL: roles.realtimeModel,
    MODEL_REASONING: roles.realtimeReasoning,
    ENABLED_PACK_AGENT_NOTES: enabledPackAgentNotes(packs)
  });
}

function readCorePackManifest(): CorePackManifest {
  return JSON.parse(readCoreAsset("manifest.json")) as CorePackManifest;
}

function candidateRepoRootStarts(): string[] {
  const starts = new Set<string>();

  if (process.argv[1]) {
    starts.add(dirname(resolve(process.argv[1])));
  }

  try {
    starts.add(dirname(fileURLToPath(import.meta.url)));
  } catch {
    if (typeof __dirname === "string") {
      starts.add(__dirname);
    }
  }

  return [...starts];
}

function discoverRepoRoot(startDirs: string[]): string {
  for (const startDir of startDirs) {
    let current = startDir;

    while (true) {
      if (existsSync(resolve(current, "packs/core/manifest.json"))) {
        return current;
      }

      const parent = resolve(current, "..");
      if (parent === current) {
        break;
      }

      current = parent;
    }
  }

  throw new Error(`unable to locate repo root from ${startDirs.join(", ")}`);
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
  return optionalPackNames()
    .filter((pack) => isOptionalPackEnabled(pack, packs))
    .map((pack) => [pack, optionalPackManifestEntry(pack)!]);
}

function enabledPackSkillSelections(packs: GuidancePacks): string {
  return enabledPackEntries(packs)
    .flatMap(([pack]) =>
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

function packPolicyNote(entry: CorePackManifestEntry): string {
  return entry.policyNote ?? entry.routerNote ?? entry.overlayNote ?? "";
}

function enabledPackPolicyNotes(packs: GuidancePacks): string {
  return enabledPackEntries(packs)
    .map(([, entry]) => packPolicyNote(entry))
    .filter((note) => note.length > 0)
    .join("\n");
}

function enabledPackAgentNotes(packs: GuidancePacks): string {
  return enabledPackPolicyNotes(packs);
}

function optionalPackMetadata(pack: OptionalPackName): OptionalPackMetadata {
  const entry = optionalPackManifestEntry(pack);
  if (!entry?.configKey) {
    throw new Error(`missing configKey for optional pack ${pack}`);
  }

  return {
    name: pack,
    configKey: entry.configKey
  };
}

function optionalPackManifestEntry(pack: string): CorePackManifestEntry | undefined {
  return CORE_PACK_MANIFEST.optionalPacks[pack];
}
