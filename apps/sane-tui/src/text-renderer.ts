import { type SaneTuiAppView } from "@sane/sane-tui/app-view.js";

export interface TextViewport {
  width?: number;
  height?: number;
  ansi?: boolean;
}

export function renderTextAppView(view: SaneTuiAppView, viewport: TextViewport = {}): string {
  const sections = [
    `${view.title} | ${view.subtitle}`,
    `Project: ${view.projectLabel}`,
    `Sections: ${formatTabs(view)}`,
    `Section: ${view.tabs.selected}`,
    `Recommended: ${view.recommendedNextStep}`,
    "",
    "[Status]",
    ...formatStatusChips(view),
    "",
    "[Actions]",
    ...formatActions(view),
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
        ...formatOverlay(view.overlay)
      ];

  return decorateAnsi(fitViewport(lines, viewport), view, viewport).join("\n");
}

function formatTabs(view: SaneTuiAppView): string {
  return view.tabs.items
    .map((item) => (item.id === view.tabs.selected ? `[${item.label}]` : item.label))
    .join(" | ");
}

function formatActions(view: SaneTuiAppView): string[] {
  return view.actions.map((action) => {
    const selected = action.id === view.selectedAction.id ? ">" : " ";
    const recommended = action.id === view.recommendedActionId ? " (recommended)" : "";
    return `${selected} ${action.label}${recommended}`;
  });
}

function formatStatusChips(view: SaneTuiAppView): string[] {
  const primaryIds = ["runtime", "codex-config", "user-skills", "hooks", "drift"];
  const primary = view.chips
    .filter((chip) => primaryIds.includes(chip.id))
    .map((chip) => `${chip.label}: ${chip.value}`);
  const secondary = view.chips
    .filter((chip) => !primaryIds.includes(chip.id))
    .map((chip) => `${chip.label}: ${chip.value}`);

  if (primary.length === 0) {
    return secondary;
  }

  if (secondary.length === 0) {
    return primary;
  }

  return [...primary, "", ...secondary];
}

function formatOverlay(view: SaneTuiAppView["overlay"]): string[] {
  if (!view) {
    return [];
  }

  return [
    `[Overlay: ${view.title}]`,
    `kind: ${view.kind}`,
    ...overlayLines(view)
  ];
}

function overlayLines(view: SaneTuiAppView["overlay"]): string[] {
  if (!view) {
    return [];
  }

  switch (view.kind) {
    case "confirm":
      return [
        "",
        view.header,
        ...prefixLines(view.bodyLines),
        "",
        "[Current Status]",
        ...prefixLines(view.statusLines),
        "",
        view.footer
      ];
    case "notice":
      return ["", ...prefixLines(view.bodyLines), "", view.footer];
    case "config":
    case "packs":
    case "privacy":
      return [
        "",
        ...view.headerLines,
        "",
        "[Last Result]",
        ...prefixLines(view.outputLines),
        "",
        `[${view.detailsTitle}]`,
        ...prefixLines(view.detailsLines)
      ];
  }
}

function prefixLines(lines: string[]): string[] {
  return lines.map((line) => (line.length === 0 ? "|" : `| ${line}`));
}

function fitViewport(lines: string[], viewport: TextViewport): string[] {
  return fitHeight(truncateWidth(lines, viewport.width), viewport.height);
}

function decorateAnsi(lines: string[], view: SaneTuiAppView, viewport: TextViewport): string[] {
  if (!viewport.ansi) {
    return lines;
  }

  return lines.map((line, index) => styleLine(line, index, lines.length, view));
}

function styleLine(line: string, index: number, lineCount: number, view: SaneTuiAppView): string {
  if (index === 0) {
    return ansi("1", line);
  }

  if (line.startsWith("Sections: ")) {
    return styleSectionsLine(line);
  }

  if (line.startsWith("> ")) {
    return ansi("7", line);
  }

  if (line.startsWith("[") && line.endsWith("]")) {
    return ansi("1;36", line);
  }

  if (line.startsWith("| ")) {
    return ansi("2", line);
  }

  if (hasStatusChipToken(line, view.chips)) {
    return styleStatusChipLine(line, view);
  }

  if (index === lineCount - 1) {
    return ansi("2", line);
  }

  return line;
}

function styleSectionsLine(line: string): string {
  const prefix = "Sections: ";
  const content = line.slice(prefix.length).replace(/\[[^\]]+\]/g, (match) => ansi("7", match));
  return `${ansi("1", prefix)}${content}`;
}

function styleStatusChipLine(line: string, view: SaneTuiAppView): string {
  return view.chips.reduce((styled, chip) => {
    const token = `${chip.label}: ${chip.value}`;
    if (!styled.includes(token)) {
      return styled;
    }

    return styled.replace(token, ansi(statusToneCode(chip.tone), token));
  }, line);
}

function hasStatusChipToken(line: string, chips: SaneTuiAppView["chips"]): boolean {
  return chips.some((chip) => line.includes(`${chip.label}: ${chip.value}`));
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

function ansi(code: string, text: string): string {
  return `\u001b[${code}m${text}\u001b[0m`;
}

function statusToneCode(tone: SaneTuiAppView["chips"][number]["tone"]): string {
  switch (tone) {
    case "ok":
      return "32";
    case "warn":
      return "33";
    case "muted":
      return "2";
  }
}
