import { spawnSync } from "node:child_process";

import { type HomeDirEnv, discoverCodexPaths, discoverProjectPaths } from "@sane/platform";

import {
  renderSessionEndHookOutput,
  renderSessionStartHookOutput
} from "@sane/control-plane/session-start-hook.js";
import {
  type ManagedTokscaleSubmitHookEvent,
  renderTokscaleSubmitHookOutput
} from "@sane/control-plane/tokscale-submit-hook.js";

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
    }
  | {
      kind: "hook";
      event: "session-end";
      rateLimitResume: boolean;
    }
  | {
      kind: "hook";
      event: "tokscale-submit";
      submitEvent: ManagedTokscaleSubmitHookEvent;
      dryRun: boolean;
    };

export interface CliRunResult {
  exitCode: number;
  output: string;
}

type CliEnv = HomeDirEnv & NodeJS.ProcessEnv;

const BACKEND_COMMAND_ALIASES: ReadonlyArray<{
  args: readonly string[];
  commandId: BackendCommandId;
}> = [
  { args: ["install-runtime"], commandId: "install_runtime" },
  { args: ["config"], commandId: "show_config" },
  { args: ["codex-config"], commandId: "show_codex_config" },
  { args: ["summary"], commandId: "show_runtime_summary" },
  { args: ["outcome-readiness"], commandId: "show_outcome_readiness" },
  { args: ["backup", "codex-config"], commandId: "backup_codex_config" },
  { args: ["preview", "policy"], commandId: "preview_policy" },
  { args: ["preview", "codex-profile"], commandId: "preview_codex_profile" },
  { args: ["preview", "integrations-profile"], commandId: "preview_integrations_profile" },
  { args: ["preview", "cloudflare-profile"], commandId: "preview_cloudflare_profile" },
  { args: ["preview", "statusline-profile"], commandId: "preview_statusline_profile" },
  { args: ["apply", "codex-profile"], commandId: "apply_codex_profile" },
  { args: ["apply", "integrations-profile"], commandId: "apply_integrations_profile" },
  { args: ["apply", "cloudflare-profile"], commandId: "apply_cloudflare_profile" },
  { args: ["apply", "statusline-profile"], commandId: "apply_statusline_profile" },
  { args: ["restore", "codex-config"], commandId: "restore_codex_config" },
  { args: ["show", "status"], commandId: "show_status" },
  { args: ["doctor"], commandId: "doctor" },
  { args: ["export", "user-skills"], commandId: "export_user_skills" },
  { args: ["export", "repo-skills"], commandId: "export_repo_skills" },
  { args: ["export", "repo-agents"], commandId: "export_repo_agents" },
  { args: ["export", "global-agents"], commandId: "export_global_agents" },
  { args: ["export", "hooks"], commandId: "export_hooks" },
  { args: ["export", "custom-agents"], commandId: "export_custom_agents" },
  { args: ["export", "opencode"], commandId: "export_opencode_all" },
  { args: ["export", "all"], commandId: "export_all" },
  { args: ["uninstall", "user-skills"], commandId: "uninstall_user_skills" },
  { args: ["uninstall", "repo-skills"], commandId: "uninstall_repo_skills" },
  { args: ["uninstall", "repo-agents"], commandId: "uninstall_repo_agents" },
  { args: ["uninstall", "global-agents"], commandId: "uninstall_global_agents" },
  { args: ["uninstall", "hooks"], commandId: "uninstall_hooks" },
  { args: ["uninstall", "custom-agents"], commandId: "uninstall_custom_agents" },
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

  if (normalizedArgs[0] === "hook" && normalizedArgs[1] === "session-end") {
    const flags = normalizedArgs.slice(2);
    const unsupported = flags.find((flag) => flag !== "--rate-limit-resume");
    if (unsupported) {
      throw new Error(`unsupported hook session-end option: ${unsupported}`);
    }
    return { kind: "hook", event: "session-end", rateLimitResume: flags.includes("--rate-limit-resume") };
  }

  if (normalizedArgs[0] === "hook" && normalizedArgs[1] === "tokscale-submit") {
    return parseTokscaleSubmitHookArgs(normalizedArgs.slice(2));
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
  env: CliEnv = process.env
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
    if (parsed.event === "session-end") {
      return {
        exitCode: 0,
        output: renderSessionEndHookOutput({ rateLimitResume: parsed.rateLimitResume })
      };
    }
    if (parsed.event === "tokscale-submit") {
      return runTokscaleSubmit(parsed.submitEvent, parsed.dryRun, env);
    }
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

function parseTokscaleSubmitHookArgs(args: readonly string[]): ParsedCliCommand {
  let submitEvent: ManagedTokscaleSubmitHookEvent | undefined;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--event") {
      const value = args[index + 1];
      if (value !== "stop" && value !== "session-end") {
        throw new Error(`invalid tokscale hook event: ${value ?? "<missing>"}`);
      }
      submitEvent = value === "session-end" ? "stop" : value;
      index += 1;
      continue;
    }
    throw new Error(`unsupported tokscale hook option: ${arg}`);
  }

  if (!submitEvent) {
    throw new Error("missing tokscale hook event");
  }

  return {
    kind: "hook",
    event: "tokscale-submit",
    submitEvent,
    dryRun
  };
}

function runTokscaleSubmit(
  event: ManagedTokscaleSubmitHookEvent,
  dryRun: boolean,
  env: NodeJS.ProcessEnv = process.env
): CliRunResult {
  const args = ["submit", "--codex"];
  if (dryRun) {
    args.push("--dry-run");
  }

  const result = spawnSync("tokscale", args, {
    encoding: "utf8",
    env,
    timeout: 20_000
  });

  void event;
  void dryRun;
  void result;

  return {
    exitCode: 0,
    output: renderTokscaleSubmitHookOutput()
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
      return "settings";
    case "install":
      return "install";
    case "inspect":
    case "status":
      return "status";
    case "repair":
      return "repair";
    case "uninstall":
      return "uninstall";
    default:
      return null;
  }
}
