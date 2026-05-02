import {
  formatTomlBareKey,
  formatTomlKey,
  isTomlTable,
  messageOf,
  omitTomlKeys,
  upgradedConfigVersion,
} from './coercion.js';
import { readText, writeAtomicTextFile } from './io.js';
import type { LocalStateConfig, TomlPrimitive, TomlTable, TomlValue } from './types.js';

export function parseLocalStateConfigToml(
  raw: string,
  path = 'config.local.toml',
): LocalStateConfig {
  try {
    const parsed = parseTomlDocument(raw);
    return {
      version: upgradedConfigVersion(asOptionalInteger(parsed.version)),
      extra: omitTomlKeys(parsed, ['version']),
    };
  } catch (error) {
    throw new Error(`failed to parse snapshot from ${path}: ${messageOf(error)}`);
  }
}

export function stringifyLocalStateConfig(config: LocalStateConfig): string {
  const normalized: TomlTable = {
    version: upgradedConfigVersion(config.version),
    ...config.extra,
  };
  return stringifyTomlDocument(normalized);
}

export function readLocalStateConfig(path: string): LocalStateConfig {
  return parseLocalStateConfigToml(readText(path), path);
}

export function writeLocalStateConfig(path: string, config: LocalStateConfig): void {
  writeAtomicTextFile(path, stringifyLocalStateConfig(config));
}

function parseTomlDocument(raw: string): TomlTable {
  const result: TomlTable = {};
  let currentPath: string[] = [];

  for (const originalLine of raw.split(/\r?\n/)) {
    const line = originalLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('[') && line.endsWith(']')) {
      currentPath = line
        .slice(1, -1)
        .split('.')
        .map((segment) => parseTomlKey(segment.trim()));
      ensureTomlTable(result, currentPath);
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`invalid TOML line: ${originalLine}`);
    }
    const key = parseTomlKey(line.slice(0, separatorIndex).trim());
    const rawValue = line.slice(separatorIndex + 1).trim();
    const table = ensureTomlTable(result, currentPath);
    table[key] = parseTomlValue(rawValue);
  }

  return result;
}

function stringifyTomlDocument(table: TomlTable): string {
  const topLines: string[] = [];
  const tableSections: string[] = [];

  for (const key of Object.keys(table).sort()) {
    const value = table[key];
    if (isTomlTable(value)) {
      appendTomlTable(tableSections, [key], value);
      continue;
    }
    topLines.push(`${formatTomlKey(key)} = ${stringifyTomlValue(value)}`);
  }

  const blocks = [topLines.join('\n'), ...tableSections.filter((section) => section.length > 0)].filter(
    (section) => section.length > 0,
  );
  return `${blocks.join('\n\n')}\n`;
}

function appendTomlTable(target: string[], path: string[], table: TomlTable): void {
  const localLines: string[] = [];
  const childTables: Array<{ path: string[]; table: TomlTable }> = [];

  for (const key of Object.keys(table).sort()) {
    const value = table[key];
    if (isTomlTable(value)) {
      childTables.push({ path: [...path, key], table: value });
      continue;
    }
    localLines.push(`${formatTomlKey(key)} = ${stringifyTomlValue(value)}`);
  }

  target.push([`[${path.map(formatTomlBareKey).join('.')}]`, ...localLines].join('\n'));
  for (const child of childTables) {
    appendTomlTable(target, child.path, child.table);
  }
}

function ensureTomlTable(root: TomlTable, path: string[]): TomlTable {
  let cursor = root;
  for (const segment of path) {
    const current = cursor[segment];
    if (current === undefined) {
      const next: TomlTable = {};
      cursor[segment] = next;
      cursor = next;
      continue;
    }
    if (!isTomlTable(current)) {
      throw new Error(`expected TOML table at ${path.join('.')}`);
    }
    cursor = current;
  }
  return cursor;
}

function parseTomlKey(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return JSON.parse(value) as string;
  }
  return value;
}

function parseTomlValue(rawValue: string): TomlValue {
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return JSON.parse(rawValue) as string;
  }
  if (rawValue === 'true') {
    return true;
  }
  if (rawValue === 'false') {
    return false;
  }
  if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    const inner = rawValue.slice(1, -1).trim();
    if (inner.length === 0) {
      return [];
    }
    return inner.split(',').map((part) => {
      const value = parseTomlValue(part.trim());
      if (typeof value === 'object') {
        throw new Error('only primitive TOML arrays are supported');
      }
      return value;
    });
  }
  const numberValue = Number(rawValue);
  if (!Number.isNaN(numberValue)) {
    return numberValue;
  }
  throw new Error(`unsupported TOML value: ${rawValue}`);
}

function stringifyTomlValue(value: TomlValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyTomlPrimitive(item)).join(', ')}]`;
  }
  if (isTomlTable(value)) {
    throw new Error('nested TOML tables must be rendered as table sections');
  }
  return stringifyTomlPrimitive(value);
}

function stringifyTomlPrimitive(value: TomlPrimitive): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return String(value);
}

function asOptionalInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}
