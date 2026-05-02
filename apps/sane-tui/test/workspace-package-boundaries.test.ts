import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(testDir, "../../..");

const sanePackageJsonPaths = [
  "apps/sane-tui/package.json",
  "packages/config/package.json",
  "packages/control-plane/package.json",
  "packages/core/package.json",
  "packages/framework-assets/package.json",
  "packages/platform/package.json",
  "packages/policy/package.json",
  "packages/state/package.json"
];

const deniedRunnerEntrypoints = [
  "outcome",
  "outcome-runner",
  "run-outcome",
  "runner",
  "sane-outcome"
] as const;

interface PackageJson {
  name: string;
  bin?: Record<string, string>;
  private?: boolean;
  type?: string;
  exports?: Record<string, string>;
  scripts?: Record<string, string>;
}

const expectedControlPlaneExports = [
  ".",
  "./bundles.js",
  "./codex-config.js",
  "./codex-native.js",
  "./history.js",
  "./hooks-custom-agents.js",
  "./index.js",
  "./install-status.js",
  "./inventory.js",
  "./issue-relay.js",
  "./policy-preview.js",
  "./preferences.js",
  "./repair-status.js",
  "./runtime-state.js",
  "./session-start-hook.js",
  "./status-presenter.js",
  "./telemetry.js",
  "./tokscale-submit-hook.js",
  "./update-check.js"
].sort();

const expectedSaneTuiExports = [
  ".",
  "./add-to-codex-screen.js",
  "./app-view.js",
  "./cli.js",
  "./command-registry.js",
  "./dashboard.js",
  "./home-screen.js",
  "./index.js",
  "./ink-terminal.js",
  "./input-driver.js",
  "./main.js",
  "./overlay-models.js",
  "./preferences-editor-state.js",
  "./presentation-normalizer.js",
  "./preview-launch.js",
  "./repair-screen.js",
  "./result-panel-layer.js",
  "./result-panel.js",
  "./section-action-rows.js",
  "./settings-screen.js",
  "./shell.js",
  "./status-screen.js",
  "./terminal-driver.js",
  "./terminal-keys.js",
  "./terminal-loop.js",
  "./text-driver.js",
  "./text-renderer.js",
  "./version.js"
].sort();

