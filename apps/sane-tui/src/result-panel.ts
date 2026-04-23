import { type OperationResult } from "@sane/core";

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

  const lines = [result.summary];
  lines.push(...result.details.slice(0, 3));

  if (result.inventory.length > 0) {
    lines.push(`inventory: ${result.inventory.length} item(s)`);
  }
  if (result.pathsTouched.length > 0) {
    lines.push(`paths touched: ${result.pathsTouched.length}`);
  }

  return {
    title: "Latest Status",
    lines
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
