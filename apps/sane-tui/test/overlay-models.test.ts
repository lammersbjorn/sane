import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { optionalPackSkillNames } from "@sane/framework-assets";
import { afterEach, describe, expect, it } from "vitest";

import { loadOverlayModel } from "@sane/sane-tui/overlay-models.js";
import { createTuiShell, editActiveValue, moveSelection, runSelectedAction } from "@sane/sane-tui/shell.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-overlay-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("overlay models", () => {
  it("builds config editor modal content", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");

    runSelectedAction(shell);
    const overlay = loadOverlayModel(shell);

    expect(overlay?.kind).toBe("config");
    if (!overlay || overlay.kind !== "config") {
      throw new Error("expected config overlay");
    }
    expect(overlay.title).toBe("Model Defaults");
    expect(overlay.headerLines[1]).toContain("Up/down row");
    expect(overlay.fieldLines[0]).toContain("> Main session model:");
    expect(overlay.fieldLines.some((line) => line.includes("Explorer agent model:"))).toBe(true);
    expect(overlay.fieldLines.some((line) => line.includes("Implementation agent model:"))).toBe(true);
    expect(overlay.detailsLines[0]).toBe("Main session model");
    expect(overlay.detailsLines).toContain("Recommended: gpt-5.5");
    expect(overlay.detailsLines).toContain("Routing behavior");
    expect(overlay.detailsLines).toContain("These rows are saved in Sane config.");
  });

  it("builds privacy and pack modal side content", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()), "settings");

    moveSelection(shell, "action", 1);
    runSelectedAction(shell);
    let overlay = loadOverlayModel(shell);
    expect(overlay?.kind).toBe("packs");
    if (!overlay || overlay.kind !== "packs") {
      throw new Error("expected packs overlay");
    }
    expect(overlay.fieldLines[0]).toContain("> caveman:");
    expect(overlay.detailsLines.some((line: string) => line.includes("selected pack: caveman"))).toBe(true);
    expect(overlay.detailsLines).toContain("exports: sane-caveman");

    if (shell.activeEditor?.kind !== "packs") {
      throw new Error("expected packs editor state");
    }
    shell.activeEditor.selected = 1;
    overlay = loadOverlayModel(shell);
    expect(overlay?.kind).toBe("packs");
    if (!overlay || overlay.kind !== "packs") {
      throw new Error("expected packs overlay");
    }
    expect(overlay.detailsLines.some((line: string) => line.includes("selected pack: rtk"))).toBe(true);
    expect(overlay.detailsLines).toContain(`exports: ${optionalPackSkillNames("rtk").join(", ")}`);

    shell.activeEditor.selected = 2;
    overlay = loadOverlayModel(shell);
    expect(overlay?.kind).toBe("packs");
    if (!overlay || overlay.kind !== "packs") {
      throw new Error("expected packs overlay");
    }
    expect(overlay.detailsLines.some((line: string) => line.includes("selected pack: frontend-craft"))).toBe(
      true
    );
    expect(overlay.detailsLines).toContain(
      `exports: ${optionalPackSkillNames("frontend-craft").join(", ")}`
    );

    shell.activeEditor = null;
    moveSelection(shell, "action", 1);
    runSelectedAction(shell);
    editActiveValue(shell, 1);
    overlay = loadOverlayModel(shell);
    expect(overlay?.kind).toBe("privacy");
    if (!overlay || overlay.kind !== "privacy") {
      throw new Error("expected privacy overlay");
    }
    expect(overlay.fieldLines).toEqual(["> Telemetry: local-only"]);
    expect(overlay.detailsLines.some((line: string) => line.includes("consent: local-only"))).toBe(true);
    expect(overlay.detailsLines).toContain("policy: local-only keeps summary/events local and removes upload queue");
    expect(overlay.detailsLines.some((line: string) => line.includes("summary path:"))).toBe(true);
    expect(overlay.detailsLines.some((line: string) => line.includes("events path:"))).toBe(true);
  });

  it("builds confirm and notice overlays from shell state", () => {
    const shell = createTuiShell(createProjectPaths(makeTempDir()), createCodexPaths(makeTempDir()));
    for (let index = 0; index < 4; index += 1) {
      moveSelection(shell, "action", 1);
    }

    runSelectedAction(shell);
    let overlay = loadOverlayModel(shell);
    expect(overlay?.kind).toBe("confirm");
    if (!overlay || overlay.kind !== "confirm") {
      throw new Error("expected confirm overlay");
    }
    expect(overlay.bodyLines[0]).toContain("Selected action:");

    shell.pendingConfirmation = null;
    shell.notice = {
      title: "Saved",
      body: "config: saved at .sane/config.toml",
      footer: "Enter, Space, or Esc closes this message.",
      section: "settings"
    };
    overlay = loadOverlayModel(shell);
    expect(overlay?.kind).toBe("notice");
    if (!overlay || overlay.kind !== "notice") {
      throw new Error("expected notice overlay");
    }
    expect(overlay.footer).toBe("Enter, Space, or Esc closes this message.");
  });
});
