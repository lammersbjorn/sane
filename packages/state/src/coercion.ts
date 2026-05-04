import type { JsonRecord, JsonValue, TomlTable, TomlValue } from './types.js';

export function parseJsonValue(raw: string, path: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`failed to parse snapshot from ${path}: ${messageOf(error)}`);
  }
}

export function omitKeys(record: Record<string, unknown>, keys: string[]): JsonRecord {
  const excluded = new Set(keys);
  const result: JsonRecord = {};
  for (const [key, value] of Object.entries(record)) {
    if (!excluded.has(key)) {
      result[key] = value as JsonValue;
    }
  }
  return result;
}

export function omitTomlKeys(record: TomlTable, keys: string[]): TomlTable {
  const excluded = new Set(keys);
  const result: TomlTable = {};
  for (const [key, value] of Object.entries(record)) {
    if (!excluded.has(key)) {
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
    }
  }
  return result;
}

export function readAlias(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }
  return undefined;
}

export function nestedObjective(value: unknown): string | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  return asOptionalString(value.objective);
}

export function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`invalid ${label}: expected object`);
  }
  return value;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (isPlainObject(value)) {
    return Object.values(value).every((item) => isJsonValue(item));
  }

  return false;
}

export function firstString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string');
}

export function asString(value: unknown, key: string): string {
  if (typeof value !== 'string') {
    throw new Error(`expected string for ${key}`);
  }
  return value;
}

export function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function asOptionalJsonRecord(value: unknown): JsonRecord | undefined {
  if (!isPlainObject(value) || !isJsonValue(value)) {
    return undefined;
  }

  return value as JsonRecord;
}

export function asNullableString(value: unknown, key: string): string | null {
  if (value === null) {
    return null;
  }
  return asString(value, key);
}

export function asInteger(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`expected integer for ${key}`);
  }
  return value;
}

export function asOptionalInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

export function asStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`expected string array for ${key}`);
  }
  return [...value];
}

export function asOptionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return asStringArray(value, 'paths');
}

export function coerceStringList(value: unknown, key: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`expected array for ${key}`);
  }
  return value.map((item) => coerceStringValue(item, key));
}

export function coerceStringValue(value: unknown, key: string): string {
  if (typeof value === 'string') {
    return value;
  }
  if (isPlainObject(value)) {
    for (const candidateKey of ['summary', 'text', 'value', 'name', 'label', 'path']) {
      const candidate = value[candidateKey];
      if (typeof candidate === 'string') {
        return candidate;
      }
    }
    const paths = value.paths;
    if (Array.isArray(paths)) {
      const firstPath = paths.find((item) => typeof item === 'string');
      if (typeof firstPath === 'string') {
        return firstPath;
      }
    }
  }
  throw new Error(`expected string-like value for ${key}`);
}

export function upgradedVersion(version: number | undefined): number {
  return version !== undefined && version >= 2 ? version : 2;
}

export function upgradedConfigVersion(version: number | undefined): number {
  return version !== undefined && version >= 1 ? version : 1;
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isTomlTable(value: TomlValue | undefined): value is TomlTable {
  return isPlainObject(value);
}

export function formatTomlKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

export function formatTomlBareKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}
