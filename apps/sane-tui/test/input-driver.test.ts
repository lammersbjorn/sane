import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { handleTuiInput } from "@sane/sane-tui/input-driver.js";
import { loadAppView } from "@sane/sane-tui/app-view.js";
import { createTuiShell, currentAction, selectSection } from "@sane/sane-tui/shell.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-input-driver-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("input driver", () => {
  it("moves through sections and actions with arrow keys", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    handleTuiInput(shell, "right");
    expect(shell.activeSectionId).toBe("settings");

    handleTuiInput(shell, "down");
    expect(currentAction(shell).id).toBe("open_pack_editor");

    handleTuiInput(shell, "left");
    expect(shell.activeSectionId).toBe("home");
    expect(currentAction(shell).id).toBe("install_runtime");
  });

  it("moves through sections with tab and backtab too", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    handleTuiInput(shell, "tab");
    expect(shell.activeSectionId).toBe("settings");

    handleTuiInput(shell, "backtab");
    expect(shell.activeSectionId).toBe("home");
  });

  it("routes risky actions through confirmation keys", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));

    for (let index = 0; index < 4; index += 1) {
      handleTuiInput(shell, "down");
    }
    expect(currentAction(shell).id).toBe("apply_codex_profile");

    expect(handleTuiInput(shell, "enter")).toBeNull();
    expect(shell.pendingConfirmation?.commandId).toBe("apply_codex_profile");

    const result = handleTuiInput(shell, "y");
    expect(result?.summary).toContain("codex-profile apply");
    expect(shell.pendingConfirmation).toBeNull();
    expect(shell.notice?.title).toBe("Applied");

    handleTuiInput(shell, "escape");
    expect(shell.notice).toBeNull();
  });

  it("opens, edits, saves, and cancels editors from input keys", () => {
    const paths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());
    const shell = createTuiShell(paths, codexPaths, "settings");

    expect(currentAction(shell).id).toBe("open_config_editor");
    handleTuiInput(shell, "enter");
    expect(shell.activeEditor?.kind).toBe("config");

    const before = shell.activeEditor?.config.models.coordinator.model;
    handleTuiInput(shell, "right");
    expect(shell.activeEditor?.config.models.coordinator.model).not.toBe(before);
    expect(handleTuiInput(shell, "enter")?.summary).toContain("config: saved");
    expect(shell.notice?.title).toBe("Saved");

    handleTuiInput(shell, "escape");
    handleTuiInput(shell, "enter");
    expect(shell.activeEditor?.kind).toBe("config");
    handleTuiInput(shell, "escape");
    expect(shell.activeEditor).toBeNull();
    expect(shell.lastResult.lines).toContain("Closed editor. Nothing changed.");
  });

  it("toggles packs and routes privacy telemetry delete through confirmation keys", () => {
    const paths = createProjectPaths(makeTempDir());
    const codexPaths = createCodexPaths(makeTempDir());
    const shell = createTuiShell(paths, codexPaths, "settings");

    handleTuiInput(shell, "down");
    expect(currentAction(shell).id).toBe("open_pack_editor");
    handleTuiInput(shell, "enter");
    expect(shell.activeEditor?.kind).toBe("packs");
    handleTuiInput(shell, "space");
    if (shell.activeEditor?.kind !== "packs") {
      throw new Error("expected packs editor");
    }
    expect(shell.activeEditor.config.packs.caveman).toBe(true);
    handleTuiInput(shell, "escape");

    handleTuiInput(shell, "down");
    expect(currentAction(shell).id).toBe("open_privacy_editor");
    handleTuiInput(shell, "enter");
    expect(shell.activeEditor?.kind).toBe("privacy");
    handleTuiInput(shell, "right");
    expect(handleTuiInput(shell, "enter")?.summary).toContain("config: saved");
    expect(existsSync(paths.telemetryDir)).toBe(true);
    selectSection(shell, "repair");
    expect(loadAppView(shell).sectionOverviewLines.join("\n")).toContain("local telemetry data: present");

    selectSection(shell, "settings");
    handleTuiInput(shell, "escape");
    handleTuiInput(shell, "down");
    handleTuiInput(shell, "down");
    handleTuiInput(shell, "enter");
    expect(shell.activeEditor?.kind).toBe("privacy");
    expect(handleTuiInput(shell, "d")).toBeNull();
    expect(shell.pendingConfirmation?.commandId).toBe("reset_telemetry_data");
    expect(handleTuiInput(shell, "y")?.summary).toBe("telemetry reset: removed local telemetry data");
    expect(existsSync(paths.telemetryDir)).toBe(false);
    selectSection(shell, "repair");
    expect(loadAppView(shell).sectionOverviewLines.join("\n")).toContain("local telemetry data: missing");
  });
});
