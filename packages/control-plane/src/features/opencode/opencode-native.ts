import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  createRecommendedLocalConfig,
  detectCodexEnvironment
} from "@sane/config";
import {
  InventoryScope,
  InventoryStatus,
  OperationKind,
  OperationResult,
  removeManagedBlock,
  upsertManagedBlock,
  type InventoryItem
} from "@sane/control-plane/core.js";
import {
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_CONTINUE_SKILL_NAME,
  SANE_GLOBAL_AGENTS_BEGIN,
  SANE_GLOBAL_AGENTS_END,
  SANE_OUTCOME_CONTINUATION_SKILL_NAME,
  SANE_ROUTER_SKILL_NAME,
  createCoreSkills,
  createDefaultGuidancePacks,
  createOptionalPackSkills,
  createSaneGlobalAgentsOverlay,
  enabledOptionalPackNames,
  optionalPackConfigKey,
  optionalPackNames,
  optionalPackSkillNames,
  type GuidancePacks,
  type ModelRoutingGuidance
} from "@sane/framework-assets";
import { type CodexPaths, type ProjectPaths } from "../../platform.js";
import { writeAtomicTextFile } from "@sane/state";

import { recommendedLocalConfigFromEnvironment } from "../../local-config.js";
import { readOpencodeConfigJson, writeOpencodeConfigJson } from "./opencode-config-json.js";
import {
  opencodePluginReferences,
  removeOpencodePluginReference,
  upsertOpencodePluginReference
} from "./opencode-plugin-references.js";
import {
  OPENCODE_AGENT_NAMES,
  OPENCODE_AGENT_OWNERSHIP_MARKER,
  OPENCODE_SESSION_START_PLUGIN_MARKER,
  createOpencodeSessionStartPluginBody,
  expectedOpencodeAgentBodies,
  isManagedOpencodeAgentBody,
  markOpencodeAgentBody
} from "./opencode-rendered-assets.js";

const SKILL_OWNERSHIP_MARKER_FILE = ".sane-owned";
const SKILL_OWNERSHIP_MARKER_CONTENT = "managed-by: sane\n";
// Keep Kimi K2.6 as a researched escalation candidate, not a default, while its OpenCode Go usage cost is high.
const OPENCODE_GO_MODEL_ROUTING: ModelRoutingGuidance = {
  coordinatorModel: "opencode-go/glm-5.1",
  coordinatorReasoning: "high",
  executionModel: "opencode-go/glm-5.1",
  executionReasoning: "medium",
  sidecarModel: "opencode-go/qwen3.6-plus",
  sidecarReasoning: "low",
  verifierModel: "opencode-go/deepseek-v4-pro",
  verifierReasoning: "high",
  realtimeModel: "opencode-go/deepseek-v4-flash",
  realtimeReasoning: "low"
};

