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

interface PackageJson {
  name: string;
  private?: boolean;
  type?: string;
  exports?: Record<string, string>;
  scripts?: Record<string, string>;
}

describe("workspace package boundaries", () => {
  it("keeps the active Sane package split explicit and TypeScript-first", () => {
    const packages = sanePackageJsonPaths.map((path) => readPackageJson(path));

    expect(packages.map((pkg) => pkg.name)).toEqual([
      "@sane/sane-tui",
      "@sane/config",
      "@sane/control-plane",
      "@sane/core",
      "@sane/framework-assets",
      "@sane/platform",
      "@sane/policy",
      "@sane/state"
    ]);

    for (const pkg of packages) {
      expect(pkg.private).toBe(true);
      expect(pkg.type).toBe("module");
      expect(pkg.exports).toMatchObject({
        ".": "./src/index.ts",
        "./*.js": "./src/*.ts"
      });
      expect(pkg.scripts?.test).toContain("vitest");
      expect(pkg.scripts?.typecheck).toContain("tsc --project tsconfig.json");
      expect(Object.values(pkg.scripts ?? {}).join("\n")).not.toMatch(/\bcargo\b/i);
    }
  });

  it("keeps public root scripts on the packaged TypeScript entrypoint", () => {
    const rootPackage = readPackageJson("package.json");

    expect(rootPackage.scripts?.start).toBe(
      "pnpm --filter @sane/sane-tui run build:package && node ./apps/sane-tui/dist/bin/sane.cjs"
    );
    expect(rootPackage.scripts?.["pack:sane-tui"]).toBe(
      "pnpm --filter @sane/sane-tui run build:package && cd apps/sane-tui/dist && pnpm pack"
    );
    expect(Object.values(rootPackage.scripts ?? {}).join("\n")).not.toMatch(/\bcargo\b/i);
  });

  it("does not reintroduce Rust workspace files into the active Sane tree", () => {
    expect(findRustWorkspaceFiles(workspaceRoot)).toEqual([]);
  });
});

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(join(workspaceRoot, path), "utf8")) as PackageJson;
}

function findRustWorkspaceFiles(root: string): string[] {
  const ignoredDirs = new Set([
    ".git",
    "apps/site",
    "dist",
    "node_modules"
  ]);
  const matches: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const currentRelative = relative(root, current);
    if (ignoredDirs.has(currentRelative)) {
      continue;
    }

    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry);
      const relPath = relative(root, fullPath);
      if (ignoredDirs.has(relPath)) {
        continue;
      }

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
