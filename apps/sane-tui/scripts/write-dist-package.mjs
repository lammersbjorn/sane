import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(scriptDir);
const repoRoot = dirname(dirname(packageRoot));
const distDir = join(packageRoot, "dist");

const sourcePackage = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

mkdirSync(distDir, { recursive: true });

const distPackage = {
  name: sourcePackage.name,
  version: sourcePackage.version,
  private: false,
  type: "commonjs",
  bin: {
    sane: "./bin/sane.cjs"
  },
  files: ["bin", "packs", "plugins", "README.md"],
  license: "MIT OR Apache-2.0",
  description: "Sane terminal onboarding and setup surface for Codex."
};

writeFileSync(join(distDir, "package.json"), `${JSON.stringify(distPackage, null, 2)}\n`, "utf8");
copyFileSync(join(packageRoot, "README.md"), join(distDir, "README.md"));
mkdirSync(join(distDir, "packs"), { recursive: true });
mkdirSync(join(distDir, "plugins"), { recursive: true });
cpSync(join(repoRoot, "packs", "core"), join(distDir, "packs", "core"), { recursive: true });
cpSync(join(repoRoot, "plugins", "sane"), join(distDir, "plugins", "sane"), { recursive: true });
