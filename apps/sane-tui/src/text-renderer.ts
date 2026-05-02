import { compactLines } from "@sane/sane-tui/result-panel.js";
import { type SaneTuiAppView } from "@sane/sane-tui/app-view.js";
import { compactActionLabel, compactStatusSummary } from "@sane/sane-tui/presentation-normalizer.js";
import { isReadOnlyAction } from "./tui-action-semantics.js";
import { readableOverviewLines, windowLinesAroundSelection } from "./tui-lines.js";

export interface TextViewport {
  width?: number;
  height?: number;
  ansi?: boolean;
}

const DEFAULT_WIDTH = 112;
const WIDE_LAYOUT_MIN_WIDTH = 96;
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
  const compact = isCompactViewport(width, viewport.height);
  const header = renderHeader(view, width, compact);
  const footer = renderFooter(view, width, compact);
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
  const header = renderHeader(view, width, isCompactViewport(width, viewport.height));
  const footer = renderFooter(view, width, isCompactViewport(width, viewport.height));
  const modalWidth = boundedOverlayWidth(width, 52, 6);
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
        : editorOverlayBodyLines(overlay);

  const box = renderBox(
    `[Overlay: ${overlay.title}]`,
    compactLines(bodyLines, Math.max(12, availableOverlayBodyLines(viewport.height, header.length, footer.length))),
    modalWidth
  );

  return [...header, "", ...centerLines(box, width), "", ...footer];
}

function boundedOverlayWidth(viewportWidth: number, preferredWidth: number, inset: number): number {
  const usableWidth = Math.max(20, viewportWidth - Math.max(0, inset));
  return Math.min(viewportWidth, Math.max(20, Math.min(preferredWidth, usableWidth)));
}

function renderHeader(view: SaneTuiAppView, width: number, compact = false): string[] {
  const header = compact ? `${view.title} / ${view.activeSection.docLabel}` : `${view.title} / ${view.activeSection.docLabel} / ${view.projectLabel}`;
  const lines = [header, `Focus: ${view.experience.title}`];
  return lines.flatMap((line) => wrapLines(line, width));
}

function renderWideBody(
  view: SaneTuiAppView,
  width: number,
  availableHeight?: number
): string[] {
  const task = renderBox("Current job", currentTaskLines(view), width);
  if (availableHeight !== undefined && availableHeight <= task.length + 7) {
    return resizeBox(task, width, availableHeight);
  }

  const remainingHeight = availableHeight === undefined ? undefined : Math.max(7, availableHeight - task.length - 1);
  const columnHeight = remainingHeight === undefined ? 11 : Math.max(7, remainingHeight);
  const actionBox = resizeBox(
    renderBox("Actions", actionRailLines(view, { maxLines: columnHeight - BOX_FRAME_HEIGHT, compactLabels: false }), width),
    width,
    columnHeight
  );

  return [
    ...(availableHeight === undefined ? task : resizeBox(task, width, Math.min(task.length, Math.max(9, availableHeight - columnHeight - 1)))),
    "",
    ...actionBox
  ];
}

function renderStackedBody(
  view: SaneTuiAppView,
  width: number,
  availableHeight?: number
): string[] {
  const task = renderBox("Current job", currentTaskLines(view), width);
  if (availableHeight !== undefined && availableHeight <= task.length + 2) {
    return resizeBox(task, width, availableHeight);
  }

  const choicesHeight = availableHeight === undefined
    ? undefined
    : Math.max(6, Math.min(9, availableHeight - Math.min(task.length, Math.max(8, availableHeight - 6)) - 1));
  const choices = choicesHeight === undefined
    ? renderBox("Actions", actionRailLines(view, { maxLines: width < 64 ? 8 : 10, compactLabels: false }), width)
    : resizeBox(
        renderBox("Actions", actionRailLines(view, { maxLines: Math.max(3, choicesHeight - BOX_FRAME_HEIGHT), compactLabels: false }), width),
        width,
        choicesHeight
      );

  return [
    ...(availableHeight === undefined ? task : resizeBox(task, width, Math.min(task.length, Math.max(8, availableHeight - (choicesHeight ?? 0) - 1)))),
    "",
    ...choices
  ];
}

