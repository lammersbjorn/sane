import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { messageOf } from './coercion.js';

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

export function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`failed to read snapshot from ${path}: ${messageOf(error)}`);
  }
}

export function writeAtomicTextFile(path: string, body: string): void {
  ensureParentDir(path);
  const tmpPath = temporaryReplacementPath(path);

  try {
    writeFileSync(tmpPath, body, { encoding: 'utf8', flag: 'wx' });
    renameSync(tmpPath, path);
  } catch (error) {
    try {
      rmSync(tmpPath, { force: true });
    } catch {
      // Ignore cleanup failures on an already failing write path.
    }
    throw new Error(`failed to write snapshot to ${path}: ${messageOf(error)}`);
  }
}

export function listCanonicalBackupSiblings(canonicalPath: string): string[] {
  const parent = dirname(canonicalPath);
  if (!existsSync(parent)) {
    return [];
  }

  const canonicalName = canonicalPath.split(/[/\\]/).pop();
  if (!canonicalName) {
    return [];
  }
  const backupPrefix = `${canonicalName}.bak.`;

  return readdirSync(parent)
    .map((name) => {
      const metadata = parseBackupSiblingMetadata(name, backupPrefix);
      if (!metadata) {
        return null;
      }
      const path = join(parent, name);
      if (!statSync(path).isFile()) {
        return null;
      }
      return { ...metadata, path };
    })
    .filter((entry): entry is { tsUnix: number; attempt: number; path: string } => entry !== null)
    .sort(
      (left, right) =>
        right.tsUnix - left.tsUnix ||
        right.attempt - left.attempt ||
        left.path.localeCompare(right.path),
    )
    .map((entry) => entry.path);
}

export function writeCanonicalWithBackupResult(path: string, encoded: string): {
  rewrittenPath: string;
  backupPath: string | null;
  firstWrite: boolean;
} {
  ensureParentDir(path);

  const backupPath = backupExistingCanonical(path);
  const tmpPath = temporaryReplacementPath(path);

  try {
    writeFileSync(tmpPath, encoded, { encoding: 'utf8', flag: 'wx' });
    renameSync(tmpPath, path);
  } catch (error) {
    try {
      rmSync(tmpPath, { force: true });
    } catch {
      // Ignore cleanup failures on an already failing write path.
    }
    throw new Error(`failed to write snapshot to ${path}: ${messageOf(error)}`);
  }

  return {
    rewrittenPath: path,
    backupPath,
    firstWrite: backupPath === null,
  };
}

export function appendTextLine(path: string, body: string): void {
  ensureParentDir(path);
  try {
    writeFileSync(path, `${body}\n`, {
      encoding: 'utf8',
      flag: 'a',
    });
  } catch (error) {
    throw new Error(`failed to write snapshot to ${path}: ${messageOf(error)}`);
  }
}

export function exists(path: string): boolean {
  return existsSync(path);
}

function backupExistingCanonical(path: string): string | null {
  if (!existsSync(path)) {
    return null;
  }

  const ts = nowUnix();
  let attempt = 0;
  let candidate = backupCandidatePath(path, ts, attempt);
  while (existsSync(candidate)) {
    attempt += 1;
    candidate = backupCandidatePath(path, ts, attempt);
  }

  try {
    copyFileSync(path, candidate);
  } catch (error) {
    throw new Error(`failed to write snapshot to ${candidate}: ${messageOf(error)}`);
  }
  return candidate;
}

function backupCandidatePath(path: string, ts: number, attempt: number): string {
  if (attempt === 0) {
    return `${path}.bak.${ts}`;
  }
  return `${path}.bak.${ts}.${attempt}`;
}

function temporaryReplacementPath(path: string): string {
  return `${path}.tmp.${process.hrtime.bigint()}`;
}

function parseBackupSiblingMetadata(
  fileName: string,
  backupPrefix: string,
): { tsUnix: number; attempt: number } | null {
  if (!fileName.startsWith(backupPrefix)) {
    return null;
  }
  const suffix = fileName.slice(backupPrefix.length);
  const segments = suffix.split('.');
  const tsUnix = Number.parseInt(segments[0] ?? '', 10);
  if (!Number.isInteger(tsUnix)) {
    return null;
  }
  if (segments.length === 1) {
    return { tsUnix, attempt: 0 };
  }
  if (segments.length === 2) {
    const attempt = Number.parseInt(segments[1] ?? '', 10);
    if (Number.isInteger(attempt)) {
      return { tsUnix, attempt };
    }
  }
  return null;
}
