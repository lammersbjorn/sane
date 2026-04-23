import {
  createRecommendedLocalConfig,
  createRecommendedModelRoutingPresets,
  detectCodexEnvironment,
} from "@sane/config";
import {
  InventoryScope,
  InventoryStatus,
  OperationKind,
  OperationResult,
  removeManagedBlock,
  upsertManagedBlock
} from "@sane/core";
import {
  disabledOptionalPackNames,
  enabledOptionalPackNames,
  SANE_GLOBAL_AGENTS_BEGIN,
  SANE_GLOBAL_AGENTS_END,
  SANE_REPO_AGENTS_BEGIN,
  SANE_REPO_AGENTS_END,
  createCoreSkills,
  createOptionalPackSkills,
  createSaneGlobalAgentsOverlay,
  createSaneRepoAgentsOverlay,
  createSaneRouterSkill,
  optionalPackNames,
  optionalPackSkillNames,
  type OptionalPackName,
  type GuidancePacks,
  type ModelRoutingGuidance
} from "@sane/framework-assets";
import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import { existsSync, mkdirSync, readFileSync, rmSync, rmSync as removeSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { recommendedLocalConfigFromEnvironment } from "./local-config.js";
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
  const expectedSkill = createSaneRouterSkill(packs, roles);
  const expectedCoreSkills = createCoreSkills(packs, roles);
  const expectedGlobalAgents = createSaneGlobalAgentsOverlay(packs, roles);
  const expectedRepoAgents = createSaneRepoAgentsOverlay(packs, roles);

  const userSkillPath = join(codexPaths.userSkillsDir, "sane-router", "SKILL.md");
  const repoSkillPath = join(paths.repoSkillsDir, "sane-router", "SKILL.md");

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
  const skillPath = join(skillsRoot, "sane-router", "SKILL.md");
  const pathsTouched: string[] = [];

  for (const skill of coreSkills) {
    const skillDir = join(skillsRoot, skill.name);
    const targetPath = join(skillDir, "SKILL.md");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(targetPath, skill.content, "utf8");
    pathsTouched.push(targetPath);
  }

  for (const [, skills] of enabledOptionalPackSkills(packs)) {
    for (const skill of skills) {
      const packDir = join(skillsRoot, skill.name);
      const packPath = join(packDir, "SKILL.md");
      mkdirSync(packDir, { recursive: true });
      writeFileSync(packPath, skill.content, "utf8");
      pathsTouched.push(packPath);

      for (const resource of skill.resources) {
        const resourcePath = join(packDir, resource.path);
        mkdirSync(dirname(resourcePath), { recursive: true });
        writeFileSync(resourcePath, resource.content, "utf8");
        pathsTouched.push(resourcePath);
      }
    }
  }

  for (const packName of disabledOptionalPackNames(packs)) {
    for (const name of optionalPackSkillNames(packName)) {
      const packDir = join(skillsRoot, name);
      if (existsSync(packDir)) {
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
  writeFileSync(agentsPath, updated, "utf8");

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
  const coreSkillDirs = ["sane-router", "continue"].map((skillName) => join(skillsRoot, skillName));
  const skillPath = join(skillsRoot, "sane-router", "SKILL.md");
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

  const pathsTouched: string[] = [];
  for (const dir of coreSkillDirs) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      pathsTouched.push(dir);
    }
  }
  for (const dir of optionalDirs) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      pathsTouched.push(dir);
    }
  }

  return new OperationResult({
    kind,
    summary: `${summaryPrefix}: removed core skills`,
    details: [],
    pathsTouched,
    inventory: [
      {
        name: inventoryName,
        scope: InventoryScope.CodexNative,
        status: InventoryStatus.Removed,
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
    writeFileSync(agentsPath, updated, "utf8");
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
  const routing = createRecommendedModelRoutingPresets(environment);
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
