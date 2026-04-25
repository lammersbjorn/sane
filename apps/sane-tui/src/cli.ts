import { type HomeDirEnv, discoverCodexPaths, discoverProjectPaths } from "@sane/platform";

import { renderSessionStartHookOutput } from "@sane/control-plane/session-start-hook.js";

import { type BackendCommandId, type LaunchShortcut } from "@sane/sane-tui/command-registry.js";
import { executeUiCommand } from "@sane/sane-tui/shell.js";
import { type TextViewport } from "@sane/sane-tui/text-renderer.js";
import { createTextTuiRuntimeFromDiscovery } from "@sane/sane-tui/text-driver.js";

export type ParsedCliCommand =
  | {
      kind: "launch";
      launchShortcut: LaunchShortcut;
      viewport?: TextViewport;
    }
  | {
      kind: "backend";
      commandId: BackendCommandId;
    }
  | {
      kind: "hook";
      event: "session-start";
    };

export interface CliRunResult {
  exitCode: number;
  output: string;
}

const BACKEND_COMMAND_ALIASES: ReadonlyArray<{
  args: readonly string[];
  commandId: BackendCommandId;
}> = [
  { args: ["install"], commandId: "install_runtime" },
  { args: ["config"], commandId: "show_config" },
  { args: ["codex-config"], commandId: "show_codex_config" },
  { args: ["summary"], commandId: "show_runtime_summary" },
  { args: ["outcome-readiness"], commandId: "show_outcome_readiness" },
  { args: ["backup", "codex-config"], commandId: "backup_codex_config" },
  { args: ["preview", "policy"], commandId: "preview_policy" },
  { args: ["preview", "codex-profile"], commandId: "preview_codex_profile" },
  { args: ["preview", "integrations-profile"], commandId: "preview_integrations_profile" },
  { args: ["preview", "cloudflare-profile"], commandId: "preview_cloudflare_profile" },
  { args: ["preview", "opencode-profile"], commandId: "preview_opencode_profile" },
  { args: ["preview", "statusline-profile"], commandId: "preview_statusline_profile" },
  { args: ["apply", "codex-profile"], commandId: "apply_codex_profile" },
  { args: ["apply", "integrations-profile"], commandId: "apply_integrations_profile" },
  { args: ["apply", "cloudflare-profile"], commandId: "apply_cloudflare_profile" },
  { args: ["apply", "opencode-profile"], commandId: "apply_opencode_profile" },
  { args: ["apply", "statusline-profile"], commandId: "apply_statusline_profile" },
  { args: ["restore", "codex-config"], commandId: "restore_codex_config" },
  { args: ["status"], commandId: "show_status" },
  { args: ["doctor"], commandId: "doctor" },
  { args: ["export", "user-skills"], commandId: "export_user_skills" },
  { args: ["export", "repo-skills"], commandId: "export_repo_skills" },
  { args: ["export", "repo-agents"], commandId: "export_repo_agents" },
  { args: ["export", "global-agents"], commandId: "export_global_agents" },
  { args: ["export", "hooks"], commandId: "export_hooks" },
  { args: ["export", "custom-agents"], commandId: "export_custom_agents" },
  { args: ["export", "opencode-agents"], commandId: "export_opencode_agents" },
  { args: ["export", "all"], commandId: "export_all" },
  { args: ["uninstall", "user-skills"], commandId: "uninstall_user_skills" },
  { args: ["uninstall", "repo-skills"], commandId: "uninstall_repo_skills" },
  { args: ["uninstall", "repo-agents"], commandId: "uninstall_repo_agents" },
  { args: ["uninstall", "global-agents"], commandId: "uninstall_global_agents" },
  { args: ["uninstall", "hooks"], commandId: "uninstall_hooks" },
  { args: ["uninstall", "custom-agents"], commandId: "uninstall_custom_agents" },
  { args: ["uninstall", "opencode-agents"], commandId: "uninstall_opencode_agents" },
  { args: ["uninstall", "all"], commandId: "uninstall_all" }
] as const;

export function parseCliArgs(args: readonly string[]): ParsedCliCommand {
  const { args: normalizedArgs, viewport } = parseRenderOptions(normalizeCliArgs(args));

  if (normalizedArgs.length === 0) {
    return { kind: "launch", launchShortcut: "default", viewport };
  }

  const launchShortcut = parseLaunchShortcut(normalizedArgs);
  if (launchShortcut) {
    return { kind: "launch", launchShortcut, viewport };
  }

  if (matchesArgs(normalizedArgs, ["hook", "session-start"])) {
    return { kind: "hook", event: "session-start" };
  }

  const backend = BACKEND_COMMAND_ALIASES.find((entry) => matchesArgs(normalizedArgs, entry.args));
  if (backend) {
    return {
      kind: "backend",
      commandId: backend.commandId
    };
  }

  throw new Error(`unsupported command: ${normalizedArgs.join(" ") || "<none>"}`);
}

export function runCliCommandFromDiscovery(
  args: readonly string[],
  startPath: string,
  env: HomeDirEnv = process.env
): CliRunResult {
  const parsed = parseCliArgs(args);

  if (parsed.kind === "launch") {
    return {
      exitCode: 0,
      output: createTextTuiRuntimeFromDiscovery(startPath, env, {
        launchShortcut: parsed.launchShortcut
      }).render(parsed.viewport)
    };
  }

  if (parsed.kind === "hook") {
    return {
      exitCode: 0,
      output: renderSessionStartHookOutput()
    };
  }

  const paths = discoverProjectPaths(startPath);
  const codexPaths = discoverCodexPaths(env);
  const result = executeUiCommand(paths, codexPaths, parsed.commandId);
  return {
    exitCode: 0,
    output: result.renderText()
  };
}

function matchesArgs(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && expected.every((part, index) => actual[index] === part);
}

function normalizeCliArgs(args: readonly string[]): readonly string[] {
  return args[0] === "--" ? args.slice(1) : args;
}

function parseRenderOptions(args: readonly string[]): {
  args: readonly string[];
  viewport?: TextViewport;
} {
  const remaining: string[] = [];
  let width: number | undefined;
  let height: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--width" || arg === "--height") {
      const raw = args[index + 1];
      if (!raw) {
        throw new Error(`missing value for ${arg}`);
      }
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`invalid value for ${arg}: ${raw}`);
      }
      if (arg === "--width") {
        width = parsed;
      } else {
        height = parsed;
      }
      index += 1;
    } else {
      remaining.push(arg);
    }
  }

  if (width === undefined && height === undefined) {
    return { args: remaining };
  }

  return {
    args: remaining,
    viewport: {
      width: width ?? 100,
      height: height ?? 32
    }
  };
}

function parseLaunchShortcut(args: readonly string[]): LaunchShortcut | null {
  if (args.length !== 1) {
    return null;
  }

  switch (args[0]) {
    case "settings":
    case "inspect":
    case "repair":
      return args[0];
    default:
      return null;
  }
}
