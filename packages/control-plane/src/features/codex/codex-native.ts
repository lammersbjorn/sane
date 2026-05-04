import {
  createRecommendedLocalConfig,
  detectCodexEnvironment,
} from "@sane/config";
import {
  InventoryScope,
  InventoryStatus,
  OperationKind,
  OperationResult,
  removeManagedBlock,
  upsertManagedBlock
} from "@sane/control-plane/core.js";
import {
  disabledOptionalPackNames,
  enabledOptionalPackNames,
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_CONTINUE_SKILL_NAME,
  SANE_OUTCOME_CONTINUATION_SKILL_NAME,
  SANE_ROUTER_SKILL_NAME,
  SANE_GLOBAL_AGENTS_BEGIN,
  SANE_GLOBAL_AGENTS_END,
  SANE_REPO_AGENTS_BEGIN,
  SANE_REPO_AGENTS_END,
  createCoreSkills,
  createDefaultGuidancePacks,
  createOptionalPackSkills,
  createSaneGlobalAgentsOverlay,
  createSaneRepoAgentsOverlay,
  optionalPackConfigKey,
  optionalPackNames,
  optionalPackSkillNames,
  type OptionalPackName,
  type GuidancePacks,
  type ModelRoutingGuidance
} from "@sane/framework-assets";
import { type CodexPaths, type ProjectPaths } from "../../platform.js";
import { writeAtomicTextFile } from "@sane/state";

import { existsSync, mkdirSync, readFileSync, rmSync, rmSync as removeSync } from "node:fs";
import { dirname, join } from "node:path";

import { recommendedLocalConfigFromEnvironment } from "../../local-config.js";

const SKILL_OWNERSHIP_MARKER_FILE = ".sane-owned";
const SKILL_OWNERSHIP_MARKER_CONTENT = "managed-by: sane\n";
export function exportUserSkills(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  return exportSkillsTarget(
    paths,
    codexPaths,
    codexPaths.userSkillsDir,
    OperationKind.ExportUserSkills,
    "user-skills",
    "export user-skills"
  );
}

export function exportRepoSkills(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  return exportSkillsTarget(
    paths,
    codexPaths,
    paths.repoSkillsDir,
    OperationKind.ExportRepoSkills,
    "repo-skills",
    "export repo-skills"
  );
}

export function exportGlobalAgents(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  return exportAgentsTarget(
    paths,
    codexPaths,
    codexPaths.globalAgentsMd,
    SANE_GLOBAL_AGENTS_BEGIN,
    SANE_GLOBAL_AGENTS_END,
    OperationKind.ExportGlobalAgents,
    "global-agents",
    "export global-agents"
  );
}

export function exportRepoAgents(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  return exportAgentsTarget(
    paths,
    codexPaths,
    paths.repoAgentsMd,
    SANE_REPO_AGENTS_BEGIN,
    SANE_REPO_AGENTS_END,
    OperationKind.ExportRepoAgents,
    "repo-agents",
    "export repo-agents"
  );
}

export function uninstallUserSkills(codexPaths: CodexPaths): OperationResult {
  return uninstallSkillsTarget(
    codexPaths.userSkillsDir,
    OperationKind.UninstallUserSkills,
    "user-skills",
    false,
    "uninstall user-skills"
  );
}

export function uninstallRepoSkills(paths: ProjectPaths): OperationResult {
  return uninstallSkillsTarget(
    paths.repoSkillsDir,
    OperationKind.UninstallRepoSkills,
    "repo-skills",
    true,
    "uninstall repo-skills"
  );
}

export function uninstallGlobalAgents(codexPaths: CodexPaths): OperationResult {
  return uninstallAgentsTarget(
    codexPaths.globalAgentsMd,
    SANE_GLOBAL_AGENTS_BEGIN,
    SANE_GLOBAL_AGENTS_END,
    OperationKind.UninstallGlobalAgents,
    "global-agents",
    false,
    "uninstall global-agents"
  );
}

