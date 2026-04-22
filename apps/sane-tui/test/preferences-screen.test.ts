import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { saveConfig } from "@sane/control-plane/preferences.js";
import { loadPreferencesScreen } from "@/preferences-screen.js";

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
    expect(screen.telemetry).toBe("off");
    expect(screen.enabledPacks).toEqual(["core"]);
    expect(screen.actions.map((action) => action.id)).toEqual([
      "open_config_editor",
      "open_pack_editor",
      "open_privacy_editor",
      "show_config",
      "show_codex_config",
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
    config.models.coordinator.model = "gpt-5.2-codex";
    config.packs.caveman = true;

    saveConfig(paths, config);
    const screen = loadPreferencesScreen(paths, codexPaths);

    expect(screen.source).toBe("local");
    expect(screen.models.coordinator.model).toBe("gpt-5.2-codex");
    expect(screen.enabledPacks).toEqual(["core", "caveman"]);
  });
});
