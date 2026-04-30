import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig, readLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/core";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import {
  exportPortableSettings,
  importPortableSettings,
  inspectEditablePreferencesConfig,
  inspectTelemetrySnapshot,
  inspectPreferencesFamilySnapshot,
  inspectPreferencesSnapshot,
  inspectPrivacyTransparencySnapshot,
  resetTelemetryData,
  saveConfig,
  showConfig,
  toggleAutoUpdates
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
      "coordinator: gpt-5.5 (medium)",
      "sidecar: gpt-5.4-mini (medium)",
      "verifier: gpt-5.5 (high)",
      "derived routing: inspect Preferences for explorer, execution, realtime, and frontend-craft defaults from detected model availability",
      "telemetry: off",
      "auto updates: disabled",
      "issue relay: off",
      "packs: core, caveman"
    ]);
  });

  it("shows derived routing and telemetry file details when codex context is available", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();

    saveConfig(paths, config);
    const result = showConfig(paths, codexPaths);

    expect(result.details).toEqual([
      "version: 1",
      "coordinator: gpt-5.5 (medium)",
      "sidecar: gpt-5.4-mini (medium)",
      "verifier: gpt-5.5 (high)",
      "model availability: no Codex model cache; using Sane defaults (plan unknown)",
      "available models: unknown",
      "coordinator capability: gpt-5.5 not in detected cache; selected medium",
      "sidecar capability: gpt-5.4-mini not in detected cache; selected medium",
      "verifier capability: gpt-5.5 not in detected cache; selected high",
      "explorer capability: gpt-5.4-mini not in detected cache; selected low",
      "implementation capability: gpt-5.3-codex not in detected cache; selected medium",
      "realtime capability: gpt-5.3-codex-spark not in detected cache; selected low",
      "frontend-craft capability: gpt-5.5 not in detected cache; selected high",
      "explorer: gpt-5.4-mini (low) (derived)",
      "execution: gpt-5.3-codex (medium) (derived)",
      "reviewer: gpt-5.5 (high) (derived)",
      "realtime: gpt-5.3-codex-spark (low) (derived)",
      "frontend-craft: gpt-5.5 (high) (derived)",
      "telemetry files: summary missing, events missing, queue missing",
      "telemetry: off",
      "auto updates: disabled",
      "issue relay: off",
      "packs: core"
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
    expect(result.details).toContain(`telemetry path: ${paths.telemetrySummaryPath}`);
    expect(result.details).toContain(`telemetry path: ${paths.telemetryEventsPath}`);
    expect(existsSync(paths.telemetrySummaryPath)).toBe(true);
    expect(existsSync(paths.telemetryEventsPath)).toBe(true);
    expect(existsSync(paths.telemetryQueuePath)).toBe(false);
    expect(result.pathsTouched).toEqual(
      expect.arrayContaining([
        paths.configPath,
        paths.telemetrySummaryPath,
        paths.telemetryEventsPath
      ])
    );
    expect(readLocalConfig(paths.configPath)).toEqual(config);
  });

  it("toggles auto updates in local config", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const enabled = toggleAutoUpdates(paths, codexPaths);
    expect(enabled.summary).toBe("auto updates: enabled");
    expect(readLocalConfig(paths.configPath).updates.auto).toBe(true);

    const disabled = toggleAutoUpdates(paths, codexPaths);
    expect(disabled.summary).toBe("auto updates: disabled");
    expect(readLocalConfig(paths.configPath).updates.auto).toBe(false);
  });

  it("reports backup metadata on config rewrite and can reset telemetry data", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const first = createDefaultLocalConfig();
    first.privacy.telemetry = "product-improvement";
    const second = createDefaultLocalConfig();
    second.models.verifier.model = "gpt-5.2";
    second.privacy.telemetry = "product-improvement";

    saveConfig(paths, first);
    const result = saveConfig(paths, second);
    const reset = resetTelemetryData(paths);

    expect(result.rewrite?.firstWrite).toBe(false);
    expect(result.rewrite?.backupPath).toContain(".bak.");
    expect(result.details).toContain(`backup path: ${result.rewrite?.backupPath}`);
    expect(result.details).toContain("write mode: rewrite");
    expect(existsSync(result.rewrite?.backupPath ?? "")).toBe(true);
    expect(readFileSync(paths.configPath, "utf8")).toContain('model = "gpt-5.2"');
    expect(reset.summary).toBe("telemetry reset: removed local telemetry data");
    expect(existsSync(paths.telemetryDir)).toBe(false);
  });

  it("removes stale telemetry files when privacy is reduced", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const productImprovement = createDefaultLocalConfig();
    productImprovement.privacy.telemetry = "product-improvement";
    const localOnly = createDefaultLocalConfig();
    localOnly.privacy.telemetry = "local-only";
    const off = createDefaultLocalConfig();
    off.privacy.telemetry = "off";

    const enabled = saveConfig(paths, productImprovement);
    expect(existsSync(paths.telemetryQueuePath)).toBe(false);
    expect(enabled.pathsTouched).toEqual(
      expect.arrayContaining([
        paths.telemetrySummaryPath,
        paths.telemetryEventsPath,
        paths.telemetryQueuePath
      ])
    );

    const reduced = saveConfig(paths, localOnly);
    expect(inspectTelemetrySnapshot(paths)).toEqual({
      dirPresent: true,
      summaryPresent: true,
      eventsPresent: true,
      queuePresent: false
    });
    expect(reduced.details).toContain(`telemetry path: ${paths.telemetryQueuePath}`);
    expect(reduced.pathsTouched).toEqual(
      expect.arrayContaining([
        paths.configPath,
        paths.telemetrySummaryPath,
        paths.telemetryEventsPath,
        paths.telemetryQueuePath
      ])
    );

    const disabled = saveConfig(paths, off);
    expect(inspectTelemetrySnapshot(paths)).toEqual({
      dirPresent: false,
      summaryPresent: false,
      eventsPresent: false,
      queuePresent: false
    });
    expect(disabled.details).toContain(`telemetry path: ${paths.telemetryDir}`);
    expect(disabled.pathsTouched).toEqual(
      expect.arrayContaining([
        paths.configPath,
        paths.telemetryDir
      ])
    );
    expect(disabled.pathsTouched).not.toEqual(
      expect.arrayContaining([
        paths.telemetrySummaryPath,
        paths.telemetryEventsPath,
        paths.telemetryQueuePath
      ])
    );
  });

  it("builds a local-or-recommended preferences snapshot for TUI consumers", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    expect(inspectPreferencesSnapshot(paths, codexPaths)).toMatchObject({
      source: "recommended",
      derivedRouting: {
        execution: {
          model: "gpt-5.3-codex",
          reasoningEffort: "medium"
        },
        realtime: {
          model: "gpt-5.3-codex-spark",
          reasoningEffort: "low"
        }
      },
      subagents: {
        explorer: {
          model: "gpt-5.4-mini",
          reasoningEffort: "low"
        },
        implementation: {
          model: "gpt-5.3-codex",
          reasoningEffort: "medium"
        },
        realtime: {
          model: "gpt-5.3-codex-spark",
          reasoningEffort: "low"
        },
        frontendCraft: {
          model: "gpt-5.5",
          reasoningEffort: "high"
        }
      },
      telemetry: "off",
      telemetryFiles: {
        dirPresent: false,
        summaryPresent: false,
        eventsPresent: false,
        queuePresent: false
      },
      enabledPacks: ["core"]
    });

    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2";
    config.packs.caveman = true;
    saveConfig(paths, config);

    expect(inspectPreferencesSnapshot(paths, codexPaths)).toMatchObject({
      source: "local",
      telemetry: "off",
      telemetryFiles: {
        dirPresent: false,
        summaryPresent: false,
        eventsPresent: false,
        queuePresent: false
      },
      enabledPacks: ["core", "caveman"],
      derivedRouting: {
        execution: {
          model: "gpt-5.3-codex"
        },
        realtime: {
          model: "gpt-5.3-codex-spark"
        }
      },
      subagents: {
        explorer: {
          model: "gpt-5.4-mini"
        },
        implementation: {
          model: "gpt-5.3-codex"
        },
        realtime: {
          model: "gpt-5.3-codex-spark"
        },
        frontendCraft: {
          model: "gpt-5.5"
        }
      },
      models: {
        coordinator: {
          model: "gpt-5.2"
        }
      }
    });
  });

  it("reports detected model capability constraints for routing decisions", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    mkdirSync(codexPaths.codexHome, { recursive: true });
    writeFileSync(
      codexPaths.modelsCacheJson,
      JSON.stringify({
        models: [
          { slug: "gpt-5.5", supported_reasoning_levels: ["medium", "high", "xhigh"] },
          { slug: "gpt-5.4-mini", supported_reasoning_levels: ["low", "medium"] },
          { slug: "gpt-5.3-codex", supported_reasoning_levels: ["medium", "high"] }
        ]
      }),
      "utf8"
    );
    writeFileSync(
      codexPaths.authJson,
      JSON.stringify({ chatgpt_plan_type: "pro" }),
      "utf8"
    );

    const snapshot = inspectPreferencesSnapshot(paths, codexPaths);

    expect(snapshot.modelCapabilities).toMatchObject({
      source: "detected",
      planType: "pro",
      availableModelCount: 3,
      availableModels: [
        { slug: "gpt-5.5", reasoningEfforts: ["medium", "high", "xhigh"] },
        { slug: "gpt-5.4-mini", reasoningEfforts: ["low", "medium"] },
        { slug: "gpt-5.3-codex", reasoningEfforts: ["medium", "high"] }
      ]
    });
    expect(snapshot.modelCapabilities.details).toEqual([
      "model availability: detected 3 model(s) from Codex cache (plan pro)",
      "available models: gpt-5.5 [medium, high, xhigh], gpt-5.4-mini [low, medium], gpt-5.3-codex [medium, high]",
      "coordinator capability: gpt-5.5 supports medium/high/xhigh; selected medium",
      "sidecar capability: gpt-5.4-mini supports low/medium; selected medium",
      "verifier capability: gpt-5.5 supports medium/high/xhigh; selected high",
      "explorer capability: gpt-5.4-mini supports low/medium; selected low",
      "implementation capability: gpt-5.3-codex supports medium/high; selected medium",
      "realtime capability: gpt-5.4-mini supports low/medium; selected low",
      "frontend-craft capability: gpt-5.5 supports medium/high/xhigh; selected high"
    ]);
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
            model: "gpt-5.5"
          }
        }
      },
      recommended: {
        models: {
          coordinator: {
            model: "gpt-5.5"
          }
        }
      }
    });

    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2";
    saveConfig(paths, config);

    expect(inspectEditablePreferencesConfig(paths, codexPaths)).toMatchObject({
      source: "local",
      current: {
        models: {
          coordinator: {
            model: "gpt-5.2"
          }
        }
      },
      recommended: {
        models: {
          coordinator: {
            model: "gpt-5.5"
          }
        }
      }
    });
  });

  it("keeps family snapshot members aligned with existing preferences selectors", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    const recommendedFamily = inspectPreferencesFamilySnapshot(paths, codexPaths);
    expect(recommendedFamily.preferences).toEqual(inspectPreferencesSnapshot(paths, codexPaths));
    expect(recommendedFamily.editable).toEqual(inspectEditablePreferencesConfig(paths, codexPaths));
    expect(recommendedFamily.telemetry).toEqual(inspectTelemetrySnapshot(paths));

    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2";
    config.privacy.telemetry = "product-improvement";
    saveConfig(paths, config);

    const localFamily = inspectPreferencesFamilySnapshot(paths, codexPaths);
    expect(localFamily.preferences).toEqual(inspectPreferencesSnapshot(paths, codexPaths));
    expect(localFamily.editable).toEqual(inspectEditablePreferencesConfig(paths, codexPaths));
    expect(localFamily.telemetry).toEqual(inspectTelemetrySnapshot(paths));
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
      queuePresent: false
    });

    expect(inspectPreferencesSnapshot(paths, createCodexPaths(makeTempDir()))).toMatchObject({
      telemetryFiles: {
        dirPresent: true,
        summaryPresent: true,
        eventsPresent: true,
        queuePresent: false
      }
    });

    expect(inspectPrivacyTransparencySnapshot(paths, "product-improvement")).toEqual({
      consent: "product-improvement",
      dir: paths.telemetryDir,
      telemetry: {
        dirPresent: true,
        summaryPresent: true,
        eventsPresent: true,
        queuePresent: false
      },
      summaryPath: paths.telemetrySummaryPath,
      eventsPath: paths.telemetryEventsPath,
      queuePath: paths.telemetryQueuePath
    });
  });

  it("exports then imports portable settings", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2";
    saveConfig(paths, config);

    const exported = exportPortableSettings(paths);
    const importedConfig = createDefaultLocalConfig();
    importedConfig.models.coordinator.model = "gpt-5.5";
    saveConfig(paths, importedConfig);
    const imported = importPortableSettings(paths);

    expect(exported.summary).toBe(`portable settings: exported to ${paths.runtimeRoot}/settings.portable.json`);
    expect(imported.summary).toBe(`portable settings: imported from ${paths.runtimeRoot}/settings.portable.json`);
    expect(readLocalConfig(paths.configPath).models.coordinator.model).toBe("gpt-5.2");
  });
});
