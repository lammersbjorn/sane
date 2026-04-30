import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { createProjectPaths } from "@sane/platform";
import { afterEach, describe, expect, it } from "vitest";

import { recordTelemetryEvent } from "../src/telemetry.js";
import { saveConfig } from "../src/preferences.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-telemetry-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("telemetry ledger", () => {
  it("does not create telemetry files when consent is off", () => {
    const paths = createProjectPaths(makeTempDir());

    const snapshot = recordTelemetryEvent(paths, {
      category: "issue-relay",
      action: "draft",
      result: "blocked",
      surface: "test",
      errorFingerprint: "/Users/bjorn/secret"
    });

    expect(snapshot.consent).toBe("off");
    expect(snapshot.summary).toBeNull();
    expect(existsSync(paths.telemetryDir)).toBe(false);
  });

  it("records aggregate local counts and bounded recent events", () => {
    const paths = createProjectPaths(makeTempDir());
    const config = createDefaultLocalConfig();
    config.privacy.telemetry = "local-only";
    saveConfig(paths, config);

    const snapshot = recordTelemetryEvent(paths, {
      category: "issue-relay",
      action: "draft",
      result: "drafted",
      surface: "test surface",
      errorFingerprint: "sane-abc123"
    });

    expect(snapshot.summary?.counts["issue-relay.draft.drafted"]).toBe(1);
    expect(snapshot.recentEvents).toEqual([
      expect.objectContaining({
        category: "issue-relay",
        action: "draft",
        result: "drafted",
        surface: "test-surface",
        errorFingerprint: "sane-abc123"
      })
    ]);
    expect(readFileSync(paths.telemetrySummaryPath, "utf8")).toContain("issue-relay.draft.drafted");
    expect(readFileSync(paths.telemetryEventsPath, "utf8")).toContain("issue-relay");
    expect(existsSync(paths.telemetryQueuePath)).toBe(false);
  });

  it("keeps product-improvement telemetry local until upload transport exists", () => {
    const paths = createProjectPaths(makeTempDir());
    const config = createDefaultLocalConfig();
    config.privacy.telemetry = "product-improvement";
    saveConfig(paths, config);

    const snapshot = recordTelemetryEvent(paths, {
      category: "doctor",
      action: "runtime check",
      result: "failure",
      surface: "status",
      errorFingerprint: "sane-runtime-missing"
    });

    expect(snapshot.summary?.counts["doctor.runtime-check.failure"]).toBe(1);
    expect(snapshot.queuedUploadCount).toBe(0);
    expect(existsSync(paths.telemetryQueuePath)).toBe(false);
    expect(readFileSync(paths.telemetryEventsPath, "utf8")).toContain("runtime-check");
    expect(readFileSync(paths.telemetryEventsPath, "utf8")).not.toContain(paths.projectRoot);
  });
});