function currentTaskLines(view: SaneTuiAppView): string[] {
  const lines = [
    `Selected: ${view.experience.selectedTitle}`,
    "",
    ...selectedDetailLines(view)
  ];
  const whyNow = view.experience.body[0] ?? view.experience.title;
  if (whyNow) {
    lines.push("", `Why now: ${whyNow}`);
  }
  lines.push("", `Suggested next: ${view.experience.primaryActionLabel}`);
  const latest = latestStatusSummaryLine(view);
  if (latest) {
    lines.push("", latest);
  }
  lines.push("", ...selectedSafetyLines(view));
  lines.push("", `Enter: ${actionPrompt(view)}`);
  return lines;
}

function selectedSafetyLines(view: SaneTuiAppView): string[] {
  if (view.selectedAction.kind === "editor") {
    return [
      "Impact: updates local Sane config after save.",
      "Undo: reopen editor and restore previous values."
    ];
  }

  if (isReadOnlyAction(view.selectedAction)) {
    return [
      "Impact: view only. No files change.",
      "Undo: none needed."
    ];
  }

  if (view.selectedAction.repoMutation) {
    return [
      "Impact: changes this project after preview/confirm.",
      "Undo: use git diff/status and revert selected hunks."
    ];
  }

  return [
    "Impact: changes Codex setup after preview/confirm.",
    "Undo: run matching remove/reset action in this flow."
  ];
}

function selectedDetailLines(view: SaneTuiAppView): string[] {
  const lines = view.experience.selectedLines.length > 0
    ? view.experience.selectedLines
    : ["No extra details."];

  return compactLines(lines, 7).filter((line) => !line.trim().startsWith("... "));
}

function latestStatusSummaryLine(view: SaneTuiAppView): string | null {
  const latest = view.latestStatusLines[0]?.trim() ?? "";
  if (latest.length === 0 || latest.startsWith("Ready.")) {
    return null;
  }
  return `Latest: ${compactStatusSummary(latest)}`;
}

function actionPrompt(view: SaneTuiAppView): string {
  if (view.selectedAction.confirmation?.required) {
    return "review change first.";
  }
  if (view.selectedAction.kind === "editor") {
    return "open editor.";
  }
  if (isReadOnlyAction(view.selectedAction)) {
    return "inspect details.";
  }
  return view.selectedAction.repoMutation ? "preview local change." : "preview Codex change.";
}

interface ActionRailOptions {
  maxLines?: number;
  compactLabels?: boolean;
}

function actionRailLines(view: SaneTuiAppView, options: ActionRailOptions = {}): string[] {
  const compact = options.compactLabels ?? true;
  const lines = [`${view.actions.length} choices`, ""];

  const recommended = selectedActionLabel(view);
  if (recommended !== view.selectedAction.label) {
    lines.push(`Recommended: ${presentActionLabel(recommended, compact)}`);
    lines.push("");
  }

  const actionLines = view.actions.map((action) => {
    const selected = action.id === view.selectedAction.id ? ">" : " ";
    const recommendedBadge =
      action.id === view.recommendedActionId && action.id !== view.selectedAction.id ? " *" : "";
    return `${selected} ${presentActionLabel(action.label, compact)}${recommendedBadge}`;
  });

  const selectedIndex = view.actions.findIndex((action) => action.id === view.selectedAction.id);
  const visibleActionLines = options.maxLines === undefined
    ? actionLines
    : windowLinesAroundSelection(actionLines, selectedIndex, options.maxLines - lines.length);

  lines.push(...visibleActionLines);

  if (
    view.activeSection.id === "home"
    && view.attentionItems.length > 0
    && (options.maxLines === undefined || lines.length + view.attentionItems.length + 2 <= options.maxLines)
  ) {
    lines.push("");
    lines.push("Needs a Look");
    lines.push(...view.attentionItems);
  }

  return lines;
}

function detailPaneTitle(view: SaneTuiAppView): string {
  return `${view.activeSection.docLabel} / Next Move`;
}

