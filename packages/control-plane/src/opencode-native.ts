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
} from "@sane/core";
import {
  SANE_AGENT_NAME,
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_CONTINUE_SKILL_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_GLOBAL_AGENTS_BEGIN,
  SANE_GLOBAL_AGENTS_END,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_OUTCOME_CONTINUATION_SKILL_NAME,
  SANE_REALTIME_AGENT_NAME,
  SANE_REVIEWER_AGENT_NAME,
  SANE_ROUTER_SKILL_NAME,
  createCoreSkills,
  createDefaultGuidancePacks,
  createOptionalPackSkills,
  createSaneGlobalAgentsOverlay,
  enabledOptionalPackContinuityLines,
  enabledOptionalPackNames,
  optionalPackConfigKey,
  optionalPackNames,
  optionalPackPolicyLine,
  optionalPackSkillNames,
  type GuidancePacks,
  type ModelRoutingGuidance
} from "@sane/framework-assets";
import { type CodexPaths, type ProjectPaths } from "@sane/platform";
import { writeAtomicTextFile } from "@sane/state";

import { recommendedLocalConfigFromEnvironment } from "./local-config.js";
import { SESSION_START_BASE_GUIDANCE } from "./session-start-hook.js";

const SKILL_OWNERSHIP_MARKER_FILE = ".sane-owned";
const SKILL_OWNERSHIP_MARKER_CONTENT = "managed-by: sane\n";
const OPENCODE_SESSION_START_PLUGIN_MARKER = "managed-by: sane opencode session-start plugin";
const OPENCODE_AGENT_OWNERSHIP_MARKER = "<!-- managed-by: sane opencode-agent -->";
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
  mkdirSync(dirname(configPath), { recursive: true });
  writeAtomicTextFile(configPath, `${JSON.stringify(updatedConfig, null, 2)}\n`);

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
    mkdirSync(dirname(configPath), { recursive: true });
    writeAtomicTextFile(configPath, `${JSON.stringify(updatedConfig, null, 2)}\n`);
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
  const managedPaths = [
    SANE_AGENT_NAME,
    SANE_REVIEWER_AGENT_NAME,
    SANE_EXPLORER_AGENT_NAME,
    SANE_IMPLEMENTATION_AGENT_NAME,
    SANE_REALTIME_AGENT_NAME
  ].map((name) => join(agentsDir, `${name}.md`));
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

function expectedOpencodeAgentBodies(
  packs: GuidancePacks,
  roles: ModelRoutingGuidance
): Array<[string, string]> {
  const packNotes = opencodePackNotes(packs);
  return [
    [
      SANE_AGENT_NAME,
      createOpencodeAgentTemplate({
        description: "Primary Sane subagent for OpenCode execution lane.",
        model: roles.coordinatorModel,
        readOnly: false,
        body: [
          "Coordinate Sane work:",
          "- start from repo-local instructions and current evidence",
          "- route broad work into lanes with disjoint write boundaries",
          "- keep context tight; load only task-relevant files",
          "- verify changed behavior before done",
          ...packNotes
        ]
      })
    ],
    [
      SANE_REVIEWER_AGENT_NAME,
      createOpencodeAgentTemplate({
        description: "Read-only reviewer for Sane in OpenCode.",
        model: roles.verifierModel,
        readOnly: true,
        body: [
          "Review Sane work:",
          "- findings first: bugs, regressions, risk, missing tests",
          "- cite concrete file anchors and behavior",
          "- avoid broad summaries and speculative churn",
          ...packNotes
        ]
      })
    ],
    [
      SANE_EXPLORER_AGENT_NAME,
      createOpencodeAgentTemplate({
        description: "Read-only explorer for Sane in OpenCode.",
        model: roles.sidecarModel,
        readOnly: true,
        body: [
          "Explore for Sane:",
          "- map only relevant files and validators",
          "- return concrete evidence and open questions",
          "- skip generated repo overviews",
          ...packNotes
        ]
      })
    ],
    [
      SANE_IMPLEMENTATION_AGENT_NAME,
      createOpencodeAgentTemplate({
        description: "Implementation lane for Sane in OpenCode.",
        model: roles.executionModel,
        readOnly: false,
        body: [
          "Implement Sane work:",
          "- own assigned write scope and avoid collateral edits",
          "- read local patterns before patching",
          "- verify focused behavior after edits",
          ...packNotes
        ]
      })
    ],
    [
      SANE_REALTIME_AGENT_NAME,
      createOpencodeAgentTemplate({
        description: "Realtime helper lane for Sane in OpenCode.",
        model: roles.realtimeModel,
        readOnly: false,
        body: [
          "Run realtime Sane support:",
          "- handle small independent checks with tight context",
          "- escalate to coordinator lane when risk or scope grows",
          ...packNotes
        ]
      })
    ]
  ];
}

