import { execFileSync, spawnSync } from "node:child_process";

import { OperationKind, OperationResult } from "@sane/control-plane/core.js";

export type SaneInstallSource = "local" | "pnpm" | "homebrew" | "unknown";

export interface UpdateCheckInput {
  currentVersion: string;
  packageName?: string;
  latestVersion?: string | null;
  npmTag?: string;
  autoUpdate?: boolean;
  executablePath?: string | null;
  env?: NodeJS.ProcessEnv;
  exec?: typeof execFileSync;
  spawn?: typeof spawnSync;
}

export interface UpdateCheckSnapshot {
  packageName: string;
  currentVersion: string;
  latestVersion: string | null;
  status: "up_to_date" | "update_available" | "unknown";
  installSource: SaneInstallSource;
  updateCommand: string;
  autoUpdate: "disabled" | "unsupported" | "not_needed" | "applied" | "failed";
  autoUpdateDetails: string[];
}

export function checkForUpdates(input: UpdateCheckInput): OperationResult {
  const snapshot = inspectUpdateCheck(input);

  return new OperationResult({
    kind: OperationKind.CheckUpdates,
    summary: updateCheckSummary(snapshot),
    details: [
      `package: ${snapshot.packageName}`,
      `current: ${snapshot.currentVersion}`,
      `latest: ${snapshot.latestVersion ?? "unknown"}`,
      `install source: ${snapshot.installSource}`,
      `auto updates: ${snapshot.autoUpdate}`,
      `update command: ${snapshot.updateCommand}`,
      ...snapshot.autoUpdateDetails
    ],
    pathsTouched: []
  });
}

export function inspectUpdateCheck(input: UpdateCheckInput): UpdateCheckSnapshot {
  const packageName = input.packageName ?? "sane-codex";
  const latestVersion = input.latestVersion === undefined
    ? readLatestNpmVersion(packageName, input.npmTag ?? "latest", input.exec ?? execFileSync)
    : input.latestVersion;
  const status = latestVersion === null
    ? "unknown"
    : compareVersions(input.currentVersion, latestVersion) < 0
      ? "update_available"
      : "up_to_date";
  const installSource = detectSaneInstallSource(input.executablePath ?? process.argv[1] ?? null, input.env ?? process.env);
  const updateCommand = updateCommandForSource(installSource, packageName);
  const autoUpdate = runAutoUpdateIfNeeded({
    enabled: input.autoUpdate ?? false,
    status,
    installSource,
    updateCommand,
    spawn: input.spawn ?? spawnSync
  });

  return {
    packageName,
    currentVersion: input.currentVersion,
    latestVersion,
    status,
    installSource,
    updateCommand,
    autoUpdate: autoUpdate.status,
    autoUpdateDetails: autoUpdate.details
  };
}

export function detectSaneInstallSource(
  executablePath: string | null,
  env: NodeJS.ProcessEnv = process.env
): SaneInstallSource {
  const path = (executablePath ?? "").toLowerCase();
  const userAgent = (env.npm_config_user_agent ?? "").toLowerCase();
  const execPath = (env.npm_execpath ?? "").toLowerCase();

  if (path.includes("/cellar/") || path.includes("/homebrew/") || path.includes("\\homebrew\\")) {
    return "homebrew";
  }
  if (userAgent.startsWith("pnpm/") || execPath.includes("pnpm")) {
    return "pnpm";
  }
  if (path.includes("/.pnpm/") || path.includes("/node_modules/sane-codex/")) {
    return "pnpm";
  }
  if (path.includes("/apps/sane-tui/") || path.includes("/dist/bin/sane.cjs")) {
    return "local";
  }
  return "unknown";
}

function updateCheckSummary(snapshot: UpdateCheckSnapshot): string {
  if (snapshot.autoUpdate === "applied") {
    return `update applied: ${snapshot.packageName} ${snapshot.currentVersion} -> ${snapshot.latestVersion}`;
  }
  if (snapshot.autoUpdate === "failed") {
    return `update available but auto-update failed: ${snapshot.packageName} ${snapshot.currentVersion} -> ${snapshot.latestVersion}`;
  }

  switch (snapshot.status) {
    case "update_available":
      return `update available: ${snapshot.packageName} ${snapshot.currentVersion} -> ${snapshot.latestVersion}`;
    case "up_to_date":
      return `update check: ${snapshot.packageName} ${snapshot.currentVersion} is current`;
    case "unknown":
      return `update check: unable to reach registry for ${snapshot.packageName}`;
  }
}

