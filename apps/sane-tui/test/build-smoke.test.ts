import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("built sane tui bin", () => {
  it("builds, packages, and runs the packaged inspect path", () => {
    const build = spawnSync("pnpm", ["run", "build:package"], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(build.status).toBe(0);

    const distDir = join(process.cwd(), "dist");
    const packageJson = JSON.parse(readFileSync(join(distDir, "package.json"), "utf8")) as {
      bin?: Record<string, string>;
      description?: string;
      license?: string;
      name?: string;
      private?: boolean;
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
    expect(saneBin).toBe("./bin/sane.cjs");

    const inspect = spawnSync(process.execPath, [join(distDir, saneBin!) , "inspect"], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(inspect.status).toBe(0);
    expect(inspect.stdout).toContain("Section: inspect");
    expect(inspect.stdout).toContain("Inspect Details");

    const pack = spawnSync("pnpm", ["pack"], {
      cwd: distDir,
      encoding: "utf8"
    });

    expect(pack.status).toBe(0);
    expect(pack.stdout).toContain(".tgz");
  });
});
