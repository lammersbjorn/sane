import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as codexConfig from "@sane/control-plane/codex-config.js";
import * as preferencesControlPlane from "@sane/control-plane/preferences.js";
import { loadPreferencesScreen } from "@sane/sane-tui/preferences-screen.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-tui-preferences-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("preferences screen model", () => {
  it("falls back to recommended config defaults when local config is missing", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const screen = loadPreferencesScreen(paths, codexPaths);

    expect(screen.summary).toBe("Preferences");
    expect(screen.source).toBe("recommended");
    expect(screen.models.coordinator.model).toBe("gpt-5.4");
    expect(screen.models.sidecar.model).toBe("gpt-5.4-mini");
    expect(screen.derivedRouting.execution.model).toBe("gpt-5.3-codex");
    expect(screen.derivedRouting.realtime.model).toBe("gpt-5.3-codex-spark");
    expect(screen.subagents.explorer.model).toBe("gpt-5.4-mini");
    expect(screen.subagents.implementation.model).toBe("gpt-5.3-codex");
    expect(screen.subagents.realtime.model).toBe("gpt-5.3-codex-spark");
    expect(screen.telemetry).toBe("off");
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
    expect(screen.opencodeAudit.status).toBe("missing");
    expect(screen.opencodeApply.status).toBe("ready");
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
      "preview_opencode_profile",
      "apply_opencode_profile"
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

    preferencesControlPlane.saveConfig(paths, config);
    const screen = loadPreferencesScreen(paths, codexPaths);

    expect(screen.source).toBe("local");
    expect(screen.models.coordinator.model).toBe("gpt-5.2");
    expect(screen.derivedRouting.execution.model).toBe("gpt-5.3-codex");
    expect(screen.derivedRouting.realtime.model).toBe("gpt-5.3-codex-spark");
    expect(screen.subagents.explorer.model).toBe("gpt-5.4-mini");
    expect(screen.telemetryFiles).toEqual({
      dirPresent: true,
      summaryPresent: true,
      eventsPresent: true,
      queuePresent: true
    });
    expect(screen.enabledPacks).toEqual(["core", "caveman"]);
    expect(screen.statuslinePreview.summary).toBe("statusline-profile preview: 3 recommended change(s)");
    expect(screen.cloudflarePreview.summary).toBe("cloudflare-profile preview: 1 recommended change(s)");
    expect(screen.opencodePreview.summary).toBe("opencode-profile preview: 1 recommended change(s)");
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

    const screen = loadPreferencesScreen(paths, codexPaths);

    expect(preferencesFamilySpy).toHaveBeenCalledTimes(1);
    expect(preferencesFamilySpy).toHaveBeenCalledWith(paths, codexPaths);
    expect(familySpy).toHaveBeenCalledTimes(1);
    expect(familySpy).toHaveBeenCalledWith(codexPaths);
    expect(screen.statuslineAudit.status).toBe("missing");
    expect(screen.cloudflareAudit.status).toBe("missing");
    expect(screen.opencodeAudit.status).toBe("missing");
  });
});
