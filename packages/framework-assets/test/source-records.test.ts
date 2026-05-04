import { describe, expect, it } from "vitest";

import {
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_AGENT_NAME,
  SANE_BLOCKED_RESPONSE_GUARD_HOOK_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_CODEX_PROFILE_FRAGMENT_ID,
  SANE_COMMAND_SAFETY_GUARD_HOOK_NAME,
  SANE_CONTINUE_SKILL_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
  SANE_FRONTEND_REVIEW_PACK_SKILL_NAME,
  SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME,
  SANE_GENERATED_SURFACE_GUARD_HOOK_NAME,
  SANE_GLOBAL_AGENTS_BEGIN,
  SANE_GLOBAL_AGENTS_BLOCK_ID,
  SANE_GLOBAL_AGENTS_END,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_INTEGRATIONS_PROFILE_FRAGMENT_ID,
  SANE_OUTCOME_CONTINUATION_SKILL_NAME,
  SANE_REALTIME_AGENT_NAME,
  SANE_REPO_AGENTS_BEGIN,
  SANE_REPO_AGENTS_BLOCK_ID,
  SANE_REPO_AGENTS_END,
  SANE_REVIEWER_AGENT_NAME,
  SANE_ROUTER_SKILL_NAME,
  SANE_SESSION_START_HOOK_NAME,
  createDefaultGuidancePacks,
  createFrameworkSourceRecords,
  createSaneGlobalAgentsOverlay,
  createSaneRepoAgentsOverlay,
  createSaneRouterSkill,
  manifestSkills,
  readCoreAsset,
  readCoreManifest,
  renderCodexArtifacts,
  roleGuidance,
  sourceRecordHash,
  sourceRecordSourceId,
  type GuidancePacks
} from "./framework-assets-helpers.js";

