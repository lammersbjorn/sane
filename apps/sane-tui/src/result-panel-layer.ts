import { type OperationResult } from "@sane/core";

import { buildNotice } from "@/result-panel.js";
import { type UiCommandId } from "@/command-registry.js";

export interface ResultNotice {
  title: string;
  body: string;
}

export interface LastResultPanel {
  title: "Last Result";
  lines: string[];
}

export function renderResultNotice(input: {
  commandId: UiCommandId;
  actionLabel: string;
  result: OperationResult;
}): ResultNotice | null {
  const notice = buildNotice(input.commandId, input.result);
  if (!notice) {
    return null;
  }

  return {
    title: notice.title,
    body: [`Completed \`${input.actionLabel}\`.`, "", input.result.renderText()].join("\n")
  };
}

export function renderLastResult(input: {
  actionLabel: string;
  result: OperationResult;
  maxLines: number;
}): LastResultPanel {
  const lines = [
    `Completed \`${input.actionLabel}\`.`,
    input.result.summary,
    ...input.result.details,
    ...(input.result.pathsTouched.length > 0 ? [`paths touched: ${input.result.pathsTouched.length}`] : [])
  ];

  if (lines.length > input.maxLines) {
    const compact = lines.slice(0, input.maxLines);
    compact[compact.length - 1] = "...";
    return {
      title: "Last Result",
      lines: compact
    };
  }

  return {
    title: "Last Result",
    lines
  };
}
