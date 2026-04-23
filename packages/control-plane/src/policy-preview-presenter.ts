import { type LatestPolicyPreviewSnapshot } from "@sane/state";

export interface LatestPolicyPreviewLineOptions {
  mode?: "runtime-summary" | "inspect";
  summaryPrefix?: string;
  provenancePrefix?: string;
  snapshotPrefix?: string;
  inputPrefix?: string;
}

export interface InspectPolicyPreviewLineOptions {
  mode?: "overview" | "action";
  snapshotPrefix?: string;
  inputPrefix?: string;
  currentPrefix?: string;
}

export interface InspectCurrentPolicyPreview {
  summary: string;
  details: string[];
  policyPreview?: {
    scenarios: Array<{
      id: string;
      obligations: string[];
      orchestration: {
        subagents: string;
        subagentReadiness: string;
        reviewPosture: string;
        verifierTiming: string;
      };
      continuation?: {
        strategy: string;
        stopCondition: string;
      } | null;
      trace: Array<{
        obligation: string;
        rule: string;
      }>;
    }>;
  } | null;
}

export function formatRuntimeSummaryPolicyPreviewLines(
  latestPolicyPreview: LatestPolicyPreviewSnapshot,
  currentPolicyPreview: InspectCurrentPolicyPreview
): string[] {
  return [
    ...formatLatestPolicyPreviewLines(latestPolicyPreview, {
      mode: "runtime-summary",
      inputPrefix: "latest policy input"
    }),
    formatCurrentPolicyPreviewLine(currentPolicyPreview, "current policy preview"),
    ...formatCurrentPolicyScenarioLines(currentPolicyPreview)
  ];
}

export function formatInspectPolicyPreviewLines(
  latestPolicyPreview: LatestPolicyPreviewSnapshot,
  currentPolicyPreview: InspectCurrentPolicyPreview,
  options: InspectPolicyPreviewLineOptions = {}
): string[] {
  const mode = options.mode ?? "overview";
  const lines = formatLatestPolicyPreviewLines(latestPolicyPreview, {
    snapshotPrefix: options.snapshotPrefix,
    inputPrefix: options.inputPrefix ?? "latest policy input"
  });

  lines.push(formatCurrentPolicyPreviewLine(currentPolicyPreview, options.currentPrefix));
  if (mode === "action") {
    lines.push(...currentPolicyPreview.details);
    lines.push(...formatCurrentPolicyScenarioLines(currentPolicyPreview));
  }

  return lines;
}

export function formatLatestPolicyPreviewLines(
  preview: LatestPolicyPreviewSnapshot,
  options: LatestPolicyPreviewLineOptions = {}
): string[] {
  const mode = options.mode ?? "inspect";

  if (mode === "runtime-summary") {
    return formatRuntimeSummaryLines(preview, options);
  }

  return [
    formatInspectSnapshotLine(preview, options.snapshotPrefix),
    ...formatLatestPolicyPreviewInputLines(preview, options.inputPrefix ?? "latest policy input"),
    ...formatLatestPolicyPreviewScenarioLines(preview)
  ];
}

export function formatLatestPolicyPreviewInputLines(
  preview: LatestPolicyPreviewSnapshot,
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

function formatRuntimeSummaryLines(
  preview: LatestPolicyPreviewSnapshot,
  options: LatestPolicyPreviewLineOptions
): string[] {
  if (preview.status !== "present") {
    return [];
  }

  const lines = [
    `${options.summaryPrefix ?? "latest policy preview"}: ${preview.scenarioCount} scenarios`
  ];

  if (preview.tsUnix !== null && preview.summary) {
    lines.push(
      `${options.provenancePrefix ?? "latest policy preview provenance"}: ts ${preview.tsUnix}, summary ${preview.summary}`
    );
  }

  return [
    ...lines,
    ...formatLatestPolicyPreviewInputLines(preview, options.inputPrefix),
    ...formatLatestPolicyPreviewScenarioLines(preview)
  ];
}

function formatInspectSnapshotLine(
  preview: LatestPolicyPreviewSnapshot,
  prefix = "latest policy snapshot"
): string {
  return preview.status === "present"
    ? `${prefix}: present (current-run-derived read-only view; ts ${preview.tsUnix}; summary ${preview.summary}; ${preview.scenarioCount} scenarios: ${preview.scenarioIds.join(", ")})`
    : `${prefix}: missing (current-run-derived read-only view)`;
}

function formatLatestPolicyPreviewScenarioLines(
  preview: LatestPolicyPreviewSnapshot
): string[] {
  if (preview.status !== "present") {
    return [];
  }

  return preview.scenarios.flatMap((scenario) => {
    const lines = [
      `latest policy scenario ${scenario.id}: obligations ${scenario.obligationCount}, traces ${scenario.traceCount}`
    ];

    if (scenario.roles) {
      lines.push(
        `latest policy roles ${scenario.id}: coordinator ${scenario.roles.coordinator ? "on" : "off"}, sidecar ${scenario.roles.sidecar ? "on" : "off"}, verifier ${scenario.roles.verifier ? "on" : "off"}`
      );
    }

    if (scenario.orchestration) {
      lines.push(
        `latest policy orchestration ${scenario.id}: subagents ${scenario.orchestration.subagents ?? "unknown"}, readiness ${scenario.orchestration.subagentReadiness ?? "unknown"}, review ${scenario.orchestration.reviewPosture ?? "unknown"}, verifier ${scenario.orchestration.verifierTiming ?? "unknown"}`
      );
    }

    if (scenario.continuation) {
      lines.push(
        `latest policy continuation ${scenario.id}: strategy ${scenario.continuation.strategy ?? "unknown"}, stop ${scenario.continuation.stopCondition ?? "unknown"}`
      );
    }

    if (scenario.trace.length > 0) {
      lines.push(
        `latest policy trace ${scenario.id}: ${scenario.trace.map((entry) => `${entry.obligation} via ${entry.rule}`).join("; ")}`
      );
    }

    return lines;
  });
}

function formatCurrentPolicyPreviewLine(
  currentPolicyPreview: InspectCurrentPolicyPreview,
  prefix = "current policy preview"
): string {
  const scenarioCount =
    currentPolicyPreview.policyPreview?.scenarios.length ?? currentPolicyPreview.details.length;
  const label = scenarioCount === 1 ? "scenario" : "scenarios";

  return `${prefix}: ${currentPolicyPreview.summary}; ${scenarioCount} ${label}`;
}

function formatCurrentPolicyScenarioLines(
  currentPolicyPreview: InspectCurrentPolicyPreview
): string[] {
  return (currentPolicyPreview.policyPreview?.scenarios ?? []).map((scenario) => {
    const obligationCount = scenario.obligations.length;
    const traceCount = scenario.trace.length;
    const traceSummary =
      traceCount === 0
        ? "none"
        : scenario.trace.map((entry) => `${entry.obligation} via ${entry.rule}`).join("; ");

    const continuation = scenario.continuation
      ? `, continuation ${scenario.continuation.strategy}, stop ${scenario.continuation.stopCondition}`
      : "";

    return `current preview scenario ${scenario.id}: obligations ${obligationCount}, traces ${traceCount}, subagents ${scenario.orchestration.subagents}, readiness ${scenario.orchestration.subagentReadiness}, review ${scenario.orchestration.reviewPosture}, verifier ${scenario.orchestration.verifierTiming}${continuation}, trace reasons ${traceSummary}`;
  });
}
