export type PlainRecord = Record<string, unknown>;

export function isPlainRecord(value: unknown): value is PlainRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asPlainRecord(value: unknown): PlainRecord | null {
  return isPlainRecord(value) ? value : null;
}

export function parseJsonValue(text: string): unknown {
  return JSON.parse(text) as unknown;
}

export function parseJsonObject(text: string): PlainRecord | null {
  return asPlainRecord(parseJsonValue(text));
}

export function clonePlainRecord(value: PlainRecord): PlainRecord {
  return JSON.parse(JSON.stringify(value)) as PlainRecord;
}
