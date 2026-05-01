#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, "..");

const tempRoot = mkdtempSync(join(tmpdir(), "sane-codex-real-smoke-"));
const tempHome = join(tempRoot, "home");
const tempWorkspace = join(tempRoot, "workspace");
const tempCodexHome = join(tempHome, ".codex");

const keepTemp = process.env.SANE_CODEX_SMOKE_KEEP_TMP === "1";

try {
  mkdirSync(tempCodexHome, { recursive: true });
  mkdirSync(tempWorkspace, { recursive: true });

  const authSource = resolveAuthSource();
  if (!authSource) {
    fail(
      "Codex auth missing. Provide `SANE_CODEX_SMOKE_AUTH_JSON=/abs/path/auth.json` or ensure `~/.codex/auth.json` exists."
    );
  }

  const tempAuthPath = join(tempCodexHome, "auth.json");
  copyFileSync(authSource, tempAuthPath);
  chmodSync(tempAuthPath, 0o600);

  const env = buildIsolatedEnv(tempHome, tempCodexHome);
  runOrFail(
    process.execPath,
    [resolveSaneEntrypoint(), "export", "all"],
    env,
    tempWorkspace,
    "sane export all failed"
  );

  if (!commandExists("codex")) {
    fail("Codex CLI not found in PATH. Install Codex CLI, then re-run `pnpm --filter @sane/sane-tui run smoke:codex-real`.");
  }

  const prompt = [
    "Check exported Sane instructions in this workspace and home profile.",
    "If setup is present, reply with exactly: rtk",
    "If missing, reply with exactly: missing"
  ].join(" ");

  const result = spawnSync(
    "codex",
    [
      "--ask-for-approval",
      "never",
      "exec",
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--cd",
      tempWorkspace,
      prompt
    ],
    {
      cwd: tempWorkspace,
      env,
      encoding: "utf8"
    }
  );

  if (result.error) {
    fail(`codex exec failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = excerpt(result.stderr);
    fail(`codex exec exited ${result.status}${stderr ? `: ${stderr}` : ""}`);
  }

  const stdout = (result.stdout ?? "").trim().toLowerCase();
  if (stdout !== "rtk") {
    fail(`codex smoke check failed: expected stdout to be exactly \`rtk\`, got ${JSON.stringify(stdout)}.`);
  }

  console.log("codex real smoke passed");
  if (!keepTemp) {
    rmSync(tempRoot, { recursive: true, force: true });
  } else {
    console.log(`temp kept: ${tempRoot}`);
  }
} catch (error) {
  if (!keepTemp) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(`codex real smoke failed: ${message}`);
  process.exit(1);
}

function resolveSaneEntrypoint() {
  const distBin = join(PACKAGE_ROOT, "dist", "bin", "sane.js");
  if (existsSync(distBin)) {
    return distBin;
  }
  return join(PACKAGE_ROOT, "bin", "sane.mjs");
}

function resolveAuthSource() {
  const envPath = process.env.SANE_CODEX_SMOKE_AUTH_JSON;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }
  const homeAuth = join(homedir(), ".codex", "auth.json");
  return existsSync(homeAuth) ? homeAuth : null;
}

function buildIsolatedEnv(tempHomeDir, tempCodexHomeDir) {
  return {
    ...process.env,
    HOME: tempHomeDir,
    CODEX_HOME: tempCodexHomeDir
  };
}

function runOrFail(command, args, env, cwd, message) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8"
  });

  if (result.error) {
    fail(`${message}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    fail(`${message}${stderr ? `: ${stderr}` : ""}`);
  }
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8"
  });
  return result.status === 0;
}

function excerpt(value) {
  const trimmed = (value || "").trim();
  if (trimmed.length <= 1200) {
    return trimmed;
  }
  return `${trimmed.slice(0, 1200)}...`;
}

function fail(message) {
  throw new Error(message);
}
