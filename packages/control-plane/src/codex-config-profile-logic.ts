import { type LocalConfig } from "@sane/config";
import { InventoryStatus } from "@sane/core";

import type {
  CloudflareProfileAppliedKey,
  CloudflareProfileApplyResult,
  CloudflareProfileAudit,
  CodexProfileApplyResult,
  CodexProfileAudit,
  CodexProfileChange,
  IntegrationsProfileAppliedKey,
  IntegrationsProfileApplyResult,
  IntegrationsProfileAudit,
  StatuslineProfileAppliedKey,
  StatuslineProfileApplyResult,
  StatuslineProfileAudit
} from "./codex-config.js";
import {
  blockedInvalidProfileApplyResult,
  invalidProfileAudit
} from "./codex-config-profile-support.js";
import { asPlainRecord, clonePlainRecord, isPlainRecord, type PlainRecord } from "./config-object.js";
import { buildSaneCompactPrompt } from "./session-start-hook.js";

type TomlTable = PlainRecord;

export interface CodexConfigProfileContext {
  inventory: { status: InventoryStatus };
  recommended: LocalConfig;
  config: TomlTable | null;
}

const RECOMMENDED_STATUSLINE = [
  "model-with-reasoning",
  "project-root",
  "git-branch",
  "context-remaining",
  "current-dir",
  "five-hour-limit",
  "weekly-limit",
  "context-window-size",
  "used-tokens"
] as const;

const RECOMMENDED_TERMINAL_TITLE = ["project", "spinner"] as const;
const RECOMMENDED_TUI_NOTIFICATION_CONDITION = "always";

export function inspectIntegrationsProfileAuditFromContext(
  context: CodexConfigProfileContext
): IntegrationsProfileAudit {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return invalidProfileAudit(
      [
        "cannot preview Codex tool settings until ~/.codex/config.toml parses cleanly",
        "repair current config first"
      ],
      (base) => ({ ...base, recommendedTargets: [], optionalTargets: [] })
    );
  }

  if (context.inventory.status === InventoryStatus.Missing) {
    return {
      status: "missing",
      recommendedChangeCount: 3,
      recommendedTargets: ["context7", "playwright", "grep.app"],
      optionalTargets: [],
      details: [
        "context7: missing -> recommended",
        "playwright: missing -> recommended",
        "grep.app: missing -> recommended"
      ]
    };
  }

  return integrationProfileAuditFromConfig(context.config ?? {});
}

export function inspectIntegrationsProfileApplyResultFromContext(
  context: CodexConfigProfileContext
): IntegrationsProfileApplyResult {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return blockedInvalidProfileApplyResult((base) => ({ ...base, appliedKeys: [] }));
  }

  const appliedKeys = applyIntegrationsProfileToValue(cloneTable(context.config ?? {}));
  const audit = inspectIntegrationsProfileAuditFromContext(context);
  return {
    status: appliedKeys.length === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys,
    details: [...audit.details]
  };
}

export function inspectCodexProfileAuditFromContext(context: CodexConfigProfileContext): CodexProfileAudit {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return invalidProfileAudit(
      [
        "cannot preview managed Codex settings until ~/.codex/config.toml parses cleanly",
        "repair current config first"
      ],
      (base) => ({ ...base, changes: [] })
    );
  }

  if (context.inventory.status === InventoryStatus.Missing) {
    return codexProfileAuditFromCurrentValues(
      context.recommended,
      {
        model: null,
        modelReasoningEffort: null,
        codexHooks: null,
        compactPrompt: null
      },
      "missing"
    );
  }

  const features = asTomlTable(context.config?.features);
  return codexProfileAuditFromCurrentValues(
    context.recommended,
    {
      model: asString(context.config?.model),
      modelReasoningEffort: asString(context.config?.model_reasoning_effort),
      codexHooks: displayHooks(features?.codex_hooks),
      compactPrompt: compactPromptStatus(context.config?.compact_prompt)
    },
    "missing"
  );
}

export function inspectCodexProfileApplyResultFromContext(
  context: CodexConfigProfileContext
): CodexProfileApplyResult {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return blockedInvalidProfileApplyResult((base) => ({ ...base, appliedKeys: [] }));
  }

  const audit = inspectCodexProfileAuditFromContext(context);
  return {
    status: audit.recommendedChangeCount === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys: audit.changes.map((change) => change.key),
    details: codexProfileApplyDetails(audit)
  };
}

