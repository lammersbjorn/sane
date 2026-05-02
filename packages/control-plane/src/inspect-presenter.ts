import {
  type LayeredStateHistoryPreview,
  type LatestPolicyPreviewSnapshot
} from "@sane/state";
import { presentManagedInventoryItem } from "./status-presenter.js";

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
  statusBundle: Pick<StatusBundle, "counts" | "conflictWarnings" | "driftItems" | "optionalPacks" | "primary">;
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
  selfHostingShadow: {
    mode: "shadow-inspect-only";
    runnerEnabled: false;
    status: "ready" | "blocked";
    checks: Array<{
      status: "pass" | "warn" | "block";
    }>;
  };
  outcomeReadiness: {
    mode: "codex-native-outcome-readiness";
    autonomousLoopEnabled: false;
    status: "ready" | "blocked" | "needs_input";
    checks: Array<{
      status: "pass" | "warn" | "block";
    }>;
  };
  outcomeRescueSignal: {
    status: "pass" | "warn" | "block";
    summary: string;
    reasons: string[];
  };
  worktreeReadiness: {
    mode: "read-only-worktree-readiness";
    status: "ready" | "limited" | "missing";
    summary: string;
    path: string | null;
    linkedWorktree: boolean;
    reasons: string[];
  };
  runtimeOutcome: {
    phase: string | null;
    activeTaskCount: number;
    blockingQuestionCount: number;
    verificationStatus: string | null;
    verificationSummary: string | null;
    lastVerifiedOutputs: string[];
    filesTouchedCount: number;
  };
  repoVerifyCommand: string | null;
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
  statuslineAudit: {
    status: string;
    recommendedChangeCount: number;
  };
  statuslineApply: {
    status: string;
    appliedKeys: string[];
  };
  statuslinePreview: {
    summary: string;
  };
  driftItems: InspectDriftItemPresentation[];
}

export function formatInspectOverviewLines(snapshot: InspectOverviewSnapshot): string[] {
  const counts = snapshot.statusBundle.counts;
  const primary = snapshot.statusBundle.primary.status;
  const hooksLabel = presentManagedInventoryItem(snapshot.statusBundle.primary.hooks).label;

  return [
    `status counts: installed ${counts.installed}, configured ${counts.configured}, disabled ${counts.disabled}, missing ${counts.missing}, invalid ${counts.invalid}, out-of-sync ${snapshot.statusBundle.driftItems.length}`,
    `main files: local setup ${primary.runtime}, codex ${primary.codexConfig}, user skills ${primary.userSkills}, hooks ${hooksLabel}, named agents ${primary.customAgents}`,
    `install bundle: ${snapshot.statusBundle.primary.installBundle}`,
    `setup check: ${snapshot.doctorHeadline}`,
    `runtime summary (read-only local visibility): ${snapshot.runtimeSummary.summary}`,
    `runtime history (read-only local visibility): events ${snapshot.runtimeHistory.events}, decisions ${snapshot.runtimeHistory.decisions}, artifacts ${snapshot.runtimeHistory.artifacts}`,
    `latest event (read-only local visibility): ${formatLatestHistoryEventPreview(snapshot.runtimeHistoryPreview.latestEvent)}`,
    `latest decision (read-only local visibility): ${formatLatestHistoryDecisionPreview(snapshot.runtimeHistoryPreview.latestDecision)}`,
    `latest artifact (read-only local visibility): ${formatLatestHistoryArtifactPreview(snapshot.runtimeHistoryPreview.latestArtifact)}`,
    `self-hosting shadow (read-only): ${snapshot.selfHostingShadow.status}, runner disabled, checks ${formatSelfHostingShadowCheckCounts(snapshot.selfHostingShadow.checks)}`,
    `outcome readiness (read-only): ${snapshot.outcomeReadiness.status}, autonomous loop disabled, checks ${formatCheckCounts(snapshot.outcomeReadiness.checks)}`,
    `outcome rescue signal (read-only): ${snapshot.outcomeRescueSignal.status} - ${snapshot.outcomeRescueSignal.summary}`,
    `worktree readiness (read-only): ${snapshot.worktreeReadiness.status} - ${snapshot.worktreeReadiness.summary}`,
    `outcome verification (read-only): ${formatInspectOutcomeVerificationLine(snapshot.runtimeOutcome)}`,
    `outcome progress (read-only): ${formatInspectOutcomeProgressLine(snapshot.runtimeOutcome)}`,
    `last verified outputs (read-only): ${joinInspectSummaryList(snapshot.runtimeOutcome.lastVerifiedOutputs)}`,
    `repo verify (read-only): ${snapshot.repoVerifyCommand ?? "none"}`,
    "",
    ...formatInspectPolicyPreviewLines(snapshot.latestPolicyPreview, snapshot.policyPreview, {
      inputPrefix: "latest policy input"
    }),
    "",
    formatInspectOptionalPackProvenanceLine(snapshot.statusBundle.optionalPacks),
    `local config view: ${snapshot.localConfig.summary}`,
    `Codex config view: ${snapshot.codexConfig.summary}`,
    `Codex tool settings: ${snapshot.integrationsAudit.status} (${snapshot.integrationsAudit.recommendedChangeCount} recommended changes)`,
    `Codex tool apply readiness: ${snapshot.integrationsApply.status} (${snapshot.integrationsApply.appliedKeys.length} keys)`,
    `Codex tool preview: ${snapshot.integrationsPreview.summary}`,
    `status line settings: ${snapshot.statuslineAudit.status} (${snapshot.statuslineAudit.recommendedChangeCount} recommended changes)`,
    `status line apply readiness: ${snapshot.statuslineApply.status} (${snapshot.statuslineApply.appliedKeys.length} keys)`,
    `status line preview: ${snapshot.statuslinePreview.summary}`,
    "",
    formatInspectConflictSummaryLine(snapshot.statusBundle.conflictWarnings),
    ...formatInspectConflictWarningLines(snapshot.statusBundle.conflictWarnings),
    "",
    formatInspectDriftSummaryLine(snapshot.driftItems)
  ].concat(formatInspectDriftItemLines(snapshot.driftItems));
}

