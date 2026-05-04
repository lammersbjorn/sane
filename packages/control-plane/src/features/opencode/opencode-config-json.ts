import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { writeAtomicTextFile } from "@sane/state";

import { parseJsonObject } from "../../config-object.js";

export type OpencodeConfigReadResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false };

export function readOpencodeConfigJson(path: string): OpencodeConfigReadResult {
  if (!existsSync(path)) {
    return { ok: true, value: {} };
  }
  try {
    const parsed = parseJsonObject(readFileSync(path, "utf8"));
    if (!parsed) {
      return { ok: false };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false };
  }
}

export function writeOpencodeConfigJson(path: string, config: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeAtomicTextFile(path, `${JSON.stringify(config, null, 2)}\n`);
}
