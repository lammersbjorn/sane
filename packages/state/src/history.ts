import { exists, readText } from './io.js';

export function readJsonlRecords<T>(
  path: string,
  parseLine: (raw: string, path?: string) => T,
): T[] {
  return readJsonlRecordsSlice(path, 0, null, parseLine);
}

export function readJsonlLastRecord<T>(
  path: string,
  parseLine: (raw: string, path?: string) => T,
): T | null {
  const records = readJsonlRecordsSlice(path, 0, null, parseLine);
  return records.at(-1) ?? null;
}

export function countJsonlEntries(path: string): number {
  if (!exists(path)) {
    return 0;
  }

  return readText(path)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;
}

export function readJsonlRecordsSlice<T>(
  path: string,
  offset: number,
  limit: number | null,
  parseLine: (raw: string, path?: string) => T,
): T[] {
  if (!exists(path)) {
    return [];
  }

  const raw = readText(path);
  const records: T[] = [];
  let seen = 0;

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    if (line.trim().length === 0) {
      continue;
    }
    if (seen < offset) {
      seen += 1;
      continue;
    }
    if (limit !== null && records.length >= limit) {
      break;
    }
    records.push(parseLine(line, `${path}:${index + 1}`));
    seen += 1;
  }

  return records;
}

export function readLatestValidJsonlRecord<T, R>(
  path: string,
  parseLine: (raw: string, path?: string) => T,
  mapRecord: (record: T) => R,
): R | null {
  if (!exists(path)) {
    return null;
  }

  const lines = readText(path).split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line || line.trim().length === 0) {
      continue;
    }

    try {
      return mapRecord(parseLine(line, `${path}:${index + 1}`));
    } catch {
      continue;
    }
  }

  return null;
}
