import { compactLines } from "@sane/sane-tui/result-panel.js";
import { type SaneTuiAppView } from "@sane/sane-tui/app-view.js";

export interface TextViewport {
  width?: number;
  height?: number;
  ansi?: boolean;
}

const DEFAULT_WIDTH = 112;
const WIDE_LAYOUT_MIN_WIDTH = 96;
const WIDE_RAIL_WIDTH = 34;
const BOX_FRAME_HEIGHT = 4;

export function renderTextAppView(view: SaneTuiAppView, viewport: TextViewport = {}): string {
  const width = Math.max(20, viewport.width ?? DEFAULT_WIDTH);
  const sections = view.overlay
    ? renderOverlayLayout(view, width, viewport)
    : renderBaseLayout(view, width, viewport);

  return decorateAnsi(fitHeight(sections, viewport.height), view, viewport).join("\n");
}

function renderBaseLayout(
  view: SaneTuiAppView,
  width: number,
  viewport: TextViewport
): string[] {
  const header = renderHeader(view, width, isCompactViewport(viewport.height));
  const footer = wrapLines(view.footerLines[0] ?? view.footer.navHint, width);
  const availableBodyHeight = bodyHeightForViewport(viewport.height, header.length, footer.length);

  if (width >= WIDE_LAYOUT_MIN_WIDTH) {
    return [
      ...header,
      "",
      ...renderWideBody(view, width, availableBodyHeight),
      "",
      ...footer
    ];
  }

  return [
    ...header,
    "",
    ...renderStackedBody(view, width, availableBodyHeight),
    "",
    ...footer
  ];
}

function renderOverlayLayout(
  view: SaneTuiAppView,
  width: number,
  viewport: TextViewport
): string[] {
  const header = renderHeader(view, width, isCompactViewport(viewport.height));
  const footer = wrapLines(view.footer.navHint, width);
  const modalWidth = Math.max(52, Math.min(width, width - 6));
  const overlay = view.overlay;

  if (!overlay) {
    return [...header, "", ...footer];
  }

  const bodyLines =
    overlay.kind === "confirm"
      ? [
          overlay.header,
          "",
          ...overlay.bodyLines,
          "",
          "Current status",
          ...overlay.statusLines,
          "",
          overlay.footer
        ]
      : overlay.kind === "notice"
        ? [...overlay.bodyLines, "", overlay.footer]
        : [
            ...overlay.headerLines,
            "",
            "Last Result",
            ...overlay.outputLines,
            "",
            overlay.detailsTitle,
            ...overlay.detailsLines
          ];

  const box = renderBox(
    `[Overlay: ${overlay.title}]`,
    compactLines(bodyLines, Math.max(12, availableOverlayBodyLines(viewport.height, header.length, footer.length))),
    modalWidth
  );

  return [...header, "", ...centerLines(box, width), "", ...footer];
}

function renderHeader(view: SaneTuiAppView, width: number, compact = false): string[] {
  if (compact) {
    return [
      ...wrapLines(`${view.title} | ${view.subtitle}`, width),
      ...wrapLines(`Section: ${view.tabs.selected} | Mode: ${view.mode.label}`, width),
      ...wrapLines(statusline(view), width)
    ];
  }

  return [
    ...wrapLines(`${view.title} | ${view.subtitle}`, width),
    ...wrapLines(
      `Project ${view.projectLabel}  |  Section ${view.activeSection.docLabel}  |  Recommended ${view.recommendedNextStep}`,
      width
    ),
    ...wrapLines(`Section: ${view.tabs.selected}`, width),
    ...wrapLines(`Sections: ${formatTabs(view)}`, width),
    ...wrapLines(statusline(view), width),
    ...wrapLines(`Mode: ${view.mode.label} | ${view.mode.hint}`, width)
  ];
}

