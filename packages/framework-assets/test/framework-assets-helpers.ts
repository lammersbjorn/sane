import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect } from "vitest";

import * as frameworkAssets from "../src/index.js";

export * from "../src/index.js";
export { parseCorePackManifest } from "../src/core-pack-manifest.js";

export const TEST_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(TEST_DIR, "../../..");
export const CORE_PACK_ROOT = resolve(REPO_ROOT, "packs/core");
export const FRONTEND_CRAFT_SKILL_NAMES = [
  frameworkAssets.SANE_FRONTEND_CRAFT_PACK_SKILL_NAME,
  frameworkAssets.SANE_FRONTEND_VISUAL_ASSETS_PACK_SKILL_NAME,
  frameworkAssets.SANE_FRONTEND_REVIEW_PACK_SKILL_NAME
] as const;
export const FRONTEND_CRAFT_SELECTION_LINES = [
  "- frontend-craft task picks: frontend-build, redesign, ui-implementation, visual-polish -> sane-frontend-craft",
  "- frontend-craft task picks: image-generation, visual-assets, hero-media, art-direction -> sane-frontend-visual-assets",
  "- frontend-craft task picks: frontend-review, responsive-qa, visual-audit, polish -> sane-frontend-review"
] as const;
export const COMMIT_STYLE_RULE =
  "When committing, copy the repo's commit message style; if none exists or it is poor, default to Conventional Commits";
export const LOWERCASE_COMMIT_STYLE_RULE = COMMIT_STYLE_RULE.replace("When", "when");

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
  optionalPacks: Record<
    string,
    {
      configKey?: keyof frameworkAssets.GuidancePacks;
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
      provenance: frameworkAssets.PackAssetProvenance;
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
  assetOwnership?: {
    style: string;
    items: Record<
      string,
      {
        owner: "sane";
        mode: "source-managed" | "generated-managed";
        writeMode?: "overwrite";
      }
    >;
  };
}

export function roleGuidance(): frameworkAssets.ModelRoutingGuidance {
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

export function readCoreManifest(): CorePackManifest {
  return JSON.parse(readFileSync(resolve(CORE_PACK_ROOT, "manifest.json"), "utf8")) as CorePackManifest;
}

export function readCoreAsset(path: string): string {
  return readFileSync(resolve(CORE_PACK_ROOT, path), "utf8");
}

export function readCoreAssetBuffer(path: string): Buffer {
  return readFileSync(resolve(CORE_PACK_ROOT, path));
}

export function isLikelyHelperScript(path: string): boolean {
  return /(^|\/)scripts\//.test(path) || /\.(?:sh|bash|zsh|py|js|mjs|cjs|ts)$/u.test(path);
}

export function manifestSkills(entry: CorePackManifest["optionalPacks"][string]) {
  return entry.skills ?? (entry.skillName && entry.skillPath ? [{ name: entry.skillName, path: entry.skillPath }] : []);
}

export function manifestSkillPath(entry: CorePackManifest["optionalPacks"][string], skillName: string): string {
  const skill = manifestSkills(entry).find((candidate) => candidate.name === skillName);
  if (!skill) {
    throw new Error(`missing manifest skill ${skillName}`);
  }
  return skill.path;
}

export function frontmatterField(body: string, field: string): string | undefined {
  const match = body.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "");
}

export function renderTemplate(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (body, [key, value]) => body.replaceAll(`{{${key}}}`, value),
    template
  );
}

export function expectNonShallowGeneratedAsset(path: string, body: string): void {
  const trimmed = body.trim();
  expect(trimmed.length, `${path} should not be placeholder-only`).toBeGreaterThan(120);
  expect(trimmed, `${path} should not leave template tokens unresolved`).not.toMatch(/\{\{[^}]+\}\}/);
  expect(trimmed, `${path} should include operational contract prose`).toMatch(
    /instruction hierarchy|managed block|Sane philosophy|Load skills|repo-local evidence/
  );
}

export function expectOperationalSkillBody(path: string, body: string): void {
  const trimmed = body.trim();
  expect(trimmed.length, `${path} should not be shallow`).toBeGreaterThan(220);
  expect(trimmed, `${path} should include frontmatter`).toMatch(/^---\n[\s\S]+?\n---\n/m);
  expect(trimmed, `${path} should include operational sections`).toMatch(
    /^## (Goal|Use When|How To Run|Inputs|Rules|Workflow|Verification|Safety|Boundaries)/m
  );
  expect(trimmed, `${path} should include concrete execution language`).toMatch(
    /\b(must|should|do not|prefer|use)\b/i
  );
}
