import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig, readLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/core";
import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import {
  inspectEditablePreferencesConfig,
  inspectTelemetrySnapshot,
  inspectPreferencesFamilySnapshot,
  inspectPreferencesSnapshot,
  inspectPrivacyTransparencySnapshot,
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
      "derived routing: inspect Preferences for explorer, execution, and realtime defaults from detected model availability",
      "telemetry: off",
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
      "coordinator: gpt-5.4 (high)",
      "sidecar: gpt-5.4-mini (medium)",
      "verifier: gpt-5.4 (high)",
      "explorer: gpt-5.4-mini (low) (derived)",
      "execution: gpt-5.3-codex (medium) (derived)",
      "realtime: gpt-5.3-codex-spark (low) (derived)",
      "telemetry files: summary missing, events missing, queue missing",
      "telemetry: off",
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
    config.models.coordinator.model = "gpt-5.2-codex";
    config.packs.caveman = true;
    saveConfig(paths, config);

    expect(inspectPreferencesSnapshot(paths, codexPaths)).toMatchObject({
      source: "local",
      telemetry: "off",
      telemetryFiles: {
        dirPresent: true,
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
        }
      },
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
    config.models.coordinator.model = "gpt-5.2-codex";
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
      queuePresent: true
    });

    expect(inspectPreferencesSnapshot(paths, createCodexPaths(makeTempDir()))).toMatchObject({
      telemetryFiles: {
        dirPresent: true,
        summaryPresent: true,
        eventsPresent: true,
        queuePresent: true
      }
    });

    expect(inspectPrivacyTransparencySnapshot(paths, "product-improvement")).toEqual({
      consent: "product-improvement",
      dir: paths.telemetryDir,
      telemetry: {
        dirPresent: true,
        summaryPresent: true,
        eventsPresent: true,
        queuePresent: true
      },
      summaryPath: paths.telemetrySummaryPath,
      eventsPath: paths.telemetryEventsPath,
      queuePath: paths.telemetryQueuePath
    });
  });
});
