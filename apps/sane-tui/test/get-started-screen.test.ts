import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyCodexProfile } from "@sane/control-plane/codex-config.js";
import * as inventory from "@sane/control-plane/inventory.js";
import { exportAll } from "@sane/control-plane";
import { installRuntime } from "@sane/control-plane";
import { saveConfig } from "@sane/control-plane/preferences.js";
import { loadGetStartedScreen } from "@/get-started-screen.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-tui-start-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("get started screen model", () => {
  it("shows ordered onboarding steps and recommends runtime install first", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const screen = loadGetStartedScreen(paths, codexPaths);

    expect(screen.summary).toBe("Get Started");
    expect(screen.recommendedActionId).toBe("install_runtime");
    expect(screen.recommendedNextStep).toBe("Create Sane's local project files first.");
    expect(screen.codexProfileAudit.status).toBe("missing");
    expect(screen.codexProfileApply.status).toBe("ready");
    expect(screen.statusLine).toBe(
      "runtime missing | codex-config missing | user-skills missing | hooks missing | install bundle missing"
    );
    expect(screen.attentionItems).toEqual([
      "runtime: missing",
      "config: missing",
      "codex-config: missing",
      "user-skills: missing",
      "hooks: missing",
      "custom-agents: missing"
    ]);
    expect(screen.steps.map((step) => step.id)).toEqual([
      "install_runtime",
      "show_codex_config",
      "preview_codex_profile",
      "backup_codex_config",
      "apply_codex_profile",
      "export_all"
    ]);
    expect(screen.steps[0]?.filesTouched).toEqual([".sane/"]);
    expect(screen.steps[5]?.filesTouched).toEqual([
      "~/.agents/skills/sane-router",
      "~/.agents/skills/continue",
      "~/.codex/AGENTS.md",
      "~/.codex/hooks.json",
      "~/.codex/agents/"
    ]);
    expect(screen.attentionItems).toEqual([
      "runtime: missing",
      "config: missing",
      "codex-config: missing",
      "user-skills: missing",
      "hooks: missing",
      "custom-agents: missing"
    ]);
  });

  it("recommends Codex config review once runtime exists", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);

    const screen = loadGetStartedScreen(paths, codexPaths);

    expect(screen.recommendedActionId).toBe("show_codex_config");
    expect(screen.recommendedNextStep).toBe(
      "Inspect Codex config, then preview the core Codex profile."
    );
    expect(screen.codexProfilePreview.summary).toBe("codex-profile preview: 3 recommended change(s)");
  });

  it("recommends bundle export once runtime and core Codex config are in place", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    applyCodexProfile(paths, codexPaths);

    const screen = loadGetStartedScreen(paths, codexPaths);

    expect(screen.recommendedActionId).toBe("export_all");
    expect(screen.recommendedNextStep).toBe(
      "Install Sane into Codex so Codex can use Sane's guidance."
    );
    expect(screen.codexProfileApply.status).toBe("already_satisfied");
  });

  it("falls back to review/inspect guidance once onboarding bundle is installed", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    applyCodexProfile(paths, codexPaths);
    exportAll(paths, codexPaths);

    const screen = loadGetStartedScreen(paths, codexPaths);

    expect(screen.recommendedActionId).toBe(null);
    expect(screen.recommendedNextStep).toBe(
      "Review configure or inspect sections and change only what you actually want."
    );
  });

  it("uses the preloaded status bundle path when provided", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const bundle = inventory.inspectStatusBundle(paths, codexPaths);
    const fromBundleSpy = vi.spyOn(inventory, "inspectOnboardingSnapshotFromStatusBundle");
    const wrapperSpy = vi.spyOn(inventory, "inspectOnboardingSnapshot");

    const screen = loadGetStartedScreen(paths, codexPaths, bundle);

    expect(fromBundleSpy).toHaveBeenCalledTimes(1);
    expect(fromBundleSpy).toHaveBeenCalledWith(paths, bundle);
    expect(wrapperSpy).not.toHaveBeenCalled();
    expect(screen.recommendedActionId).toBe("install_runtime");
  });
});