function formatSelfHostingShadowCheckCounts(
  checks: InspectOverviewSnapshot["selfHostingShadow"]["checks"]
): string {
  return formatCheckCounts(checks);
}

function formatCheckCounts(
  checks: Array<{
    status: "pass" | "warn" | "block";
  }>
): string {
  const pass = checks.filter((check) => check.status === "pass").length;
  const warn = checks.filter((check) => check.status === "warn").length;
  const block = checks.filter((check) => check.status === "block").length;

  return `pass ${pass}, warn ${warn}, block ${block}`;
}

function formatInspectOutcomeVerificationLine(
  runtimeOutcome: InspectOverviewSnapshot["runtimeOutcome"]
): string {
  if (!runtimeOutcome.verificationStatus) {
    return "missing";
  }

  return runtimeOutcome.verificationSummary
    ? `${runtimeOutcome.verificationStatus} (${runtimeOutcome.verificationSummary})`
    : runtimeOutcome.verificationStatus;
}

function formatInspectOutcomeProgressLine(
  runtimeOutcome: InspectOverviewSnapshot["runtimeOutcome"]
): string {
  const phase = runtimeOutcome.phase ?? "missing";

  return `phase ${phase}, active tasks ${runtimeOutcome.activeTaskCount}, blocking questions ${runtimeOutcome.blockingQuestionCount}, files touched ${runtimeOutcome.filesTouchedCount}`;
}

function joinInspectSummaryList(values: string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

export function formatInspectConflictSummaryLine(
  warnings: StatusBundle["conflictWarnings"]
): string {
  return warnings.length === 0
    ? "conflict warnings: none"
    : `conflict warnings: ${warnings.length}`;
}

export function formatInspectConflictWarningLines(
  warnings: StatusBundle["conflictWarnings"]
): string[] {
  return warnings.map((warning) => `${warning.target}: ${warning.message}`);
}

export function formatInspectDriftSummaryLine(
  driftItems: InspectDriftItemPresentation[]
): string {
  return driftItems.length === 0
    ? "out-of-sync files: none"
    : `out-of-sync files: ${driftItems.map((item) => item.name).join(", ")}`;
}

export function formatInspectDriftItemLines(
  driftItems: InspectDriftItemPresentation[]
): string[] {
  return driftItems.map((item) =>
    item.repairHint && item.status !== "unsupported (use WSL)"
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

  return `optional guidance provenance: ${summary.join("; ")}`;
}