export function exportOpencodeCoreBundle(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult[] {
  return [
    exportOpencodeSkills(paths, codexPaths),
    exportOpencodeGlobalAgents(paths, codexPaths),
    exportOpencodeSessionStartPlugin(paths, codexPaths),
    exportOpencodeAgents(paths, codexPaths)
  ];
}

export function uninstallOpencodeCoreBundle(
  codexPaths: CodexPaths
): OperationResult[] {
  return [
    uninstallOpencodeSkills(codexPaths),
    uninstallOpencodeGlobalAgents(codexPaths),
    uninstallOpencodeSessionStartPlugin(codexPaths),
    uninstallOpencodeAgents(codexPaths)
  ];
}

export function exportOpencodeSkills(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const skillsRoot = opencodeSkillsDir(codexPaths);
  const coreSkills = createCoreSkills(packs, roles);
  const enabledOptionalSkills = enabledOptionalPackNames(packs).flatMap((name) => createOptionalPackSkills(name));
  const managedSkillNames = [
    ...coreSkills.map((skill) => skill.name),
    ...enabledOptionalSkills.map((skill) => skill.name)
  ];
  const disabledSkillNames = optionalPackNames()
    .filter((name) => !enabledOptionalPackNames(packs).includes(name))
    .flatMap((name) => optionalPackSkillNames(name));
  const skillPath = join(skillsRoot, SANE_ROUTER_SKILL_NAME, "SKILL.md");
  const blocked = collectUnownedSkillDirs(skillsRoot, [...managedSkillNames, ...disabledSkillNames]);
  if (blocked.length > 0) {
    return new OperationResult({
      kind: OperationKind.ExportUserSkills,
      summary: "export opencode-skills: blocked by non-Sane skill directories",
      details: [
        "refusing to overwrite or delete skill directories without Sane ownership marker",
        ...blocked.map((path) => `blocked: ${path}`)
      ],
      pathsTouched: blocked,
      inventory: [
        {
          name: "opencode-skills",
          scope: InventoryScope.Compatibility,
          status: InventoryStatus.Invalid,
          path: skillPath,
          repairHint: "resolve blocked directories, then rerun `export opencode`"
        }
      ]
    });
  }

  const pathsTouched: string[] = [];
  for (const skill of coreSkills) {
    const skillDir = join(skillsRoot, skill.name);
    const targetPath = join(skillDir, "SKILL.md");
    mkdirSync(skillDir, { recursive: true });
    writeAtomicTextFile(targetPath, skill.content);
    writeAtomicTextFile(join(skillDir, SKILL_OWNERSHIP_MARKER_FILE), SKILL_OWNERSHIP_MARKER_CONTENT);
    pathsTouched.push(targetPath);
  }

  for (const skill of enabledOptionalSkills) {
    const skillDir = join(skillsRoot, skill.name);
    const targetPath = join(skillDir, "SKILL.md");
    mkdirSync(skillDir, { recursive: true });
    writeAtomicTextFile(targetPath, skill.content);
    writeAtomicTextFile(join(skillDir, SKILL_OWNERSHIP_MARKER_FILE), SKILL_OWNERSHIP_MARKER_CONTENT);
    pathsTouched.push(targetPath);

    for (const resource of skill.resources) {
      const resourcePath = join(skillDir, resource.path);
      mkdirSync(dirname(resourcePath), { recursive: true });
      writeAtomicTextFile(resourcePath, resource.content);
      pathsTouched.push(resourcePath);
    }
  }

  for (const skillName of disabledSkillNames) {
    const skillDir = join(skillsRoot, skillName);
    if (existsSync(skillDir) && isSaneOwnedSkillDir(skillDir)) {
      rmSync(skillDir, { recursive: true, force: true });
      pathsTouched.push(skillDir);
    }
  }

  return new OperationResult({
    kind: OperationKind.ExportUserSkills,
    summary: "export opencode-skills: installed core skills",
    details: [`path: ${skillPath}`],
    pathsTouched,
    inventory: [inspectOpencodeSkillsInventory(paths, codexPaths)]
  });
}

export function uninstallOpencodeSkills(codexPaths: CodexPaths): OperationResult {
  const skillsRoot = opencodeSkillsDir(codexPaths);
  const managedSkillDirs = [
    SANE_ROUTER_SKILL_NAME,
    SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
    SANE_AGENT_LANES_SKILL_NAME,
    SANE_OUTCOME_CONTINUATION_SKILL_NAME,
    SANE_CONTINUE_SKILL_NAME,
    ...optionalPackNames().flatMap((pack) => optionalPackSkillNames(pack))
  ].map((skillName) => join(skillsRoot, skillName));
  const present = managedSkillDirs.filter((dir) => existsSync(dir));
  const managed = present.filter((dir) => isSaneOwnedSkillDir(dir));
  const preserved = present.filter((dir) => !isSaneOwnedSkillDir(dir));
  const skillPath = join(skillsRoot, SANE_ROUTER_SKILL_NAME, "SKILL.md");

  if (present.length === 0) {
    return new OperationResult({
      kind: OperationKind.UninstallUserSkills,
      summary: "uninstall opencode-skills: not installed",
      details: [],
      pathsTouched: [skillsRoot],
      inventory: [
        {
          name: "opencode-skills",
          scope: InventoryScope.Compatibility,
          status: InventoryStatus.Missing,
          path: skillPath,
          repairHint: null
        }
      ]
    });
  }

  const pathsTouched: string[] = [];
  for (const dir of managed) {
    rmSync(dir, { recursive: true, force: true });
    pathsTouched.push(dir);
  }

  return new OperationResult({
    kind: OperationKind.UninstallUserSkills,
    summary:
      preserved.length > 0
        ? "uninstall opencode-skills: removed managed skills; preserved non-Sane directories"
        : "uninstall opencode-skills: removed managed skills",
    details: preserved.map((path) => `preserved: ${path}`),
    pathsTouched: pathsTouched.length > 0 ? pathsTouched : [skillsRoot],
    inventory: [
      {
        name: "opencode-skills",
        scope: InventoryScope.Compatibility,
        status: preserved.length > 0 ? InventoryStatus.Invalid : InventoryStatus.Removed,
        path: skillPath,
        repairHint: null
      }
    ]
  });
}

export function exportOpencodeGlobalAgents(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const agentsPath = opencodeGlobalAgentsMd(codexPaths);
  mkdirSync(dirname(agentsPath), { recursive: true });
  const existing = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : "";
  const updated = upsertManagedBlock(
    existing,
    SANE_GLOBAL_AGENTS_BEGIN,
    SANE_GLOBAL_AGENTS_END,
    createSaneGlobalAgentsOverlay(packs, roles)
  );
  writeAtomicTextFile(agentsPath, updated);

  return new OperationResult({
    kind: OperationKind.ExportGlobalAgents,
    summary: "export opencode-global-agents: installed managed block",
    details: [`path: ${agentsPath}`],
    pathsTouched: [agentsPath],
    inventory: [inspectOpencodeGlobalAgentsInventory(paths, codexPaths)]
  });
}

export function uninstallOpencodeGlobalAgents(codexPaths: CodexPaths): OperationResult {
  const agentsPath = opencodeGlobalAgentsMd(codexPaths);
  if (!existsSync(agentsPath)) {
    return new OperationResult({
      kind: OperationKind.UninstallGlobalAgents,
      summary: "uninstall opencode-global-agents: not installed",
      details: [],
      pathsTouched: [agentsPath],
      inventory: [
        {
          name: "opencode-global-agents",
          scope: InventoryScope.Compatibility,
          status: InventoryStatus.Missing,
          path: agentsPath,
          repairHint: null
        }
      ]
    });
  }

  const existing = readFileSync(agentsPath, "utf8");
  const updated = removeManagedBlock(existing, SANE_GLOBAL_AGENTS_BEGIN, SANE_GLOBAL_AGENTS_END);
  if (updated === existing) {
    return new OperationResult({
      kind: OperationKind.UninstallGlobalAgents,
      summary: "uninstall opencode-global-agents: not installed",
      details: [],
      pathsTouched: [agentsPath],
      inventory: [
        {
          name: "opencode-global-agents",
          scope: InventoryScope.Compatibility,
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
    kind: OperationKind.UninstallGlobalAgents,
    summary: "uninstall opencode-global-agents: removed managed block",
    details: [],
    pathsTouched: [agentsPath],
    inventory: [
      {
        name: "opencode-global-agents",
        scope: InventoryScope.Compatibility,
        status: InventoryStatus.Removed,
        path: agentsPath,
        repairHint: null
      }
    ]
  });
}

export function exportOpencodeSessionStartPlugin(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const { packs } = activeGuidance(paths, codexPaths);
  const pluginPath = opencodeSessionStartPluginPath(codexPaths);
  const configPath = opencodeConfigJson(codexPaths);

  if (existsSync(pluginPath)) {
    const existing = readFileSync(pluginPath, "utf8");
    if (!existing.includes(OPENCODE_SESSION_START_PLUGIN_MARKER)) {
      return new OperationResult({
        kind: OperationKind.ExportGlobalAgents,
        summary: "export opencode-session-start: blocked by unmanaged plugin file",
        details: [`blocked: ${pluginPath}`],
        pathsTouched: [pluginPath],
        inventory: [
          {
            name: "opencode-session-start",
            scope: InventoryScope.Compatibility,
            status: InventoryStatus.Invalid,
            path: pluginPath,
            repairHint: "move the unmanaged plugin, then rerun `export opencode`"
          }
        ]
      });
    }
  }

  const configResult = readOpencodeConfigJson(configPath);
  if (!configResult.ok) {
    return invalidOpencodeConfigResult(
      OperationKind.ExportGlobalAgents,
      "export opencode-session-start",
      configPath
    );
  }
  const config = configResult.value;
  const updatedConfig = upsertOpencodePluginReference(config, pluginPath);
  mkdirSync(dirname(pluginPath), { recursive: true });
  writeAtomicTextFile(pluginPath, createOpencodeSessionStartPluginBody(packs));
  writeOpencodeConfigJson(configPath, updatedConfig);

  return new OperationResult({
    kind: OperationKind.ExportGlobalAgents,
    summary: "export opencode-session-start: installed Sane start plugin",
    details: [`plugin: ${pluginPath}`, `config: ${configPath}`],
    pathsTouched: [pluginPath, configPath],
    inventory: [inspectOpencodeSessionStartInventory(paths, codexPaths)]
  });
}

export function uninstallOpencodeSessionStartPlugin(codexPaths: CodexPaths): OperationResult {
  const pluginPath = opencodeSessionStartPluginPath(codexPaths);
  const configPath = opencodeConfigJson(codexPaths);
  const hadPlugin = existsSync(pluginPath);
  const configResult = readOpencodeConfigJson(configPath);
  if (!configResult.ok) {
    return invalidOpencodeConfigResult(
      OperationKind.UninstallGlobalAgents,
      "uninstall opencode-session-start",
      configPath
    );
  }
  const config = configResult.value;
  const updatedConfig = removeOpencodePluginReference(config, pluginPath);
  const configChanged = JSON.stringify(updatedConfig) !== JSON.stringify(config);

  if (hadPlugin) {
    const existing = readFileSync(pluginPath, "utf8");
    if (existing.includes(OPENCODE_SESSION_START_PLUGIN_MARKER)) {
      rmSync(pluginPath, { force: true });
    }
  }

  if (configChanged) {
    writeOpencodeConfigJson(configPath, updatedConfig);
  }

  if (!hadPlugin && !configChanged) {
    return new OperationResult({
      kind: OperationKind.UninstallGlobalAgents,
      summary: "uninstall opencode-session-start: not installed",
      details: [],
      pathsTouched: [pluginPath, configPath],
      inventory: [
        {
          name: "opencode-session-start",
          scope: InventoryScope.Compatibility,
          status: InventoryStatus.Missing,
          path: pluginPath,
          repairHint: null
        }
      ]
    });
  }

  return new OperationResult({
    kind: OperationKind.UninstallGlobalAgents,
    summary: "uninstall opencode-session-start: removed Sane start plugin",
    details: hadPlugin ? [] : [`removed stale config reference: ${pluginPath}`],
    pathsTouched: [pluginPath, configPath],
    inventory: [
      {
        name: "opencode-session-start",
        scope: InventoryScope.Compatibility,
        status: InventoryStatus.Removed,
        path: pluginPath,
        repairHint: null
      }
    ]
  });
}

export function exportOpencodeAgents(paths: ProjectPaths, codexPaths: CodexPaths): OperationResult {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const agentsDir = opencodeAgentsDir(codexPaths);
  mkdirSync(agentsDir, { recursive: true });
  const rendered = expectedOpencodeAgentBodies(packs, roles);
  const blocked = rendered
    .map(([name, body]) => ({ path: join(agentsDir, `${name}.md`), body }))
    .filter(({ path, body }) => existsSync(path) && !isManagedOpencodeAgentBody(readFileSync(path, "utf8"), body))
    .map(({ path }) => path);
  if (blocked.length > 0) {
    return new OperationResult({
      kind: OperationKind.ExportCustomAgents,
      summary: "export opencode-agents: blocked by unmanaged same-name agent file",
      details: [
        "refusing to overwrite same-name OpenCode agent files without Sane ownership marker or expected managed body",
        ...blocked.map((path) => `blocked: ${path}`)
      ],
      pathsTouched: blocked,
      inventory: [inspectOpencodeAgentsInventory(paths, codexPaths)]
    });
  }

  const pathsTouched: string[] = [];
  for (const [name, body] of rendered) {
    const path = join(agentsDir, `${name}.md`);
    writeAtomicTextFile(path, markOpencodeAgentBody(body));
    pathsTouched.push(path);
  }

  return new OperationResult({
    kind: OperationKind.ExportCustomAgents,
    summary: "export opencode-agents: installed Sane OpenCode agents",
    details: rendered.map(([name]) => `${name}: ${join(agentsDir, `${name}.md`)}`),
    pathsTouched,
    inventory: [inspectOpencodeAgentsInventory(paths, codexPaths)]
  });
}

export function uninstallOpencodeAgents(codexPaths: CodexPaths): OperationResult {
  const agentsDir = opencodeAgentsDir(codexPaths);
  const managedPaths = OPENCODE_AGENT_NAMES.map((name) => join(agentsDir, `${name}.md`));
  const managed = managedPaths.filter((path) => existsSync(path) && isManagedOpencodeAgentFile(path));
  const preserved = managedPaths.filter((path) => existsSync(path) && !isManagedOpencodeAgentFile(path));
  const hadAny = managed.length + preserved.length > 0;

  if (!hadAny) {
    return new OperationResult({
      kind: OperationKind.UninstallCustomAgents,
      summary: "uninstall opencode-agents: not installed",
      details: [],
      pathsTouched: [agentsDir],
      inventory: [
        {
          name: "opencode-agents",
          scope: InventoryScope.Compatibility,
          status: InventoryStatus.Missing,
          path: agentsDir,
          repairHint: null
        }
      ]
    });
  }

  for (const path of managed) {
    rmSync(path, { force: true });
  }

  if (existsSync(agentsDir) && readdirSync(agentsDir).length === 0) {
    rmSync(agentsDir, { recursive: true, force: true });
  }

  return new OperationResult({
    kind: OperationKind.UninstallCustomAgents,
    summary:
      preserved.length > 0
        ? "uninstall opencode-agents: removed managed Sane OpenCode agents; preserved unmanaged same-name files"
        : "uninstall opencode-agents: removed Sane OpenCode agents",
    details: preserved.map((path) => `preserved: ${path}`),
    pathsTouched: managed.length > 0 ? managed : [agentsDir],
    inventory: [
      {
        name: "opencode-agents",
        scope: InventoryScope.Compatibility,
        status: preserved.length > 0 ? InventoryStatus.Invalid : InventoryStatus.Removed,
        path: agentsDir,
        repairHint: null
      }
    ]
  });
}

export function inspectOpencodeCoreInventory(paths: ProjectPaths, codexPaths: CodexPaths): InventoryItem[] {
  return [
    inspectOpencodeSkillsInventory(paths, codexPaths),
    inspectOpencodeGlobalAgentsInventory(paths, codexPaths),
    inspectOpencodeSessionStartInventory(paths, codexPaths),
    inspectOpencodeAgentsInventory(paths, codexPaths)
  ];
}

export function inspectOpencodeSkillsInventory(paths: ProjectPaths, codexPaths: CodexPaths): InventoryItem {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const skillsRoot = opencodeSkillsDir(codexPaths);
  const coreSkills = createCoreSkills(packs, roles);
  const corePresentCount = coreSkills.filter((skill) =>
    existsSync(join(skillsRoot, skill.name, "SKILL.md"))
  ).length;
  const status =
    corePresentCount === 0
      ? InventoryStatus.Missing
      : corePresentCount === coreSkills.length
        ? coreSkills.every(
            (skill) => readFileSync(join(skillsRoot, skill.name, "SKILL.md"), "utf8") === skill.content
          )
          ? InventoryStatus.Installed
          : InventoryStatus.Invalid
        : InventoryStatus.Invalid;

  return {
    name: "opencode-skills",
    scope: InventoryScope.Compatibility,
    status,
    path: join(skillsRoot, SANE_ROUTER_SKILL_NAME, "SKILL.md"),
    repairHint:
      status === InventoryStatus.Installed
        ? null
        : status === InventoryStatus.Missing
          ? "run `export opencode`"
          : "rerun `export opencode`"
  };
}

export function inspectOpencodeGlobalAgentsInventory(paths: ProjectPaths, codexPaths: CodexPaths): InventoryItem {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const agentsPath = opencodeGlobalAgentsMd(codexPaths);
  if (!existsSync(agentsPath)) {
    return {
      name: "opencode-global-agents",
      scope: InventoryScope.Compatibility,
      status: InventoryStatus.Missing,
      path: agentsPath,
      repairHint: "run `export opencode`"
    };
  }

  const body = readFileSync(agentsPath, "utf8");
  if (body.includes(SANE_GLOBAL_AGENTS_BEGIN) && body.includes(SANE_GLOBAL_AGENTS_END)) {
    const rendered = upsertManagedBlock(
      body,
      SANE_GLOBAL_AGENTS_BEGIN,
      SANE_GLOBAL_AGENTS_END,
      createSaneGlobalAgentsOverlay(packs, roles)
    );
    const status = rendered === body ? InventoryStatus.Installed : InventoryStatus.Invalid;
    return {
      name: "opencode-global-agents",
      scope: InventoryScope.Compatibility,
      status,
      path: agentsPath,
      repairHint: status === InventoryStatus.Invalid ? "rerun `export opencode`" : null
    };
  }

  return {
    name: "opencode-global-agents",
    scope: InventoryScope.Compatibility,
    status: InventoryStatus.PresentWithoutSaneBlock,
    path: agentsPath,
    repairHint: "run `export opencode`"
  };
}

export function inspectOpencodeAgentsInventory(paths: ProjectPaths, codexPaths: CodexPaths): InventoryItem {
  const { packs, roles } = activeGuidance(paths, codexPaths);
  const agentsDir = opencodeAgentsDir(codexPaths);
  const expected = expectedOpencodeAgentBodies(packs, roles).map(([name, body]) => [
    join(agentsDir, `${name}.md`),
    body
  ] as const);
  const missingCount = expected.filter(([path]) => !existsSync(path)).length;
  const status =
    missingCount === expected.length
      ? InventoryStatus.Missing
      : missingCount === 0
        ? expected.every(([path, body]) => isManagedOpencodeAgentBody(readFileSync(path, "utf8"), body))
          ? InventoryStatus.Installed
          : InventoryStatus.Invalid
        : InventoryStatus.Invalid;

  return {
    name: "opencode-agents",
    scope: InventoryScope.Compatibility,
    status,
    path: agentsDir,
    repairHint:
      status === InventoryStatus.Installed
        ? null
        : status === InventoryStatus.Missing
          ? "run `export opencode`"
          : "rerun `export opencode`"
  };
}

export function inspectOpencodeSessionStartInventory(paths: ProjectPaths, codexPaths: CodexPaths): InventoryItem {
  const { packs } = activeGuidance(paths, codexPaths);
  const pluginPath = opencodeSessionStartPluginPath(codexPaths);
  const configPath = opencodeConfigJson(codexPaths);
  const expectedBody = createOpencodeSessionStartPluginBody(packs);
  const hasPlugin = existsSync(pluginPath);
  const configResult = readOpencodeConfigJson(configPath);
  if (!configResult.ok) {
    return {
      name: "opencode-session-start",
      scope: InventoryScope.Compatibility,
      status: InventoryStatus.Invalid,
      path: pluginPath,
      repairHint: "repair ~/.config/opencode/opencode.json before rerunning `export opencode`"
    };
  }
  const config = configResult.value;
  const hasConfigReference = opencodePluginReferences(config).includes(pluginPath);
  const status =
    !hasPlugin && !hasConfigReference
      ? InventoryStatus.Missing
      : hasPlugin && hasConfigReference && readFileSync(pluginPath, "utf8") === expectedBody
        ? InventoryStatus.Installed
        : InventoryStatus.Invalid;

  return {
    name: "opencode-session-start",
    scope: InventoryScope.Compatibility,
    status,
    path: pluginPath,
    repairHint:
      status === InventoryStatus.Installed
        ? null
        : status === InventoryStatus.Missing
          ? "run `export opencode`"
          : "rerun `export opencode`"
  };
}

function invalidOpencodeConfigResult(kind: OperationKind, operation: string, configPath: string): OperationResult {
  return new OperationResult({
    kind,
    summary: `${operation}: blocked by invalid opencode.json`,
    details: ["repair ~/.config/opencode/opencode.json before rerunning"],
    pathsTouched: [configPath],
    inventory: [
      {
        name: "opencode-session-start",
        scope: InventoryScope.Compatibility,
        status: InventoryStatus.Invalid,
        path: configPath,
        repairHint: "repair ~/.config/opencode/opencode.json before rerunning `export opencode`"
      }
    ]
  });
}

function isManagedOpencodeAgentFile(path: string): boolean {
  return readFileSync(path, "utf8").includes(OPENCODE_AGENT_OWNERSHIP_MARKER);
}

function activeGuidance(paths: ProjectPaths, codexPaths: CodexPaths): {
  packs: GuidancePacks;
  roles: ModelRoutingGuidance;
} {
  const environment = detectCodexEnvironment(codexPaths.modelsCacheJson, codexPaths.authJson);
  const config = recommendedLocalConfigFromEnvironment(
    paths,
    createRecommendedLocalConfig(environment)
  );
  return {
    packs: guidancePacksFromConfig(config.packs),
    roles: {
      ...OPENCODE_GO_MODEL_ROUTING
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

function opencodeRoot(codexPaths: CodexPaths): string {
  return join(codexPaths.homeDir, ".config", "opencode");
}

function opencodeAgentsDir(codexPaths: CodexPaths): string {
  return join(opencodeRoot(codexPaths), "agents");
}

function opencodeSkillsDir(codexPaths: CodexPaths): string {
  return join(opencodeRoot(codexPaths), "skills");
}

function opencodeGlobalAgentsMd(codexPaths: CodexPaths): string {
  return join(opencodeRoot(codexPaths), "AGENTS.md");
}

function opencodeSessionStartPluginPath(codexPaths: CodexPaths): string {
  return join(opencodeRoot(codexPaths), "plugins", "sane-session-start.js");
}

function opencodeConfigJson(codexPaths: CodexPaths): string {
  return join(opencodeRoot(codexPaths), "opencode.json");
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
