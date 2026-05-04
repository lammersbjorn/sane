import { type OperationResult } from "@sane/control-plane/core.js";

import { buildNotice, compactLines, resultLines } from "@sane/sane-tui/result-panel.js";
import { type UiCommandId } from "@sane/sane-tui/command-registry.js";

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
  return {
    title: "Last Result",
    lines: compactLines(
      [`Completed \`${input.actionLabel}\`.`, ...resultLines(input.result)],
      input.maxLines
    )
  };
}
