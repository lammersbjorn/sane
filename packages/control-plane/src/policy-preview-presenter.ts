import { type LatestPolicyPreviewSnapshot } from "@sane/state";

export interface LatestPolicyPreviewLineOptions {
  mode?: "runtime-summary" | "inspect";
  summaryPrefix?: string;
  provenancePrefix?: string;
  snapshotPrefix?: string;
  inputPrefix?: string;
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
    ...formatLatestPolicyPreviewInputLines(preview, options.inputPrefix ?? "latest policy input")
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

  return [...lines, ...formatLatestPolicyPreviewInputLines(preview, options.inputPrefix)];
}

function formatInspectSnapshotLine(
  preview: LatestPolicyPreviewSnapshot,
  prefix = "latest policy snapshot"
): string {
  return preview.status === "present"
    ? `${prefix}: present (current-run-derived read-only view; ts ${preview.tsUnix}; summary ${preview.summary}; ${preview.scenarioCount} scenarios: ${preview.scenarioIds.join(", ")})`
    : `${prefix}: missing (current-run-derived read-only view)`;
}
