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

export interface CorePackAssetSources {
  style: string;
  items: Record<string, PackAssetSourceProvenance>;
}

export type CorePackAssetOwnershipMode = "source-managed" | "generated-managed";
export type CorePackAssetWriteMode = "overwrite";

export interface CorePackAssetOwnership {
  owner: "sane";
  mode: CorePackAssetOwnershipMode;
  writeMode?: CorePackAssetWriteMode;
}

export interface CorePackAssetOwnerships {
  style: string;
  items: Record<string, CorePackAssetOwnership>;
}

export interface CorePackManifestEntry {
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

export interface CorePackManifest {
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
  optionalPacks: Record<string, CorePackManifestEntry>;
  assetSources?: CorePackAssetSources;
  assetOwnership?: CorePackAssetOwnerships;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCorePackManifest(content: string): CorePackManifest {
  const parsed = JSON.parse(content) as unknown;
  const root = expectRecord(parsed, "core pack manifest");
  const assets = parseManifestAssets(root.assets);
  const optionalPacks = parseOptionalPacks(root.optionalPacks);
  const assetSources = root.assetSources === undefined
    ? undefined
    : parseAssetSources(root.assetSources);
  const assetOwnership = root.assetOwnership === undefined
    ? undefined
    : parseAssetOwnership(root.assetOwnership);

  return {
    name: expectString(root.name, "core pack manifest name"),
    assets,
    optionalPacks,
    ...(assetSources ? { assetSources } : {}),
    ...(assetOwnership ? { assetOwnership } : {})
  };
}

function parseManifestAssets(value: unknown): CorePackManifest["assets"] {
  const assets = expectRecord(value, "core pack manifest assets");
  const agents = expectRecord(assets.agents, "core pack manifest agent assets");

  return {
    routerSkill: expectString(assets.routerSkill, "core pack manifest routerSkill"),
    bootstrapResearchSkill: expectString(
      assets.bootstrapResearchSkill,
      "core pack manifest bootstrapResearchSkill"
    ),
    agentLanesSkill: expectString(assets.agentLanesSkill, "core pack manifest agentLanesSkill"),
    outcomeContinuationSkill: expectString(
      assets.outcomeContinuationSkill,
      "core pack manifest outcomeContinuationSkill"
    ),
    continueSkill: expectString(assets.continueSkill, "core pack manifest continueSkill"),
    globalOverlay: expectString(assets.globalOverlay, "core pack manifest globalOverlay"),
    repoOverlay: expectString(assets.repoOverlay, "core pack manifest repoOverlay"),
    agents: {
      primary: expectString(agents.primary, "core pack manifest primary agent"),
      reviewer: expectString(agents.reviewer, "core pack manifest reviewer agent"),
      explorer: expectString(agents.explorer, "core pack manifest explorer agent"),
      implementation: expectString(agents.implementation, "core pack manifest implementation agent"),
      realtime: expectString(agents.realtime, "core pack manifest realtime agent")
    }
  };
}

function parseOptionalPacks(value: unknown): Record<string, CorePackManifestEntry> {
  const packs = expectRecord(value, "core pack manifest optionalPacks");
  return Object.fromEntries(
    Object.entries(packs).map(([name, entry]) => [name, parseOptionalPackEntry(name, entry)])
  );
}

function parseOptionalPackEntry(name: string, value: unknown): CorePackManifestEntry {
  const entry = expectRecord(value, `optional pack ${name}`);
  const skills = parseOptionalPackSkills(name, entry.skills);
  const skillName = optionalString(entry.skillName, `optional pack ${name} skillName`);
  const skillPath = optionalString(entry.skillPath, `optional pack ${name} skillPath`);

  if (!skills && Boolean(skillName) !== Boolean(skillPath)) {
    throw new Error(`optional pack ${name} must define both skillName and skillPath`);
  }

  return {
    ...(entry.configKey === undefined
      ? {}
      : { configKey: expectString(entry.configKey, `optional pack ${name} configKey`) }),
    ...(skillName ? { skillName } : {}),
    ...(skillPath ? { skillPath } : {}),
    ...(skills ? { skills } : {}),
    ...(entry.policyNote === undefined
      ? {}
      : { policyNote: expectString(entry.policyNote, `optional pack ${name} policyNote`) }),
    ...(entry.continuityNote === undefined
      ? {}
      : { continuityNote: expectString(entry.continuityNote, `optional pack ${name} continuityNote`) }),
    ...(entry.routerNote === undefined
      ? {}
      : { routerNote: expectString(entry.routerNote, `optional pack ${name} routerNote`) }),
    ...(entry.overlayNote === undefined
      ? {}
      : { overlayNote: expectString(entry.overlayNote, `optional pack ${name} overlayNote`) }),
    provenance: parseProvenance(entry.provenance, `optional pack ${name} provenance`)
  };
}

function parseOptionalPackSkills(
  packName: string,
  value: unknown
): CorePackManifestEntry["skills"] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`optional pack ${packName} skills must be array`);
  }

  return value.map((skill, index) => {
    const record = expectRecord(skill, `optional pack ${packName} skill ${index}`);
    const resources = record.resources === undefined
      ? undefined
      : parseSkillResources(packName, index, record.resources);
    return {
      name: expectString(record.name, `optional pack ${packName} skill ${index} name`),
      path: expectString(record.path, `optional pack ${packName} skill ${index} path`),
      ...(record.taskKinds === undefined
        ? {}
        : { taskKinds: expectStringArray(record.taskKinds, `optional pack ${packName} skill ${index} taskKinds`) }),
      ...(resources ? { resources } : {})
    };
  });
}

