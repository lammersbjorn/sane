import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { previewPolicy } from "../src/policy-preview.js";
import { saveConfig } from "../src/preferences.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-policy-preview-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("policy preview", () => {
  it("renders canonical adaptive obligation scenarios", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);

    const result = previewPolicy(paths);

    expect(result.summary).toBe("policy preview: rendered adaptive obligation scenarios");
    expect(result.details).toHaveLength(5);
    expect(result.details[0]).toContain("simple-question:");
    expect(result.details[0]).toContain("direct_answer");
    expect(result.details[0]).toContain("coordinator=");
    expect(result.details[0]).toContain("explorer=");
    expect(result.details[0]).toContain("execution=");
    expect(result.details[0]).toContain("realtime=");
    expect(result.policyPreview?.scenarios).toHaveLength(5);
    expect(result.policyPreview?.scenarios[0]?.id).toBe("simple-question");
    expect(result.policyPreview?.scenarios[0]?.trace[0]?.rule).toBe("keep_direct_answers_light");
  });

  it("uses current local config roles plus derived routing classes when available", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const config = createDefaultLocalConfig();
    config.models.coordinator.model = "gpt-5.2-codex";
    config.models.verifier.model = "gpt-5.1-codex-mini";
    saveConfig(paths, config);

    const result = previewPolicy(paths);
    const featureLine = result.details.find((line) => line.startsWith("multi-file-feature:")) ?? "";

    expect(featureLine).toContain("coordinator=gpt-5.2-codex/high");
    expect(featureLine).toContain("explorer=gpt-5.4-mini/low");
    expect(featureLine).toContain("verifier=gpt-5.1-codex-mini/high");
    expect(featureLine).toContain("execution=gpt-5.3-codex/medium");
    expect(featureLine).toContain("realtime=gpt-5.3-codex-spark/low");
  });

  it("reads codex environment through platform discovery instead of homedir", () => {
    const projectRoot = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexHome = makeTempDir();
    saveConfig(paths, createDefaultLocalConfig());

    const result = previewPolicy(paths, { HOME: codexHome });
    const featureLine = result.details.find((line) => line.startsWith("multi-file-feature:")) ?? "";

    expect(featureLine).toContain("execution=gpt-5.3-codex/medium");
    expect(featureLine).toContain("realtime=gpt-5.3-codex-spark/low");
  });
});
