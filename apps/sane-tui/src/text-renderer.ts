import { type SaneTuiAppView } from "@sane/sane-tui/app-view.js";

export interface TextViewport {
  width?: number;
  height?: number;
}

export function renderTextAppView(view: SaneTuiAppView, viewport: TextViewport = {}): string {
  const sections = [
    `${view.title} | ${view.subtitle}`,
    `Project: ${view.projectLabel}`,
    `Section: ${view.tabs.selected}`,
    `Recommended: ${view.recommendedNextStep}`,
    "",
    `[${view.sectionOverviewTitle}]`,
    ...view.sectionOverviewLines,
    "",
    `[${view.selectedHelpTitle}]`,
    ...view.selectedHelpLines,
    "",
    `[${view.latestStatusTitle}]`,
    ...view.latestStatusLines,
    "",
    `[${view.footerTitle}]`,
    ...view.footerLines
  ];

  const lines = !view.overlay
    ? sections
    : [
    ...sections,
    "",
    "[Overlay]",
    `kind: ${view.overlay.kind}`,
    `title: ${view.overlay.title}`,
    ...overlayLines(view.overlay)
  ];

  return fitViewport(lines, viewport).join("\n");
}

function overlayLines(view: SaneTuiAppView["overlay"]): string[] {
  if (!view) {
    return [];
  }

  switch (view.kind) {
    case "confirm":
      return [view.header, ...view.bodyLines, ...view.statusLines, view.footer];
    case "notice":
      return [...view.bodyLines, view.footer];
    case "config":
    case "packs":
    case "privacy":
      return [...view.headerLines, ...view.outputLines, view.detailsTitle, ...view.detailsLines];
  }
}

function fitViewport(lines: string[], viewport: TextViewport): string[] {
  return fitHeight(truncateWidth(lines, viewport.width), viewport.height);
}

function truncateWidth(lines: string[], width?: number): string[] {
  if (!width || width < 4) {
    return lines;
  }

  return lines.map((line) => truncateLine(line, width));
}

function truncateLine(line: string, width: number): string {
  if (line.length <= width) {
    return line;
  }

  return `${line.slice(0, width - 3)}...`;
}

function fitHeight(lines: string[], height?: number): string[] {
  if (!height || height <= 0 || lines.length <= height) {
    return lines;
  }

  if (height === 1) {
    return ["..."];
  }

  if (height === 2) {
    return [lines[0]!, lines.at(-1)!];
  }

  if (height === 3) {
    return ["...", lines.at(-2)!, lines.at(-1)!];
  }

  const head = lines.slice(0, height - 3);
  return [...head, "...", lines.at(-2)!, lines.at(-1)!];
}