export function inspectCloudflareProfileAuditFromContext(
  context: CodexConfigProfileContext
): CloudflareProfileAudit {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return invalidProfileAudit(
      [
        "cannot preview Cloudflare settings until ~/.codex/config.toml parses cleanly",
        "repair current config first"
      ],
      (base) => ({ ...base, target: "cloudflare-api" })
    );
  }

  if (context.inventory.status === InventoryStatus.Missing) {
    return {
      status: "missing",
      recommendedChangeCount: 1,
      target: "cloudflare-api",
      details: [
        "cloudflare-api: missing -> optional provider settings",
        "oauth and permissions stay explicit at connect time",
        "note: not part of the broad recommended Codex tool settings"
      ]
    };
  }

  return cloudflareProfileAuditFromConfig(context.config ?? {});
}

export function inspectCloudflareProfileApplyResultFromContext(
  context: CodexConfigProfileContext
): CloudflareProfileApplyResult {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return blockedInvalidProfileApplyResult((base) => ({ ...base, appliedKeys: [] }));
  }

  const appliedKeys = applyCloudflareProfileToValue(cloneTable(context.config ?? {}));
  const audit = inspectCloudflareProfileAuditFromContext(context);
  return {
    status: appliedKeys.length === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys,
    details: [...audit.details]
  };
}

export function inspectStatuslineProfileAuditFromContext(
  context: CodexConfigProfileContext
): StatuslineProfileAudit {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return invalidProfileAudit(
      [
        "cannot preview status line settings until ~/.codex/config.toml parses cleanly",
        "repair current config first"
      ],
      (base) => base
    );
  }

  const current = context.inventory.status === InventoryStatus.Missing ? {} : (context.config ?? {});
  return statuslineProfileAuditFromConfig(current);
}

export function inspectStatuslineProfileApplyResultFromContext(
  context: CodexConfigProfileContext
): StatuslineProfileApplyResult {
  if (context.inventory.status === InventoryStatus.Invalid) {
    return blockedInvalidProfileApplyResult((base) => ({ ...base, appliedKeys: [] }));
  }

  const appliedKeys = applyStatuslineProfileToValue(cloneTable(context.config ?? {}));
  const audit = inspectStatuslineProfileAuditFromContext(context);
  return {
    status: appliedKeys.length === 0 ? "already_satisfied" : "ready",
    recommendedChangeCount: audit.recommendedChangeCount,
    appliedKeys,
    details: [...audit.details]
  };
}

export function applyCoreCodexProfileToValue(config: TomlTable, recommended: LocalConfig): void {
  config.model = recommended.models.coordinator.model;
  config.model_reasoning_effort = recommended.models.coordinator.reasoningEffort;
  config.compact_prompt = buildSaneCompactPrompt();

  const features = ensureChildTable(config, "features", "[features] must be a table");
  features.codex_hooks = true;
}

export function applyIntegrationsProfileToValue(config: TomlTable): IntegrationsProfileAppliedKey[] {
  const mcpServers = ensureChildTable(config, "mcp_servers", "[mcp_servers] must be a table");
  const appliedKeys: IntegrationsProfileAppliedKey[] = [];

  if (!Object.hasOwn(mcpServers, "context7")) {
    mcpServers.context7 = { url: "https://mcp.context7.com/mcp" };
    appliedKeys.push("mcp_servers.context7");
  }

  if (!Object.hasOwn(mcpServers, "playwright")) {
    mcpServers.playwright = {
      command: "npx",
      args: ["@playwright/mcp@latest"]
    };
    appliedKeys.push("mcp_servers.playwright");
  }

  if (!Object.hasOwn(mcpServers, "grep") && !Object.hasOwn(mcpServers, "grep_app")) {
    mcpServers.grep_app = { url: "https://mcp.grep.app" };
    appliedKeys.push("mcp_servers.grep_app");
  }

  return appliedKeys;
}