export function uninstallRepoAgents(paths: ProjectPaths): OperationResult {
  return uninstallAgentsTarget(
    paths.repoAgentsMd,
    SANE_REPO_AGENTS_BEGIN,
    SANE_REPO_AGENTS_END,
    OperationKind.UninstallRepoAgents,
    "repo-agents",
    true,
    "uninstall repo-agents"
  );
}

export function inspectCodexSkillsAndAgents(paths: ProjectPaths, codexPaths: CodexPaths) {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const expectedCoreSkills = createCoreSkills(packs, roles);
  const expectedGlobalAgents = createSaneGlobalAgentsOverlay(packs, roles);
  const expectedRepoAgents = createSaneRepoAgentsOverlay(packs, roles);

  const userSkillPath = join(codexPaths.userSkillsDir, SANE_ROUTER_SKILL_NAME, "SKILL.md");
  const repoSkillPath = join(paths.repoSkillsDir, SANE_ROUTER_SKILL_NAME, "SKILL.md");

  return [
    {
      name: "user-skills",
      scope: InventoryScope.CodexNative,
      status: coreSkillsTargetStatus(codexPaths.userSkillsDir, expectedCoreSkills, false),
      path: userSkillPath,
      repairHint: coreSkillsTargetHint(codexPaths.userSkillsDir, expectedCoreSkills, false, "export user-skills")
    },
    {
      name: "repo-skills",
      scope: InventoryScope.CodexNative,
      status: coreSkillsTargetStatus(paths.repoSkillsDir, expectedCoreSkills, true),
      path: repoSkillPath,
      repairHint: coreSkillsTargetHint(paths.repoSkillsDir, expectedCoreSkills, true, "export repo-skills")
    },
    inspectAgentsBlock(
      paths.repoAgentsMd,
      "repo-agents",
      SANE_REPO_AGENTS_BEGIN,
      SANE_REPO_AGENTS_END,
      expectedRepoAgents,
      true,
      "export repo-agents"
    ),
    inspectAgentsBlock(
      codexPaths.globalAgentsMd,
      "global-agents",
      SANE_GLOBAL_AGENTS_BEGIN,
      SANE_GLOBAL_AGENTS_END,
      expectedGlobalAgents,
      false,
      "export global-agents"
    )
  ];
}

