import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("built sane tui bin", () => {
  it("builds and runs the bundled inspect path", () => {
    const build = spawnSync("pnpm", ["run", "build"], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(build.status).toBe(0);

    const inspect = spawnSync(process.execPath, ["dist/bin/sane.cjs", "inspect"], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(inspect.status).toBe(0);
    expect(inspect.stdout).toContain("Section: inspect");
    expect(inspect.stdout).toContain("[Status]");
  });
});
