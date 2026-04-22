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
  const primary = snapshot.statusBundle.primary.status;
  return [
    `status counts: installed ${counts.installed}, configured ${counts.configured}, disabled ${counts.disabled}, missing ${counts.missing}, invalid ${counts.invalid}, drift ${snapshot.statusBundle.driftItems.length}`,
    `primary surfaces: runtime ${primary.runtime}, codex ${primary.codexConfig}, user ${primary.userSkills}, hooks ${primary.hooks}, custom-agents ${primary.customAgents}`,
    `install bundle: ${snapshot.statusBundle.primary.installBundle}`,
    `doctor result: ${snapshot.doctorHeadline}`,
    `runtime summary (read-only local visibility): ${snapshot.runtimeSummary.summary}`,
    `runtime history (read-only local visibility): events ${snapshot.runtimeHistory.events}, decisions ${snapshot.runtimeHistory.decisions}, artifacts ${snapshot.runtimeHistory.artifacts}`,
    ...formatLatestPolicyPreviewLines(snapshot.latestPolicyPreview),
    formatOptionalPackProvenanceLine(snapshot.statusBundle.optionalPacks),
    `local config view: ${snapshot.localConfig.summary}`,
    `Codex config view: ${snapshot.codexConfig.summary}`,
    `integrations audit: ${snapshot.integrationsAudit.status} (${snapshot.integrationsAudit.recommendedChangeCount} recommended changes)`,
    `integrations apply: ${snapshot.integrationsApply.status} (${snapshot.integrationsApply.appliedKeys.length} keys)`,
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

export function formatLatestPolicyPreviewLine(
  preview: InspectScreenSnapshot["latestPolicyPreview"],
  prefix = "latest policy snapshot"
): string {
  return preview.status === "present"
    ? `${prefix}: present (current-run-derived read-only view; ts ${preview.tsUnix}; summary ${preview.summary}; ${preview.scenarioCount} scenarios: ${preview.scenarioIds.join(", ")})`
    : `${prefix}: missing (current-run-derived read-only view)`;
}

export function formatLatestPolicyPreviewInputLines(
  preview: InspectScreenSnapshot["latestPolicyPreview"],
  prefix = "latest policy input"
): string[] {
  if (preview.status !== "present") {
    return [];
  }

  return preview.scenarios.flatMap((scenario) => {
    if (!scenario.input) {
      return [];
    }

    return [
      `${prefix} ${scenario.id}: intent ${scenario.input.intent ?? "unknown"}, task ${scenario.input.taskShape ?? "unknown"}, risk ${scenario.input.risk ?? "unknown"}, ambiguity ${scenario.input.ambiguity ?? "unknown"}, parallelism ${scenario.input.parallelism ?? "unknown"}, context ${scenario.input.contextPressure ?? "unknown"}, run ${scenario.input.runState ?? "unknown"}`
    ];
  });
}

export function formatLatestPolicyPreviewLines(
  preview: InspectScreenSnapshot["latestPolicyPreview"],
  prefixes: {
    snapshot?: string;
    input?: string;
  } = {}
): string[] {
  return [
    formatLatestPolicyPreviewLine(preview, prefixes.snapshot),
    ...formatLatestPolicyPreviewInputLines(preview, prefixes.input ?? "latest policy input")
  ];
}

function formatOptionalPackProvenanceLine(
  packs: InspectScreenSnapshot["statusBundle"]["optionalPacks"]
): string {
  const summary = packs.map((pack) => {
    const origin =
      pack.provenance?.kind === "derived" || pack.provenance?.kind === "upstream"
        ? `${pack.provenance.kind} from ${pack.provenance.upstreams.map((item) => item.name).join(" + ")}`
        : "internal";
    const exportedSkills = pack.skillNames.length === 0 ? "no skills" : pack.skillNames.join(" + ");

    return `${pack.name} ${pack.status} (${exportedSkills}; ${origin})`;
  });

  return `optional pack provenance: ${summary.join("; ")}`;
}
