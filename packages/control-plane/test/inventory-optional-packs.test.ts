import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/control-plane/core.js";
import { optionalPackSkillNames } from "@sane/framework-assets";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
import { describe, expect, it } from "vitest";

import { exportUserSkills } from "../src/codex-native.js";
import { installRuntime } from "../src/index.js";
import { inspectStatusBundle } from "../src/inventory.js";
import { saveConfig } from "../src/preferences.js";
import { makeTempDir } from "./inventory-helpers.js";

describe("inventory optional pack behavior", () => {
  it("does not mark a multi-skill pack installed when only one exported skill matches", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.frontendCraft = true;

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    exportUserSkills(paths, codexPaths);
    rmSync(join(codexPaths.userSkillsDir, "sane-frontend-review"), { recursive: true, force: true });

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.optionalPacks.find((item) => item.name === "frontend-craft")).toEqual(
      expect.objectContaining({
        status: "configured",
        skillNames: optionalPackSkillNames("frontend-craft")
      })
    );
    expect(bundle.inventory.find((item) => item.name === "pack-frontend-craft")?.status).toBe(
      InventoryStatus.Configured
    );
  });

  it("marks a pack invalid when a shipped frontend skill goes missing", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.frontendCraft = true;

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    exportUserSkills(paths, codexPaths);
    writeFileSync(
      join(codexPaths.userSkillsDir, "sane-frontend-visual-assets", "SKILL.md"),
      "stale frontend asset skill",
      "utf8"
    );

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(bundle.optionalPacks.find((item) => item.name === "frontend-craft")).toEqual(
      expect.objectContaining({
        status: "invalid",
        skillNames: optionalPackSkillNames("frontend-craft")
      })
    );
    expect(bundle.inventory.find((item) => item.name === "pack-frontend-craft")?.status).toBe(
      InventoryStatus.Invalid
    );
  });
});
