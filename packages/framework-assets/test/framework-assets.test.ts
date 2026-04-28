import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SANE_CONTINUE_SKILL_NAME,
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_AGENT_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_CAVEMAN_PACK_SKILL_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
  SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME,
  SANE_FRONTEND_REVIEW_PACK_SKILL_NAME,
  SANE_IMPLEMENTATION_AGENT_NAME,
  SANE_OUTCOME_CONTINUATION_SKILL_NAME,
  SANE_REALTIME_AGENT_NAME,
  SANE_ROUTER_SKILL_NAME,
  SANE_REVIEWER_AGENT_NAME,
  createCoreSkills,
  createOptionalPackSkills,
  createDefaultGuidancePacks,
  createOptionalPackSkill,
  createSaneAgentLanesSkill,
  createSaneBootstrapResearchSkill,
  createSaneContinueSkill,
  createSaneOutcomeContinuationSkill,
  createSaneAgentTemplate,
  createSaneAgentTemplateWithPacks,
  createSaneExplorerAgentTemplate,
  createSaneExplorerAgentTemplateWithPacks,
  createSaneImplementationAgentTemplate,
  createSaneImplementationAgentTemplateWithPacks,
  createSaneGlobalAgentsOverlay,
  createSaneRealtimeAgentTemplate,
  createSaneRealtimeAgentTemplateWithPacks,
  createSaneRepoAgentsOverlay,
  createSaneReviewerAgentTemplate,
  createSaneReviewerAgentTemplateWithPacks,
  createSaneRouterSkill,
  corePackAssetSourceProvenance,
  corePackAssetSourceProvenanceStyle,
  optionalPackConfigKey,
  optionalPackNames,
  optionalPackSkillName,
  optionalPackSkillNames,
  optionalPackProvenance,
  type GuidancePacks,
  type PackAssetProvenance,
  type ModelRoutingGuidance
} from "../src/index.js";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../../..");
const CORE_PACK_ROOT = resolve(REPO_ROOT, "packs/core");
const SANE_PLUGIN_ROOT = resolve(REPO_ROOT, "plugins/sane");
const FRONTEND_CRAFT_SKILL_NAMES = [
  SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
  SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME,
  SANE_FRONTEND_REVIEW_PACK_SKILL_NAME
] as const;
const FRONTEND_CRAFT_SELECTION_LINES = [
  "- frontend-craft task picks: frontend-build, redesign, ui-implementation, visual-polish -> sane-frontend-craft",
  "- frontend-craft task picks: image-generation, visual-assets, hero-media, art-direction -> sane-frontend-visual-assets",
  "- frontend-craft task picks: frontend-review, responsive-qa, visual-audit, polish -> sane-frontend-review"
] as const;
const COMMIT_STYLE_RULE =
  "When committing, copy the repo's commit message style; if none exists or it is poor, default to Conventional Commits";
const LOWERCASE_COMMIT_STYLE_RULE = COMMIT_STYLE_RULE.replace("When", "when");

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
    {
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
      routerNote: string;
      overlayNote: string;
      provenance: PackAssetProvenance;
    }
  >;
  assetSources?: {
    style: string;
    items: Record<
      string,
      {
        repo: string;
        path: string;
        ref: string;
        license: string;
        updateStrategy: string;
      }
    >;
  };
}

function roleGuidance(): ModelRoutingGuidance {
  return {
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
}

function readCoreManifest(): CorePackManifest {
  return JSON.parse(readFileSync(resolve(CORE_PACK_ROOT, "manifest.json"), "utf8")) as CorePackManifest;
}

function readCoreAsset(path: string): string {
  return readFileSync(resolve(CORE_PACK_ROOT, path), "utf8");
}

function readPluginAsset(path: string): string {
  return readFileSync(resolve(SANE_PLUGIN_ROOT, path), "utf8");
}

function readPluginSkillAsset(skillName: string): string {
  return readPluginAsset(`skills/${skillName}/SKILL.md`);
}

function manifestSkills(entry: CorePackManifest["optionalPacks"][string]) {
  return entry.skills ?? (entry.skillName && entry.skillPath ? [{ name: entry.skillName, path: entry.skillPath }] : []);
}

function manifestSkillPath(entry: CorePackManifest["optionalPacks"][string], skillName: string): string {
  const skill = manifestSkills(entry).find((candidate) => candidate.name === skillName);
  if (!skill) {
    throw new Error(`missing manifest skill ${skillName}`);
  }
  return skill.path;
}

function frontmatterField(body: string, field: string): string | undefined {
  const match = body.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "");
}