function exportSkillsTarget(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  skillsRoot: string,
  kind: OperationKind,
  inventoryName: string,
  summaryPrefix: string
): OperationResult {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const coreSkills = createCoreSkills(packs, roles);
  const enabledOptionalSkills = enabledOptionalPackSkills(packs).flatMap(([, skills]) => skills);
  const managedSkillNames = [
    ...coreSkills.map((skill) => skill.name),
    ...enabledOptionalSkills.map((skill) => skill.name)
  ];
  const disabledSkillNames = disabledOptionalPackNames(packs).flatMap((packName) => optionalPackSkillNames(packName));
  const skillPath = join(skillsRoot, SANE_ROUTER_SKILL_NAME, "SKILL.md");
  const pathsTouched: string[] = [];
  const protectedDirs = collectUnownedSkillDirs(skillsRoot, [...managedSkillNames, ...disabledSkillNames]);

  if (protectedDirs.length > 0) {
    return new OperationResult({
      kind,
      summary: `${summaryPrefix}: blocked by non-Sane skill directories`,
      details: [
        "refusing to overwrite or delete skill directories without Sane ownership marker",
        ...protectedDirs.map((path) => `blocked: ${path}`)
      ],
      pathsTouched: protectedDirs,
      inventory: [
        {
          name: inventoryName,
          scope: InventoryScope.CodexNative,
          status: InventoryStatus.Invalid,
          path: skillPath,
          repairHint: `resolve blocked directories, then rerun \`${summaryPrefix}\``
        }
      ]
    });
  }

  for (const skill of coreSkills) {
    const skillDir = join(skillsRoot, skill.name);
    const targetPath = join(skillDir, "SKILL.md");
    mkdirSync(skillDir, { recursive: true });
    writeAtomicTextFile(targetPath, skill.content);
    writeAtomicTextFile(join(skillDir, SKILL_OWNERSHIP_MARKER_FILE), SKILL_OWNERSHIP_MARKER_CONTENT);
    pathsTouched.push(targetPath);
  }

  for (const skill of enabledOptionalSkills) {
    const packDir = join(skillsRoot, skill.name);
    const packPath = join(packDir, "SKILL.md");
    mkdirSync(packDir, { recursive: true });
    writeAtomicTextFile(packPath, skill.content);
    writeAtomicTextFile(join(packDir, SKILL_OWNERSHIP_MARKER_FILE), SKILL_OWNERSHIP_MARKER_CONTENT);
    pathsTouched.push(packPath);

    for (const resource of skill.resources) {
      const resourcePath = join(packDir, resource.path);
      mkdirSync(dirname(resourcePath), { recursive: true });
      writeAtomicTextFile(resourcePath, resource.content);
      pathsTouched.push(resourcePath);
    }
  }

  for (const packName of disabledOptionalPackNames(packs)) {
    for (const name of optionalPackSkillNames(packName)) {
      const packDir = join(skillsRoot, name);
      if (existsSync(packDir) && isSaneOwnedSkillDir(packDir)) {
        removeSync(packDir, { recursive: true, force: true });
        pathsTouched.push(packDir);
      }
    }
  }

  return new OperationResult({
    kind,
    summary: `${summaryPrefix}: installed core skills`,
    details: [
      `path: ${skillPath}`,
      `packs: ${formatGuidancePacks(packs)}`
    ],
    pathsTouched,
    inventory: [
      {
        name: inventoryName,
        scope: InventoryScope.CodexNative,
        status: InventoryStatus.Installed,
        path: skillPath,
        repairHint: null
      }
    ]
  });
}

function exportAgentsTarget(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  agentsPath: string,
  begin: string,
  end: string,
  kind: OperationKind,
  inventoryName: string,
  summaryPrefix: string
): OperationResult {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  mkdirSync(dirname(agentsPath), { recursive: true });
  const existing = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : "";
  const overlay =
    inventoryName === "repo-agents"
      ? createSaneRepoAgentsOverlay(packs, roles)
      : createSaneGlobalAgentsOverlay(packs, roles);
  const updated = upsertManagedBlock(
    existing,
    begin,
    end,
    overlay
  );
  writeAtomicTextFile(agentsPath, updated);

  return new OperationResult({
    kind,
    summary: `${summaryPrefix}: installed managed block`,
    details: [
      `path: ${agentsPath}`,
      `packs: ${formatGuidancePacks(packs)}`
    ],
    pathsTouched: [agentsPath],
    inventory: [
      {
        name: inventoryName,
        scope: InventoryScope.CodexNative,
        status: InventoryStatus.Installed,
        path: agentsPath,
        repairHint: null
      }
    ]
  });
}

