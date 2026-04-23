import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { saveConfig } from "../src/preferences.js";
import { inspectLocalConfigFamily, inspectSavedLocalConfig } from "../src/local-config.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-local-config-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("local config helpers", () => {
  it("returns recommended family state when no local config exists", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const recommended = createDefaultLocalConfig();
    recommended.models.coordinator.model = "gpt-5.2";

    expect(inspectSavedLocalConfig(paths)).toEqual({ kind: "missing" });
    expect(inspectLocalConfigFamily(paths, recommended)).toEqual({
      source: "recommended",
      current: recommended,
      recommended,
      saved: { kind: "missing" }
    });
  });

  it("returns loaded family state when local config exists", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const local = createDefaultLocalConfig();
    local.packs.caveman = true;
    saveConfig(paths, local);

    const recommended = createDefaultLocalConfig();
    recommended.models.verifier.model = "gpt-5.2";

    expect(inspectLocalConfigFamily(paths, recommended)).toEqual({
      source: "local",
      current: local,
      recommended,
      saved: { kind: "loaded", config: local }
    });
  });
});
