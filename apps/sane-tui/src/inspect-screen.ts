import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import {
  formatInspectPolicyPreviewLines as formatSharedInspectPolicyPreviewLines,
  formatLatestPolicyPreviewInputLines as formatSharedLatestPolicyPreviewInputLines,
  formatLatestPolicyPreviewLines as formatSharedLatestPolicyPreviewLines,
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
    `latest event (read-only local visibility): ${formatLatestHistoryEventOverview(snapshot.runtimeHistoryPreview.latestEvent)}`,
    `latest decision (read-only local visibility): ${formatLatestHistoryDecisionOverview(snapshot.runtimeHistoryPreview.latestDecision)}`,
    `latest artifact (read-only local visibility): ${formatLatestHistoryArtifactOverview(snapshot.runtimeHistoryPreview.latestArtifact)}`,
    ...formatInspectPolicyPreviewLines(snapshot),
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

function formatLatestHistoryEventOverview(
  latestEvent: InspectScreenSnapshot["runtimeHistoryPreview"]["latestEvent"]
): string {
  if (!latestEvent) {
    return "missing";
  }

  return `ts ${latestEvent.tsUnix}, action ${latestEvent.action}, result ${latestEvent.result}, summary ${latestEvent.summary}`;
}

function formatLatestHistoryDecisionOverview(
  latestDecision: InspectScreenSnapshot["runtimeHistoryPreview"]["latestDecision"]
): string {
  if (!latestDecision) {
    return "missing";
  }

  return `ts ${latestDecision.tsUnix}, summary ${latestDecision.summary}, rationale ${latestDecision.rationale}`;
}

function formatLatestHistoryArtifactOverview(
  latestArtifact: InspectScreenSnapshot["runtimeHistoryPreview"]["latestArtifact"]
): string {
  if (!latestArtifact) {
    return "missing";
  }

  return `ts ${latestArtifact.tsUnix}, kind ${latestArtifact.kind}, path ${latestArtifact.path}, summary ${latestArtifact.summary}`;
}