function renderWideBody(
  view: SaneTuiAppView,
  width: number,
  availableHeight?: number
): string[] {
  const railWidth = Math.min(WIDE_RAIL_WIDTH, Math.max(30, Math.floor(width * 0.32)));
  const detailWidth = width - railWidth - 2;
  const rail = renderBox("Actions", actionRailLines(view), railWidth);
  const detail = renderBox(detailPaneTitle(view), detailPaneLines(view), detailWidth);
  const targetHeight =
    availableHeight === undefined
      ? Math.max(rail.length, detail.length)
      : Math.max(10, availableHeight);

  return joinColumns(
    resizeBox(rail, railWidth, targetHeight),
    resizeBox(detail, detailWidth, targetHeight)
  );
}

function renderStackedBody(
  view: SaneTuiAppView,
  width: number,
  availableHeight?: number
): string[] {
  if (availableHeight !== undefined && availableHeight <= 12) {
    return resizeBox(
      renderBox(`${view.activeSection.docLabel} Focus`, compactFocusLines(view), width),
      width,
      availableHeight
    );
  }

  const actions = renderBox("Actions", actionRailLines(view), width);
  const detail = renderBox(detailPaneTitle(view), detailPaneLines(view), width);

  if (availableHeight === undefined) {
    return [...actions, "", ...detail];
  }

  const actionHeight = Math.max(8, Math.min(12, Math.floor(availableHeight * 0.38)));
  const detailHeight = Math.max(10, availableHeight - actionHeight - 1);

  return [
    ...resizeBox(actions, width, actionHeight),
    "",
    ...resizeBox(detail, width, detailHeight)
  ];
}

function actionRailLines(view: SaneTuiAppView): string[] {
  const lines = [
    `Current section: ${view.activeSection.docLabel}`,
    `Selected step: ${view.selectedAction.label}`,
    ""
  ];

  const recommended = selectedActionLabel(view);
  if (recommended !== view.selectedAction.label) {
    lines.push(`Recommended step: ${recommended}`);
    lines.push("");
  }

  for (const action of view.actions) {
    const selected = action.id === view.selectedAction.id ? ">" : " ";
    const recommended = action.id === view.recommendedActionId ? " [recommended]" : "";
    lines.push(`${selected} ${action.label}${recommended}`);
  }

  if (view.activeSection.id === "get_started" && view.attentionItems.length > 0) {
    lines.push("");
    lines.push("Needs attention");
    lines.push(...view.attentionItems);
  }

  return lines;
}

function detailPaneTitle(view: SaneTuiAppView): string {
  return `${view.activeSection.docLabel} Details`;
}

function detailPaneLines(view: SaneTuiAppView): string[] {
  const overviewLines = compactLines(view.sectionOverviewLines, 10);
  const selectedHelpLines = compactLines(view.selectedHelpLines, 14);
  const latestStatusLines = compactLines(view.latestStatusLines, 6);

  return [
    "Section overview",
    ...overviewLines,
    "",
    "Selected step",
    ...selectedHelpLines,
    "",
    view.latestStatusTitle,
    ...latestStatusLines
  ];
}

function selectedActionLabel(view: SaneTuiAppView): string {
  return view.actions.find((action) => action.id === view.recommendedActionId)?.label ?? view.selectedAction.label;
}

function compactFocusLines(view: SaneTuiAppView): string[] {
  const selectedIndex = view.actions.findIndex((action) => action.id === view.selectedAction.id);
  const nextAction = view.actions[selectedIndex + 1] ?? null;

  return [
    `Selected: ${compactActionLabel(view.selectedAction.label)}`,
    nextAction ? `Next: ${compactActionLabel(nextAction.label)}` : `Next: none`,
    `Status: ${view.latestStatusLines[0] ?? "ready"}`,
    "Use a wider terminal for the full rail and detail view."
  ];
}

