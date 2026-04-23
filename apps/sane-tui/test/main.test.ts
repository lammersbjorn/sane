import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { writeFileSync } from "node:fs";

import { createSaneTuiAppFromDiscovery, createSaneTuiAppFromRoots, refreshSaneTuiApp } from "@/main.js";
import { moveSelection } from "@/shell.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-tui-main-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("tui app bootstrap", () => {
  it("builds the dashboard from default launch", () => {
    const app = createSaneTuiAppFromRoots(makeTempDir(), makeTempDir());

    expect(app.shell.activeSectionId).toBe("get_started");
    expect(app.dashboard.activeSection.docLabel).toBe("Get Started");
    expect(app.dashboard.selectedAction.id).toBe("install_runtime");
  });

  it("refreshes the dashboard after shell navigation", () => {
    const app = createSaneTuiAppFromRoots(makeTempDir(), makeTempDir(), {
      launchShortcut: "settings"
    });

    moveSelection(app.shell, "section", 1);
    const refreshed = refreshSaneTuiApp(app);

    expect(refreshed.shell.activeSectionId).toBe("install");
    expect(refreshed.dashboard.activeSection.docLabel).toBe("Install");
  });

  it("can bootstrap from discovery inputs", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const nested = join(projectRoot, "apps", "sane-tui", "src");
    writeFileSync(join(projectRoot, "Cargo.toml"), "[workspace]\n");

    const app = createSaneTuiAppFromDiscovery(nested, { HOME: homeDir }, {
      launchShortcut: "settings"
    });

    expect(app.paths.projectRoot).toBe(projectRoot);
    expect(app.codexPaths.homeDir).toBe(homeDir);
    expect(app.shell.activeSectionId).toBe("preferences");
  });
});
