import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SANE_CONTINUE_SKILL_NAME,
  SANE_AGENT_LANES_SKILL_NAME,
  SANE_AGENT_NAME,
  SANE_BOOTSTRAP_RESEARCH_SKILL_NAME,
  SANE_CAVEMAN_PACK_SKILL_NAME,
  SANE_DOCS_WRITING_PACK_SKILL_NAME,
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
      configKey?: keyof GuidancePacks;
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
      routerNote?: string;
      overlayNote?: string;
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
    expect(manifestSkills(manifest.optionalPacks["docs-craft"])[0]?.name).toBe(
      SANE_DOCS_WRITING_PACK_SKILL_NAME
    );
    expect(manifest.optionalPacks.caveman.provenance.kind).toBe("derived");
    expect(manifest.optionalPacks["frontend-craft"].provenance.kind).toBe("derived");
    for (const [packName, entry] of Object.entries(manifest.optionalPacks)) {
      expect(entry.policyNote, `${packName} should define canonical policyNote`).toBeTruthy();
      expect(entry.routerNote, `${packName} should not use deprecated routerNote`).toBeUndefined();
      expect(entry.overlayNote, `${packName} should not use deprecated overlayNote`).toBeUndefined();
    }
  });

  it("exposes one shared optional-pack roster and config-key mapping", () => {
    const manifest = readCoreManifest();
    expect(optionalPackNames()).toEqual(Object.keys(manifest.optionalPacks));
    expect(optionalPackConfigKey("caveman")).toBe("caveman");
    expect(optionalPackConfigKey("rtk")).toBe("rtk");
    expect(optionalPackConfigKey("frontend-craft")).toBe("frontendCraft");
    expect(optionalPackConfigKey("docs-craft")).toBe("docsCraft");
    for (const [packName, entry] of Object.entries(manifest.optionalPacks)) {
      expect(entry.configKey, `${packName} should define configKey`).toBeTruthy();
      expect(optionalPackConfigKey(packName)).toBe(entry.configKey);
    }
  });

  it("router skill renders from the checked-in core template", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: true,
      rtk: true,
      frontendCraft: false,
      docsCraft: false
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
    expect(body).toContain("Choose the next Sane surface with minimal context");
    expect(body).toContain("Load `sane-agent-lanes`; it owns lane planning");
    expect(body).toContain("do not route broad work to \"main session only\"");
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
    expect(createSaneAgentLanesSkill()).toContain("Research/planning lanes do not authorize later implementation");
    expect(createSaneAgentLanesSkill()).toContain("Do not count earlier research or planning lanes as the implementation handoff");
    expect(createSaneAgentLanesSkill()).toContain("Do not do a tiny solo pass for broad review");
    expect(createSaneAgentLanesSkill()).toContain("Do not pre-ask just because work is broad");
    expect(createSaneAgentLanesSkill()).toContain("Blocked, missing, or unauthorized subagent launch is never a reason to route broad work to \"main session only\"");
    expect(createSaneOutcomeContinuationSkill()).toContain("name: sane-outcome-continuation");
    expect(createSaneOutcomeContinuationSkill()).toContain("plain-language outcome");
    expect(createSaneOutcomeContinuationSkill()).toContain("Broad reviews need explorer/reviewer lanes");
    expect(createSaneOutcomeContinuationSkill()).toContain("ask once, and stop");
    expect(createSaneOutcomeContinuationSkill()).toContain("do not inspect, verify, patch, or continue broad work locally as a substitute");
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
      frontendCraft: true,
      docsCraft: false
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
    expect(body).toContain("Load `sane-router` or concrete skills only when triggered");
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
      frontendCraft: false,
      docsCraft: false
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
    expect(body).toContain("Repo `AGENTS.md`, repo-local skills, current worktree, and runtime state are project truth.");
    expect(body).toContain("Use the repo's own verify commands");
    expect(body).toContain("Sane repo overlay");
    expect(body).toContain("Use `sane-router` for Sane routing");
    expect(body).toContain("RTK pack active");
    expect(body).toContain("sane-rtk");
    expect(body).not.toContain("Current coordinator default");
    expect(body).not.toBe(createSaneGlobalAgentsOverlay(packs, roles));
    expect(body).not.toContain("{{");
  });

  it("derives router and overlay policy prose from one canonical manifest field", () => {
    const roles = roleGuidance();
    const manifest = readCoreManifest();
    const packs: GuidancePacks = {
      caveman: true,
      rtk: true,
      frontendCraft: true,
      docsCraft: true
    };
    const expectedNotes = Object.values(manifest.optionalPacks)
      .map((entry) => entry.policyNote)
      .filter((note): note is string => Boolean(note));
    const router = createSaneRouterSkill(packs, roles);
    const globalOverlay = createSaneGlobalAgentsOverlay(packs, roles);
    const repoOverlay = createSaneRepoAgentsOverlay(packs, roles);

    for (const note of expectedNotes) {
      expect(router).toContain(note);
      expect(globalOverlay).toContain(note);
      expect(repoOverlay).toContain(note);
    }
  });

  it("optional pack skills resolve directly from checked-in files", () => {
    const manifest = readCoreManifest();
    const cases: Array<[string, string]> = [
      ["caveman", SANE_CAVEMAN_PACK_SKILL_NAME],
      ["rtk", "sane-rtk"],
      ["frontend-craft", SANE_FRONTEND_CRAFT_PACK_SKILL_NAME],
      ["docs-craft", SANE_DOCS_WRITING_PACK_SKILL_NAME]
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
    expect(frontendCraft).toContain("Build frontend work that fits the product");
    expect(frontendCraft).toContain("UI implementation subagents should run on `gpt-5.5` with `high` reasoning");
    expect(frontendCraft).toContain("Use visual assets deliberately");

    const frontendSkills = createOptionalPackSkills("frontend-craft");
    expect(frontendSkills.find((skill) => skill.name === "sane-frontend-visual-assets")?.content).toContain(
      "Choose, generate, or direct visual assets"
    );

    const frontendReview =
      createOptionalPackSkills("frontend-craft").find((skill) => skill.name === "sane-frontend-review")?.content ?? "";
    expect(frontendReview).toContain("name: sane-frontend-review");
    expect(frontendReview).toContain("Catch visual, interaction, responsive, and asset defects");
    expect(frontendReview).toContain("Frontend review/visual QA subagents should run on `gpt-5.5` with `high` reasoning");
    expect(frontendReview).toContain("Review Checklist");

    const docsWriting = createOptionalPackSkill("docs-craft");
    expect(optionalPackSkillNames("docs-craft")).toEqual([SANE_DOCS_WRITING_PACK_SKILL_NAME]);
    expect(docsWriting).toContain("name: sane-docs-writing");
    expect(docsWriting).toContain("Write docs that help readers act from current truth");
    expect(docsWriting).toContain("Do not present the TUI as the normal prompting interface");
  });

  it("exposes pinned provenance seam for optional packs", () => {
    const caveman = optionalPackProvenance("caveman");
    const frontendCraft = optionalPackProvenance("frontend-craft");
    const docsCraft = optionalPackProvenance("docs-craft");
    const rtk = optionalPackProvenance("rtk");

    expect(caveman?.kind).toBe("derived");
    expect(frontendCraft?.kind).toBe("derived");
    expect(docsCraft?.kind).toBe("derived");
    expect(rtk?.kind).toBe("internal");
    if (
      caveman?.kind !== "derived" ||
      frontendCraft?.kind !== "derived" ||
      docsCraft?.kind !== "derived" ||
      rtk?.kind !== "internal"
    ) {
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
    expect(docsCraft).toMatchObject({
      kind: "derived",
      updateStrategy: "manual-curated",
      upstreams: [
        expect.objectContaining({ name: "google-gemini-docs-writer", role: "inspiration" }),
        expect.objectContaining({ name: "aiskillstore-writing-docs", role: "inspiration" }),
        expect.objectContaining({ name: "inkeep-docs-skill", role: "inspiration" }),
        expect.objectContaining({ name: "obra-writing-plans", role: "inspiration" })
      ]
    });
    expect(docsCraft?.note).toContain("ETH-aligned instruction-surface research");
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
      manifest.assets.agents.implementation,
      manifest.assets.agents.realtime,
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
    expect(agent).toContain("route with `sane-router`");
    expect(agent).toContain("follow-up implementation");
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
      frontendCraft: false,
      docsCraft: false
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
      expect(body).toContain("instruction hierarchy");
      expect(body).not.toContain("{{ENABLED_PACK_AGENT_NOTES}}");
    }
  });

});
