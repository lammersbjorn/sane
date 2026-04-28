import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(TEST_DIR, "..");

describe("built sane tui bin", () => {
  it("builds, packages, and runs the packaged status path", () => {
    const sandboxRoot = mkdtempSync(join(tmpdir(), "sane-build-smoke-"));
    try {
      const build = spawnSync("pnpm", ["run", "build:package"], {
        cwd: PACKAGE_ROOT,
        encoding: "utf8"
      });

      expect(build.status, build.stderr).toBe(0);

      const distDir = join(PACKAGE_ROOT, "dist");
      const packageJson = JSON.parse(readFileSync(join(distDir, "package.json"), "utf8")) as {
        bin?: Record<string, string>;
        description?: string;
        license?: string;
        name?: string;
        private?: boolean;
        files?: string[];
        type?: string;
        version?: string;
      };
      const saneBin = packageJson.bin?.sane;

      expect(packageJson.name).toBe("@sane/sane-tui");
      expect(packageJson.version).toBe("0.1.0");
      expect(packageJson.private).toBe(false);
      expect(packageJson.type).toBe("commonjs");
      expect(packageJson.license).toBe("MIT OR Apache-2.0");
      expect(packageJson.description).toBe("Sane terminal onboarding and setup surface for Codex.");
      expect(packageJson.files).toEqual(["bin", "packs", "plugins", "README.md"]);
      expect(Object.keys(packageJson.bin ?? {})).toEqual(["sane"]);
      expect(JSON.stringify(packageJson)).not.toMatch(/\b(outcome[- ]runner|run[- ]outcome|runner)\b/i);
      expect(saneBin).toBe("./bin/sane.cjs");

      const pack = spawnSync("pnpm", ["pack"], { cwd: distDir, encoding: "utf8" });
      expect(pack.status, pack.stderr).toBe(0);
      expect(pack.stdout).toContain(".tgz");

      const tgzName = readdirSync(distDir).find((entry) => entry.endsWith(".tgz"));
      expect(tgzName).toBeDefined();

      const extractRoot = join(sandboxRoot, "extract");
      mkdirSync(extractRoot, { recursive: true });
      const extract = spawnSync("tar", ["-xzf", join(distDir, tgzName!), "-C", extractRoot], {
        encoding: "utf8"
      });
      expect(extract.status, extract.stderr).toBe(0);

      const extractedPackage = join(extractRoot, "package");
      expect(existsSync(join(extractedPackage, "packs", "core", "manifest.json"))).toBe(true);
      expect(existsSync(join(extractedPackage, "plugins", "sane", ".codex-plugin", "plugin.json"))).toBe(true);

      const trapCwd = join(sandboxRoot, "trap-cwd");
      mkdirSync(join(trapCwd, "packs", "core"), { recursive: true });
      writeFileSync(join(trapCwd, "packs", "core", "manifest.json"), "{not-json", "utf8");

      const inspect = spawnSync(process.execPath, [join(extractedPackage, saneBin!), "inspect"], {
        cwd: trapCwd,
        encoding: "utf8"
      });

      expect(inspect.status, inspect.stderr).toBe(0);
      expect(inspect.stdout).toContain("[Status]");
      expect(inspect.stdout).toContain("Status Focus");
    } finally {
      rmSync(sandboxRoot, { recursive: true, force: true });
    }
  }, 20_000);
});