function updateCommandForSource(source: SaneInstallSource, packageName: string): string {
  switch (source) {
    case "homebrew":
      return `brew upgrade ${packageName}`;
    case "local":
      return "git pull && pnpm install && pnpm run start:status";
    case "pnpm":
    case "unknown":
      return `pnpm add -g ${packageName}`;
  }
}

function runAutoUpdateIfNeeded(input: {
  enabled: boolean;
  status: UpdateCheckSnapshot["status"];
  installSource: SaneInstallSource;
  updateCommand: string;
  spawn: typeof spawnSync;
}): { status: UpdateCheckSnapshot["autoUpdate"]; details: string[] } {
  if (!input.enabled) {
    return { status: "disabled", details: [] };
  }
  if (input.status !== "update_available") {
    return { status: "not_needed", details: [] };
  }
  if (input.installSource === "local" || input.installSource === "unknown") {
    return {
      status: "unsupported",
      details: ["auto-update skipped: install source needs manual update"]
    };
  }

  const [command, ...args] = input.updateCommand.split(" ");
  const result = input.spawn(command!, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000
  });
  if (result.status === 0) {
    return { status: "applied", details: ["auto-update command completed"] };
  }

  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  return {
    status: "failed",
    details: [`auto-update command failed: ${stderr || result.error?.message || "unknown error"}`]
  };
}

function readLatestNpmVersion(
  packageName: string,
  npmTag: string,
  exec: typeof execFileSync
): string | null {
  try {
    const output = exec("pnpm", ["view", `${packageName}@${npmTag}`, "version"], {
      encoding: "utf8",
      timeout: 8_000,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const version = output.trim().split(/\s+/).at(-1) ?? "";
    return version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

function compareVersions(left: string, right: string): number {
  const leftParsed = parseVersion(left);
  const rightParsed = parseVersion(right);

  for (let index = 0; index < 3; index += 1) {
    const diff = leftParsed.core[index]! - rightParsed.core[index]!;
    if (diff !== 0) {
      return Math.sign(diff);
    }
  }

  if (leftParsed.prerelease === rightParsed.prerelease) {
    return 0;
  }
  if (leftParsed.prerelease === null) {
    return 1;
  }
  if (rightParsed.prerelease === null) {
    return -1;
  }

  return comparePrerelease(leftParsed.prerelease, rightParsed.prerelease);
}

function parseVersion(version: string): {
  core: [number, number, number];
  prerelease: string[] | null;
} {
  const [coreRaw = "", prereleaseRaw] = version.replace(/^v/, "").split("-", 2);
  const coreParts = coreRaw.split(".").map((part) => Number.parseInt(part, 10));
  return {
    core: [
      Number.isFinite(coreParts[0]) ? coreParts[0]! : 0,
      Number.isFinite(coreParts[1]) ? coreParts[1]! : 0,
      Number.isFinite(coreParts[2]) ? coreParts[2]! : 0
    ],
    prerelease: prereleaseRaw ? prereleaseRaw.split(".") : null
  };
}

function comparePrerelease(left: string[], right: string[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    if (leftPart === rightPart) {
      continue;
    }

    const leftNumber = Number.parseInt(leftPart, 10);
    const rightNumber = Number.parseInt(rightPart, 10);
    const leftIsNumber = String(leftNumber) === leftPart;
    const rightIsNumber = String(rightNumber) === rightPart;
    if (leftIsNumber && rightIsNumber) {
      return Math.sign(leftNumber - rightNumber);
    }
    if (leftIsNumber) {
      return -1;
    }
    if (rightIsNumber) {
      return 1;
    }
    return leftPart.localeCompare(rightPart);
  }

  return 0;
}