export function applyCloudflareProfileToValue(config: TomlTable): CloudflareProfileAppliedKey[] {
  const mcpServers = ensureChildTable(config, "mcp_servers", "[mcp_servers] must be a table");
  const appliedKeys: CloudflareProfileAppliedKey[] = [];
  if (Object.hasOwn(mcpServers, "cloudflare-api")) {
    return appliedKeys;
  }

  mcpServers["cloudflare-api"] = { url: "https://mcp.cloudflare.com/mcp" };
  appliedKeys.push("mcp_servers.cloudflare-api");
  return appliedKeys;
}

export function applyStatuslineProfileToValue(config: TomlTable): StatuslineProfileAppliedKey[] {
  const tui = ensureChildTable(config, "tui", "[tui] must be a table");
  const appliedKeys: StatuslineProfileAppliedKey[] = [];
  const desiredStatusLine = [...RECOMMENDED_STATUSLINE];
  const desiredTerminalTitle = [...RECOMMENDED_TERMINAL_TITLE];

  if (asString(tui.notification_condition) !== RECOMMENDED_TUI_NOTIFICATION_CONDITION) {
    tui.notification_condition = RECOMMENDED_TUI_NOTIFICATION_CONDITION;
    appliedKeys.push("tui.notification_condition");
  }

  if (!stringArraysEqual(asStringArray(tui.status_line), desiredStatusLine)) {
    tui.status_line = desiredStatusLine;
    appliedKeys.push("tui.status_line");
  }

  if (!stringArraysEqual(asStringArray(tui.terminal_title), desiredTerminalTitle)) {
    tui.terminal_title = desiredTerminalTitle;
    appliedKeys.push("tui.terminal_title");
  }

  return appliedKeys;
}

function codexProfileApplyDetails(audit: CodexProfileAudit): string[] {
  if (audit.status !== "missing") {
    return [...audit.details];
  }

  return audit.details.filter(
    (line) => line !== "note: Codex tool settings stay outside the core Codex settings"
  );
}

function codexProfileAuditFromCurrentValues(
  recommended: LocalConfig,
  current: {
    model: string | null;
    modelReasoningEffort: string | null;
    codexHooks: string | null;
    compactPrompt: string | null;
  },
  status: CodexProfileAudit["status"]
): CodexProfileAudit {
  const changes: CodexProfileChange[] = [];
  const details: string[] = [];

  pushCodexProfileChange(
    changes,
    details,
    "model",
    "model",
    current.model,
    recommended.models.coordinator.model
  );
  pushCodexProfileChange(
    changes,
    details,
    "model_reasoning_effort",
    "reasoning",
    current.modelReasoningEffort,
    recommended.models.coordinator.reasoningEffort
  );
  pushCodexProfileChange(
    changes,
    details,
    "compact_prompt",
    "compact prompt",
    current.compactPrompt,
    "Sane continuity prompt"
  );
  pushCodexProfileChange(
    changes,
    details,
    "features.codex_hooks",
    "codex hooks",
    current.codexHooks,
    "enabled"
  );

  if (changes.length === 0) {
    details.push("Codex settings already match current recommendation");
  }

  details.push("note: this writes the single-session Codex baseline only");
  details.push("note: broader execution and realtime routing stays derived outside config.toml");
  details.push("note: Codex native memories stay outside Sane's default continuity path");
  details.push("note: Codex tool settings stay outside the core Codex settings");

  return {
    status: changes.length === 0 ? "installed" : status,
    recommendedChangeCount: changes.length,
    changes,
    details
  };
}

function statuslineProfileAuditFromConfig(config: TomlTable): StatuslineProfileAudit {
  const tui = asTomlTable(config.tui);
  const currentStatusLine = asStringArray(tui?.status_line);
  const currentTerminalTitle = asStringArray(tui?.terminal_title);
  const currentNotifications = asString(tui?.notification_condition);
  const details: string[] = [];
  let recommendedChangeCount = 0;

  if (currentNotifications !== RECOMMENDED_TUI_NOTIFICATION_CONDITION) {
    details.push(
      `tui.notification_condition: ${currentNotifications ?? "<missing>"} -> ${RECOMMENDED_TUI_NOTIFICATION_CONDITION}`
    );
    recommendedChangeCount += 1;
  }

  if (!stringArraysEqual(currentStatusLine, RECOMMENDED_STATUSLINE)) {
    details.push(
      `tui.status_line: ${displayStringArray(currentStatusLine)} -> ${RECOMMENDED_STATUSLINE.join(", ")}`
    );
    recommendedChangeCount += 1;
  }

  if (!stringArraysEqual(currentTerminalTitle, RECOMMENDED_TERMINAL_TITLE)) {
    details.push(
      `tui.terminal_title: ${displayStringArray(currentTerminalTitle)} -> ${RECOMMENDED_TERMINAL_TITLE.join(", ")}`
    );
    recommendedChangeCount += 1;
  }

  if (recommendedChangeCount === 0) {
    details.push("status line settings already match current recommendation");
  }

  details.push("note: native Codex statusline/title config only");
  details.push("note: this stays additive inside ~/.codex/config.toml");

  return {
    status: recommendedChangeCount === 0 ? "installed" : "missing",
    recommendedChangeCount,
    details
  };
}

