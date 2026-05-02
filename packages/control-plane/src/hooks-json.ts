import { readFileSync } from "node:fs";

import { writeAtomicTextFile } from "@sane/state";

import { asPlainRecord, parseJsonObject, type PlainRecord } from "./config-object.js";

type JsonObject = PlainRecord;

export function readHooksJson(path: string): JsonObject {
  const root = parseJsonObject(readFileSync(path, "utf8"));
  if (!root) {
    throw new Error("hooks JSON root must be an object");
  }
  return root;
}

export function readHooksJsonOrDefault(path: string, exists: boolean): JsonObject {
  return exists ? readHooksJson(path) : {};
}

export function writeHooksJson(path: string, value: unknown): void {
  writeAtomicTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function ensureObjectProperty(root: JsonObject, key: string): JsonObject {
  if (!asPlainRecord(root[key])) {
    root[key] = {};
  }
  return root[key] as JsonObject;
}

export function ensureArrayProperty(root: JsonObject, key: string): unknown[] {
  if (!Array.isArray(root[key])) {
    root[key] = [];
  }
  return root[key] as unknown[];
}

export function validateHooksShapeForManagedUpdate(root: JsonObject): string | null {
  if (root.hooks === undefined) {
    return null;
  }
  const hooks = asPlainRecord(root.hooks);
  if (!hooks) {
    return "hooks.json must use object at top-level `hooks` key";
  }
  if (hooks.SessionStart !== undefined && !Array.isArray(hooks.SessionStart)) {
    return "hooks.json must use array at `hooks.SessionStart`";
  }
  if (hooks.PreToolUse !== undefined && !Array.isArray(hooks.PreToolUse)) {
    return "hooks.json must use array at `hooks.PreToolUse`";
  }
  if (hooks.SessionEnd !== undefined && !Array.isArray(hooks.SessionEnd)) {
    return "hooks.json must use array at `hooks.SessionEnd`";
  }
  if (hooks.Stop !== undefined && !Array.isArray(hooks.Stop)) {
    return "hooks.json must use array at `hooks.Stop`";
  }
  return null;
}
