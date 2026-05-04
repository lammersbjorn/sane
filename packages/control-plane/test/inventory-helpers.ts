import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";

import { afterEach } from "vitest";

const tempDirs: string[] = [];

export function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sane-inventory-"));
  tempDirs.push(dir);
  return dir;
}

export function writeBackupSiblings(basePath: string, prefix: string): void {
  for (let index = 1; index <= 4; index += 1) {
    writeFileSync(`${basePath}.bak.${index}`, `${prefix}.${index}\n`, "utf8");
  }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});
