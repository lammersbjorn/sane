import { type LocalConfig } from "@sane/config";

import type { CodexConfigConflictWarning } from "./codex-config.js";
import { asPlainRecord, type PlainRecord } from "./config-object.js";

type TomlTable = PlainRecord;

const SANE_KNOWN_MCP_SERVERS = new Set([
  "cloudflare-api",
  "context7",
  "grep",
  "grep_app",
  "playwright"
]);

interface ConflictWarningInputs {
  codexConfigPath: string;
  config: TomlTable;
  recommended: LocalConfig;
}

export function synthesizeCodexConfigConflictWarnings(
  input: ConflictWarningInputs
): CodexConfigConflictWarning[] {
  return [
    ...collectUnmanagedMcpWarnings(input.config, input.codexConfigPath),
    ...collectManagedMcpDriftWarnings(input.config, input.codexConfigPath),
    ...collectCoreProfileDriftWarnings(input.config, input.codexConfigPath, input.recommended),
    ...collectCodexAdjacentSetupWarnings(input.config, input.codexConfigPath),
    ...collectStatuslineDriftWarnings(input.config, input.codexConfigPath),
    ...collectUnsupportedTuiWarnings(input.config, input.codexConfigPath),
    ...collectPluginWarnings(input.config, input.codexConfigPath)
  ];
}

function collectUnmanagedMcpWarnings(
  config: TomlTable,
  codexConfigPath: string
): CodexConfigConflictWarning[] {
  const mcpServers = sortedKeys(asPlainRecord(config.mcp_servers));
  return mcpServers
    .filter((name) => !SANE_KNOWN_MCP_SERVERS.has(name))
    .map((name) => ({
      kind: "unmanaged_mcp_server" as const,
      target: `mcp_servers.${name}`,
      path: codexConfigPath,
      message: `unmanaged Codex MCP server '${name}' is outside Sane's known tool settings; warning-only, no auto-install or auto-remove`
    }));
}

function collectManagedMcpDriftWarnings(
  config: TomlTable,
  codexConfigPath: string
): CodexConfigConflictWarning[] {
  const mcpServers = asPlainRecord(config.mcp_servers);
  const expected: Record<string, TomlTable> = {
    "cloudflare-api": { url: "https://mcp.cloudflare.com/mcp" },
    context7: { url: "https://mcp.context7.com/mcp" },
    grep_app: { url: "https://mcp.grep.app" },
    playwright: { command: "npx", args: ["@playwright/mcp@latest"] }
  };

  return Object.entries(expected).flatMap(([name, expectedValue]) => {
    const actual = asPlainRecord(mcpServers?.[name]);
    if (!actual || tomlValueEqual(actual, expectedValue)) {
      return [];
    }

    return [
      {
        kind: "managed_mcp_server_drift" as const,
        target: `mcp_servers.${name}`,
        path: codexConfigPath,
        message: `managed Codex MCP server '${name}' differs from Sane's recommended settings; warning-only until you explicitly apply settings`
      }
    ];
  });
}

function collectCoreProfileDriftWarnings(
  config: TomlTable,
  codexConfigPath: string,
  recommended: LocalConfig
): CodexConfigConflictWarning[] {
  const warnings: CodexConfigConflictWarning[] = [];
  const currentModel = asString(config.model);
  const currentReasoning = asString(config.model_reasoning_effort);
  const features = asPlainRecord(config.features);

  if (currentModel !== null && currentModel !== recommended.models.coordinator.model) {
    warnings.push({
      kind: "codex_profile_drift",
      target: "model",
      path: codexConfigPath,
      message: `Codex model '${currentModel}' differs from Sane's recommended coordinator model '${recommended.models.coordinator.model}'`
    });
  }

  if (
    currentReasoning !== null
    && currentReasoning !== recommended.models.coordinator.reasoningEffort
  ) {
    warnings.push({
      kind: "codex_profile_drift",
      target: "model_reasoning_effort",
      path: codexConfigPath,
      message: `Codex reasoning '${currentReasoning}' differs from Sane's recommended coordinator reasoning '${recommended.models.coordinator.reasoningEffort}'`
    });
  }

  if (features?.codex_hooks === false) {
    warnings.push({
      kind: "disabled_codex_hooks",
      target: "features.codex_hooks",
      path: codexConfigPath,
      message:
        "Codex hooks are disabled, so Sane-managed hook exports will not run until features.codex_hooks is enabled"
    });
  }

  return warnings;
}

