import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { type LocalConfig, type TelemetryLevel } from "@sane/config";
import { type ProjectPaths } from "@sane/platform";
import { appendJsonlRecord, readJsonlRecordsSlice } from "@sane/state";

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
    const parsed = JSON.parse(readFileSync(paths.telemetrySummaryPath, "utf8")) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null;
    }
    const counts = isRecord(parsed.counts) ? numericRecord(parsed.counts) : {};
    const lastSeen = isRecord(parsed.lastSeen) ? stringRecord(parsed.lastSeen) : {};
    return { version: 1, counts, lastSeen };
  } catch {
    return null;
  }
}

function inspectRecentTelemetryEvents(paths: ProjectPaths): TelemetryEventRecord[] {
  return readJsonlRecordsSlice(paths.telemetryEventsPath, 0, 20, parseTelemetryEventRecord);
}

function parseTelemetryEventRecord(raw: string): TelemetryEventRecord {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed) || parsed.version !== 1) {
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
  return value.replace(/[^a-zA-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "unknown";
}

function numericRecord(record: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, number] => typeof entry[1] === "number")
  );
}

function stringRecord(record: Record<string, unknown>): Record<string, string> {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
