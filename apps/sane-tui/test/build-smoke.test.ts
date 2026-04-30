import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(TEST_DIR, "..");
const SOURCE_PACKAGE_JSON = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as {
  version?: string;
};

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
        engines?: Record<string, string>;
        license?: string;
        name?: string;
        private?: boolean;
        files?: string[];
        publishConfig?: Record<string, string>;
        type?: string;
        version?: string;
      };
      const saneBin = packageJson.bin?.sane;

      expect(packageJson.name).toBe("sane-codex");
      expect(packageJson.version).toBe(SOURCE_PACKAGE_JSON.version);
      expect(packageJson.private).toBe(false);
      expect(packageJson.type).toBe("module");
      expect(packageJson.license).toBe("MIT OR Apache-2.0");
      expect(packageJson.description).toBe("Sane terminal onboarding and setup surface for Codex.");
      expect(packageJson.files).toEqual([
        "bin",
        "packs",
        "README.md",
        "NOTICE",
        "LICENSE-MIT",
        "LICENSE-APACHE"
      ]);
      expect(packageJson.engines?.node).toBe(">=22");
      expect(packageJson.publishConfig?.access).toBe("public");
      expect(Object.keys(packageJson.bin ?? {})).toEqual(["sane"]);
      expect(JSON.stringify(packageJson)).not.toMatch(/\b(outcome[- ]runner|run[- ]outcome|runner)\b/i);
      expect(saneBin).toBe("./bin/sane.js");

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
      expect(existsSync(join(extractedPackage, "plugins"))).toBe(false);
      expect(existsSync(join(extractedPackage, "packs", "core", "skills", "vendor"))).toBe(false);
      expect(existsSync(join(extractedPackage, "LICENSE-MIT"))).toBe(true);
      expect(existsSync(join(extractedPackage, "LICENSE-APACHE"))).toBe(true);
      expect(existsSync(join(extractedPackage, "NOTICE"))).toBe(true);
      expect(readFileSync(join(extractedPackage, "README.md"), "utf8")).toContain("Public npm package name");
      expect(readFileSync(join(extractedPackage, "README.md"), "utf8")).not.toContain("Sane TUI (TypeScript)");

      const trapCwd = join(sandboxRoot, "trap-cwd");
      mkdirSync(join(trapCwd, "packs", "core"), { recursive: true });
      writeFileSync(join(trapCwd, "packs", "core", "manifest.json"), "{not-json", "utf8");

      const inspect = spawnSync(join(extractedPackage, saneBin!), ["inspect"], {
        cwd: trapCwd,
        encoding: "utf8"
      });

      expect(inspect.status, inspect.stderr).toBe(0);
      expect(inspect.stdout).toContain("[Status]");
      expect(inspect.stdout).toContain("Status Focus");

      const ttyInspect = runPseudoTty(join(extractedPackage, saneBin!), ["status"], trapCwd);
      const ttyOutput = `${ttyInspect.stdout}\n${ttyInspect.stderr}`;
      if (!ttyOutput.includes("tcgetattr/ioctl")) {
        expect(ttyOutput).not.toContain("Dynamic require");
      }

    } finally {
      rmSync(sandboxRoot, { recursive: true, force: true });
    }
  }, 20_000);
});

function runPseudoTty(command: string, args: string[], cwd: string): ReturnType<typeof spawnSync> {
  const commandLine = [command, ...args].map(shellQuote).join(" ");
  if (process.platform === "darwin") {
    return spawnSync("script", ["-q", "/dev/null", command, ...args], {
      cwd,
      encoding: "utf8",
      timeout: 2_000
    });
  }

  return spawnSync("script", ["-q", "-c", commandLine, "/dev/null"], {
    cwd,
    encoding: "utf8",
    timeout: 2_000
  });
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
