import { type HomeDirEnv, discoverCodexPaths, discoverProjectPaths } from "@sane/platform";

import { renderSessionStartHookOutput } from "@sane/control-plane/session-start-hook.js";

import { type BackendCommandId } from "@/command-registry.js";
import { executeUiCommand } from "@/shell.js";

export type ParsedCliCommand =
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
  { args: ["backup", "codex-config"], commandId: "backup_codex_config" },
  { args: ["preview", "policy"], commandId: "preview_policy" },
  { args: ["preview", "codex-profile"], commandId: "preview_codex_profile" },
  { args: ["preview", "integrations-profile"], commandId: "preview_integrations_profile" },
  { args: ["preview", "cloudflare-profile"], commandId: "preview_cloudflare_profile" },
  { args: ["preview", "opencode-profile"], commandId: "preview_opencode_profile" },
  { args: ["apply", "codex-profile"], commandId: "apply_codex_profile" },
  { args: ["apply", "integrations-profile"], commandId: "apply_integrations_profile" },
  { args: ["apply", "cloudflare-profile"], commandId: "apply_cloudflare_profile" },
  { args: ["apply", "opencode-profile"], commandId: "apply_opencode_profile" },
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
  if (matchesArgs(args, ["hook", "session-start"])) {
    return { kind: "hook", event: "session-start" };
  }

  const backend = BACKEND_COMMAND_ALIASES.find((entry) => matchesArgs(args, entry.args));
  if (backend) {
    return {
      kind: "backend",
      commandId: backend.commandId
    };
  }

  throw new Error(`unsupported command: ${args.join(" ") || "<none>"}`);
}

export function runCliCommandFromDiscovery(
  args: readonly string[],
  startPath: string,
  env: HomeDirEnv = process.env
): CliRunResult {
  const parsed = parseCliArgs(args);

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
