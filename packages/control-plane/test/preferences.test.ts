import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig, readLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/core";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  inspectEditablePreferencesConfig,
  inspectTelemetrySnapshot,
  inspectPreferencesSnapshot,
  resetTelemetryData,
  saveConfig,
  showConfig
} from "../src/preferences.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-preferences-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("preferences control plane", () => {
  it("shows missing local config state", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    const result = showConfig(paths);

    expect(result.summary).toBe(`config: missing at ${paths.configPath}`);
    expect(result.inventory[0]?.status).toBe(InventoryStatus.Missing);
    expect(result.inventory[0]?.repairHint).toBe("run `install`");
    expect(result.pathsTouched).toEqual([paths.configPath]);
  });

  it("shows saved config details in stable order", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.packs.caveman = true;

    saveConfig(paths, config);
    const result = showConfig(paths);

    expect(result.summary).toBe(`config: ok at ${paths.configPath}`);
    expect(result.details).toEqual([
      "version: 1",
      "coordinator: gpt-5.4 (high)",
      "sidecar: gpt-5.4-mini (medium)",
      "verifier: gpt-5.4 (high)",
      "derived classes: execution and realtime iteration are resolved from detected model availability",
      "telemetry: off",
      "packs: core, caveman"
    ]);
  });

  it("saves config with rewrite metadata and creates telemetry files when enabled", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.privacy.telemetry = "local-only";

    const result = saveConfig(paths, config);

    expect(result.summary).toBe(`config: saved at ${paths.configPath}`);
    expect(result.rewrite?.rewrittenPath).toBe(paths.configPath);
    expect(result.rewrite?.firstWrite).toBe(true);
    expect(result.details).toContain(`rewritten path: ${paths.configPath}`);
    expect(result.details).toContain("write mode: first write");
    expect(existsSync(paths.telemetrySummaryPath)).toBe(true);
    expect(existsSync(paths.telemetryEventsPath)).toBe(true);
    expect(existsSync(paths.telemetryQueuePath)).toBe(false);
    expect(readLocalConfig(paths.configPath)).toEqual(config);
  });

  it("reports backup metadata on config rewrite and can reset telemetry data", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const first = createDefaultLocalConfig();
    first.privacy.telemetry = "product-improvement";
    const second = createDefaultLocalConfig();
    second.models.verifier.model = "gpt-5.2-codex";
    second.privacy.telemetry = "product-improvement";

    saveConfig(paths, first);
    const result = saveConfig(paths, second);
    const reset = resetTelemetryData(paths);

    expect(result.rewrite?.firstWrite).toBe(false);
    expect(result.rewrite?.backupPath).toContain(".bak.");
    expect(result.details).toContain(`backup path: ${result.rewrite?.backupPath}`);
    expect(result.details).toContain("write mode: rewrite");
    expect(existsSync(result.rewrite?.backupPath ?? "")).toBe(true);
    expect(readFileSync(paths.configPath, "utf8")).toContain('model = "gpt-5.2-codex"');
    expect(reset.summary).toBe("telemetry reset: removed local telemetry data");
    expect(existsSync(paths.telemetryDir)).toBe(false);
  });

  it("builds a local-or-recommended preferences snapshot for TUI consumers", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectPreferencesSnapshot(paths, codexPaths)).toMatchObject({
      source: "recommended",
      telemetry: "off",
      enabledPacks: ["core"]
    });

    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2-codex";
    config.packs.caveman = true;
    saveConfig(paths, config);

    expect(inspectPreferencesSnapshot(paths, codexPaths)).toMatchObject({
      source: "local",
      telemetry: "off",
      enabledPacks: ["core", "caveman"],
      models: {
        coordinator: {
          model: "gpt-5.2-codex"
        }
      }
    });
  });

  it("builds an editable preferences config snapshot with local current and recommended defaults", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectEditablePreferencesConfig(paths, codexPaths)).toMatchObject({
      source: "recommended",
      current: {
        models: {
          coordinator: {
            model: "gpt-5.4"
          }
        }
      },
      recommended: {
        models: {
          coordinator: {
            model: "gpt-5.4"
          }
        }
      }
    });

    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2-codex";
    saveConfig(paths, config);

    expect(inspectEditablePreferencesConfig(paths, codexPaths)).toMatchObject({
      source: "local",
      current: {
        models: {
          coordinator: {
            model: "gpt-5.2-codex"
          }
        }
      },
      recommended: {
        models: {
          coordinator: {
            model: "gpt-5.4"
          }
        }
      }
    });
  });

  it("reports bounded telemetry file presence for UI consumers", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.privacy.telemetry = "product-improvement";

    expect(inspectTelemetrySnapshot(paths)).toEqual({
      dirPresent: false,
      summaryPresent: false,
      eventsPresent: false,
      queuePresent: false
    });

    saveConfig(paths, config);

    expect(inspectTelemetrySnapshot(paths)).toEqual({
      dirPresent: true,
      summaryPresent: true,
      eventsPresent: true,
      queuePresent: true
    });
  });
});