function renderTemplate(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (body, [key, value]) => body.replaceAll(`{{${key}}}`, value),
    template
  );
}

describe("framework asset parity", () => {
  it("core pack manifest describes the managed asset files", () => {
    const manifest = readCoreManifest();

    expect(manifest.name).toBe("core");
    expect(manifest.assets.routerSkill).toBe("skills/sane-router.md.tmpl");
    expect(manifest.assets.bootstrapResearchSkill).toBe("skills/sane-bootstrap-research.md");
    expect(manifest.assets.agentLanesSkill).toBe("skills/sane-agent-lanes.md");
    expect(manifest.assets.outcomeContinuationSkill).toBe("skills/sane-outcome-continuation.md");
    expect(manifest.assets.continueSkill).toBe("skills/continue/SKILL.md");
    expect(manifest.assets.globalOverlay).toBe("overlays/global-agents.md.tmpl");
    expect(manifest.assets.repoOverlay).toBe("overlays/repo-agents.md.tmpl");
    expect(manifest.assets.agents.primary).toBe("agents/sane-agent.toml.tmpl");
    expect(manifest.assets.agents.reviewer).toBe("agents/sane-reviewer.toml.tmpl");
    expect(manifest.assets.agents.explorer).toBe("agents/sane-explorer.toml.tmpl");
    expect(manifest.assets.agents.implementation).toBe("agents/sane-implementation.toml.tmpl");
    expect(manifest.assets.agents.realtime).toBe("agents/sane-realtime.toml.tmpl");
    expect(manifestSkills(manifest.optionalPacks.caveman)[0]?.name).toBe(SANE_CAVEMAN_PACK_SKILL_NAME);
    expect(manifestSkills(manifest.optionalPacks["frontend-craft"])[0]?.name).toBe(
      SANE_FRONTEND_CRAFT_PACK_SKILL_NAME
    );
    expect(manifestSkills(manifest.optionalPacks["frontend-craft"]).map((skill) => skill.name)).toEqual(
      FRONTEND_CRAFT_SKILL_NAMES
    );
    expect(manifestSkills(manifest.optionalPacks["frontend-craft"]).at(-1)?.name).toBe(
      SANE_FRONTEND_REVIEW_PACK_SKILL_NAME
    );
    expect(manifest.optionalPacks.caveman.provenance.kind).toBe("derived");
    expect(manifest.optionalPacks["frontend-craft"].provenance.kind).toBe("derived");
  });

  it("exposes one shared optional-pack roster and config-key mapping", () => {
    expect(optionalPackNames()).toEqual(["caveman", "rtk", "frontend-craft"]);
    expect(optionalPackConfigKey("caveman")).toBe("caveman");
    expect(optionalPackConfigKey("rtk")).toBe("rtk");
    expect(optionalPackConfigKey("frontend-craft")).toBe("frontendCraft");
  });

  it("router skill renders from the checked-in core template", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: true,
      rtk: true,
      frontendCraft: false
    };
    const manifest = readCoreManifest();
    const template = readCoreAsset(manifest.assets.routerSkill);
    const body = createSaneRouterSkill(packs, roles);
    const expected = renderTemplate(template, {
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
      ENABLED_PACK_ROUTER_NOTES: [
        "- Caveman pack active: load `sane-caveman` for prose rules",
        "- RTK pack active: load `sane-rtk` for shell/search/test/log routing"
      ].join("\n"),
      ENABLED_PACK_SKILL_SELECTIONS: [
        "- caveman task picks: communication-style, caveman-prose, brevity -> sane-caveman",
        "- rtk task picks: shell, search, test, logs -> sane-rtk"
      ].join("\n")
    });

    expect(body).toBe(expected);
    expect(body).toContain("Use `sane-router` to choose the next Sane surface.");
    expect(body).toContain("Load `sane-agent-lanes`; that skill owns lane planning");
    expect(body).toContain("Load skills by trigger only:");
    expect(body).not.toContain("Broad read-only review still needs explorer");
    expect(body).not.toContain("{{");
  });

  it("core always-on skills resolve directly from checked-in files", () => {
    const manifest = readCoreManifest();

    expect(createSaneBootstrapResearchSkill()).toBe(readCoreAsset(manifest.assets.bootstrapResearchSkill));
    expect(createSaneAgentLanesSkill()).toBe(readCoreAsset(manifest.assets.agentLanesSkill));
    expect(createSaneOutcomeContinuationSkill()).toBe(readCoreAsset(manifest.assets.outcomeContinuationSkill));
    expect(createSaneContinueSkill()).toBe(readCoreAsset(manifest.assets.continueSkill));
    expect(createCoreSkills()).toEqual([
      {
        name: SANE_ROUTER_SKILL_NAME,
        content: createSaneRouterSkill(createDefaultGuidancePacks(), roleGuidance()),
        resources: []
      },
      {
        name: SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
        content: readCoreAsset(manifest.assets.bootstrapResearchSkill),
        resources: []
      },
      {
        name: SANE_AGENT_LANES_SKILL_NAME,
        content: readCoreAsset(manifest.assets.agentLanesSkill),
        resources: []
      },
      {
        name: SANE_OUTCOME_CONTINUATION_SKILL_NAME,
        content: readCoreAsset(manifest.assets.outcomeContinuationSkill),
        resources: []
      },
      {
        name: SANE_CONTINUE_SKILL_NAME,
        content: readCoreAsset(manifest.assets.continueSkill),
        resources: []
      }
    ]);
    expect(createSaneBootstrapResearchSkill()).toContain("name: sane-bootstrap-research");
    expect(createSaneBootstrapResearchSkill()).toContain("Choose a current, defensible project stack");
    expect(createSaneAgentLanesSkill()).toContain("name: sane-agent-lanes");
    expect(createSaneAgentLanesSkill()).toContain("owned lanes");
    expect(createSaneAgentLanesSkill()).toContain("Do not start broad edits before an implementation lane owns a disjoint write scope.");
    expect(createSaneAgentLanesSkill()).toContain("Do not do a tiny solo pass for broad review");
    expect(createSaneAgentLanesSkill()).toContain("Do not confuse missing explicit user authorization with a harness block");
    expect(createSaneOutcomeContinuationSkill()).toContain("name: sane-outcome-continuation");
    expect(createSaneOutcomeContinuationSkill()).toContain("plain-language outcome");
    expect(createSaneOutcomeContinuationSkill()).toContain("Broad reviews need explorer/reviewer lanes");
    expect(createSaneOutcomeContinuationSkill()).toContain("ask and pause");
    expect(createSaneOutcomeContinuationSkill()).not.toContain("smallest solo fallback");
    expect(createSaneOutcomeContinuationSkill()).not.toContain("advance_outcome");
    expect(createSaneContinueSkill()).toContain("name: continue");
    expect(createSaneContinueSkill()).toContain("Keep the current mainline moving");
    expect(createSaneContinueSkill()).toContain(`${COMMIT_STYLE_RULE}.`);
  });

  it("global overlay renders from the checked-in core template", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: false,
      rtk: false,
      frontendCraft: true
    };
    const manifest = readCoreManifest();
    const template = readCoreAsset(manifest.assets.globalOverlay);
    const body = createSaneGlobalAgentsOverlay(packs, roles);
    const expected = renderTemplate(template, {
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
      ENABLED_PACK_OVERLAY_NOTES: [
        "- Frontend-craft pack active: load the matching frontend skill for UI, asset, or visual-review work"
      ].join("\n"),
      ENABLED_PACK_SKILL_SELECTIONS: FRONTEND_CRAFT_SELECTION_LINES.join("\n")
    });

    expect(body).toBe(expected);
    expect(body).toContain("Use `sane-router` for Sane routing");
    expect(body).toContain("Frontend-craft pack active");
    expect(body).not.toContain("task picks:");
    expect(body).not.toContain("Current coordinator default");
    expect(body).not.toContain("{{");
  });

  it("repo overlay renders from the checked-in repo template and stays distinct from the global overlay", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: false,
      rtk: true,
      frontendCraft: false
    };
    const manifest = readCoreManifest();
    const template = readCoreAsset(manifest.assets.repoOverlay);
    const body = createSaneRepoAgentsOverlay(packs, roles);
    const expected = renderTemplate(template, {
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
      ENABLED_PACK_OVERLAY_NOTES: [
        "- RTK pack active: load `sane-rtk` for shell/search/test/log routing"
      ].join("\n"),
      ENABLED_PACK_SKILL_SELECTIONS: "- rtk task picks: shell, search, test, logs -> sane-rtk"
    });

    expect(body).toBe(expected);
    expect(body).toContain("Start from repo `AGENTS.md`");
    expect(body).toContain("Use the repo's own verify commands");
    expect(body).toContain("Sane-managed repo overlay");
    expect(body).toContain("Use `sane-router` for Sane routing");
    expect(body).toContain("RTK pack active");
    expect(body).toContain("sane-rtk");
    expect(body).not.toContain("Current coordinator default");
    expect(body).not.toBe(createSaneGlobalAgentsOverlay(packs, roles));
    expect(body).not.toContain("{{");
  });

  it("optional pack skills resolve directly from checked-in files", () => {
    const manifest = readCoreManifest();
    const cases: Array<[string, string]> = [
      ["caveman", SANE_CAVEMAN_PACK_SKILL_NAME],
      ["rtk", "sane-rtk"],
      ["frontend-craft", SANE_FRONTEND_CRAFT_PACK_SKILL_NAME]
    ];

    for (const [pack, name] of cases) {
      expect(optionalPackSkillName(pack)).toBe(name);
      expect(createOptionalPackSkill(pack)).toBe(
        readCoreAsset(manifestSkills(manifest.optionalPacks[pack])[0]!.path)
      );
    }

    const frontendCraft = createOptionalPackSkill("frontend-craft");
    const rtk = createOptionalPackSkill("rtk");
    expect(optionalPackSkillNames("rtk")).toEqual(["sane-rtk"]);
    expect(rtk).toContain("name: sane-rtk");
    expect(rtk).toContain("prefer RTK subcommands over raw shell");
    expect(rtk).toContain("Use `rtk run '<command>'` only when no native RTK command fits");
    expect(optionalPackSkillNames("frontend-craft")).toEqual(FRONTEND_CRAFT_SKILL_NAMES);
    expect(createOptionalPackSkills("frontend-craft")).toEqual([
      {
        name: SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
        content: readCoreAsset(
          manifestSkillPath(manifest.optionalPacks["frontend-craft"], SANE_FRONTEND_CRAFT_PACK_SKILL_NAME)
        ),
        resources: []
      },
      {
        name: SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME,
        content: readCoreAsset(
          manifestSkillPath(manifest.optionalPacks["frontend-craft"], SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME)
        ),
        resources: []
      },
      {
        name: SANE_FRONTEND_REVIEW_PACK_SKILL_NAME,
        content: readCoreAsset(
          manifestSkillPath(manifest.optionalPacks["frontend-craft"], SANE_FRONTEND_REVIEW_PACK_SKILL_NAME)
        ),
        resources: []
      }
    ]);
    expect(frontendCraft).toContain("name: sane-frontend-craft");
    expect(frontendCraft).toContain("Build frontend work that feels specific to the product");
    expect(frontendCraft).toContain("UI implementation subagents should run on `gpt-5.5` with `high` reasoning");
    expect(frontendCraft).toContain("Use visual assets deliberately");

    const frontendSkills = createOptionalPackSkills("frontend-craft");
    expect(frontendSkills.find((skill) => skill.name === "sane-frontend-visual-assets")?.content).toContain(
      "Choose, generate, or direct visual assets"
    );

    const frontendReview =
      createOptionalPackSkills("frontend-craft").find((skill) => skill.name === "sane-frontend-review")?.content ?? "";
    expect(frontendReview).toContain("name: sane-frontend-review");
    expect(frontendReview).toContain("Catch frontend defects that normal code checks miss");
    expect(frontendReview).toContain("Frontend review/visual QA subagents should run on `gpt-5.5` with `high` reasoning");
    expect(frontendReview).toContain("Review Checklist");
  });

  it("exposes pinned provenance seam for optional packs", () => {
    const caveman = optionalPackProvenance("caveman");
    const frontendCraft = optionalPackProvenance("frontend-craft");
    const rtk = optionalPackProvenance("rtk");

    expect(caveman?.kind).toBe("derived");
    expect(frontendCraft?.kind).toBe("derived");
    expect(rtk?.kind).toBe("internal");
    if (caveman?.kind !== "derived" || frontendCraft?.kind !== "derived" || rtk?.kind !== "internal") {
      throw new Error("unexpected optional pack provenance shape");
    }

    expect(caveman).toMatchObject({
      kind: "derived",
      updateStrategy: "pinned-manual",
      upstreams: [
        expect.objectContaining({
          name: "caveman",
          role: "primary",
          url: "https://github.com/JuliusBrussee/caveman"
        })
      ]
    });
    expect(caveman?.upstreams?.[0]?.ref).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(frontendCraft).toMatchObject({
      kind: "derived",
      updateStrategy: "manual-curated",
      upstreams: [
        expect.objectContaining({ name: "taste-skill", role: "inspiration" }),
        expect.objectContaining({ name: "impeccable", role: "inspiration" }),
        expect.objectContaining({ name: "make-interfaces-feel-better", role: "inspiration" })
      ]
    });
    expect(frontendCraft?.note).toContain("Sane-owned compact frontend craft pack");
    expect(frontendCraft?.upstreams?.filter((upstream) => upstream.ref).length).toBeGreaterThanOrEqual(2);
    expect(rtk).toMatchObject({
      kind: "internal",
      updateStrategy: "manual-curated"
    });
    expect(rtk?.note).toContain("RTK-aware shell routing");
    expect(optionalPackProvenance("missing-pack")).toBeUndefined();
  });

  it("exposes source provenance seam for core pack assets", () => {
    const manifest = readCoreManifest();
    const requiredAssetPaths = [
      manifest.assets.routerSkill,
      manifest.assets.bootstrapResearchSkill,
      manifest.assets.agentLanesSkill,
      manifest.assets.outcomeContinuationSkill,
      manifest.assets.continueSkill,
      manifest.assets.globalOverlay,
      manifest.assets.repoOverlay,
      manifest.assets.agents.primary,
      manifest.assets.agents.reviewer,
      manifest.assets.agents.explorer,
      ...Object.values(manifest.optionalPacks).flatMap((entry) =>
        manifestSkills(entry).flatMap((skill) => [
          skill.path,
          ...((skill.resources ?? []).map((resource) => resource.source))
        ])
      )
    ];
    const requiredAssetPathSet = new Set(requiredAssetPaths);

    expect(manifest.assetSources?.style).toBe("mixed-source-provenance");
    expect(corePackAssetSourceProvenanceStyle()).toBe("mixed-source-provenance");
    expect(Object.keys(manifest.assetSources?.items ?? {}).sort()).toEqual(
      [...requiredAssetPathSet].sort()
    );

    for (const path of requiredAssetPaths) {
      const source = corePackAssetSourceProvenance(path);
      expect(source).toEqual(manifest.assetSources?.items[path]);
      expect(source?.repo.startsWith("https://")).toBe(true);
      expect(source?.path.length).toBeGreaterThan(0);
      expect(source?.ref.length).toBeGreaterThan(0);
      if (source?.repo === "https://github.com/lammersbjorn/sane") {
        expect(source.ref).toBe("workspace");
      }
      expect(source?.license.length).toBeGreaterThan(0);
      expect(source?.updateStrategy).toContain("manual");
    }

    expect(corePackAssetSourceProvenance("missing/file")).toBeUndefined();
  });

  it("keeps every manifest-exported skill path current", () => {
    const manifest = readCoreManifest();

    for (const [packName, entry] of Object.entries(manifest.optionalPacks)) {
      for (const skill of manifestSkills(entry)) {
        const body = readCoreAsset(skill.path);
        expect(body, `${packName}:${skill.path}`).toMatch(/^---\n/);
        expect(frontmatterField(body, "name"), `${packName}:${skill.path}`).toBe(skill.name);
        expect(frontmatterField(body, "description"), `${packName}:${skill.path}`).toBeTruthy();
      }
    }
  });

  it("ships a local Codex plugin package with current manifest skills", () => {
    const manifest = readCoreManifest();
    const pluginManifest = JSON.parse(readPluginAsset(".codex-plugin/plugin.json")) as {
      name: string;
      skills: string;
      interface: { displayName: string; defaultPrompt: string[] };
    };
    const marketplace = JSON.parse(readFileSync(resolve(REPO_ROOT, ".agents/plugins/marketplace.json"), "utf8")) as {
      name: string;
      plugins: Array<{ name: string; source: { source: string; path: string } }>;
    };
    const pluginSkillNames = readdirSync(resolve(SANE_PLUGIN_ROOT, "skills")).sort();
    const expectedOptionalSkillNames = Object.values(manifest.optionalPacks)
      .flatMap((entry) => manifestSkills(entry).map((skill) => skill.name))
      .sort();

    expect(pluginManifest.name).toBe("sane");
    expect(pluginManifest.skills).toBe("./skills/");
    expect(pluginManifest.interface.displayName).toBe("Sane");
    expect(pluginManifest.interface.defaultPrompt.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(pluginManifest)).not.toContain("[TODO:");
    expect(marketplace.name).toBe("sane-local");
    expect(marketplace.plugins).toEqual([
      {
        name: "sane",
        source: { source: "local", path: "./plugins/sane" },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: "Productivity"
      }
    ]);
    expect(pluginSkillNames).toEqual(
      [
        SANE_ROUTER_SKILL_NAME,
        SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
        SANE_AGENT_LANES_SKILL_NAME,
        SANE_OUTCOME_CONTINUATION_SKILL_NAME,
        SANE_CONTINUE_SKILL_NAME,
        ...expectedOptionalSkillNames
      ].sort()
    );
    expect(pluginSkillNames).not.toContain("sane-self-hosting");
    expect(readPluginSkillAsset(SANE_ROUTER_SKILL_NAME)).toContain("name: sane-router");
    expect(readPluginSkillAsset(SANE_BOOTSTRAP_RESEARCH_SKILL_NAME)).toBe(
      readCoreAsset(manifest.assets.bootstrapResearchSkill)
    );
    expect(readPluginSkillAsset(SANE_AGENT_LANES_SKILL_NAME)).toBe(
      readCoreAsset(manifest.assets.agentLanesSkill)
    );
    expect(readPluginSkillAsset(SANE_OUTCOME_CONTINUATION_SKILL_NAME)).toBe(
      readCoreAsset(manifest.assets.outcomeContinuationSkill)
    );
    expect(readPluginSkillAsset(SANE_CONTINUE_SKILL_NAME)).toBe(readCoreAsset(manifest.assets.continueSkill));

    for (const entry of Object.values(manifest.optionalPacks)) {
      for (const skill of manifestSkills(entry)) {
        expect(readPluginSkillAsset(skill.name)).toBe(readCoreAsset(skill.path));
      }
    }
  });

  it("custom agent templates render from checked-in files", () => {
    const roles = roleGuidance();
    const manifest = readCoreManifest();

    const agent = createSaneAgentTemplate(roles);
    const reviewer = createSaneReviewerAgentTemplate(roles);
    const explorer = createSaneExplorerAgentTemplate(roles);
    const implementation = createSaneImplementationAgentTemplate(roles);
    const realtime = createSaneRealtimeAgentTemplate(roles);
    const expectedAgent = renderTemplate(readCoreAsset(manifest.assets.agents.primary), {
      MODEL: roles.coordinatorModel,
      MODEL_REASONING: roles.coordinatorReasoning,
      ENABLED_PACK_AGENT_NOTES: ""
    });
    const expectedReviewer = renderTemplate(readCoreAsset(manifest.assets.agents.reviewer), {
      MODEL: roles.verifierModel,
      MODEL_REASONING: roles.verifierReasoning,
      ENABLED_PACK_AGENT_NOTES: ""
    });
    const expectedExplorer = renderTemplate(readCoreAsset(manifest.assets.agents.explorer), {
      MODEL: roles.sidecarModel,
      MODEL_REASONING: roles.sidecarReasoning,
      ENABLED_PACK_AGENT_NOTES: ""
    });
    const expectedImplementation = renderTemplate(readCoreAsset(manifest.assets.agents.implementation), {
      MODEL: roles.executionModel,
      MODEL_REASONING: roles.executionReasoning,
      ENABLED_PACK_AGENT_NOTES: ""
    });
    const expectedRealtime = renderTemplate(readCoreAsset(manifest.assets.agents.realtime), {
      MODEL: roles.realtimeModel,
      MODEL_REASONING: roles.realtimeReasoning,
      ENABLED_PACK_AGENT_NOTES: ""
    });

    expect(agent).toBe(expectedAgent);
    expect(agent).toContain(`name = "${SANE_AGENT_NAME.replace("-", "_")}"`);
    expect(agent).toContain(`model = "${roles.coordinatorModel}"`);
    expect(agent).toContain("use `sane-router` skill as master router");
    expect(reviewer).toBe(expectedReviewer);
    expect(reviewer).toContain(`name = "${SANE_REVIEWER_AGENT_NAME.replace("-", "_")}"`);
    expect(reviewer).toContain(`model = "${roles.verifierModel}"`);
    expect(reviewer).toContain("dedicated review skills");
    expect(reviewer).toContain("missing validation");
    expect(explorer).toBe(expectedExplorer);
    expect(explorer).toContain(`name = "${SANE_EXPLORER_AGENT_NAME.replace("-", "_")}"`);
    expect(explorer).toContain(`model = "${roles.sidecarModel}"`);
    expect(implementation).toBe(expectedImplementation);
    expect(implementation).toContain(`name = "${SANE_IMPLEMENTATION_AGENT_NAME.replace("-", "_")}"`);
    expect(implementation).toContain(`model = "${roles.executionModel}"`);
    expect(realtime).toBe(expectedRealtime);
    expect(realtime).toContain(`name = "${SANE_REALTIME_AGENT_NAME.replace("-", "_")}"`);
    expect(realtime).toContain(`model = "${roles.realtimeModel}"`);
    expect(agent).not.toContain("{{");
    expect(reviewer).not.toContain("{{");
    expect(explorer).not.toContain("{{");
    expect(implementation).not.toContain("{{");
    expect(realtime).not.toContain("{{");
  });

  it("custom agent templates enforce enabled caveman pack rules", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: true,
      rtk: false,
      frontendCraft: false
    };

    const agent = createSaneAgentTemplateWithPacks(roles, packs);
    const reviewer = createSaneReviewerAgentTemplateWithPacks(roles, packs);
    const explorer = createSaneExplorerAgentTemplateWithPacks(roles, packs);
    const implementation = createSaneImplementationAgentTemplateWithPacks(roles, packs);
    const realtime = createSaneRealtimeAgentTemplateWithPacks(roles, packs);

    for (const body of [agent, reviewer, explorer, implementation, realtime]) {
      expect(body).toContain(
        "Caveman pack active"
      );
      expect(body).toContain("higher-priority rules");
      expect(body).not.toContain("{{ENABLED_PACK_AGENT_NOTES}}");
    }
  });

});