function detailPaneLines(view: SaneTuiAppView): string[] {
  const selectedHelpLines = compactLines(
    readableHelpLines(view.selectedHelpLines),
    9
  ).filter((line) => !line.trim().startsWith("... "));
  const overviewLines = compactLines(readableOverviewLinesForText(view.sectionOverviewLines), 6)
    .filter((line) => !line.trim().startsWith("... "));
  const latestStatusLines = shouldShowLatestStatus(view.latestStatusLines)
    ? compactLines(view.latestStatusLines, 2).filter((line) => !line.trim().startsWith("... "))
    : [];

  return [
    presentActionLabel(view.selectedAction.label, false),
    "",
    ...selectedHelpLines,
    "",
    "Setup at a Glance",
    ...overviewLines,
    ...(latestStatusLines.length > 0 ? ["", view.latestStatusTitle, ...latestStatusLines] : [])
  ];
}

function shouldShowLatestStatus(lines: string[]): boolean {
  const first = lines[0] ?? "";
  return first.length > 0 && !first.startsWith("Ready.");
}

function readableHelpLines(lines: string[]): string[] {
  return lines.filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length > 0
      && !trimmed.startsWith("Files changed:")
      && !trimmed.startsWith("Visibility only")
      && !trimmed.startsWith("Use it when")
    );
  });
}

function readableOverviewLinesForText(lines: string[]): string[] {
  return readableOverviewLines(lines).map(friendlySetupLine);
}

function selectedActionLabel(view: SaneTuiAppView): string {
  return view.actions.find((action) => action.id === view.recommendedActionId)?.label ?? view.selectedAction.label;
}

function compactFocusLines(view: SaneTuiAppView): string[] {
  const selectedIndex = view.actions.findIndex((action) => action.id === view.selectedAction.id);
  const nextAction = view.actions[selectedIndex + 1] ?? null;
  const setupLines = compactHomeSetupLines(view);

  return [
    `Now: ${compactActionLabel(view.selectedAction.label)}`,
    nextAction ? `Up next: ${compactActionLabel(nextAction.label)}` : `Up next: none`,
    `Last result: ${compactStatusSummary(view.latestStatusLines[0] ?? "ready")}`,
    ...setupLines
  ];
}

function compactHomeSetupLines(view: SaneTuiAppView): string[] {
  if (view.activeSection.id !== "home") {
    return ["Use wider terminal for full detail view."];
  }

  const setup = view.sectionOverviewLines.filter((line) =>
    line.startsWith("runtime ")
    || line.startsWith("local setup ")
    || line.startsWith("codex-config ")
    || line.startsWith("codex settings ")
    || line.startsWith("Codex settings ")
    || line.startsWith("user-skills ")
    || line.startsWith("skills ")
    || line.startsWith("hooks ")
  );
  if (setup.length === 0) {
    return ["Use wider terminal for full detail view."];
  }
  return setup.slice(0, 2).map(friendlySetupLine);
}

function editorOverlayBodyLines(overlay: Extract<NonNullable<SaneTuiAppView["overlay"]>, { kind: "config" | "packs" | "privacy" }>): string[] {
  return [
    ...overlay.headerLines,
    "",
    "Fields",
    ...overlay.fieldLines,
    "",
    overlay.detailsTitle,
    ...compactLines(overlay.detailsLines, 4).filter((line) => !line.trim().startsWith("... "))
  ];
}

function renderFooter(view: SaneTuiAppView, width: number, compact: boolean): string[] {
  const keys = compact
    ? `Keys: enter ${actionPrompt(view)} | up/down move | left/right section | q quit`
    : `Keys: enter ${actionPrompt(view)} | up/down move | left/right section | q quit`;
  const focus = `Now: ${presentActionLabel(view.selectedAction.label, compact)}${view.selectedAction.id === view.recommendedActionId ? " [suggested]" : ""}`;
  const state = compact
    ? `State: local ${compactFooterStatus(view.footer.status.runtime)} cx ${compactFooterStatus(view.footer.status.codex)} sk ${compactFooterStatus(view.footer.status.user)} hk ${compactFooterStatus(view.footer.status.hooks)} dr ${compactDrift(view)}`
    : `State: ${friendlyFooterStatus(view)}`;
  return [...wrapLines(keys, width), ...wrapLines(focus, width), ...wrapLines(state, width)];
}

