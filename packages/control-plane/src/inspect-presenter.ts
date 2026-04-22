import {
  type LayeredStateHistoryPreview,
  type LatestPolicyPreviewSnapshot
} from "@sane/state";

import { type StatusBundle } from "./inventory.js";
import {
  formatInspectPolicyPreviewLines,
  type InspectCurrentPolicyPreview
} from "./policy-preview-presenter.js";
import {
  formatLatestHistoryArtifactPreview,
  formatLatestHistoryDecisionPreview,
  formatLatestHistoryEventPreview
} from "./runtime-history-presenter.js";

export interface InspectDriftItemPresentation {
  name: string;
  status: string;
  repairHint: string | null;
}

export interface InspectOverviewSnapshot {
  statusBundle: Pick<StatusBundle, "counts" | "driftItems" | "optionalPacks" | "primary">;
  doctorHeadline: string;
  runtimeSummary: {
    summary: string;
  };
  runtimeHistory: {
    events: number;
    decisions: number;
    artifacts: number;
  };
  runtimeHistoryPreview: LayeredStateHistoryPreview;
  latestPolicyPreview: LatestPolicyPreviewSnapshot;
  policyPreview: InspectCurrentPolicyPreview;
  localConfig: {
    summary: string;
  };
  codexConfig: {
    summary: string;
  };
  integrationsAudit: {
    status: string;
    recommendedChangeCount: number;
  };
  integrationsApply: {
    status: string;
    appliedKeys: string[];
  };
  integrationsPreview: {
    summary: string;
  };
  driftItems: InspectDriftItemPresentation[];
}

export function formatInspectOverviewLines(snapshot: InspectOverviewSnapshot): string[] {
  const counts = snapshot.statusBundle.counts;
  const primary = snapshot.statusBundle.primary.status;

  return [
    `status counts: installed ${counts.installed}, configured ${counts.configured}, disabled ${counts.disabled}, missing ${counts.missing}, invalid ${counts.invalid}, drift ${snapshot.statusBundle.driftItems.length}`,
    `primary surfaces: runtime ${primary.runtime}, codex ${primary.codexConfig}, user ${primary.userSkills}, hooks ${primary.hooks}, custom-agents ${primary.customAgents}`,
    `install bundle: ${snapshot.statusBundle.primary.installBundle}`,
    `doctor result: ${snapshot.doctorHeadline}`,
    `runtime summary (read-only local visibility): ${snapshot.runtimeSummary.summary}`,
    `runtime history (read-only local visibility): events ${snapshot.runtimeHistory.events}, decisions ${snapshot.runtimeHistory.decisions}, artifacts ${snapshot.runtimeHistory.artifacts}`,
    `latest event (read-only local visibility): ${formatLatestHistoryEventPreview(snapshot.runtimeHistoryPreview.latestEvent)}`,
    `latest decision (read-only local visibility): ${formatLatestHistoryDecisionPreview(snapshot.runtimeHistoryPreview.latestDecision)}`,
    `latest artifact (read-only local visibility): ${formatLatestHistoryArtifactPreview(snapshot.runtimeHistoryPreview.latestArtifact)}`,
    ...formatInspectPolicyPreviewLines(snapshot.latestPolicyPreview, snapshot.policyPreview, {
      inputPrefix: "latest policy input"
    }),
    formatInspectOptionalPackProvenanceLine(snapshot.statusBundle.optionalPacks),
    `local config view: ${snapshot.localConfig.summary}`,
    `Codex config view: ${snapshot.codexConfig.summary}`,
    `integrations audit: ${snapshot.integrationsAudit.status} (${snapshot.integrationsAudit.recommendedChangeCount} recommended changes)`,
    `integrations apply: ${snapshot.integrationsApply.status} (${snapshot.integrationsApply.appliedKeys.length} keys)`,
    `integrations preview: ${snapshot.integrationsPreview.summary}`,
    formatInspectDriftSummaryLine(snapshot.driftItems)
  ].concat(formatInspectDriftItemLines(snapshot.driftItems));
}

export function formatInspectDriftSummaryLine(
  driftItems: InspectDriftItemPresentation[]
): string {
  return driftItems.length === 0
    ? "export drift view: no current drift detected"
    : `export drift view: ${driftItems.map((item) => item.name).join(", ")}`;
}

export function formatInspectDriftItemLines(
  driftItems: InspectDriftItemPresentation[]
): string[] {
  return driftItems.map((item) =>
    item.repairHint
      ? `${item.name}: ${item.status} (${item.repairHint})`
      : `${item.name}: ${item.status}`
  );
}

export function formatInspectOptionalPackProvenanceLine(
  packs: StatusBundle["optionalPacks"]
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