function integrationProfileAuditFromConfig(config: TomlTable): IntegrationsProfileAudit {
  const mcpServers = asTomlTable(config.mcp_servers);
  const hasContext7 = hasTableKey(mcpServers, "context7");
  const hasPlaywright = hasTableKey(mcpServers, "playwright");
  const hasGrep = hasTableKey(mcpServers, "grep") || hasTableKey(mcpServers, "grep_app");
  const recommendedTargets = [
    hasContext7 ? null : "context7",
    hasPlaywright ? null : "playwright",
    hasGrep ? null : "grep.app"
  ].filter((value): value is string => value !== null);

  return {
    status: recommendedTargets.length === 0 ? "installed" : "missing",
    recommendedChangeCount: recommendedTargets.length,
    recommendedTargets,
    optionalTargets: [],
    details: [
      hasContext7 ? "context7: keep installed" : "context7: missing -> recommended",
      hasPlaywright ? "playwright: keep installed" : "playwright: missing -> recommended",
      hasGrep ? "grep.app: keep installed" : "grep.app: missing -> recommended"
    ]
  };
}

function cloudflareProfileAuditFromConfig(config: TomlTable): CloudflareProfileAudit {
  const mcpServers = asTomlTable(config.mcp_servers);
  const hasCloudflare = hasTableKey(mcpServers, "cloudflare-api");
  return {
    status: hasCloudflare ? "installed" : "missing",
    recommendedChangeCount: hasCloudflare ? 0 : 1,
    target: "cloudflare-api",
    details: [
      hasCloudflare
        ? "cloudflare-api: keep installed"
        : "cloudflare-api: missing -> optional provider settings",
      "oauth and permissions stay explicit at connect time",
      "note: not part of the broad recommended Codex tool settings"
    ]
  };
}

function pushProfileChange(details: string[], label: string, current: string, recommended: string): void {
  details.push(
    current === recommended ? `${label}: keep ${recommended}` : `${label}: ${current} -> ${recommended}`
  );
}

function pushCodexProfileChange(
  changes: CodexProfileChange[],
  details: string[],
  key: CodexProfileChange["key"],
  label: string,
  current: string | null,
  recommended: string
): void {
  const displayCurrent = current ?? "<missing>";
  if (current !== recommended) {
    changes.push({ key, current, recommended });
  }
  pushProfileChange(details, label, displayCurrent, recommended);
}

function ensureChildTable(parent: TomlTable, key: string, errorMessage: string): TomlTable {
  const existing = parent[key];
  if (existing === undefined) {
    const created: TomlTable = {};
    parent[key] = created;
    return created;
  }
  if (!isPlainRecord(existing)) {
    throw new Error(errorMessage);
  }
  return existing;
}

function cloneTable(value: TomlTable): TomlTable {
  return clonePlainRecord(value);
}

function hasTableKey(table: TomlTable | null | undefined, key: string): boolean {
  return table ? Object.hasOwn(table, key) : false;
}

function asTomlTable(value: unknown): TomlTable | null {
  return asPlainRecord(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function displayHooks(value: unknown): string {
  if (value === true) {
    return "enabled";
  }
  if (value === false) {
    return "disabled";
  }
  return "unset";
}

function compactPromptStatus(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  return value === buildSaneCompactPrompt() ? "Sane continuity prompt" : "custom";
}

function displayStringArray(value: unknown): string {
  const entries = asStringArray(value);
  if (!entries) {
    return "unset";
  }

  return entries.length === 0 ? "none" : entries.join(", ");
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
