import { describe, expect, it } from "vitest";
import { statSync } from "node:fs";
import { resolve } from "node:path";

import {
  CORE_PACK_ROOT,
  corePackAssetOwnership,
  corePackAssetOwnershipStyle,
  corePackAssetSourceProvenance,
  corePackAssetSourceProvenanceStyle,
  createOptionalPackSkills,
  expectNonShallowGeneratedAsset,
  expectOperationalSkillBody,
  frontmatterField,
  isLikelyHelperScript,
  manifestSkills,
  optionalPackProvenance,
  parseCorePackManifest,
  readCoreAsset,
  readCoreAssetBuffer,
  readCoreManifest
} from "./framework-assets-helpers.js";

describe("framework asset parity and drift audits", () => {
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


  it("exposes ownership seam for core managed assets", () => {
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

    expect(manifest.assetOwnership?.style).toBe("sane-managed-asset-ownership");
    expect(corePackAssetOwnershipStyle()).toBe("sane-managed-asset-ownership");
    expect(Object.keys(manifest.assetOwnership?.items ?? {}).sort()).toEqual(
      [...requiredAssetPathSet].sort()
    );

    for (const path of requiredAssetPathSet) {
      const ownership = corePackAssetOwnership(path);
      expect(ownership).toEqual(manifest.assetOwnership?.items[path]);
      expect(ownership?.owner).toBe("sane");
      if (path.endsWith(".tmpl")) {
        expect(ownership?.mode).toBe("generated-managed");
        expect(ownership?.writeMode).toBe("overwrite");
      } else {
        expect(ownership?.mode).toBe("source-managed");
        expect(ownership?.writeMode).toBeUndefined();
      }
    }

    expect(corePackAssetOwnership("missing/file")).toBeUndefined();
  });


  it("rejects malformed ownership metadata", () => {
    const manifest = readCoreManifest();
    const ownedPath = manifest.assets.routerSkill;

    const wrongOwner = structuredClone(manifest);
    wrongOwner.assetOwnership!.items[ownedPath] = {
      owner: "not-sane" as "sane",
      mode: "generated-managed",
      writeMode: "overwrite"
    };
    expect(() => parseCorePackManifest(JSON.stringify(wrongOwner))).toThrow(
      `core pack asset ownership ${ownedPath} owner must be sane`
    );

    const missingGeneratedWriteMode = structuredClone(manifest);
    missingGeneratedWriteMode.assetOwnership!.items[ownedPath] = {
      owner: "sane",
      mode: "generated-managed"
    };
    expect(() => parseCorePackManifest(JSON.stringify(missingGeneratedWriteMode))).toThrow(
      `core pack asset ownership ${ownedPath} generated-managed writeMode must be overwrite`
    );

    const sourceWithWriteMode = structuredClone(manifest);
    sourceWithWriteMode.assetOwnership!.items[manifest.assets.bootstrapResearchSkill] = {
      owner: "sane",
      mode: "source-managed",
      writeMode: "overwrite"
    };
    expect(() => parseCorePackManifest(JSON.stringify(sourceWithWriteMode))).toThrow(
      `core pack asset ownership ${manifest.assets.bootstrapResearchSkill} source-managed must not define writeMode`
    );
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


  it("preserves optional skill support files exactly as manifest declares", () => {
    const manifest = readCoreManifest();

    for (const [packName, entry] of Object.entries(manifest.optionalPacks)) {
      const generatedSkills = createOptionalPackSkills(packName);
      const manifestDeclaredSkills = manifestSkills(entry);
      expect(generatedSkills.map((skill) => skill.name)).toEqual(
        manifestDeclaredSkills.map((skill) => skill.name)
      );

      for (const skill of manifestDeclaredSkills) {
        const generated = generatedSkills.find((candidate) => candidate.name === skill.name);
        expect(generated, `${packName}:${skill.name} should be exported`).toBeTruthy();
        const expectedResources = (skill.resources ?? []).map((resource) => ({
          path: resource.target,
          content: readCoreAsset(resource.source)
        }));
        expect(generated?.resources, `${packName}:${skill.name} resources should preserve mapping`).toEqual(
          expectedResources
        );
      }
    }
  });


  it("keeps executable helper-script resources operational when present", () => {
    const manifest = readCoreManifest();
    const resources = Object.values(manifest.optionalPacks).flatMap((entry) =>
      manifestSkills(entry).flatMap((skill) => skill.resources ?? [])
    );

    for (const resource of resources.filter((item) => isLikelyHelperScript(item.source))) {
      const sourcePath = resolve(CORE_PACK_ROOT, resource.source);
      const mode = statSync(sourcePath).mode;
      const ownerExecutable = (mode & 0o100) !== 0;
      const body = readCoreAsset(resource.source);
      expect(body.length, `${resource.source} should not be empty`).toBeGreaterThan(0);
      if (ownerExecutable) {
        expect(body, `${resource.source} should include shebang when executable`).toMatch(/^#!/);
      }
    }
  });


  it("rejects shallow generated asset bodies in contract checks", () => {
    expect(() => expectNonShallowGeneratedAsset("placeholder", "---\nname: placeholder\n---\n")).toThrow();
    expect(() => expectNonShallowGeneratedAsset("unresolved", "x".repeat(140) + "{{MODEL}}")).toThrow();
  });


  it("generated-managed core assets are operational, not shallow descriptors", () => {
    const manifest = readCoreManifest();

    for (const [path, ownership] of Object.entries(manifest.assetOwnership?.items ?? {})) {
      if (ownership.mode !== "generated-managed") {
        continue;
      }

      expectNonShallowGeneratedAsset(path, readCoreAsset(path).replace(/\{\{[^}]+\}\}/g, "filled"));
    }
  });


  it("source-managed skill assets are operational, not shallow descriptors", () => {
    const manifest = readCoreManifest();

    for (const [path, ownership] of Object.entries(manifest.assetOwnership?.items ?? {})) {
      if (ownership.mode !== "source-managed" || !path.includes("skills/")) {
        continue;
      }

      const body = readCoreAsset(path);
      if (/(\.png|\.jpg|\.jpeg|\.webp|\.gif|\.ico|\.svg)$/u.test(path)) {
        expect(readCoreAssetBuffer(path).byteLength, `${path} binary asset should not be empty`).toBeGreaterThan(0);
        continue;
      }
      expectOperationalSkillBody(path, body);
    }
  });


});
