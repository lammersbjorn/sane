import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

import { InventoryScope, InventoryStatus, type InventoryItem } from "@sane/core";
import { type HostPlatform } from "@sane/platform";

export const RTK_BINARY_INVENTORY_NAME = "rtk-binary";
export const RTK_INSTALL_HINT = "install upstream RTK (`brew install rtk`, upstream install script, or Cargo) and ensure `rtk` is on PATH";
export const RTK_HOMEBREW_INSTALL_HINT = "future Sane Homebrew formula should depend on upstream `rtk`";

export interface RtkBinarySnapshot {
  installed: boolean;
  path: string | null;
}

export function inspectRtkBinaryInventory(
  enabled: boolean,
  hostPlatform: HostPlatform,
  env: NodeJS.ProcessEnv = process.env
): InventoryItem | null {
  if (!enabled) {
    return null;
  }

  const binary = findExecutableOnPath("rtk", env);

  return {
    name: RTK_BINARY_INVENTORY_NAME,
    scope: InventoryScope.Compatibility,
    status: binary.installed ? InventoryStatus.Installed : InventoryStatus.Missing,
    path: binary.path ?? "PATH",
    repairHint: binary.installed
      ? null
      : hostPlatform === "windows"
        ? `${RTK_INSTALL_HINT}; use WSL for Codex hook enforcement on native Windows`
        : RTK_INSTALL_HINT
  };
}

export function inspectRtkBinary(env: NodeJS.ProcessEnv = process.env): RtkBinarySnapshot {
  return findExecutableOnPath("rtk", env);
}

function findExecutableOnPath(command: string, env: NodeJS.ProcessEnv): RtkBinarySnapshot {
  const pathEnv = env.PATH ?? env.Path ?? env.path ?? "";
  const extensions = executableExtensions(env);

  for (const dir of pathEnv.split(delimiter).filter((item) => item.length > 0)) {
    for (const extension of extensions) {
      const candidate = join(dir, `${command}${extension}`);
      if (existsSync(candidate)) {
        return { installed: true, path: candidate };
      }
    }
  }

  return { installed: false, path: null };
}

function executableExtensions(env: NodeJS.ProcessEnv): string[] {
  const pathext = env.PATHEXT ?? "";
  const fromPathext = pathext
    .split(";")
    .map((extension) => extension.trim().toLowerCase())
    .filter((extension) => extension.length > 0);

  return ["", ...fromPathext];
}
