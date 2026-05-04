import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
import { describe, expect, it } from "vitest";

import { exportAll } from "../src/bundles.js";
import { applyCodexProfile } from "../src/codex-config.js";
import { installRuntime } from "../src/index.js";
import {
  inspectOnboardingSnapshot,
  inspectOnboardingSnapshotFromStatusBundle,
  inspectStatusBundle
} from "../src/inventory.js";
import { saveConfig } from "../src/preferences.js";
import { makeTempDir } from "./inventory-helpers.js";

describe("inventory onboarding recommendations", () => {
  it("keeps bundle-based onboarding snapshot aligned with the wrapper", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);

    const bundle = inspectStatusBundle(paths, codexPaths);

    expect(inspectOnboardingSnapshotFromStatusBundle(paths, bundle)).toEqual(
      inspectOnboardingSnapshot(paths, codexPaths)
    );
  });

  it("does not keep unsupported native Windows hooks in onboarding attention once the bundle is installed", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    applyCodexProfile(paths, codexPaths);
    exportAll(paths, codexPaths, "windows");

    const bundle = inspectStatusBundle(paths, codexPaths, "windows");
    const onboarding = inspectOnboardingSnapshotFromStatusBundle(paths, bundle);

    expect(onboarding.recommendedActionId).toBeNull();
    expect(onboarding.attentionItems.map((item) => item.id)).not.toContain("hooks");
  });

  it("derives onboarding recommendations from a narrow backend snapshot", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();

    expect(inspectOnboardingSnapshot(paths, codexPaths)).toMatchObject({
      recommendedActionId: "install_runtime",
      recommendedReason: "install_runtime",
      primaryStatuses: {
        runtime: "missing",
        codexConfig: "missing",
        userSkills: "missing",
        hooks: "missing",
        installBundle: "missing"
      },
      attentionItems: [
        { id: "runtime", status: "missing" },
        { id: "config", status: "missing" },
        { id: "codex-config", status: "missing" },
        { id: "user-skills", status: "missing" },
        { id: "hooks", status: "missing" },
        { id: "custom-agents", status: "missing" }
      ]
    });

    installRuntime(paths, codexPaths);
    expect(inspectOnboardingSnapshot(paths, codexPaths)).toMatchObject({
      recommendedActionId: "show_codex_config",
      recommendedReason: "show_codex_config"
    });

    saveConfig(paths, config);
    applyCodexProfile(paths, codexPaths);
    expect(inspectOnboardingSnapshot(paths, codexPaths)).toMatchObject({
      recommendedActionId: "export_all",
      recommendedReason: "export_all"
    });
  });
});