function createOpencodeAgentTemplate(input: {
  description: string;
  model: string;
  readOnly: boolean;
  body: string[];
}): string {
  const permissionBlock = input.readOnly
    ? [
        "permission:",
        "  edit: deny",
        "  bash: deny"
      ]
    : [];
  return [
    "---",
    `description: ${input.description}`,
    "mode: subagent",
    `model: ${input.model}`,
    "temperature: 0.1",
    ...permissionBlock,
    "---",
    "",
    ...input.body
  ].join("\n");
}

function opencodePackNotes(packs: GuidancePacks): string[] {
  return enabledOptionalPackNames(packs)
    .map((pack) => optionalPackPolicyLine(pack))
    .filter((line): line is string => Boolean(line))
    .map((line) => `- ${line}`);
}

function createOpencodeSessionStartPluginBody(packs: GuidancePacks): string {
  const guidance = [
    SESSION_START_BASE_GUIDANCE,
    "OpenCode-specific: for broad review, release audit, migration, multi-file repair, or architecture work, load required skills and call the `task` tool with a `sane-*` subagent before deep inspection.",
    "OpenCode-specific: when RTK pack is active, use RTK-native commands (`rtk grep`, `rtk read`, `rtk ls`, `rtk git`, `rtk pnpm`, `rtk vitest`) or wrap exact shell with `rtk run`.",
    ...opencodeSessionStartPackLines(packs)
  ].join(" ");
  return [
    `// ${OPENCODE_SESSION_START_PLUGIN_MARKER}`,
    "const SANE_SESSION_START_CONTEXT = " + JSON.stringify(guidance) + ";",
    "const SANE_RTK_ACTIVE = " + JSON.stringify(packs.rtk) + ";",
    "const broadSessions = new Set();",
    "const subagentSessions = new Set();",
    "",
    "function textFromParts(parts) {",
    "  return parts",
    "    .filter((part) => part && part.type === \"text\" && typeof part.text === \"string\")",
    "    .map((part) => part.text)",
    "    .join(\"\\n\");",
    "}",
    "",
    "function looksBroad(text) {",
    "  return /\\b(full|complete|entire|whole|broad|public|release|v1|audit|review|migration|refactor|architecture|codebase)\\b/i.test(text) &&",
    "    /\\b(codebase|repo|review|release|v1|audit|migration|refactor|architecture)\\b/i.test(text);",
    "}",
    "",
    "function isRtkCommand(command) {",
    "  const trimmed = command.trim();",
    "  return trimmed === \"rtk\" || trimmed.startsWith(\"rtk \");",
    "}",
    "",
    "function shellQuote(value) {",
    "  return \"'\" + value.replaceAll(\"'\", \"'\\\"'\\\"'\") + \"'\";",
    "}",
    "",
    "function blockedRtkCommand(command) {",
    "  return \"printf %s\\\\n \" + shellQuote(",
    "    \"Sane RTK guard: raw bash blocked. Use an RTK-native command (`rtk grep`, `rtk read`, `rtk ls`, `rtk git`, `rtk pnpm`, `rtk vitest`) or `rtk run '...` for exact shell. Original: \" + command",
    "  ) + \" >&2; exit 2\";",
    "}",
    "",
    "export const SaneSessionStartPlugin = async () => ({",
    "  \"chat.message\": async (input, output) => {",
    "    if (looksBroad(textFromParts(output.parts))) {",
    "      broadSessions.add(input.sessionID);",
    "    }",
    "  },",
    '  "experimental.chat.system.transform": async (_input, output) => {',
    "    output.system.push(SANE_SESSION_START_CONTEXT);",
    "  },",
    "  \"tool.definition\": async (input, output) => {",
    "    if ([\"bash\", \"read\", \"glob\", \"grep\", \"list\"].includes(input.toolID)) {",
    "      output.description = `${output.description}\\n\\nSane: if RTK is active, prefer RTK-native commands. For broad review/release work, call the task tool with a sane-* subagent before deep solo inspection.`;",
    "    }",
    "    if (input.toolID === \"task\") {",
    "      output.description = `${output.description}\\n\\nSane: broad codebase reviews, release audits, migrations, and multi-file work must start with a sane-* subagent handoff after required skills are loaded.`;",
    "    }",
    "  },",
    "  \"tool.execute.before\": async (input, output) => {",
    "    if (input.tool === \"task\") {",
    "      subagentSessions.add(input.sessionID);",
    "      return;",
    "    }",
    "    if (input.tool !== \"bash\" || !SANE_RTK_ACTIVE) {",
    "      return;",
    "    }",
    "    const command = typeof output.args?.command === \"string\" ? output.args.command : \"\";",
    "    if (command.trim().length > 0 && !isRtkCommand(command)) {",
    "      output.args = {",
    "        ...output.args,",
    "        command: blockedRtkCommand(command),",
    "        description: \"Sane RTK guard\"",
    "      };",
    "    }",
    "  }",
    "});",
    ""
  ].join("\n");
}

