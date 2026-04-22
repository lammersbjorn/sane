import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import {
  inspectSnapshot
} from "@sane/control-plane";
import { listSectionActions, type UiCommandId } from "@/command-registry.js";

export interface InspectScreenAction {
  id: Extract<
    UiCommandId,
    | "show_status"
    | "doctor"
    | "show_runtime_summary"
    | "show_config"
    | "show_codex_config"
    | "preview_integrations_profile"
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

export function loadInspectScreen(paths: ProjectPaths, codexPaths: CodexPaths): InspectScreenModel {
  const snapshot = inspectSnapshot(paths, codexPaths);

  return {
    summary: "Inspect",
    actions: listSectionActions("inspect").map((action) => ({
      id: action.id as InspectScreenAction["id"],
      title: action.label
    })),
    overviewLines: inspectOverviewLines(snapshot),
    ...snapshot
  };
}

export function inspectOverviewLines(snapshot: InspectScreenSnapshot): string[] {
  const counts = snapshot.statusBundle.counts;
  return [
    `status counts: installed ${counts.installed}, configured ${counts.configured}, disabled ${counts.disabled}, missing ${counts.missing}, invalid ${counts.invalid}, drift ${snapshot.statusBundle.driftItems.length}`,
    `primary surfaces: runtime ${statusValue(snapshot.statusBundle.primary.runtime)}, codex ${statusValue(snapshot.statusBundle.primary.codexConfig)}, user ${statusValue(snapshot.statusBundle.primary.userSkills)}, hooks ${statusValue(snapshot.statusBundle.primary.hooks)}, custom-agents ${statusValue(snapshot.statusBundle.primary.customAgents)}`,
    `install bundle: ${snapshot.statusBundle.primary.installBundle}`,
    `doctor result: ${snapshot.doctor.summary.split("\n")[0] ?? "no doctor output"}`,
    `runtime summary (read-only local visibility): ${snapshot.runtimeSummary.summary}`,
    `runtime history (read-only local visibility): events ${snapshot.runtimeHistory.events}, decisions ${snapshot.runtimeHistory.decisions}, artifacts ${snapshot.runtimeHistory.artifacts}`,
    snapshot.latestPolicyPreview.status === "present"
      ? `latest policy snapshot: present (current-run-derived read-only view; ts ${snapshot.latestPolicyPreview.tsUnix}; summary ${snapshot.latestPolicyPreview.summary}; ${snapshot.latestPolicyPreview.scenarioCount} scenarios: ${snapshot.latestPolicyPreview.scenarioIds.join(", ")})`
      : "latest policy snapshot: missing (current-run-derived read-only view)",
    `local config view: ${snapshot.localConfig.summary}`,
    `Codex config view: ${snapshot.codexConfig.summary}`,
    `integrations audit: ${snapshot.integrationsAudit.status} (${snapshot.integrationsAudit.recommendedChangeCount} recommended changes)`,
    `integrations preview: ${snapshot.integrationsPreview.summary}`,
    snapshot.driftItems.length === 0
      ? "export drift view: no current drift detected"
      : `export drift view: ${snapshot.driftItems.map((item) => item.name).join(", ")}`
  ].concat(
    snapshot.driftItems.map((item) =>
      item.repairHint
        ? `${item.name}: ${item.status} (${item.repairHint})`
        : `${item.name}: ${item.status}`
    )
  );
}

function statusValue(item: { status: { displayString(): string } } | null): string {
  return item?.status.displayString() ?? "missing";
}
