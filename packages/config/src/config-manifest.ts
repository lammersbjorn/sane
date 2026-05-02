import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isRecord } from './config-coercion.js';
import { messageOf, parseJsonConfig } from './config-parsing.js';

export interface CorePackManifest {
  optionalPacks: Record<string, { configKey?: string }>;
}

export function parseCorePackManifest(
  raw: string,
  path = 'packs/core/manifest.json',
): CorePackManifest {
  const decoded = parseJsonConfig(raw, path, 'core pack manifest');

  if (!isRecord(decoded) || Array.isArray(decoded)) {
    throw new Error(`invalid core pack manifest at ${path}: expected object`);
  }

  if (!isRecord(decoded.optionalPacks) || Array.isArray(decoded.optionalPacks)) {
    throw new Error(`invalid core pack manifest at ${path}: optionalPacks must be object`);
  }

  const optionalPacks: Record<string, { configKey?: string }> = {};
  for (const [pack, definition] of Object.entries(decoded.optionalPacks)) {
    if (!isRecord(definition) || Array.isArray(definition)) {
      throw new Error(`invalid core pack manifest at ${path}: optional pack ${pack} must be object`);
    }
    if (
      'configKey' in definition &&
      definition.configKey !== undefined &&
      typeof definition.configKey !== 'string'
    ) {
      throw new Error(
        `invalid core pack manifest at ${path}: optional pack ${pack} configKey must be string`,
      );
    }
    optionalPacks[pack] = { configKey: definition.configKey as string | undefined };
  }

  return { optionalPacks };
}

export function readCorePackManifest(): CorePackManifest {
  const manifestPath = resolve(discoverRepoRoot(), 'packs/core/manifest.json');

  try {
    return parseCorePackManifest(readFileSync(manifestPath, 'utf8'), manifestPath);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('failed to parse core pack manifest')) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('invalid core pack manifest at')) {
      throw error;
    }
    throw new Error(`failed to read core pack manifest from ${manifestPath}: ${messageOf(error)}`);
  }
}

function discoverRepoRoot(): string {
  for (const startDir of candidateRepoRootStarts()) {
    let current = startDir;

    while (true) {
      if (existsSync(resolve(current, 'packs/core/manifest.json'))) {
        return current;
      }

      const parent = resolve(current, '..');
      if (parent === current) {
        break;
      }

      current = parent;
    }
  }

  throw new Error(`unable to locate repo root for Sane pack manifest`);
}

function candidateRepoRootStarts(): string[] {
  const starts = new Set<string>();

  if (process.argv[1]) {
    starts.add(dirname(resolve(process.argv[1])));
  }

  try {
    starts.add(dirname(fileURLToPath(import.meta.url)));
  } catch {
    if (typeof __dirname === 'string') {
      starts.add(__dirname);
    }
  }

  return [...starts];
}
