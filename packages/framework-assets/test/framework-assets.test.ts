import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SANE_CONTINUE_SKILL_NAME,
  SANE_AGENT_NAME,
  SANE_CAVEMAN_PACK_SKILL_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
  SANE_FRONTEND_REVIEW_PACK_SKILL_NAME,
  SANE_REVIEWER_AGENT_NAME,
  createCoreSkills,
  createOptionalPackSkills,
  createDefaultGuidancePacks,
  createOptionalPackSkill,
  createSaneContinueSkill,
  createSaneOpencodeAgentTemplate,
  createSaneOpencodeAgentTemplateWithPacks,
  createSaneOpencodeExplorerAgentTemplate,
  createSaneOpencodeExplorerAgentTemplateWithPacks,
  createSaneOpencodeReviewerAgentTemplate,
  createSaneOpencodeReviewerAgentTemplateWithPacks,
  createSaneAgentTemplate,
  createSaneAgentTemplateWithPacks,
  createSaneExplorerAgentTemplate,
  createSaneExplorerAgentTemplateWithPacks,
  createSaneGlobalAgentsOverlay,
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
  type ModelRoleGuidance,
  type ModelRoutingGuidance
} from "../src/index.js";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../../..");
const CORE_PACK_ROOT = resolve(REPO_ROOT, "packs/core");
const FRONTEND_CRAFT_SKILL_NAMES = [
  SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
  "gpt-taste",
  "image-taste-frontend",
  "redesign-existing-projects",
  "high-end-visual-design",
  "full-output-enforcement",
  "minimalist-ui",
  "industrial-brutalist-ui",
  "stitch-design-taste",
  SANE_FRONTEND_REVIEW_PACK_SKILL_NAME
] as const;
const FRONTEND_CRAFT_SELECTION_LINES = [
  "- frontend-craft task picks: implementation, restyle, frontend-build -> design-taste-frontend",
  "- frontend-craft task picks: ambitious-frontend-build, gsap-motion, high-variance-layout -> gpt-taste",
  "- frontend-craft task picks: image-first-design, visual-reference, premium-landing-page -> image-taste-frontend",
  "- frontend-craft task picks: redesign, existing-project, visual-upgrade -> redesign-existing-projects",
  "- frontend-craft task picks: soft-premium-ui, agency-style, visual-polish -> high-end-visual-design",
  "- frontend-craft task picks: complete-output, no-placeholders, long-generation -> full-output-enforcement",
  "- frontend-craft task picks: minimalist-ui, editorial-ui, clean-interface -> minimalist-ui",
  "- frontend-craft task picks: brutalist-ui, mechanical-interface, bold-dashboard -> industrial-brutalist-ui",
  "- frontend-craft task picks: stitch-design, design-system, semantic-design -> stitch-design-taste",
  "- frontend-craft task picks: review, audit, critique, polish -> impeccable"
] as const;