function compactActionLabel(label: string): string {
  return label
    .replace("View your current ", "View ")
    .replace("Preview optional ", "Preview ")
    .replace("Apply optional ", "Apply ")
    .replace("Enable or disable built-in guidance packs", "Toggle built-in packs")
    .replace("Edit default model and reasoning settings", "Edit model defaults")
    .replace("Choose your telemetry and privacy level", "Set telemetry and privacy")
    .replace("Show everything Sane currently manages", "Show managed surfaces")
    .replace("Run Sane doctor checks for problems", "Run doctor checks")
    .replace("View current Sane runtime handoff state", "View runtime handoff")
    .replace("Explain Sane's routing policy", "Explain routing policy")
    .replace("Codex settings", "Codex")
    .replace("compatibility settings", "compatibility")
    .replace("statusline settings", "statusline");
}

function statusline(view: SaneTuiAppView): string {
  const ids = ["runtime", "codex-config", "user-skills", "hooks", "drift"];
  return view.chips
    .filter((chip) => ids.includes(chip.id))
    .map((chip) => `${chip.label}: ${chip.value}`)
    .join("  |  ");
}

function formatTabs(view: SaneTuiAppView): string {
  return view.tabs.items
    .map((item) => (item.id === view.tabs.selected ? `[${item.label}]` : item.label))
    .join(" | ");
}

function renderBox(title: string, lines: string[], width: number): string[] {
  const safeWidth = Math.max(20, width);
  const innerWidth = safeWidth - 4;
  const border = `+${"-".repeat(safeWidth - 2)}+`;
  const separator = `|-${"-".repeat(safeWidth - 4)}-|`;
  const body = wrapParagraphs(lines, innerWidth).map((line) => `| ${padRight(line, innerWidth)} |`);

  return [
    border,
    `| ${padRight(title, innerWidth)} |`,
    separator,
    ...(body.length > 0 ? body : [`| ${" ".repeat(innerWidth)} |`]),
    border
  ];
}

function resizeBox(lines: string[], width: number, targetHeight: number): string[] {
  const minHeight = Math.max(5, targetHeight);
  if (lines.length === minHeight) {
    return lines;
  }

  const innerWidth = Math.max(1, width - 4);
  const blank = `| ${" ".repeat(innerWidth)} |`;
  const ellipsis = `| ${padRight("...", innerWidth)} |`;
  const top = lines.slice(0, 3);
  const body = lines.slice(3, -1);
  const bottom = lines.at(-1) ?? `+${"-".repeat(width - 2)}+`;

  if (lines.length < minHeight) {
    return [...top, ...body, ...Array.from({ length: minHeight - lines.length }, () => blank), bottom];
  }

  const bodySlots = Math.max(1, minHeight - BOX_FRAME_HEIGHT);
  if (body.length <= bodySlots) {
    return [...top, ...body, bottom];
  }

  if (bodySlots === 1) {
    return [...top, ellipsis, bottom];
  }

  return [...top, ...body.slice(0, bodySlots - 1), ellipsis, bottom];
}

function joinColumns(left: string[], right: string[]): string[] {
  const leftWidth = left[0]?.length ?? 0;
  const height = Math.max(left.length, right.length);
  const output: string[] = [];

  for (let index = 0; index < height; index += 1) {
    const leftLine = left[index] ?? " ".repeat(leftWidth);
    const rightLine = right[index] ?? "";
    output.push(`${leftLine}  ${rightLine}`);
  }

  return output;
}

function centerLines(lines: string[], width: number): string[] {
  return lines.map((line) => {
    if (line.length >= width) {
      return line;
    }

    const leftPad = Math.floor((width - line.length) / 2);
    return `${" ".repeat(leftPad)}${line}`;
  });
}

function wrapParagraphs(lines: string[], width: number): string[] {
  return lines.flatMap((line) => (line.length === 0 ? [""] : wrapLines(line, width)));
}

