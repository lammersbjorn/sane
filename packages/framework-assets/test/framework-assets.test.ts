import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

import {
  SANE_AGENT_NAME,
  SANE_CAVEMAN_PACK_SKILL_NAME,
  SANE_EXPLORER_AGENT_NAME,
  SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
  SANE_FRONTEND_REVIEW_PACK_SKILL_NAME,
  SANE_REVIEWER_AGENT_NAME,
  createOptionalPackSkills,
  createDefaultGuidancePacks,
  createOptionalPackSkill,
  createSaneOpencodeAgentTemplate,
  createSaneOpencodeExplorerAgentTemplate,
  createSaneOpencodeReviewerAgentTemplate,
  createSaneAgentTemplate,
  createSaneExplorerAgentTemplate,
  createSaneGlobalAgentsOverlay,
  createSaneReviewerAgentTemplate,
  createSaneRouterSkill,
  corePackAssetSourceProvenance,
  corePackAssetSourceProvenanceStyle,
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

interface CorePackManifest {
  name: string;
  assets: {
    routerSkill: string;
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
    expect(manifestSkills(manifest.optionalPacks["frontend-craft"])[1]?.name).toBe(
      SANE_FRONTEND_REVIEW_PACK_SKILL_NAME
    );
    expect(manifest.optionalPacks.caveman.provenance.kind).toBe("derived");
    expect(manifest.optionalPacks["frontend-craft"].provenance.kind).toBe("derived");
  });

  it("router skill renders from the checked-in core template", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: true,
      cavemem: false,
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
        "- caveman pack active: prefer terse, token-efficient prose when normal clarity still holds",
        "- rtk pack active: if RTK policy is present, route shell work through RTK instead of raw shell"
      ].join("\n")
    });

    expect(body).toBe(expected);
    expect(body).toContain("custom agents");
    expect(body).not.toContain("{{");
  });

  it("global overlay renders from the checked-in core template", () => {
    const roles = roleGuidance();
    const packs: GuidancePacks = {
      caveman: false,
      cavemem: true,
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
        "- cavemem pack active: prefer compact durable memory and handoff summaries",
        "- frontend-craft pack active: for frontend work, pick the dedicated build vs review skill instead of generic AI aesthetics"
      ].join("\n")
    });

    expect(body).toBe(expected);
    expect(body).toContain("cavemem pack active");
    expect(body).toContain("frontend-craft pack active");
    expect(body).not.toContain("caveman pack active");
    expect(body).not.toContain("rtk pack active");
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
    expect(optionalPackSkillNames("frontend-craft")).toEqual([
      SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
      SANE_FRONTEND_REVIEW_PACK_SKILL_NAME
    ]);
    expect(createOptionalPackSkills("frontend-craft")).toEqual([
      {
        name: SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
        content: readCoreAsset(manifestSkills(manifest.optionalPacks["frontend-craft"])[0]!.path)
      },
      {
        name: SANE_FRONTEND_REVIEW_PACK_SKILL_NAME,
        content: readCoreAsset(manifestSkills(manifest.optionalPacks["frontend-craft"])[1]!.path)
      }
    ]);
    expect(frontendCraft).toContain("Taste-inspired frontend implementation craft");
    expect(frontendCraft).toContain("gpt-taste");
    expect(frontendCraft).toContain("DESIGN_VARIANCE");
    expect(frontendCraft).toContain("avoid generic AI frontend aesthetics");
    expect(frontendCraft).toContain("sane-frontend-review");

    const frontendReview = createOptionalPackSkills("frontend-craft")[1]?.content ?? "";
    expect(frontendReview).toContain("Impeccable-style frontend review");
    expect(frontendReview).toContain("anti-pattern sweep");
    expect(frontendReview).toContain("findings first");
    expect(frontendReview).toContain("code-linked findings");
  });

  it("exposes pinned provenance seam for optional packs", () => {
    expect(optionalPackProvenance("caveman")).toEqual({
      kind: "derived",
      note: "Sane-curated adaptation of the Caveman plugin skill for builtin pack use.",
      updateStrategy: "manual-curated",
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
      note: "Sane-curated frontend pack built around Taste for implementation craft and Impeccable for review-shaped frontend quality guidance.",
      updateStrategy: "manual-curated",
      upstreams: [
        {
          name: "taste-skill",
          role: "primary",
          url: "https://github.com/Leonxlnx/taste-skill",
          ref: "main",
          path: "skills/taste-skill/SKILL.md"
        },
        {
          name: "impeccable",
          role: "review-secondary",
          url: "https://github.com/pbakaus/impeccable",
          ref: "main",
          path: "source/skills/impeccable/SKILL.md",
          license: "Apache-2.0"
        }
      ]
    });
    expect(optionalPackProvenance("cavemem")).toEqual({
      kind: "derived",
      note: "Sane-curated durable-memory pack derived from Cavemem's local-first memory model and README guidance, without mirroring its full MCP/runtime surface.",
      updateStrategy: "manual-curated",
      upstreams: [
        {
          name: "cavemem",
          role: "primary",
          url: "https://github.com/JuliusBrussee/cavemem",
          ref: "v0.1.3",
          path: "README.md",
          license: "MIT"
        }
      ]
    });
    expect(optionalPackProvenance("rtk")).toEqual({
      kind: "internal",
      note: "Sane-curated workflow pack for RTK-aware shell routing. Provenance stays repo-local for now.",
      updateStrategy: "manual-curated"
    });
    expect(optionalPackProvenance("missing-pack")).toBeUndefined();
  });

  it("exposes source provenance seam for core pack assets", () => {
    const manifest = readCoreManifest();
    const requiredAssetPaths = [
      manifest.assets.routerSkill,
      manifest.assets.globalOverlay,
      manifest.assets.repoOverlay,
      manifest.assets.agents.primary,
      manifest.assets.agents.reviewer,
      manifest.assets.agents.explorer,
      manifest.assets.opencodeAgents.primary,
      manifest.assets.opencodeAgents.reviewer,
      manifest.assets.opencodeAgents.explorer,
      ...Object.values(manifest.optionalPacks).flatMap((entry) => manifestSkills(entry).map((skill) => skill.path))
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
      MODEL_REASONING: roles.coordinatorReasoning
    });
    const expectedReviewer = renderTemplate(readCoreAsset(manifest.assets.agents.reviewer), {
      MODEL: roles.verifierModel,
      MODEL_REASONING: roles.verifierReasoning
    });
    const expectedExplorer = renderTemplate(readCoreAsset(manifest.assets.agents.explorer), {
      MODEL: roles.sidecarModel,
      MODEL_REASONING: roles.sidecarReasoning
    });

    expect(agent).toBe(expectedAgent);
    expect(agent).toContain(`name = "${SANE_AGENT_NAME.replace("-", "_")}"`);
    expect(agent).toContain(`model = "${roles.coordinatorModel}"`);
    expect(reviewer).toBe(expectedReviewer);
    expect(reviewer).toContain(`name = "${SANE_REVIEWER_AGENT_NAME.replace("-", "_")}"`);
    expect(reviewer).toContain(`model = "${roles.verifierModel}"`);
    expect(explorer).toBe(expectedExplorer);
    expect(explorer).toContain(`name = "${SANE_EXPLORER_AGENT_NAME.replace("-", "_")}"`);
    expect(explorer).toContain(`model = "${roles.sidecarModel}"`);
    expect(agent).not.toContain("{{");
    expect(reviewer).not.toContain("{{");
    expect(explorer).not.toContain("{{");
  });

  it("opencode agent templates render from checked-in files", () => {
    const roles = roleGuidance();
    const manifest = readCoreManifest();

    const agent = createSaneOpencodeAgentTemplate(roles);
    const reviewer = createSaneOpencodeReviewerAgentTemplate(roles);
    const explorer = createSaneOpencodeExplorerAgentTemplate(roles);
    const expectedAgent = renderTemplate(readCoreAsset(manifest.assets.opencodeAgents.primary), {
      MODEL: roles.coordinatorModel
    });
    const expectedReviewer = renderTemplate(readCoreAsset(manifest.assets.opencodeAgents.reviewer), {
      MODEL: roles.verifierModel
    });
    const expectedExplorer = renderTemplate(readCoreAsset(manifest.assets.opencodeAgents.explorer), {
      MODEL: roles.sidecarModel
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
});