function opencodeSessionStartPackLines(packs: GuidancePacks): string[] {
  return enabledOptionalPackContinuityLines(packs);
}

function readOpencodeConfigJson(path: string):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false } {
  if (!existsSync(path)) {
    return { ok: true, value: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ok: true, value: parsed }
      : { ok: true, value: {} };
  } catch {
    return { ok: false };
  }
}

function upsertOpencodePluginReference(
  config: Record<string, unknown>,
  pluginPath: string
): Record<string, unknown> {
  const plugins = opencodePluginEntries(config);
  if (!opencodePluginReferences(config).includes(pluginPath)) {
    plugins.push(pluginPath);
  }
  return { ...config, plugin: plugins };
}

function removeOpencodePluginReference(
  config: Record<string, unknown>,
  pluginPath: string
): Record<string, unknown> {
  const plugins = opencodePluginEntries(config).filter((plugin) => plugin !== pluginPath);
  return { ...config, plugin: plugins };
}

function opencodePluginEntries(config: Record<string, unknown>): unknown[] {
  const plugin = config.plugin;
  if (Array.isArray(plugin)) {
    return [...plugin];
  }
  if (typeof plugin === "string") {
    return [plugin];
  }
  return [];
}

function opencodePluginReferences(config: Record<string, unknown>): string[] {
  return opencodePluginEntries(config).filter((item): item is string => typeof item === "string");
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

function isManagedOpencodeAgentBody(current: string, expected: string): boolean {
  return (
    current === expected ||
    current === markOpencodeAgentBody(expected) ||
    isLegacySaneOpencodeAgentBody(current)
  );
}

function isLegacySaneOpencodeAgentBody(current: string): boolean {
  return (
    current.startsWith("---\n") &&
    current.includes("mode: subagent") &&
    (current.includes("Work with Sane philosophy:") ||
      current.includes("Review with Sane philosophy:") ||
      current.includes("Explore with Sane philosophy:") ||
      current.includes("Implement with Sane philosophy:") ||
      current.includes("Run realtime Sane support:")) &&
    current.includes("RTK-first shell/search/test route")
  );
}

function markOpencodeAgentBody(body: string): string {
  const closingFrontmatter = body.indexOf("\n---\n", 4);
  if (body.startsWith("---\n") && closingFrontmatter >= 0) {
    const insertAt = closingFrontmatter + "\n---\n".length;
    return `${body.slice(0, insertAt)}${OPENCODE_AGENT_OWNERSHIP_MARKER}\n${body.slice(insertAt)}`;
  }
  return `${OPENCODE_AGENT_OWNERSHIP_MARKER}\n${body}`;
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
