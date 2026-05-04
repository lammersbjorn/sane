import { type OperationResult } from "@sane/control-plane/core.js";

import { getCommandSpec, type UiCommandId } from "@sane/sane-tui/command-registry.js";

export interface LastResultView {
  title: "Latest Status";
  lines: string[];
}

export interface NoticeView {
  title: string;
  body: string;
  footer: "Enter, Space, or Esc closes this message.";
}

const DEFAULT_MAX_RESULT_LINES = 10;

export function buildLastResultView(
  result: OperationResult | null,
  fallback: string
): LastResultView {
  if (!result) {
    return {
      title: "Latest Status",
      lines: fallback.split("\n").filter((line) => line.length > 0)
    };
  }

  return {
    title: "Latest Status",
    lines: compactLines(resultLines(result), DEFAULT_MAX_RESULT_LINES)
  };
}

export function buildNotice(
  commandId: UiCommandId,
  result: OperationResult
): NoticeView | null {
  const title = getCommandSpec(commandId).successNoticeTitle;
  if (!title) {
    return null;
  }

  const compact = buildLastResultView(result, result.summary);
  return {
    title,
    body: compact.lines.join("\n"),
    footer: "Enter, Space, or Esc closes this message."
  };
}

export function buildResultNotice(
  title: string,
  result: OperationResult
): NoticeView {
  const compact = buildLastResultView(result, result.summary);
  return {
    title,
    body: compact.lines.join("\n"),
    footer: "Enter, Space, or Esc closes this message."
  };
}

export function resultLines(result: OperationResult): string[] {
  return result.renderText().split("\n").filter((line) => line.length > 0);
}

export function compactLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) {
    return lines;
  }

  const visible = lines.slice(0, Math.max(1, maxLines - 1));
  visible.push(`... ${lines.length - visible.length} more line(s)`);
  return visible;
}
