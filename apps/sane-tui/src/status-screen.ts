import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/platform";

import {
  formatInspectOverviewLines as formatSharedInspectOverviewLines,
  formatInspectPolicyPreviewLines as formatSharedInspectPolicyPreviewLines,
  formatLatestPolicyPreviewInputLines as formatSharedLatestPolicyPreviewInputLines,
  formatLatestPolicyPreviewLines as formatSharedLatestPolicyPreviewLines,
  inspectSnapshotFromStatusBundle,
  inspectSnapshot,
  type InspectOverviewSnapshot
} from "@sane/control-plane";
import { inspectStatusBundle } from "@sane/control-plane/inventory.js";
import { listSectionActions, type UiCommandId } from "@sane/sane-tui/command-registry.js";

export interface StatusScreenAction {
  id: Extract<
    UiCommandId,
    | "show_status"
    | "doctor"
    | "show_runtime_summary"
    | "show_config"
    | "show_codex_config"
    | "preview_integrations_profile"
    | "preview_statusline_profile"
    | "preview_policy"
  >;
  title: string;
}

type StatusScreenSnapshot = ReturnType<typeof inspectSnapshot>;

export interface StatusScreenModel extends StatusScreenSnapshot {
  summary: "Status";
  actions: StatusScreenAction[];
  overviewLines: string[];
}

export function loadStatusScreen(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  hostPlatform: HostPlatform = detectPlatform()
): StatusScreenModel {
  return loadStatusScreenFromStatusBundle(
    paths,
    codexPaths,
    inspectStatusBundle(paths, codexPaths, hostPlatform),
    undefined,
    undefined,
    hostPlatform
  );
}

export function loadStatusScreenFromStatusBundle(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  statusBundle: ReturnType<typeof inspectStatusBundle>,
  profiles?: Parameters<typeof inspectSnapshotFromStatusBundle>[3],
  preferencesFamily?: Parameters<typeof inspectSnapshotFromStatusBundle>[4],
  hostPlatform: HostPlatform = detectPlatform()
): StatusScreenModel {
  const snapshot = profiles || preferencesFamily
    ? inspectSnapshotFromStatusBundle(paths, codexPaths, statusBundle, profiles, preferencesFamily)
    : inspectSnapshotFromStatusBundle(paths, codexPaths, statusBundle);

  return {
    summary: "Status",
    actions: listSectionActions("status", hostPlatform).map((action) => ({
      id: action.id as StatusScreenAction["id"],
      title: action.label
    })),
    overviewLines: statusOverviewLines(snapshot),
    ...snapshot
  };
}

export function statusOverviewLines(snapshot: InspectOverviewSnapshot): string[] {
  return formatSharedInspectOverviewLines(snapshot);
}

export function formatLatestPolicyPreviewLine(
  preview: StatusScreenSnapshot["latestPolicyPreview"],
  prefix = "latest policy snapshot"
): string {
  return formatSharedLatestPolicyPreviewLines(preview, {
    snapshotPrefix: prefix
  })[0]!;
}

export function formatLatestPolicyPreviewInputLines(
  preview: StatusScreenSnapshot["latestPolicyPreview"],
  prefix = "latest policy input"
): string[] {
  return formatSharedLatestPolicyPreviewInputLines(preview, prefix);
}

export function formatLatestPolicyPreviewLines(
  preview: StatusScreenSnapshot["latestPolicyPreview"],
  prefixes: {
    snapshot?: string;
    input?: string;
  } = {}
): string[] {
  return formatSharedLatestPolicyPreviewLines(preview, {
    snapshotPrefix: prefixes.snapshot,
    inputPrefix: prefixes.input ?? "latest policy input"
  });
}

export function formatStatusPolicyPreviewLines(
  snapshot: Pick<StatusScreenSnapshot, "latestPolicyPreview" | "policyPreview">,
  options: {
    mode?: "overview" | "action";
    snapshot?: string;
    input?: string;
    current?: string;
  } = {}
): string[] {
  return formatSharedInspectPolicyPreviewLines(snapshot.latestPolicyPreview, snapshot.policyPreview, {
    mode: options.mode,
    snapshotPrefix: options.snapshot,
    inputPrefix: options.input ?? "latest policy input",
    currentPrefix: options.current
  });
}
