import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as codexConfig from "@sane/control-plane/codex-config.js";
import * as preferencesControlPlane from "@sane/control-plane/preferences.js";
import { loadSettingsScreen } from "@sane/sane-tui/settings-screen.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-tui-settings-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("settings screen model", () => {
  it("falls back to recommended config defaults when local config is missing", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const screen = loadSettingsScreen(paths, codexPaths);

    expect(screen.summary).toBe("Settings");
    expect(screen.source).toBe("recommended");
    expect(screen.models.coordinator.model).toBe("gpt-5.5");
    expect(screen.models.sidecar.model).toBe("gpt-5.4-mini");
    expect(screen.derivedRouting.execution.model).toBe("gpt-5.5");
    expect(screen.derivedRouting.realtime.model).toBe("gpt-5.3-codex-spark");
    expect(screen.subagents.explorer.model).toBe("gpt-5.4-mini");
    expect(screen.subagents.implementation.model).toBe("gpt-5.5");
    expect(screen.subagents.realtime.model).toBe("gpt-5.3-codex-spark");
    expect(screen.subagents.frontendCraft.model).toBe("gpt-5.5");
    expect(screen.subagents.frontendCraft.reasoningEffort).toBe("high");
    expect(screen.telemetry).toBe("off");
    expect(screen.autoUpdates).toBe(false);
    expect(screen.telemetryFiles).toEqual({
      dirPresent: false,
      summaryPresent: false,
      eventsPresent: false,
      queuePresent: false
    });
    expect(screen.enabledPacks).toEqual(["core"]);
    expect(screen.statuslineAudit.status).toBe("missing");
    expect(screen.statuslineApply.status).toBe("ready");
    expect(screen.cloudflareAudit.status).toBe("missing");
    expect(screen.cloudflareApply.status).toBe("ready");
    expect(screen.actions.map((action) => action.id)).toEqual([
      "open_config_editor",
      "open_pack_editor",
      "open_privacy_editor",
      "show_config",
      "show_codex_config",
      "preview_statusline_profile",
      "apply_statusline_profile",
      "preview_cloudflare_profile",
      "apply_cloudflare_profile",
      "toggle_auto_updates"
    ]);
  });

  it("uses the local config snapshot when runtime config exists", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2";
    config.packs.caveman = true;
    config.privacy.telemetry = "product-improvement";
    config.updates.auto = true;

    preferencesControlPlane.saveConfig(paths, config);
    const screen = loadSettingsScreen(paths, codexPaths);

    expect(screen.source).toBe("local");
    expect(screen.models.coordinator.model).toBe("gpt-5.2");
    expect(screen.derivedRouting.execution.model).toBe("gpt-5.5");
    expect(screen.derivedRouting.realtime.model).toBe("gpt-5.3-codex-spark");
    expect(screen.subagents.explorer.model).toBe("gpt-5.4-mini");
    expect(screen.subagents.frontendCraft.model).toBe("gpt-5.5");
    expect(screen.autoUpdates).toBe(true);
    expect(screen.telemetryFiles).toEqual({
      dirPresent: true,
      summaryPresent: true,
      eventsPresent: true,
      queuePresent: false
    });
    expect(screen.enabledPacks).toEqual(["core", "caveman"]);
    expect(screen.statuslinePreview.summary).toBe("statusline-profile preview: 3 recommended change(s)");
    expect(screen.cloudflarePreview.summary).toBe("cloudflare-profile preview: 1 recommended change(s)");
  });

  it("reads preferences and provider profile data through family snapshot helpers", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const preferencesFamilySpy = vi.spyOn(
      preferencesControlPlane,
      "inspectPreferencesFamilySnapshot"
    );
    const familySpy = vi.spyOn(codexConfig, "inspectCodexProfileFamilySnapshot");

    const screen = loadSettingsScreen(paths, codexPaths);

    expect(preferencesFamilySpy).toHaveBeenCalledTimes(1);
    expect(preferencesFamilySpy).toHaveBeenCalledWith(paths, codexPaths);
    expect(familySpy).toHaveBeenCalledTimes(1);
    expect(familySpy).toHaveBeenCalledWith(codexPaths);
    expect(screen.statuslineAudit.status).toBe("missing");
    expect(screen.cloudflareAudit.status).toBe("missing");
  });

  it("can build from a preloaded preferences family snapshot", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const snapshot = preferencesControlPlane.inspectPreferencesFamilySnapshot(paths, codexPaths);
    const preferencesFamilySpy = vi.spyOn(
      preferencesControlPlane,
      "inspectPreferencesFamilySnapshot"
    );
    preferencesFamilySpy.mockClear();

    const screen = loadSettingsScreen(paths, codexPaths, undefined, snapshot);

    expect(preferencesFamilySpy).not.toHaveBeenCalled();
    expect(screen.source).toBe(snapshot.preferences.source);
    expect(screen.telemetry).toBe(snapshot.preferences.telemetry);
    expect(screen.enabledPacks).toEqual(snapshot.preferences.enabledPacks);
  });

  it("surfaces model availability and routing capability details", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(codexPaths.codexHome, { recursive: true });
    writeFileSync(
      codexPaths.modelsCacheJson,
      JSON.stringify({
        models: [
          { slug: "gpt-5.5", supported_reasoning_levels: ["low", "medium", "high", "xhigh"] },
          { slug: "gpt-5.4-mini", supported_reasoning_levels: ["low", "medium"] },
          { slug: "gpt-5.3-codex", supported_reasoning_levels: ["medium", "high"] }
        ]
      }),
      "utf8"
    );

    const screen = loadSettingsScreen(paths, codexPaths);

    expect(screen.modelCapabilities.details).toContain(
      "model availability: detected 3 model(s) from Codex cache (plan unknown)"
    );
    expect(screen.modelCapabilities.details).toContain(
      "implementation capability: gpt-5.5 supports low/medium/high/xhigh; selected low"
    );
    expect(screen.modelCapabilities.details).toContain(
      "explorer capability: gpt-5.4-mini supports low/medium; selected low"
    );
    expect(screen.modelCapabilities.details).toContain(
      "frontend-craft capability: gpt-5.5 supports low/medium/high/xhigh; selected high"
    );
  });
});
