import { type LayeredStateHistoryPreview } from "@sane/state";

export function formatLatestHistoryEventPreview(
  preview: LayeredStateHistoryPreview["latestEvent"]
): string {
  if (!preview) {
    return "missing";
  }

  return `ts ${preview.tsUnix}, action ${preview.action}, result ${preview.result}, summary ${preview.summary}`;
}

export function formatLatestHistoryDecisionPreview(
  preview: LayeredStateHistoryPreview["latestDecision"]
): string {
  if (!preview) {
    return "missing";
  }

  return `ts ${preview.tsUnix}, summary ${preview.summary}, rationale ${preview.rationale}`;
}

export function formatLatestHistoryArtifactPreview(
  preview: LayeredStateHistoryPreview["latestArtifact"]
): string {
  if (!preview) {
    return "missing";
  }

  return `ts ${preview.tsUnix}, kind ${preview.kind}, path ${preview.path}, summary ${preview.summary}`;
}