describe("workspace package boundaries", () => {
  it("keeps the active Sane package split explicit and TypeScript-first", () => {
    const packages = sanePackageJsonPaths.map((path) => readPackageJson(path));
    const expectedNames = sanePackageJsonPaths.map((path) => expectedSanePackageName(path));

    expect(packages.map((pkg) => pkg.name)).toHaveLength(expectedNames.length);
    expect(new Set(packages.map((pkg) => pkg.name))).toEqual(new Set(expectedNames));

    for (const pkg of packages) {
      expect(pkg.private).toBe(true);
      expect(pkg.type).toBe("module");
      expect(pkg.exports?.["."]).toBe("./src/index.ts");
      expect(pkg.exports).not.toHaveProperty("./*.js");
      expect(pkg.scripts?.test).toContain("vitest");
      expect(pkg.scripts?.typecheck).toContain("tsc --project tsconfig.json");
      expect(Object.values(pkg.scripts ?? {}).join("\n")).not.toMatch(/\bcargo\b/i);
    }
  });

  it("keeps broad package subpath exports out of workspace packages", () => {
    const packages = sanePackageJsonPaths.map((path) => ({
      path,
      pkg: readPackageJson(path)
    }));

    for (const { path, pkg } of packages) {
      const exportKeys = Object.keys(pkg.exports ?? {});

      expect(exportKeys).not.toContain("./*.js");
      expect(exportKeys.every((key) => key === "." || key.endsWith(".js"))).toBe(true);

      if (path === "packages/control-plane/package.json") {
        expect(exportKeys.sort()).toEqual(expectedControlPlaneExports);
      } else if (path === "apps/sane-tui/package.json") {
        expect(exportKeys.sort()).toEqual(expectedSaneTuiExports);
      } else {
        expect(exportKeys.sort()).toEqual([".", "./index.js"]);
      }
    }
  });

  it("keeps @sane/sane-tui root barrel stable and minimal", () => {
    const rootBarrel = readFileSync(join(workspaceRoot, "apps/sane-tui/src/index.ts"), "utf8");
    const publicReExports = [...rootBarrel.matchAll(/export \* from "@sane\/sane-tui\/([^"]+)";/g)].map(
      (match) => match[1]
    );

    expect(publicReExports.sort()).toEqual(["command-registry.js", "main.js", "preview-launch.js"]);
  });

  it("keeps public root scripts on the packaged TypeScript entrypoint", () => {
    const rootPackage = readPackageJson("package.json");
    const saneTuiPackage = readPackageJson("apps/sane-tui/package.json");

    expectScriptIncludes(rootPackage.scripts, "start", [
      "pnpm --filter @sane/sane-tui run build:package",
      "node ./apps/sane-tui/dist/bin/sane.js"
    ]);
    expectScriptIncludes(rootPackage.scripts, "pack:sane-tui", [
      "pnpm --filter @sane/sane-tui run build:package",
      "apps/sane-tui/dist",
      "pnpm pack"
    ]);
    expectScriptIncludes(saneTuiPackage.scripts, "build:package", [
      "pnpm run build",
      "node ./scripts/write-dist-package.mjs"
    ]);
    expectScriptIncludes(saneTuiPackage.scripts, "build:smoke", [
      "pnpm run build:package",
      "node ./dist/bin/sane.js",
      "status"
    ]);
    expect(Object.values(rootPackage.scripts ?? {}).join("\n")).not.toMatch(/\bcargo\b/i);
    expect(Object.values(saneTuiPackage.scripts ?? {}).join("\n")).not.toMatch(/\bcargo\b/i);
  });

  it("keeps release workflows aligned with the public accept gate and artifacts", () => {
    const rootPackage = readPackageJson("package.json");
    const ciWorkflow = readFileSync(join(workspaceRoot, ".github/workflows/ci.yml"), "utf8");
    const npmWorkflow = readFileSync(join(workspaceRoot, ".github/workflows/npm-publish.yml"), "utf8");
    const releaseWorkflow = readFileSync(join(workspaceRoot, ".github/workflows/release-artifacts.yml"), "utf8");
    const workflows = [ciWorkflow, npmWorkflow, releaseWorkflow].join("\n");

    expectScriptIncludes(rootPackage.scripts, "accept", ["pnpm run release:verify"]);
    expect(ciWorkflow).toContain("run: pnpm run accept");
    expect(npmWorkflow).toContain("run: pnpm run accept");
    expect(releaseWorkflow).toContain("run: pnpm run accept");
    expect(workflows).not.toContain("run: pnpm run release:verify");
    expect(releaseWorkflow).toContain("artifacts/*.tgz");
    expect(releaseWorkflow).toContain("artifacts/*.zip");
    expect(releaseWorkflow).toContain("artifacts/SHA256SUMS.txt");
    expect(releaseWorkflow).toContain("sha256sum artifacts/* > artifacts/SHA256SUMS.txt");
    expect(releaseWorkflow).toContain("Trigger Homebrew tap updater");
  });

  it("keeps B8 outcome-runner entrypoints out of workspace scripts and bins", () => {
    const rootPackage = readPackageJson("package.json");
    const saneTuiPackage = readPackageJson("apps/sane-tui/package.json");
    const scriptAndBinNames = [
      ...Object.keys(rootPackage.scripts ?? {}),
      ...Object.keys(rootPackage.bin ?? {}),
      ...Object.keys(saneTuiPackage.scripts ?? {}),
      ...Object.keys(saneTuiPackage.bin ?? {})
    ].sort();
    const scriptAndBinCommands = [
      ...Object.values(rootPackage.scripts ?? {}),
      ...Object.values(rootPackage.bin ?? {}),
      ...Object.values(saneTuiPackage.scripts ?? {}),
      ...Object.values(saneTuiPackage.bin ?? {})
    ].join("\n");

    expect(scriptAndBinNames).not.toEqual(expect.arrayContaining([...deniedRunnerEntrypoints]));
    expect(scriptAndBinCommands).not.toMatch(/\b(outcome[- ]runner|run[- ]outcome|runner)\b/i);
    expect(Object.keys(saneTuiPackage.bin ?? {})).toEqual(["sane"]);
    expect(saneTuiPackage.bin?.sane).toMatch(/(^|\/)bin\/sane\.mjs$/);
  });

  it("does not reintroduce Rust workspace files into the active Sane tree", () => {
    expect(findRustWorkspaceFiles(sanePackageJsonPaths.map((path) => dirname(join(workspaceRoot, path))))).toEqual([]);
  });
});

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(join(workspaceRoot, path), "utf8")) as PackageJson;
}

function expectedSanePackageName(path: string): string {
  if (path === "apps/sane-tui/package.json") {
    return "@sane/sane-tui";
  }

  const match = path.match(/^packages\/([^/]+)\/package\.json$/);
  if (!match) {
    throw new Error(`unknown Sane package path: ${path}`);
  }
  return `@sane/${match[1]}`;
}

function expectScriptIncludes(
  scripts: Record<string, string> | undefined,
  scriptName: string,
  requiredFragments: readonly string[]
): void {
  const script = scripts?.[scriptName];
  expect(script).toEqual(expect.any(String));
  for (const fragment of requiredFragments) {
    expect(script).toContain(fragment);
  }
}

function findRustWorkspaceFiles(roots: readonly string[]): string[] {
  const ignoredEntries = new Set(["dist", "node_modules"]);
  const matches: string[] = [];
  const stack = [...roots];

  while (stack.length > 0) {
    const current = stack.pop()!;

    for (const entry of readdirSync(current)) {
      if (ignoredEntries.has(entry)) {
        continue;
      }

      const fullPath = join(current, entry);
      const relPath = relative(workspaceRoot, fullPath);

      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry === "Cargo.toml" || entry.endsWith(".rs")) {
        matches.push(relPath);
      }
    }
  }

  return matches.sort();
}
