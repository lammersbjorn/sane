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
import { loadHomeScreen, loadHomeScreenFromStatusBundle } from "@sane/sane-tui/home-screen.js";

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

    const screen = loadHomeScreen(paths, codexPaths);

    expect(screen.summary).toBe("Home");
    expect(screen.recommendedActionId).toBe("install_runtime");
    expect(screen.recommendedNextStep).toBe("Get this repo ready for Sane first.");
    expect(screen.codexProfileAudit.status).toBe("missing");
    expect(screen.codexProfileApply.status).toBe("ready");
    expect(screen.statusLine).toBe(
      "repo setup missing | codex setup missing | sane skills missing | codex hooks missing | sane add-ons missing"
    );
    expect(screen.attentionItems).toEqual([
      "repo setup missing",
      "saved defaults missing",
      "Codex setup missing",
      "Sane skills missing",
      "Codex hooks missing",
      "named agents missing"
    ]);
    expect(screen.steps.map((step) => step.id)).toEqual([
      "install_runtime",
      "open_config_editor",
      "preview_codex_profile",
      "backup_codex_config",
      "apply_codex_profile",
      "export_all",
      "doctor"
    ]);
    expect(screen.steps[0]?.filesTouched).toEqual([".sane/"]);
    expect(screen.steps[5]?.filesTouched).toEqual([
      "~/.agents/skills/sane-router",
      "~/.agents/skills/sane-bootstrap-research",
      "~/.agents/skills/sane-agent-lanes",
      "~/.agents/skills/sane-outcome-continuation",
      "~/.agents/skills/continue",
      "~/.codex/AGENTS.md",
      "~/.codex/hooks.json",
      "~/.codex/agents/"
    ]);
    expect(screen.attentionItems).toEqual([
      "repo setup missing",
      "saved defaults missing",
      "Codex setup missing",
      "Sane skills missing",
      "Codex hooks missing",
      "named agents missing"
    ]);
  });

  it("recommends Codex config review once runtime exists", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);

    const screen = loadHomeScreen(paths, codexPaths);

    expect(screen.recommendedActionId).toBe("preview_codex_profile");
    expect(screen.recommendedNextStep).toBe("Review Codex changes before you apply them.");
    expect(screen.codexProfilePreview.summary).toBe("codex-profile preview: 4 recommended change(s)");
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

    const screen = loadHomeScreen(paths, codexPaths);

    expect(screen.recommendedActionId).toBe("export_all");
    expect(screen.recommendedNextStep).toBe("Add Sane to Codex when the setup path looks right.");
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

    const screen = loadHomeScreen(paths, codexPaths);

    expect(screen.recommendedActionId).toBe("doctor");
    expect(screen.recommendedNextStep).toBe("Setup looks complete. Start on Check, then tune behavior or add-ons only when needed.");
  });

  it("builds from a preloaded status bundle when requested", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const bundle = inventory.inspectStatusBundle(paths, codexPaths);
    const fromBundleSpy = vi.spyOn(inventory, "inspectOnboardingSnapshotFromStatusBundle");
    const screen = loadHomeScreenFromStatusBundle(paths, codexPaths, bundle);

    expect(fromBundleSpy).toHaveBeenCalledTimes(1);
    expect(fromBundleSpy).toHaveBeenCalledWith(paths, bundle);
    expect(screen.recommendedActionId).toBe("install_runtime");
  });

  it("drops hooks from export-all files on native Windows", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    installRuntime(paths, codexPaths);
    applyCodexProfile(paths, codexPaths);
    exportAll(paths, codexPaths, "windows");

    const bundle = inventory.inspectStatusBundle(paths, codexPaths, "windows");
    const screen = loadHomeScreenFromStatusBundle(paths, codexPaths, bundle, undefined, "windows");

    expect(screen.recommendedActionId).toBe("doctor");
    expect(screen.attentionItems).not.toContain("hooks invalid");
    expect(screen.statusLine).toContain("hooks unsupported (use WSL)");
    expect(screen.steps[5]?.filesTouched).toEqual([
      "~/.agents/skills/sane-router",
      "~/.agents/skills/sane-bootstrap-research",
      "~/.agents/skills/sane-agent-lanes",
      "~/.agents/skills/sane-outcome-continuation",
      "~/.agents/skills/continue",
      "~/.codex/AGENTS.md",
      "~/.codex/agents/"
    ]);
  });
});