interface CorePackManifest {
  name: string;
  assets: {
    routerSkill: string;
    continueSkill: string;
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

function manifestSkills(entry: CorePackManifest["optionalPacks"][string]) {
  return entry.skills ?? (entry.skillName && entry.skillPath ? [{ name: entry.skillName, path: entry.skillPath }] : []);
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
    expect(manifest.assets.continueSkill).toBe("skills/continue/SKILL.md");
    expect(manifest.assets.globalOverlay).toBe("overlays/global-agents.md.tmpl");
    expect(manifest.assets.repoOverlay).toBe("overlays/repo-agents.md.tmpl");
    expect(manifest.assets.agents.primary).toBe("agents/sane-agent.toml.tmpl");
    expect(manifest.assets.agents.reviewer).toBe("agents/sane-reviewer.toml.tmpl");
    expect(manifest.assets.agents.explorer).toBe("agents/sane-explorer.toml.tmpl");
    expect(manifest.assets.opencodeAgents.primary).toBe("agents/opencode/sane-agent.md.tmpl");
    expect(manifest.assets.opencodeAgents.reviewer).toBe("agents/opencode/sane-reviewer.md.tmpl");
    expect(manifest.assets.opencodeAgents.explorer).toBe("agents/opencode/sane-explorer.md.tmpl");
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
        "- caveman pack active: default to terse, token-efficient prose for normal narrative output; only switch to normal phrasing when exact commands, code, paths, URLs, errors, diffs, or quotes need it",
        "- rtk pack active: always route shell work through RTK instead of raw shell"
      ].join("\n"),
      ENABLED_PACK_SKILL_SELECTIONS: [
        "- caveman task picks: communication, brevity, token-efficiency -> sane-caveman"
      ].join("\n")
    });

    expect(body).toBe(expected);
    expect(body).toContain("custom agents");
    expect(body).toContain("Prefer task-specific skills first");
    expect(body).not.toContain("{{");
  });

  it("core always-on skills resolve directly from checked-in files", () => {
    const manifest = readCoreManifest();

    expect(createSaneContinueSkill()).toBe(readCoreAsset(manifest.assets.continueSkill));
    expect(createCoreSkills()).toEqual([
      {
        name: "sane-router",
        content: createSaneRouterSkill(createDefaultGuidancePacks(), roleGuidance()),
        resources: []
      },
      {
        name: SANE_CONTINUE_SKILL_NAME,
        content: readCoreAsset(manifest.assets.continueSkill),
        resources: []
      }
    ]);
    expect(createSaneContinueSkill()).toContain("name: continue");
    expect(createSaneContinueSkill()).toContain("Keep the current mainline moving");
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
        "- frontend-craft pack active: for frontend work, pick the real task-specific frontend skills (`design-taste-frontend`, `gpt-taste`, `image-taste-frontend`, Taste variants, `impeccable`) instead of vague pack wrappers"
      ].join("\n"),
      ENABLED_PACK_SKILL_SELECTIONS: FRONTEND_CRAFT_SELECTION_LINES.join("\n")
    });

    expect(body).toBe(expected);
    expect(body).toContain("frontend-craft pack active");
    expect(body).not.toContain("caveman pack active");
    expect(body).not.toContain("rtk pack active");
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
        "- rtk pack active: always route shell work through RTK instead of raw shell"
      ].join("\n"),
      ENABLED_PACK_SKILL_SELECTIONS: ""
    });

    expect(body).toBe(expected);
    expect(body).toContain("Start from repo `AGENTS.md`");
    expect(body).toContain("Use the repo's own verify commands");
    expect(body).not.toBe(createSaneGlobalAgentsOverlay(packs, roles));
    expect(body).not.toContain("{{");
  });

  it("optional pack skills resolve directly from checked-in files", () => {
    const manifest = readCoreManifest();
    const cases: Array<[string, string]> = [
      ["caveman", SANE_CAVEMAN_PACK_SKILL_NAME],
      ["frontend-craft", SANE_FRONTEND_CRAFT_PACK_SKILL_NAME]
    ];

    for (const [pack, name] of cases) {
      expect(optionalPackSkillName(pack)).toBe(name);
      expect(createOptionalPackSkill(pack)).toBe(
        readCoreAsset(manifestSkills(manifest.optionalPacks[pack])[0]!.path)
      );
    }

    const frontendCraft = createOptionalPackSkill("frontend-craft");
    expect(optionalPackSkillNames("frontend-craft")).toEqual(FRONTEND_CRAFT_SKILL_NAMES);
    expect(createOptionalPackSkills("frontend-craft")).toEqual([
      {
        name: SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
        content: readCoreAsset(manifestSkills(manifest.optionalPacks["frontend-craft"])[0]!.path),
        resources: []
      },
      {
        name: "gpt-taste",
        content: readCoreAsset("skills/vendor/frontend/gpt-tasteskill/SKILL.md"),
        resources: []
      },
      {
        name: "image-taste-frontend",
        content: readCoreAsset("skills/vendor/frontend/images-taste-skill/SKILL.md"),
        resources: []
      },
      {
        name: "redesign-existing-projects",
        content: readCoreAsset("skills/vendor/frontend/redesign-skill/SKILL.md"),
        resources: []
      },
      {
        name: "high-end-visual-design",
        content: readCoreAsset("skills/vendor/frontend/soft-skill/SKILL.md"),
        resources: []
      },
      {
        name: "full-output-enforcement",
        content: readCoreAsset("skills/vendor/frontend/output-skill/SKILL.md"),
        resources: []
      },
      {
        name: "minimalist-ui",
        content: readCoreAsset("skills/vendor/frontend/minimalist-skill/SKILL.md"),
        resources: []
      },
      {
        name: "industrial-brutalist-ui",
        content: readCoreAsset("skills/vendor/frontend/brutalist-skill/SKILL.md"),
        resources: []
      },
      {
        name: "stitch-design-taste",
        content: readCoreAsset("skills/vendor/frontend/stitch-skill/SKILL.md"),
        resources: [
          {
            path: "DESIGN.md",
            content: readCoreAsset("skills/vendor/frontend/stitch-skill/DESIGN.md")
          }
        ]
      },
      {
        name: SANE_FRONTEND_REVIEW_PACK_SKILL_NAME,
        content: readCoreAsset(manifestSkills(manifest.optionalPacks["frontend-craft"]).at(-1)!.path),
        resources: [
          {
            path: "reference/color-and-contrast.md",
            content: readCoreAsset("skills/vendor/frontend/impeccable/reference/color-and-contrast.md")
          },
          {
            path: "reference/craft.md",
            content: readCoreAsset("skills/vendor/frontend/impeccable/reference/craft.md")
          },
          {
            path: "reference/extract.md",
            content: readCoreAsset("skills/vendor/frontend/impeccable/reference/extract.md")
          },
          {
            path: "reference/interaction-design.md",
            content: readCoreAsset("skills/vendor/frontend/impeccable/reference/interaction-design.md")
          },
          {
            path: "reference/motion-design.md",
            content: readCoreAsset("skills/vendor/frontend/impeccable/reference/motion-design.md")
          },
          {
            path: "reference/responsive-design.md",
            content: readCoreAsset("skills/vendor/frontend/impeccable/reference/responsive-design.md")
          },
          {
            path: "reference/spatial-design.md",
            content: readCoreAsset("skills/vendor/frontend/impeccable/reference/spatial-design.md")
          },
          {
            path: "reference/typography.md",
            content: readCoreAsset("skills/vendor/frontend/impeccable/reference/typography.md")
          },
          {
            path: "reference/ux-writing.md",
            content: readCoreAsset("skills/vendor/frontend/impeccable/reference/ux-writing.md")
          }
        ]
      }
    ]);
    expect(frontendCraft).toContain("# High-Agency Frontend Skill");
    expect(frontendCraft).toContain("ACTIVE BASELINE CONFIGURATION");
    expect(frontendCraft).toContain("DESIGN_VARIANCE");
    expect(frontendCraft).toContain("ANTI-EMOJI POLICY");

    const frontendSkills = createOptionalPackSkills("frontend-craft");
    expect(frontendSkills.find((skill) => skill.name === "gpt-taste")?.content).toContain(
      "CORE DIRECTIVE: AWWWARDS-LEVEL DESIGN ENGINEERING"
    );
    expect(frontendSkills.find((skill) => skill.name === "image-taste-frontend")?.content).toContain(
      "CORE DIRECTIVE: IMAGE-FIRST WEBSITE DESIGN TO CODE"
    );
    expect(frontendSkills.find((skill) => skill.name === "stitch-design-taste")?.resources).toEqual([
      {
        path: "DESIGN.md",
        content: readCoreAsset("skills/vendor/frontend/stitch-skill/DESIGN.md")
      }
    ]);

    const frontendReview =
      createOptionalPackSkills("frontend-craft").find((skill) => skill.name === "impeccable")?.content ?? "";
    expect(frontendReview).toContain("name: impeccable");
    expect(frontendReview).toContain("Context Gathering Protocol");
    expect(frontendReview).toContain("Run impeccable teach");
    expect(frontendReview).toContain("Consult [typography reference](reference/typography.md)");
    expect(frontendReview).toContain('argument-hint: "[craft|teach|extract]"');
    expect(frontendReview).toContain("## Extract Mode");
  });

  it("exposes pinned provenance seam for optional packs", () => {
    expect(optionalPackProvenance("caveman")).toEqual({
      kind: "derived",
      note: "Pinned mirror of the upstream Caveman skill, exported under a Sane-managed name to avoid collisions with user-installed plugin skills.",
      updateStrategy: "pinned-manual",
      upstreams: [
        {
          name: "caveman",
          role: "primary",
          url: "https://github.com/JuliusBrussee/caveman",
          ref: "0.1.0",
          path: "skills/caveman/SKILL.md",
          license: "MIT"
        }
      ]
    });
    expect(optionalPackProvenance("frontend-craft")).toEqual({
      kind: "derived",
      note: "Pinned vendored mirror of every upstream Taste Skill skill plus Impeccable, exported under upstream skill names instead of Sane-written wrapper prose.",
      updateStrategy: "pinned-manual",
      upstreams: [
        {
          name: "taste-skill",
          role: "primary-skill-suite",
          url: "https://github.com/Leonxlnx/taste-skill",
          ref: "39dc15944b4ada367984489726b3849f400511ec",
          path: "skills/",
          license: null
        },
        {
          name: "impeccable",
          role: "review-secondary",
          url: "https://github.com/pbakaus/impeccable",
          ref: "00d485659af82982aef0328d0419c49a2716d123",
          path: "source/skills/impeccable/SKILL.md",
          license: "Apache-2.0"
        }
      ]
    });
    expect(optionalPackProvenance("rtk")).toEqual({
      kind: "internal",
      note: "Capability-only workflow pack for RTK-aware shell routing. No dedicated skill export until there is a concrete upstream skill worth mirroring.",
      updateStrategy: "manual-curated"
    });
    expect(optionalPackProvenance("missing-pack")).toBeUndefined();
  });

  it("exposes source provenance seam for core pack assets", () => {
    const manifest = readCoreManifest();
    const requiredAssetPaths = [
      manifest.assets.routerSkill,
      manifest.assets.continueSkill,
      manifest.assets.globalOverlay,
      manifest.assets.repoOverlay,
      manifest.assets.agents.primary,
      manifest.assets.agents.reviewer,
      manifest.assets.agents.explorer,
      manifest.assets.opencodeAgents.primary,
      manifest.assets.opencodeAgents.reviewer,
      manifest.assets.opencodeAgents.explorer,
      ...Object.values(manifest.optionalPacks).flatMap((entry) =>
        manifestSkills(entry).flatMap((skill) => [
          skill.path,
          ...((skill.resources ?? []).map((resource) => resource.source))
        ])
      )
    ];

    expect(manifest.assetSources?.style).toBe("pinned-upstream-link");
    expect(corePackAssetSourceProvenanceStyle()).toBe("pinned-upstream-link");

    for (const path of requiredAssetPaths) {
      const source = corePackAssetSourceProvenance(path);
      expect(source).toEqual(manifest.assetSources?.items[path]);
      expect(source?.repo.startsWith("https://")).toBe(true);
      expect(source?.path.length).toBeGreaterThan(0);
      expect(source?.ref.length).toBeGreaterThan(0);
      expect(source?.license.length).toBeGreaterThan(0);
      expect(source?.updateStrategy).toContain("manual");
    }

    expect(corePackAssetSourceProvenance("missing/file")).toBeUndefined();
  });

  it("custom agent templates render from checked-in files", () => {
    const roles = roleGuidance();
    const manifest = readCoreManifest();

    const agent = createSaneAgentTemplate(roles);
    const reviewer = createSaneReviewerAgentTemplate(roles);
    const explorer = createSaneExplorerAgentTemplate(roles);
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

    expect(agent).toBe(expectedAgent);
    expect(agent).toContain(`name = "${SANE_AGENT_NAME.replace("-", "_")}"`);
    expect(agent).toContain(`model = "${roles.coordinatorModel}"`);
    expect(agent).toContain("pick the most task-specific one");
    expect(agent).toContain("brief milestone updates only");
    expect(reviewer).toBe(expectedReviewer);
    expect(reviewer).toContain(`name = "${SANE_REVIEWER_AGENT_NAME.replace("-", "_")}"`);
    expect(reviewer).toContain(`model = "${roles.verifierModel}"`);
    expect(reviewer).toContain("dedicated review skills");
    expect(reviewer).toContain("missing validation");
    expect(explorer).toBe(expectedExplorer);
    expect(explorer).toContain(`name = "${SANE_EXPLORER_AGENT_NAME.replace("-", "_")}"`);
    expect(explorer).toContain(`model = "${roles.sidecarModel}"`);
    expect(agent).not.toContain("{{");
    expect(reviewer).not.toContain("{{");
    expect(explorer).not.toContain("{{");
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

    for (const body of [agent, reviewer, explorer]) {
      expect(body).toContain(
        "always use terse, token-efficient prose for normal narrative output"
      );
      expect(body).not.toContain("{{ENABLED_PACK_AGENT_NOTES}}");
    }
  });

  it("opencode agent templates render from checked-in files", () => {
    const roles = roleGuidance();
    const manifest = readCoreManifest();

    const agent = createSaneOpencodeAgentTemplate(roles);
    const reviewer = createSaneOpencodeReviewerAgentTemplate(roles);
    const explorer = createSaneOpencodeExplorerAgentTemplate(roles);
    const expectedAgent = renderTemplate(readCoreAsset(manifest.assets.opencodeAgents.primary), {
      MODEL: roles.coordinatorModel,
      ENABLED_PACK_AGENT_NOTES: ""
    });
    const expectedReviewer = renderTemplate(readCoreAsset(manifest.assets.opencodeAgents.reviewer), {
      MODEL: roles.verifierModel,
      ENABLED_PACK_AGENT_NOTES: ""
    });
    const expectedExplorer = renderTemplate(readCoreAsset(manifest.assets.opencodeAgents.explorer), {
      MODEL: roles.sidecarModel,
      ENABLED_PACK_AGENT_NOTES: ""
    });

    expect(agent).toBe(expectedAgent);
    expect(agent).toContain(`model: ${roles.coordinatorModel}`);
    expect(reviewer).toBe(expectedReviewer);
    expect(reviewer).toContain(`model: ${roles.verifierModel}`);
    expect(reviewer).toContain("write: false");
    expect(explorer).toBe(expectedExplorer);
    expect(explorer).toContain(`model: ${roles.sidecarModel}`);
    expect(explorer).toContain("bash: false");
    expect(agent).not.toContain("{{");
    expect(reviewer).not.toContain("{{");
    expect(explorer).not.toContain("{{");
  });

  it("opencode agent templates enforce enabled caveman pack rules", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: true,
      rtk: false,
      frontendCraft: false
    };

    const agent = createSaneOpencodeAgentTemplateWithPacks(roles, packs);
    const reviewer = createSaneOpencodeReviewerAgentTemplateWithPacks(roles, packs);
    const explorer = createSaneOpencodeExplorerAgentTemplateWithPacks(roles, packs);

    for (const body of [agent, reviewer, explorer]) {
      expect(body).toContain(
        "always use terse, token-efficient prose for normal narrative output"
      );
      expect(body).not.toContain("{{ENABLED_PACK_AGENT_NOTES}}");
    }
  });
});
