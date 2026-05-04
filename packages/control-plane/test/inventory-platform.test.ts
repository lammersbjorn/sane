import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createDefaultLocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/control-plane/core.js";
import { createCodexPaths, createProjectPaths } from "../src/platform.js";
import { describe, expect, it } from "vitest";

import { exportGlobalAgents, exportUserSkills } from "../src/codex-native.js";
import { exportCustomAgents } from "../src/hooks-custom-agents.js";
import { installRuntime } from "../src/index.js";
import { inspectDoctorSnapshot, inspectStatusBundle } from "../src/inventory.js";
import { saveConfig } from "../src/preferences.js";
import { makeTempDir } from "./inventory-helpers.js";

describe("inventory platform compatibility", () => {
  it("surfaces missing RTK binary when the RTK pack is enabled", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.rtk = true;

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);

    const bundle = inspectStatusBundle(paths, codexPaths, "linux", { PATH: "" });
    const rtkBinary = bundle.compatibility.find((item) => item.name === "rtk-binary");
    const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths, bundle);

    expect(rtkBinary).toEqual(
      expect.objectContaining({
        status: InventoryStatus.Missing,
        path: "PATH",
        repairHint: "install upstream RTK (`brew install rtk`, upstream install script, or Cargo) and ensure `rtk` is on PATH"
      })
    );
    expect(doctorSnapshot.lines).toContain(
      "rtk-binary: missing (install upstream RTK (`brew install rtk`, upstream install script, or Cargo) and ensure `rtk` is on PATH; Homebrew packaging: future Sane Homebrew formula should depend on upstream `rtk`)"
    );
  });

  it("marks RTK binary installed when a PATH executable exists", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const binDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);
    const config = createDefaultLocalConfig();
    config.packs.rtk = true;
    const rtkPath = join(binDir, "rtk");

    installRuntime(paths, codexPaths);
    saveConfig(paths, config);
    writeFileSync(rtkPath, "#!/bin/sh\nexit 0\n", "utf8");
    chmodSync(rtkPath, 0o755);

    const bundle = inspectStatusBundle(paths, codexPaths, "linux", { PATH: binDir });

    expect(bundle.compatibility.find((item) => item.name === "rtk-binary")).toEqual(
      expect.objectContaining({
        status: InventoryStatus.Installed,
        path: rtkPath,
        repairHint: null
      })
    );
  });

  it("marks hooks invalid but does not block the install bundle on native Windows", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportUserSkills(paths, codexPaths);
    exportGlobalAgents(paths, codexPaths);
    exportCustomAgents(paths, codexPaths);

    const bundle = inspectStatusBundle(paths, codexPaths, "windows");

    expect(bundle.primary.hooks?.status).toBe(InventoryStatus.Invalid);
    expect(bundle.primary.status.hooks).toBe("invalid");
    expect(bundle.primary.installBundle).toBe("installed");
  });

  it("formats native Windows hooks as unsupported in doctor output", () => {
    const projectRoot = makeTempDir();
    const homeDir = makeTempDir();
    const paths = createProjectPaths(projectRoot);
    const codexPaths = createCodexPaths(homeDir);

    exportUserSkills(paths, codexPaths);
    exportGlobalAgents(paths, codexPaths);
    exportCustomAgents(paths, codexPaths);

    const bundle = inspectStatusBundle(paths, codexPaths, "windows");
    const doctorSnapshot = inspectDoctorSnapshot(paths, codexPaths, bundle);

    expect(doctorSnapshot.lines).toContain("hooks: unsupported (use WSL)");
  });
});
