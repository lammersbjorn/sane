#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const tsxCli = fileURLToPath(new URL(import.meta.resolve("tsx/cli")));
const previewEntry = fileURLToPath(new URL("./sane-preview.ts", import.meta.url));

const result = spawnSync(process.execPath, [tsxCli, previewEntry, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