function parseSkillResources(
  packName: string,
  skillIndex: number,
  value: unknown
): Array<{ source: string; target: string }> {
  if (!Array.isArray(value)) {
    throw new Error(`optional pack ${packName} skill ${skillIndex} resources must be array`);
  }

  return value.map((resource, index) => {
    const record = expectRecord(resource, `optional pack ${packName} skill ${skillIndex} resource ${index}`);
    return {
      source: expectString(record.source, `optional pack ${packName} skill ${skillIndex} resource ${index} source`),
      target: expectString(record.target, `optional pack ${packName} skill ${skillIndex} resource ${index} target`)
    };
  });
}

function parseProvenance(value: unknown, label: string): PackAssetProvenance {
  const provenance = expectRecord(value, label);
  const kind = expectString(provenance.kind, `${label} kind`);
  const note = expectString(provenance.note, `${label} note`);
  const updateStrategy = expectString(provenance.updateStrategy, `${label} updateStrategy`);

  if (kind === "internal") {
    if (updateStrategy !== "manual-curated") {
      throw new Error(`${label} internal updateStrategy must be manual-curated`);
    }
    return {
      kind,
      note,
      updateStrategy
    };
  }

  if (kind !== "upstream" && kind !== "derived") {
    throw new Error(`${label} kind must be upstream, derived, or internal`);
  }
  if (updateStrategy !== "pinned-manual" && updateStrategy !== "manual-curated") {
    throw new Error(`${label} updateStrategy must be pinned-manual or manual-curated`);
  }
  if (!Array.isArray(provenance.upstreams)) {
    throw new Error(`${label} upstreams must be array`);
  }

  return {
    kind,
    note,
    updateStrategy,
    upstreams: provenance.upstreams.map((upstream, index) =>
      parseUpstream(upstream, `${label} upstream ${index}`)
    )
  };
}

function parseUpstream(value: unknown, label: string): PackAssetUpstream {
  const upstream = expectRecord(value, label);
  return {
    name: expectString(upstream.name, `${label} name`),
    url: expectString(upstream.url, `${label} url`),
    ref: upstream.ref === null ? null : expectString(upstream.ref, `${label} ref`),
    ...(upstream.role === undefined ? {} : { role: expectString(upstream.role, `${label} role`) }),
    ...(upstream.path === undefined
      ? {}
      : { path: upstream.path === null ? null : expectString(upstream.path, `${label} path`) }),
    ...(upstream.license === undefined
      ? {}
      : { license: upstream.license === null ? null : expectString(upstream.license, `${label} license`) })
  };
}

function parseAssetSources(value: unknown): CorePackAssetSources {
  const sources = expectRecord(value, "core pack manifest assetSources");
  const items = expectRecord(sources.items, "core pack manifest assetSources items");
  return {
    style: expectString(sources.style, "core pack manifest assetSources style"),
    items: Object.fromEntries(
      Object.entries(items).map(([path, source]) => [path, parseAssetSource(path, source)])
    )
  };
}

function parseAssetSource(path: string, value: unknown): PackAssetSourceProvenance {
  const source = expectRecord(value, `core pack asset source ${path}`);
  return {
    repo: expectString(source.repo, `core pack asset source ${path} repo`),
    path: expectString(source.path, `core pack asset source ${path} path`),
    ref: expectString(source.ref, `core pack asset source ${path} ref`),
    license: expectString(source.license, `core pack asset source ${path} license`),
    updateStrategy: expectString(
      source.updateStrategy,
      `core pack asset source ${path} updateStrategy`
    )
  };
}

function parseAssetOwnership(value: unknown): CorePackAssetOwnerships {
  const ownership = expectRecord(value, "core pack manifest assetOwnership");
  const items = expectRecord(ownership.items, "core pack manifest assetOwnership items");
  return {
    style: expectString(ownership.style, "core pack manifest assetOwnership style"),
    items: Object.fromEntries(
      Object.entries(items).map(([path, item]) => [path, parseAssetOwnershipItem(path, item)])
    )
  };
}

function parseAssetOwnershipItem(path: string, value: unknown): CorePackAssetOwnership {
  const ownership = expectRecord(value, `core pack asset ownership ${path}`);
  const owner = expectString(ownership.owner, `core pack asset ownership ${path} owner`);
  const mode = expectString(ownership.mode, `core pack asset ownership ${path} mode`);
  const writeMode = ownership.writeMode === undefined
    ? undefined
    : expectString(ownership.writeMode, `core pack asset ownership ${path} writeMode`);

  if (owner !== "sane") {
    throw new Error(`core pack asset ownership ${path} owner must be sane`);
  }
  if (mode !== "source-managed" && mode !== "generated-managed") {
    throw new Error(`core pack asset ownership ${path} mode must be source-managed or generated-managed`);
  }
  if (mode === "generated-managed") {
    if (writeMode !== "overwrite") {
      throw new Error(`core pack asset ownership ${path} generated-managed writeMode must be overwrite`);
    }
    return { owner, mode, writeMode };
  }
  if (writeMode !== undefined) {
    throw new Error(`core pack asset ownership ${path} source-managed must not define writeMode`);
  }
  return { owner, mode };
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be object`);
  }
  return value;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be non-empty string`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : expectString(value, label);
}

function expectStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${label} must be string array`);
  }
  return value;
}
