import { detectPlatform, type CodexPaths, type ProjectPaths } from "@sane/platform";

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

export interface InspectScreenAction {
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

type InspectScreenSnapshot = ReturnType<typeof inspectSnapshot>;

export interface InspectScreenModel extends InspectScreenSnapshot {
  summary: "Inspect";
  actions: InspectScreenAction[];
  overviewLines: string[];
}

export function loadInspectScreen(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): InspectScreenModel {
  return loadInspectScreenFromStatusBundle(paths, codexPaths, inspectStatusBundle(paths, codexPaths));
}

export function loadInspectScreenFromStatusBundle(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  statusBundle: ReturnType<typeof inspectStatusBundle>,
  profiles?: Parameters<typeof inspectSnapshotFromStatusBundle>[3],
  preferencesFamily?: Parameters<typeof inspectSnapshotFromStatusBundle>[4]
): InspectScreenModel {
  const snapshot = profiles || preferencesFamily
    ? inspectSnapshotFromStatusBundle(paths, codexPaths, statusBundle, profiles, preferencesFamily)
    : inspectSnapshotFromStatusBundle(paths, codexPaths, statusBundle);

  return {
    summary: "Inspect",
    actions: listSectionActions("inspect", detectPlatform()).map((action) => ({
      id: action.id as InspectScreenAction["id"],
      title: action.label
    })),
    overviewLines: inspectOverviewLines(snapshot),
    ...snapshot
  };
}

export function inspectOverviewLines(snapshot: InspectOverviewSnapshot): string[] {
  return formatSharedInspectOverviewLines(snapshot);
}

export function formatLatestPolicyPreviewLine(
  preview: InspectScreenSnapshot["latestPolicyPreview"],
  prefix = "latest policy snapshot"
): string {
  return formatSharedLatestPolicyPreviewLines(preview, {
    snapshotPrefix: prefix
  })[0]!;
}

export function formatLatestPolicyPreviewInputLines(
  preview: InspectScreenSnapshot["latestPolicyPreview"],
  prefix = "latest policy input"
): string[] {
  return formatSharedLatestPolicyPreviewInputLines(preview, prefix);
}

export function formatLatestPolicyPreviewLines(
  preview: InspectScreenSnapshot["latestPolicyPreview"],
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

export function formatInspectPolicyPreviewLines(
  snapshot: Pick<InspectScreenSnapshot, "latestPolicyPreview" | "policyPreview">,
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