describe("framework asset source records", () => {
  it("exposes minimal typed framework source records", () => {
    const manifest = readCoreManifest();
    const records = createFrameworkSourceRecords();
    const coreSkillNames = [
      SANE_ROUTER_SKILL_NAME,
      SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
      SANE_AGENT_LANES_SKILL_NAME,
      SANE_OUTCOME_CONTINUATION_SKILL_NAME,
      SANE_CONTINUE_SKILL_NAME
    ];
    const sourceManagedSkillAssets = {
      [SANE_BOOTSTRAP_RESEARCH_SKILL_NAME]: manifest.assets.bootstrapResearchSkill,
      [SANE_AGENT_LANES_SKILL_NAME]: manifest.assets.agentLanesSkill,
      [SANE_OUTCOME_CONTINUATION_SKILL_NAME]: manifest.assets.outcomeContinuationSkill,
      [SANE_CONTINUE_SKILL_NAME]: manifest.assets.continueSkill
    };
    const customAgentNames = [
      SANE_AGENT_NAME,
      SANE_REVIEWER_AGENT_NAME,
      SANE_EXPLORER_AGENT_NAME,
      SANE_IMPLEMENTATION_AGENT_NAME,
      SANE_REALTIME_AGENT_NAME
    ];

    expect(records.map((record) => record.kind)).toEqual([
      "agents-block",
      "agents-block",
      "core-skill",
      "core-skill",
      "core-skill",
      "core-skill",
      "core-skill",
      "custom-agent",
      "custom-agent",
      "custom-agent",
      "custom-agent",
      "custom-agent",
      "config-fragment",
      "config-fragment",
      "hook",
      "hook",
      "hook",
      "hook"
    ]);
    expect(records.map((record) => record.provider)).toEqual(records.map(() => "codex"));
    expect(records.map((record) => record.id)).toEqual([
      SANE_GLOBAL_AGENTS_BLOCK_ID,
      SANE_REPO_AGENTS_BLOCK_ID,
      SANE_ROUTER_SKILL_NAME,
      SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
      SANE_AGENT_LANES_SKILL_NAME,
      SANE_OUTCOME_CONTINUATION_SKILL_NAME,
      SANE_CONTINUE_SKILL_NAME,
      SANE_AGENT_NAME,
      SANE_REVIEWER_AGENT_NAME,
      SANE_EXPLORER_AGENT_NAME,
      SANE_IMPLEMENTATION_AGENT_NAME,
      SANE_REALTIME_AGENT_NAME,
      SANE_CODEX_PROFILE_FRAGMENT_ID,
      SANE_INTEGRATIONS_PROFILE_FRAGMENT_ID,
      SANE_SESSION_START_HOOK_NAME,
      SANE_COMMAND_SAFETY_GUARD_HOOK_NAME,
      SANE_GENERATED_SURFACE_GUARD_HOOK_NAME,
      SANE_BLOCKED_RESPONSE_GUARD_HOOK_NAME
    ]);

    const agentsBlocks = records.filter((record) => record.kind === "agents-block");
    const coreSkills = records.filter((record) => record.kind === "core-skill");
    const router = records.find((record) => record.id === SANE_ROUTER_SKILL_NAME);
    const customAgents = records.filter((record) => record.kind === "custom-agent");
    const configFragments = records.filter((record) => record.kind === "config-fragment");
    const hook = records.find((record) => record.kind === "hook");

    expect(agentsBlocks.map((record) => record.id)).toEqual([
      SANE_GLOBAL_AGENTS_BLOCK_ID,
      SANE_REPO_AGENTS_BLOCK_ID
    ]);
    expect(agentsBlocks[0]).toMatchObject({
      sourcePath: `packs/core/${manifest.assets.globalOverlay}`,
      targetPath: "global/AGENTS.md",
      mode: "generated-managed",
      executable: false,
      structuredKeys: ["AGENTS.md", "managedBlock", "begin", "end"],
      blockMarkers: {
        begin: SANE_GLOBAL_AGENTS_BEGIN,
        end: SANE_GLOBAL_AGENTS_END
      }
    });
    expect(agentsBlocks[0]?.content).toBe(createSaneGlobalAgentsOverlay(createDefaultGuidancePacks(), roleGuidance()));
    expect(agentsBlocks[1]).toMatchObject({
      sourcePath: `packs/core/${manifest.assets.repoOverlay}`,
      targetPath: "repo/AGENTS.md",
      mode: "generated-managed",
      executable: false,
      structuredKeys: ["AGENTS.md", "managedBlock", "begin", "end"],
      blockMarkers: {
        begin: SANE_REPO_AGENTS_BEGIN,
        end: SANE_REPO_AGENTS_END
      }
    });
    expect(agentsBlocks[1]?.content).toBe(createSaneRepoAgentsOverlay(createDefaultGuidancePacks(), roleGuidance()));

    expect(coreSkills.map((record) => record.id)).toEqual(coreSkillNames);
    expect(router).toMatchObject({
      sourcePath: `packs/core/${manifest.assets.routerSkill}`,
      targetPath: `skills/${SANE_ROUTER_SKILL_NAME}/SKILL.md`,
      mode: "generated-managed",
      executable: false,
      structuredKeys: ["name", "description"]
    });
    expect(router?.content).toContain("name: sane-router");
    expect(router?.content).toBe(createSaneRouterSkill(createDefaultGuidancePacks(), roleGuidance()));

    for (const [skillName, assetPath] of Object.entries(sourceManagedSkillAssets)) {
      const skill = coreSkills.find((record) => record.id === skillName);
      expect(skill).toMatchObject({
        sourcePath: `packs/core/${assetPath}`,
        targetPath: `skills/${skillName}/SKILL.md`,
        mode: "source-managed",
        executable: false,
        structuredKeys: ["name", "description"]
      });
      expect(skill?.content).toBe(readCoreAsset(assetPath));
      expect(skill?.content).toContain(`name: ${skillName}`);
    }

    expect(customAgents.map((record) => record.id)).toEqual(customAgentNames);
    for (const agentName of customAgentNames) {
      const agent = customAgents.find((record) => record.id === agentName);
      expect(agent).toMatchObject({
        targetPath: `agents/${agentName}.toml`,
        mode: "generated-managed",
        executable: false,
        blockMarker: "# managed-by: sane custom-agent"
      });
      expect(agent?.content).toContain(`name = "${agentName.replace("-", "_")}"`);
      expect(agent?.structuredKeys).toEqual([
        "name",
        "description",
        "model",
        "model_reasoning_effort",
        "sandbox_mode"
      ]);
    }

    expect(configFragments.map((record) => record.id)).toEqual([
      SANE_CODEX_PROFILE_FRAGMENT_ID,
      SANE_INTEGRATIONS_PROFILE_FRAGMENT_ID
    ]);
    expect(configFragments[0]).toMatchObject({
      sourcePath: "codex/config/codex-profile",
      targetPath: "config.toml",
      mode: "config-managed",
      executable: false,
      structuredKeys: ["model", "model_reasoning_effort", "compact_prompt", "features.codex_hooks"],
      blockMarker: "codex-profile"
    });
    expect(configFragments[0]?.content).toContain('model = "gpt-5.4"');
    expect(configFragments[0]?.content).toContain('model_reasoning_effort = "high"');
    expect(configFragments[0]?.content).toContain("[features]");
    expect(configFragments[0]?.content).toContain("codex_hooks = true");
    expect(configFragments[1]).toMatchObject({
      sourcePath: "codex/config/integrations-profile",
      targetPath: "config.toml",
      mode: "config-managed",
      executable: false,
      structuredKeys: ["mcp_servers.playwright"],
      blockMarker: "integrations-profile"
    });
    expect(configFragments[1]?.content).toContain("[mcp_servers.playwright]");
    expect(configFragments[1]?.content).not.toContain("[mcp_servers.context7]");
    expect(configFragments[1]?.content).not.toContain("[mcp_servers.grep_app]");

    expect(hook).toMatchObject({
      targetPath: "hooks.json",
      mode: "config-managed",
      executable: true,
      blockMarker: "hook session-start"
    });
    expect(hook?.content).toContain("\"SessionStart\"");
    expect(hook?.structuredKeys).toContain("statusMessage");

    for (const record of records) {
      expect(record.provenance).toEqual({
        owner: "sane",
        sourcePath: record.sourcePath,
        updateStrategy: record.mode === "source-managed" ? "manual-curated" : "rendered-managed"
      });
      expect(record.hash).toBe(sourceRecordHash(record.content));
      expect(record.sourceId).toBe(sourceRecordSourceId(record));
      expect(record.content).not.toMatch(/\{\{[^}]+\}\}/);
    }
  });


  it("keeps optional pack framework source records disabled by default", () => {
    const records = createFrameworkSourceRecords();
    const artifacts = renderCodexArtifacts();
    const optionalSkillNames = Object.values(readCoreManifest().optionalPacks).flatMap((entry) =>
      manifestSkills(entry).map((skill) => skill.name)
    );

    for (const skillName of optionalSkillNames) {
      expect(records.find((record) => record.id === skillName)).toBeUndefined();
      expect(artifacts.find((artifact) => artifact.path === `skills/${skillName}/SKILL.md`)).toBeUndefined();
    }
  });


  it("adds enabled optional pack skills and support files to framework source records", () => {
    const manifest = readCoreManifest();
    const packs: GuidancePacks = {
      caveman: true,
      rtk: true,
      frontendCraft: true,
      docsCraft: true
    };
    const records = createFrameworkSourceRecords({ packs, roles: roleGuidance() });
    const artifacts = renderCodexArtifacts({ packs, roles: roleGuidance() });
    const expectedSkills = Object.entries(manifest.optionalPacks).flatMap(([packName, entry]) =>
      manifestSkills(entry).map((skill) => ({ packName, skill }))
    );

    expect(records.filter((record) => record.id === SANE_FRONTEND_CRAFT_PACK_SKILL_NAME)).toHaveLength(1);
    expect(records.filter((record) => record.id === SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME)).toHaveLength(1);
    expect(records.filter((record) => record.id === SANE_FRONTEND_REVIEW_PACK_SKILL_NAME)).toHaveLength(1);

    for (const { packName, skill } of expectedSkills) {
      const record = records.find((candidate) => candidate.id === skill.name);
      const artifact = artifacts.find((candidate) => candidate.path === `skills/${skill.name}/SKILL.md`);

      expect(record).toMatchObject({
        kind: "core-skill",
        sourcePath: `packs/core/${skill.path}`,
        targetPath: `skills/${skill.name}/SKILL.md`,
        mode: "source-managed",
        executable: false,
        structuredKeys: ["name", "description", "optionalPack", packName],
        hash: sourceRecordHash(readCoreAsset(skill.path))
      });
      expect(record?.sourceId).toBe(sourceRecordSourceId(record!));
      expect(record?.content).toBe(readCoreAsset(skill.path));
      expect(record?.content).toContain(`name: ${skill.name}`);
      expect(artifact).toMatchObject({
        path: `skills/${skill.name}/SKILL.md`,
        mode: "file",
        ownershipMode: "source-managed",
        hash: sourceRecordHash(readCoreAsset(skill.path)),
        sourceId: sourceRecordSourceId(record!)
      });
      expect(artifact?.structuredKeys).toEqual(record?.structuredKeys);
      expect(artifact?.provenance).toEqual(record?.provenance);

      for (const resource of skill.resources ?? []) {
        const resourceRecord = records.find((candidate) => candidate.id === `${skill.name}:${resource.target}`);
        const resourceArtifact = artifacts.find(
          (candidate) => candidate.path === `skills/${skill.name}/${resource.target}`
        );

        expect(resourceRecord).toMatchObject({
          kind: "core-skill-support",
          name: `${skill.name}/${resource.target}`,
          sourcePath: `packs/core/${resource.source}`,
          targetPath: `skills/${skill.name}/${resource.target}`,
          mode: "source-managed",
          structuredKeys: ["optionalPack", packName, "skill", skill.name, "supportFile"],
          hash: sourceRecordHash(readCoreAsset(resource.source))
        });
        expect(resourceRecord?.sourceId).toBe(sourceRecordSourceId(resourceRecord!));
        expect(resourceRecord?.content).toBe(readCoreAsset(resource.source));
        expect(resourceArtifact).toMatchObject({
          path: `skills/${skill.name}/${resource.target}`,
          mode: "file",
          ownershipMode: "source-managed",
          hash: sourceRecordHash(readCoreAsset(resource.source)),
          sourceId: sourceRecordSourceId(resourceRecord!)
        });
      }
    }
  });


});
