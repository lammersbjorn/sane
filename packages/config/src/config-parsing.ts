import { readFileSync } from 'node:fs';

import { parse as parseToml } from 'toml';

export function parseTomlConfig(raw: string, path: string): unknown {
  try {
    return parseToml(raw);
  } catch (error) {
    throw new Error(`failed to parse config from ${path}: ${messageOf(error)}`);
  }
}

export function parseJsonConfig(raw: string, path: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`failed to parse ${label} from ${path}: ${messageOf(error)}`);
  }
}

export function readUtf8File(path: string, prefix: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`${prefix}${messageOf(error)}`);
  }
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