function collectCodexAdjacentSetupWarnings(
  config: TomlTable,
  codexConfigPath: string
): CodexConfigConflictWarning[] {
  const features = asPlainRecord(config.features);
  if (features?.memories !== true) {
    return [];
  }

  return [
    {
      kind: "codex_native_memories_enabled",
      target: "features.memories",
      path: codexConfigPath,
      message:
        "Codex native memories are enabled; Sane keeps default continuity in scoped exports plus .sane state instead"
    }
  ];
}

function collectStatuslineDriftWarnings(
  config: TomlTable,
  codexConfigPath: string
): CodexConfigConflictWarning[] {
  const tui = asPlainRecord(config.tui);
  if (!tui) {
    return [];
  }

  const warnings: CodexConfigConflictWarning[] = [];
  const notificationCondition = asString(tui.notification_condition);
  const statusLine = asStringArray(tui.status_line);
  const terminalTitle = asStringArray(tui.terminal_title);
  const recommendedNotificationCondition = "always";
  const recommendedStatusLine = [
    "model-with-reasoning",
    "project-root",
    "git-branch",
    "context-remaining",
    "current-dir",
    "five-hour-limit",
    "weekly-limit",
    "context-window-size",
    "used-tokens"
  ];
  const recommendedTerminalTitle = ["project", "spinner"];

  if (
    notificationCondition !== null
    && notificationCondition !== recommendedNotificationCondition
  ) {
    warnings.push({
      kind: "statusline_profile_drift",
      target: "tui.notification_condition",
      path: codexConfigPath,
      message: `Codex TUI notifications '${notificationCondition}' differ from Sane's status line setting '${recommendedNotificationCondition}'`
    });
  }

  if (statusLine !== null && !stringArraysEqual(statusLine, recommendedStatusLine)) {
    warnings.push({
      kind: "statusline_profile_drift",
      target: "tui.status_line",
      path: codexConfigPath,
      message: "Codex TUI status line differs from Sane's recommended status line settings"
    });
  }

  if (terminalTitle !== null && !stringArraysEqual(terminalTitle, recommendedTerminalTitle)) {
    warnings.push({
      kind: "statusline_profile_drift",
      target: "tui.terminal_title",
      path: codexConfigPath,
      message: "Codex TUI terminal title differs from Sane's recommended terminal title settings"
    });
  }

  return warnings;
}

function collectUnsupportedTuiWarnings(
  config: TomlTable,
  codexConfigPath: string
): CodexConfigConflictWarning[] {
  const tui = asPlainRecord(config.tui);
  const theme = asString(tui?.theme);
  if (theme === null) {
    return [];
  }

  return [
    {
      kind: "unsupported_tui_theme",
      target: "tui.theme",
      path: codexConfigPath,
      message: `Codex TUI theme '${theme}' is display-only in Sane; warning-only, no auto-apply or auto-remove`
    }
  ];
}

function collectPluginWarnings(
  config: TomlTable,
  codexConfigPath: string
): CodexConfigConflictWarning[] {
  const plugins = asPlainRecord(config.plugins);
  return sortedKeys(plugins)
    .filter((name) => asPlainRecord(plugins?.[name])?.enabled === true)
    .map((name) => ({
      kind: "unmanaged_plugin" as const,
      target: `plugins.${name}`,
      path: codexConfigPath,
      message: `enabled Codex plugin '${name}' is outside Sane's managed settings; warning-only, no auto-install or auto-remove`
    }));
}

function tomlValueEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sortedKeys(table: TomlTable | null | undefined): string[] {
  return table ? Object.keys(table).sort() : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function stringArraysEqual(
  left: readonly string[] | null | undefined,
  right: readonly string[]
): boolean {
  if (!left || left.length !== right.length) {
    return false;
  }
  return left.every((entry, index) => entry === right[index]);
}