function uninstallSkillsTarget(
  skillsRoot: string,
  kind: OperationKind,
  inventoryName: string,
  optionalWhenMissing: boolean,
  summaryPrefix: string
): OperationResult {
  const coreSkillDirs = [
    SANE_ROUTER_SKILL_NAME,
    SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
    SANE_AGENT_LANES_SKILL_NAME,
    SANE_OUTCOME_CONTINUATION_SKILL_NAME,
    SANE_CONTINUE_SKILL_NAME
  ].map((skillName) => join(skillsRoot, skillName));
  const skillPath = join(skillsRoot, SANE_ROUTER_SKILL_NAME, "SKILL.md");
  const optionalDirs = optionalPackNames().flatMap((name) =>
    optionalPackSkillNames(name).map((skillName) => join(skillsRoot, skillName))
  );

  if (coreSkillDirs.every((dir) => !existsSync(dir)) && optionalDirs.every((dir) => !existsSync(dir))) {
    return new OperationResult({
      kind,
      summary: `${summaryPrefix}: core skills not installed`,
      details: [],
      pathsTouched: [skillPath],
      inventory: [
        {
          name: inventoryName,
          scope: InventoryScope.CodexNative,
          status: optionalWhenMissing ? InventoryStatus.Disabled : InventoryStatus.Missing,
          path: skillPath,
          repairHint: null
        }
      ]
    });
  }

  const presentDirs = [...coreSkillDirs, ...optionalDirs].filter((dir) => existsSync(dir));
  const managedDirs = presentDirs.filter((dir) => isSaneOwnedSkillDir(dir));
  const preservedDirs = presentDirs.filter((dir) => !isSaneOwnedSkillDir(dir));

  if (managedDirs.length === 0 && preservedDirs.length > 0) {
    return new OperationResult({
      kind,
      summary: `${summaryPrefix}: blocked by non-Sane skill directories`,
      details: [
        "refusing to delete skill directories without Sane ownership marker",
        ...preservedDirs.map((path) => `blocked: ${path}`)
      ],
      pathsTouched: preservedDirs,
      inventory: [
        {
          name: inventoryName,
          scope: InventoryScope.CodexNative,
          status: InventoryStatus.Invalid,
          path: skillPath,
          repairHint: null
        }
      ]
    });
  }

  const pathsTouched: string[] = [];
  for (const dir of managedDirs) {
    rmSync(dir, { recursive: true, force: true });
    pathsTouched.push(dir);
  }

  return new OperationResult({
    kind,
    summary:
      preservedDirs.length > 0
        ? `${summaryPrefix}: removed managed skills; preserved non-Sane directories`
        : `${summaryPrefix}: removed core skills`,
    details: preservedDirs.map((path) => `preserved: ${path}`),
    pathsTouched,
    inventory: [
      {
        name: inventoryName,
        scope: InventoryScope.CodexNative,
        status: preservedDirs.length > 0 ? InventoryStatus.Invalid : InventoryStatus.Removed,
        path: skillPath,
        repairHint: null
      }
    ]
  });
}

function uninstallAgentsTarget(
  agentsPath: string,
  begin: string,
  end: string,
  kind: OperationKind,
  inventoryName: string,
  optionalWhenMissing: boolean,
  summaryPrefix: string
): OperationResult {
  if (!existsSync(agentsPath)) {
    return new OperationResult({
      kind,
      summary: `${summaryPrefix}: not installed`,
      details: [],
      pathsTouched: [agentsPath],
      inventory: [
        {
          name: inventoryName,
          scope: InventoryScope.CodexNative,
          status: optionalWhenMissing ? InventoryStatus.Disabled : InventoryStatus.Missing,
          path: agentsPath,
          repairHint: null
        }
      ]
    });
  }

  const existing = readFileSync(agentsPath, "utf8");
  const updated = removeManagedBlock(existing, begin, end);
  if (updated === existing) {
    return new OperationResult({
      kind,
      summary: `${summaryPrefix}: not installed`,
      details: [],
      pathsTouched: [agentsPath],
      inventory: [
        {
          name: inventoryName,
          scope: InventoryScope.CodexNative,
          status: InventoryStatus.PresentWithoutSaneBlock,
          path: agentsPath,
          repairHint: null
        }
      ]
    });
  }

  if (updated.trim().length === 0) {
    rmSync(agentsPath, { force: true });
  } else {
  writeAtomicTextFile(agentsPath, updated);
  }

  return new OperationResult({
    kind,
    summary: `${summaryPrefix}: removed managed block`,
    details: [],
    pathsTouched: [agentsPath],
    inventory: [
      {
        name: inventoryName,
        scope: InventoryScope.CodexNative,
        status: InventoryStatus.Removed,
        path: agentsPath,
        repairHint: null
      }
    ]
  });
}

