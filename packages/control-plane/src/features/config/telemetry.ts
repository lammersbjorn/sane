import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { type LocalConfig, type TelemetryLevel } from "@sane/config";
import { type ProjectPaths } from "../../platform.js";
import { appendJsonlRecord, readJsonlRecordsSlice } from "@sane/state";

import { parseJsonObject, type PlainRecord } from "./config-object.js";
import { loadOrDefaultLocalConfig } from "./local-config.js";

export type TelemetryCategory =
  | "install"
  | "doctor"
  | "self-repair"
  | "issue-relay"
  | "export"
  | "config"
  | "error";

export interface TelemetryEventInput {
  category: TelemetryCategory;
  action: string;
  result: "success" | "failure" | "blocked" | "drafted" | "discarded" | "submitted";
  surface: string;
  errorFingerprint?: string | null;
}

export interface TelemetryEventRecord extends TelemetryEventInput {
  tsBucket: string;
  version: 1;
}

export interface TelemetrySummary {
  version: 1;
  counts: Record<string, number>;
  lastSeen: Record<string, string>;
}

export interface TelemetryLedgerSnapshot {
  consent: TelemetryLevel;
  summary: TelemetrySummary | null;
  recentEvents: TelemetryEventRecord[];
  queuedUploadCount: number;
}

export function recordTelemetryEvent(
  paths: ProjectPaths,
  input: TelemetryEventInput,
  config: LocalConfig = loadOrDefaultLocalConfig(paths)
): TelemetryLedgerSnapshot {
  if (config.privacy.telemetry === "off") {
    return inspectTelemetryLedger(paths, config);
  }

  mkdirSync(paths.telemetryDir, { recursive: true });
  const event = normalizeTelemetryEvent(input);
  const summary = updateTelemetrySummary(paths, event);
  appendJsonlRecord(paths.telemetryEventsPath, event, stringifyTelemetryEventRecord);

  return {
    consent: config.privacy.telemetry,
    summary,
    recentEvents: inspectRecentTelemetryEvents(paths),
    queuedUploadCount: countJsonl(paths.telemetryQueuePath)
  };
}

export function inspectTelemetryLedger(
  paths: ProjectPaths,
  config: LocalConfig = loadOrDefaultLocalConfig(paths)
): TelemetryLedgerSnapshot {
  return {
    consent: config.privacy.telemetry,
    summary: readTelemetrySummary(paths),
    recentEvents: inspectRecentTelemetryEvents(paths),
    queuedUploadCount: countJsonl(paths.telemetryQueuePath)
  };
}

function normalizeTelemetryEvent(input: TelemetryEventInput): TelemetryEventRecord {
  return {
    version: 1,
    tsBucket: dayBucket(new Date()),
    category: input.category,
    action: sanitizeTelemetryToken(input.action),
    result: input.result,
    surface: sanitizeTelemetryToken(input.surface),
    errorFingerprint: input.errorFingerprint ? sanitizeTelemetryToken(input.errorFingerprint) : null
  };
}

function updateTelemetrySummary(
  paths: ProjectPaths,
  event: TelemetryEventRecord
): TelemetrySummary {
  const summary = readTelemetrySummary(paths) ?? {
    version: 1,
    counts: {},
    lastSeen: {}
  };
  const key = `${event.category}.${event.action}.${event.result}`;
  summary.counts[key] = (summary.counts[key] ?? 0) + 1;
  summary.lastSeen[key] = event.tsBucket;
  writeFileSync(paths.telemetrySummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summary;
}

function readTelemetrySummary(paths: ProjectPaths): TelemetrySummary | null {
  if (!existsSync(paths.telemetrySummaryPath)) {
    return null;
  }

  try {
    const parsed = parseJsonObject(readFileSync(paths.telemetrySummaryPath, "utf8"));
    if (!parsed || parsed.version !== 1) {
      return null;
    }
    const counts = numericRecord(parseRecordField(parsed, "counts"));
    const lastSeen = stringRecord(parseRecordField(parsed, "lastSeen"));
    return { version: 1, counts, lastSeen };
  } catch {
    return null;
  }
}

function inspectRecentTelemetryEvents(paths: ProjectPaths): TelemetryEventRecord[] {
  return readJsonlRecordsSlice(paths.telemetryEventsPath, 0, 20, parseTelemetryEventRecord);
}

function parseTelemetryEventRecord(raw: string): TelemetryEventRecord {
  const parsed = parseJsonObject(raw);
  if (!parsed || parsed.version !== 1) {
    throw new Error("invalid telemetry event");
  }

  return {
    version: 1,
    tsBucket: typeof parsed.tsBucket === "string" ? parsed.tsBucket : "unknown",
    category: isTelemetryCategory(parsed.category) ? parsed.category : "error",
    action: typeof parsed.action === "string" ? parsed.action : "unknown",
    result: isTelemetryResult(parsed.result) ? parsed.result : "failure",
    surface: typeof parsed.surface === "string" ? parsed.surface : "unknown",
    errorFingerprint: typeof parsed.errorFingerprint === "string" ? parsed.errorFingerprint : null
  };
}

function stringifyTelemetryEventRecord(event: TelemetryEventRecord): string {
  return JSON.stringify(event);
}

function countJsonl(path: string): number {
  return readJsonlRecordsSlice(path, 0, null, (raw) => raw).length;
}

function dayBucket(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sanitizeTelemetryToken(value: string): string {
  return sanitizeTokenText(value, 80) || "unknown";
}

function sanitizeTokenText(value: string, maxLength: number): string {
  let result = "";
  let pendingSeparator = false;
  for (const char of value) {
    if (result.length >= maxLength) {
      break;
    }
    if (isTelemetryTokenChar(char)) {
      if (pendingSeparator && result.length > 0) {
        result += "-";
      }
      result += char;
      pendingSeparator = false;
      continue;
    }
    pendingSeparator = result.length > 0;
  }
  return trimTrailingDashes(result);
}

function isTelemetryTokenChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57)
    || (code >= 65 && code <= 90)
    || (code >= 97 && code <= 122)
    || char === "."
    || char === "_"
    || char === ":"
    || char === "-"
  );
}

function trimTrailingDashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "-") {
    end -= 1;
  }
  return value.slice(0, end);
}

function parseRecordField(record: PlainRecord, key: string): PlainRecord {
  const value = record[key];
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as PlainRecord
    : {};
}

function numericRecord(record: PlainRecord): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, number] => typeof entry[1] === "number")
  );
}

function stringRecord(record: PlainRecord): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function isTelemetryCategory(value: unknown): value is TelemetryCategory {
  return typeof value === "string" && [
    "install",
    "doctor",
    "self-repair",
    "issue-relay",
    "export",
    "config",
    "error"
  ].includes(value);
}

function isTelemetryResult(value: unknown): value is TelemetryEventInput["result"] {
  return typeof value === "string" && [
    "success",
    "failure",
    "blocked",
    "drafted",
    "discarded",
    "submitted"
  ].includes(value);
}
