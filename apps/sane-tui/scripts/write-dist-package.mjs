import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(scriptDir);
const repoRoot = dirname(dirname(packageRoot));
const distDir = join(packageRoot, "dist");

const sourcePackage = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

mkdirSync(distDir, { recursive: true });

const distPackage = {
  name: "sane-codex",
  version: sourcePackage.version,
  private: false,
  type: "module",
  bin: {
    sane: "./bin/sane.js"
  },
  files: ["bin", "packs", "README.md", "NOTICE", "LICENSE-MIT", "LICENSE-APACHE"],
  license: "MIT OR Apache-2.0",
  description: "Sane terminal onboarding and setup surface for Codex.",
  engines: {
    node: ">=22"
  },
  dependencies: {
    ink: sourcePackage.dependencies.ink,
    react: sourcePackage.dependencies.react
  },
  publishConfig: {
    access: "public"
  },
  repository: {
    type: "git",
    url: "git+https://github.com/lammersbjorn/sane.git"
  },
  homepage: "https://github.com/lammersbjorn/sane#readme",
  bugs: {
    url: "https://github.com/lammersbjorn/sane/issues"
  },
  keywords: ["codex", "agents", "cli", "sane"]
};

writeFileSync(join(distDir, "package.json"), `${JSON.stringify(distPackage, null, 2)}\n`, "utf8");
copyFileSync(join(repoRoot, "README.md"), join(distDir, "README.md"));
copyFileSync(join(repoRoot, "NOTICE"), join(distDir, "NOTICE"));
copyFileSync(join(repoRoot, "LICENSE-MIT"), join(distDir, "LICENSE-MIT"));
copyFileSync(join(repoRoot, "LICENSE-APACHE"), join(distDir, "LICENSE-APACHE"));
mkdirSync(join(distDir, "packs"), { recursive: true });
cpSync(join(repoRoot, "packs", "core"), join(distDir, "packs", "core"), { recursive: true });
rmSync(join(distDir, "packs", "core", "skills", "vendor"), { recursive: true, force: true });
