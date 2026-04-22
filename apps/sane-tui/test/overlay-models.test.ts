import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodexPaths, createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { loadOverlayModel } from "@/overlay-models.js";
import { createTuiShell, editActiveValue, moveSelection, runSelectedAction } from "@/shell.js";

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
    expect(overlay.headerLines[1]).toContain("Up/down picks field");
    expect(overlay.detailsLines[0]).toBe("Coordinator model");
    expect(overlay.detailsLines).toContain("Routing behavior");
    expect(overlay.detailsLines).toContain("Coordinator/sidecar/verifier are editable defaults.");
    expect(overlay.detailsLines).toContain(
      "Sane also derives execution and realtime-iteration classes from detected model availability."
    );
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
    expect(overlay.detailsLines.some((line: string) => line.includes("selected pack: caveman"))).toBe(true);

    shell.activeEditor = null;
    moveSelection(shell, "action", 1);
    runSelectedAction(shell);
    editActiveValue(shell, 1);
    overlay = loadOverlayModel(shell);
    expect(overlay?.kind).toBe("privacy");
    if (!overlay || overlay.kind !== "privacy") {
      throw new Error("expected privacy overlay");
    }
    expect(overlay.detailsLines.some((line: string) => line.includes("consent: local-only"))).toBe(true);
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
      section: "preferences"
    };
    overlay = loadOverlayModel(shell);
    expect(overlay?.kind).toBe("notice");
    if (!overlay || overlay.kind !== "notice") {
      throw new Error("expected notice overlay");
    }
    expect(overlay.footer).toBe("Enter, Space, or Esc closes this message.");
  });
});
