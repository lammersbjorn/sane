import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';

import type { VerificationStatus } from '../src/index.js';

const tempDirs: string[] = [];

export function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sane-state-'));
  tempDirs.push(dir);
  return dir;
}

export function createVerificationStatus(
  status: VerificationStatus['status'],
  summary: string | null = null,
): VerificationStatus {
  return { status, summary };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { force: true, recursive: true });
  }
});