function inspectAgentsBlock(
  path: string,
  inventoryName: string,
  begin: string,
  end: string,
  expected: string,
  optionalWhenMissing: boolean,
  exportCommand: string
) {
  if (!existsSync(path)) {
    return {
      name: inventoryName,
      scope: InventoryScope.CodexNative,
      status: optionalWhenMissing ? InventoryStatus.Disabled : InventoryStatus.Missing,
      path,
      repairHint: optionalWhenMissing ? "optional repo export" : `run \`${exportCommand}\``
    };
  }

  const body = readFileSync(path, "utf8");
  if (body.includes(begin) && body.includes(end)) {
    const rendered = upsertManagedBlock(body, begin, end, expected);
    const status = rendered === body ? InventoryStatus.Installed : InventoryStatus.Invalid;
    return {
      name: inventoryName,
      scope: InventoryScope.CodexNative,
      status,
      path,
      repairHint: status === InventoryStatus.Invalid ? `rerun \`${exportCommand}\`` : null
    };
  }

  return {
    name: inventoryName,
    scope: InventoryScope.CodexNative,
    status: InventoryStatus.PresentWithoutSaneBlock,
    path,
    repairHint: `run \`${exportCommand}\``
  };
}

function coreSkillsTargetStatus(
  skillsRoot: string,
  expectedSkills: Array<{ name: string; content: string }>,
  optionalWhenMissing: boolean
): InventoryStatus {
  const presentCount = expectedSkills.filter((skill) =>
    existsSync(join(skillsRoot, skill.name, "SKILL.md"))
  ).length;
  if (presentCount === 0) {
    return optionalWhenMissing ? InventoryStatus.Disabled : InventoryStatus.Missing;
  }
  if (presentCount !== expectedSkills.length) {
    return InventoryStatus.Invalid;
  }

  return expectedSkills.every(
    (skill) => readFileSync(join(skillsRoot, skill.name, "SKILL.md"), "utf8") === skill.content
  )
    ? InventoryStatus.Installed
    : InventoryStatus.Invalid;
}

function coreSkillsTargetHint(
  skillsRoot: string,
  expectedSkills: Array<{ name: string; content: string }>,
  optionalWhenMissing: boolean,
  exportCommand: string
): string | null {
  const presentCount = expectedSkills.filter((skill) =>
    existsSync(join(skillsRoot, skill.name, "SKILL.md"))
  ).length;
  if (presentCount === 0) {
    return optionalWhenMissing ? "optional repo export" : `run \`${exportCommand}\``;
  }
  if (presentCount !== expectedSkills.length) {
    return `rerun \`${exportCommand}\``;
  }

  return expectedSkills.every(
    (skill) => readFileSync(join(skillsRoot, skill.name, "SKILL.md"), "utf8") === skill.content
  )
    ? null
    : `rerun \`${exportCommand}\``;
}

function activeGuidance(paths: ProjectPaths, codexPaths: CodexPaths): {
  packs: GuidancePacks;
  roles: ModelRoutingGuidance;
} {
  const environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
  const config = loadOrDefaultConfig(paths, codexPaths, environment);
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

function loadOrDefaultConfig(paths: ProjectPaths, codexPaths: CodexPaths, environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson)) {
  return recommendedLocalConfigFromEnvironment(
    paths,
    createRecommendedLocalConfig(environment)
  );
}

function formatGuidancePacks(packs: GuidancePacks): string {
  return ["core", ...enabledOptionalPackNames(packs)].join(", ");
}

function enabledOptionalPackSkills(
  packs: GuidancePacks
): Array<
  [
    OptionalPackName,
    Array<{ name: string; content: string; resources: Array<{ path: string; content: string }> }>
  ]
> {
  return enabledOptionalPackNames(packs).map((name) => [name, createOptionalPackSkills(name)]);
}

function isSaneOwnedSkillDir(path: string): boolean {
  return existsSync(join(path, SKILL_OWNERSHIP_MARKER_FILE));
}

function collectUnownedSkillDirs(skillsRoot: string, skillNames: string[]): string[] {
  const blocked = new Set<string>();
  for (const name of skillNames) {
    const path = join(skillsRoot, name);
    if (existsSync(path) && !isSaneOwnedSkillDir(path)) {
      blocked.add(path);
    }
  }
  return [...blocked];
}