function friendlyFooterStatus(view: SaneTuiAppView): string {
  return [
    `local setup ${compactFooterStatus(view.footer.status.runtime)}`,
    `Codex settings ${compactFooterStatus(view.footer.status.codex)}`,
    `skills ${compactFooterStatus(view.footer.status.user)}`,
    `hooks ${compactFooterStatus(view.footer.status.hooks)}`,
    `drift ${compactDrift(view)}`
  ].join("  ");
}

function compactFooterStatus(status: string): string {
  switch (status) {
    case "installed":
      return "ok";
    case "missing":
      return "miss";
    case "invalid":
      return "bad";
    default:
      return status;
  }
}

function compactDrift(view: SaneTuiAppView): string {
  const drift = view.chips.find((chip) => chip.id === "drift")?.value ?? "unknown";
  const issueCount = drift.match(/^(\d+) issue\(s\)$/);
  return issueCount?.[1] ?? (drift === "none" ? "ok" : drift);
}

function presentActionLabel(label: string, compact: boolean): string {
  return compact ? compactActionLabel(label) : label;
}

function friendlySetupLine(line: string): string {
  if (line.startsWith("runtime ")) {
    return line.replace("runtime ", "local setup ");
  }
  if (line.startsWith("codex-config ")) {
    return line.replace("codex-config ", "Codex settings ");
  }
  if (line.startsWith("codex settings ")) {
    return line.replace("codex settings ", "Codex settings ");
  }
  if (line.startsWith("user-skills ")) {
    return line.replace("user-skills ", "skills ");
  }
  return line;
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

  if (line.includes("| > ")) {
    return ansi("7", line);
  }

  if (line.includes("| + ")) {
    return line.replace("[recommended]", ansi("33", "[recommended]"));
  }

  if (line.startsWith("| ") && line.includes("[recommended]")) {
    return line.replace("[recommended]", ansi("33", "[recommended]"));
  }

  if (line.startsWith("| ") && line.includes("Needs a look")) {
    return ansi("33", line);
  }

  if (line.startsWith("| ") && isBoxTitle(line)) {
    return ansi("1;36", line);
  }

  if (line.includes("Enter:") || line.startsWith("Keys: ")) {
    return ansi("33", line);
  }

  if (line.startsWith("+") && line.endsWith("+")) {
    return ansi("2", line);
  }

  if (index >= lineCount - 3 || line.startsWith("Sections: ") || line.startsWith("State: ")) {
    return ansi("2", line);
  }

  return styleStatusTokens(line, view);
}

function styleStatusTokens(line: string, view: SaneTuiAppView): string {
  const replacements = [
    { token: `local setup ${compactFooterStatus(view.footer.status.runtime)}`, tone: view.footer.status.runtime === "installed" ? "ok" : view.footer.status.runtime === "missing" || view.footer.status.runtime === "invalid" ? "warn" : "muted" },
    { token: `Codex settings ${compactFooterStatus(view.footer.status.codex)}`, tone: view.footer.status.codex === "installed" ? "ok" : view.footer.status.codex === "missing" || view.footer.status.codex === "invalid" ? "warn" : "muted" },
    { token: `skills ${compactFooterStatus(view.footer.status.user)}`, tone: view.footer.status.user === "installed" ? "ok" : view.footer.status.user === "missing" || view.footer.status.user === "invalid" ? "warn" : "muted" },
    { token: `hooks ${compactFooterStatus(view.footer.status.hooks)}`, tone: view.footer.status.hooks === "installed" ? "ok" : view.footer.status.hooks === "missing" || view.footer.status.hooks === "invalid" ? "warn" : "muted" }
  ] as const;

  return replacements.reduce((styled, item) => (
    styled.includes(item.token)
      ? styled.replace(item.token, ansi(statusToneCode(item.tone), item.token))
      : styled
  ), line);
}

function isBoxTitle(line: string): boolean {
  const content = line.slice(2, -2).trim();
  return (
    content === "Current job" ||
    content === "Choices" ||
    content === "State" ||
    content.endsWith("Details") ||
    content.endsWith("Next Move") ||
    content.startsWith("[Overlay: ") ||
    content === "Confirm" ||
    content === "Model Defaults" ||
    content === "Guidance Options" ||
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

function isCompactViewport(width: number, height: number | undefined): boolean {
  return width < 72 || Boolean(height && height <= 18);
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