function wrapLines(line: string, width: number): string[] {
  if (width <= 0 || line.length <= width) {
    return [line];
  }

  const words = line.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [line.slice(0, width)];
  }

  const output: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > width) {
      if (current.length > 0) {
        output.push(current);
        current = "";
      }

      let remaining = word;
      while (remaining.length > width) {
        output.push(remaining.slice(0, width));
        remaining = remaining.slice(width);
      }
      current = remaining;
      continue;
    }

    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length <= width) {
      current = next;
    } else {
      output.push(current);
      current = word;
    }
  }

  if (current.length > 0) {
    output.push(current);
  }

  return output.length > 0 ? output : [line.slice(0, width)];
}

function fitHeight(lines: string[], height?: number): string[] {
  if (!height || height <= 0 || lines.length <= height) {
    return lines;
  }

  if (height <= 3) {
    return lines.slice(0, height);
  }

  const headerCount = Math.min(4, height - 2);
  const footerCount = Math.min(2, height - headerCount - 1);
  const bodySlots = Math.max(1, height - headerCount - footerCount - 1);
  const head = lines.slice(0, headerCount);
  const tail = footerCount > 0 ? lines.slice(-footerCount) : [];
  const middle = lines.slice(headerCount, Math.min(lines.length - footerCount, headerCount + bodySlots));

  return [...head, ...middle, "...", ...tail].slice(0, height);
}

function decorateAnsi(lines: string[], view: SaneTuiAppView, viewport: TextViewport): string[] {
  if (!viewport.ansi) {
    return lines;
  }

  return lines.map((line, index, all) => styleLine(line, index, all.length, view));
}

function styleLine(
  line: string,
  index: number,
  lineCount: number,
  view: SaneTuiAppView
): string {
  if (index === 0) {
    return ansi("1", line);
  }

  if (line.startsWith("Sections: ")) {
    return line.replace(/\[[^\]]+\]/g, (match) => ansi("7", match));
  }

  if (line.startsWith("| > ")) {
    return ansi("7", line);
  }

  if (line.startsWith("| ") && line.includes("[recommended]")) {
    return line.replace("[recommended]", ansi("33", "[recommended]"));
  }

  if (line.startsWith("| ") && line.includes("Needs attention")) {
    return ansi("33", line);
  }

  if (line.startsWith("| ") && isBoxTitle(line)) {
    return ansi("1;36", line);
  }

  if (line.startsWith("+") && line.endsWith("+")) {
    return ansi("2", line);
  }

  if (index === lineCount - 1 || line.startsWith("left/right or tab")) {
    return ansi("2", line);
  }

  return styleStatusTokens(line, view);
}

function styleStatusTokens(line: string, view: SaneTuiAppView): string {
  return view.chips.reduce((styled, chip) => {
    const token = `${chip.label}: ${chip.value}`;
    if (!styled.includes(token)) {
      return styled;
    }

    return styled.replace(token, ansi(statusToneCode(chip.tone), token));
  }, line);
}

function isBoxTitle(line: string): boolean {
  const content = line.slice(2, -2).trim();
  return (
    content === "Actions" ||
    content.endsWith("Details") ||
    content.startsWith("[Overlay: ") ||
    content === "Confirm" ||
    content === "Model Defaults" ||
    content === "Built-in Packs" ||
    content === "Privacy"
  );
}

function bodyHeightForViewport(height: number | undefined, headerLines: number, footerLines: number): number | undefined {
  if (!height || height <= 0) {
    return undefined;
  }

  return Math.max(10, height - headerLines - footerLines - 2);
}

function availableOverlayBodyLines(
  height: number | undefined,
  headerLines: number,
  footerLines: number
): number {
  if (!height || height <= 0) {
    return 20;
  }

  return Math.max(8, height - headerLines - footerLines - 8);
}

function isCompactViewport(height: number | undefined): boolean {
  return Boolean(height && height <= 18);
}

function padRight(text: string, width: number): string {
  if (text.length >= width) {
    return text.slice(0, width);
  }

  return `${text}${" ".repeat(width - text.length)}`;
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
