import { type Instance, type Key, type RenderOptions } from "ink";

import { loadAppView, type SaneTuiAppView } from "@sane/sane-tui/app-view.js";
import { type TextTuiRuntime } from "@sane/sane-tui/text-driver.js";
import { type TuiInputKey } from "@sane/sane-tui/input-driver.js";
import { compactLines } from "@sane/sane-tui/result-panel.js";
import { compactActionLabel } from "@sane/sane-tui/presentation-normalizer.js";

export type InkTuiInputKey = TuiInputKey | "quit";

export function inkInputToTuiKey(input: string, key: Key): InkTuiInputKey | null {
  if (input === "q" || (input === "c" && key.ctrl)) {
    return "quit";
  }
  if (key.upArrow || input === "k") {
    return "up";
  }
  if (key.downArrow || input === "j") {
    return "down";
  }
  if (key.leftArrow) {
    return "left";
  }
  if (key.rightArrow) {
    return "right";
  }
  if (key.tab) {
    return key.shift ? "backtab" : "tab";
  }
  if (key.return) {
    return "enter";
  }
  if (key.escape) {
    return "escape";
  }
  if (input === " ") {
    return "space";
  }
  if (input === "r" || input === "d" || input === "y" || input === "n") {
    return input;
  }
  return null;
}

export function inkRenderOptions(): RenderOptions {
  return {
    alternateScreen: true,
    exitOnCtrlC: false,
    interactive: true,
    patchConsole: true
  };
}

export async function startInkTerminalLoop(
  runtime: TextTuiRuntime,
  options: RenderOptions = {}
): Promise<Instance> {
  const React = await import("react");
  const { Box, Text, render, useApp, useInput, useStdout } = await import("ink");

  type InkNode = ReturnType<typeof React.createElement>;

  function SaneInkTerminalApp() {
    const { exit } = useApp();
    const { stdout } = useStdout();
    const [, setVersion] = React.useState(0);
    const view = loadAppView(runtime.app.shell);
    const width = stdout.columns ?? 100;
    const height = stdout.rows ?? 30;

    useInput((input, key) => {
      const mapped = inkInputToTuiKey(input, key);
      if (!mapped) {
        return;
      }
      if (mapped === "quit") {
        exit();
        return;
      }
      runtime.handleInput(mapped);
      setVersion((version) => version + 1);
    });

    return React.createElement(InkShell, { view, width, height });
  }

  function InkShell({ view, width, height }: { view: SaneTuiAppView; width: number; height: number }): InkNode {
    const compact = width < 92 || height < 24;
    return React.createElement(
      Box,
      { flexDirection: "column", paddingX: 1, width, height },
      React.createElement(Header, { view, compact }),
      view.overlay
        ? React.createElement(OverlayWindow, { view, width, height })
        : React.createElement(MainWindows, { view, width, height, compact }),
      React.createElement(Footer, { view, compact })
    );
  }

  function Header({ view, compact }: { view: SaneTuiAppView; compact: boolean }): InkNode {
    return React.createElement(
      Box,
      { flexDirection: "column", marginBottom: 1 },
      React.createElement(
        Box,
        { justifyContent: "space-between" },
        React.createElement(Text, { bold: true, color: "cyan" }, `Sane / ${view.activeSection.docLabel}`),
        !compact && React.createElement(Text, { color: "gray" }, view.projectLabel)
      ),
      React.createElement(TabBar, { view }),
      React.createElement(StatusChips, { view, compact })
    );
  }

  function TabBar({ view }: { view: SaneTuiAppView }): InkNode {
    return React.createElement(
      Box,
      { gap: 1 },
      ...view.tabs.items.map((tab) =>
        React.createElement(
          Text,
          {
            key: tab.id,
            color: tab.id === view.tabs.selected ? "black" : "gray",
            backgroundColor: tab.id === view.tabs.selected ? "cyan" : undefined,
            bold: tab.id === view.tabs.selected
          },
          tab.id === view.tabs.selected ? ` ${tab.label} ` : tab.label
        )
      )
    );
  }

  function StatusChips({ view, compact }: { view: SaneTuiAppView; compact: boolean }): InkNode {
    const ids = compact
      ? ["runtime", "codex-config", "drift"]
      : ["runtime", "codex-config", "user-skills", "hooks", "drift"];
    return React.createElement(
      Box,
      { gap: 1 },
      ...view.chips
        .filter((chip) => ids.includes(chip.id))
        .map((chip) =>
          React.createElement(
            Text,
            { key: chip.id, color: chipColor(chip.tone) },
            `${compactChipLabel(chip.id, chip.label)} ${chip.value}`
          )
        )
    );
  }

  function MainWindows({
    view,
    width,
    height,
    compact
  }: {
    view: SaneTuiAppView;
    width: number;
    height: number;
    compact: boolean;
  }): InkNode {
    const bodyHeight = Math.max(compact ? 14 : 20, height - 6);
    const actionWidth = compact ? width - 2 : Math.max(36, Math.min(48, Math.floor(width * 0.25)));
    if (compact) {
      return React.createElement(
        Box,
        { flexDirection: "column", flexGrow: 1, height: bodyHeight },
        React.createElement(FocusWindow, { view, height: bodyHeight, compact })
      );
    }

    return React.createElement(
      Box,
      { gap: 1, flexGrow: 1, height: bodyHeight },
      React.createElement(ActionWindow, { view, width: actionWidth, height: bodyHeight }),
      React.createElement(FocusWindow, { view, height: bodyHeight, compact })
    );
  }

  function ActionWindow({ view, width, height }: { view: SaneTuiAppView; width: number; height: number }): InkNode {
    const selectedIndex = Math.max(0, view.actions.findIndex((action) => action.id === view.selectedAction.id));
    const slots = Math.max(4, height - 4);
    const actions = windowAround(view.actions, selectedIndex, slots);
    const labelWidth = Math.max(8, width - 5);
    return React.createElement(
      Box,
      {
        borderStyle: "round",
        borderColor: "cyan",
        flexDirection: "column",
        paddingX: 1,
        width,
        height
      },
      React.createElement(Text, { bold: true, color: "cyan" }, "Actions"),
      ...actions.map((action, index) =>
        action === null
          ? React.createElement(Text, { key: `ellipsis-${index}`, color: "gray" }, "...")
          : React.createElement(
              Text,
              {
                key: action.id,
                color: action.id === view.selectedAction.id ? "black" : action.id === view.recommendedActionId ? "yellow" : undefined,
                backgroundColor: action.id === view.selectedAction.id ? "cyan" : undefined,
                bold: action.id === view.selectedAction.id,
                wrap: "truncate-end"
              },
              truncateEnd(
                `${action.id === view.selectedAction.id ? "> " : "  "}${compactActionLabel(action.label)}${action.id === view.recommendedActionId ? " *" : ""}`,
                labelWidth
              )
            )
      )
    );
  }

  function FocusWindow({ view, height, compact }: { view: SaneTuiAppView; height: number; compact: boolean }): InkNode {
    const help = focusHelpLines(view.selectedAction, compact ? 4 : 7);
    const snapshot = focusSnapshotLines(view.sectionOverviewLines, compact ? 3 : 6);
    return React.createElement(
      Box,
      {
        borderStyle: "round",
        borderColor: "blue",
        flexDirection: "column",
        paddingX: 1,
        flexGrow: 1,
        height
      },
      React.createElement(
        Box,
        { flexDirection: "column", marginBottom: 1 },
        React.createElement(Text, { bold: true, color: "blue" }, `${view.activeSection.docLabel} Focus`),
        React.createElement(Text, { bold: true, wrap: "truncate-end" }, view.selectedAction.label)
      ),
      React.createElement(
        Box,
        { flexDirection: "column", marginBottom: 1 },
        ...help.map((line, index) => React.createElement(Text, { key: `help-${index}`, wrap: "truncate-end" }, line))
      ),
      React.createElement(
        Box,
        { marginBottom: 1 },
        React.createElement(Text, { color: "gray" }, focusActionHint(view.selectedAction))
      ),
      React.createElement(
        Box,
        { flexDirection: "column" },
        React.createElement(Text, { bold: true, color: "cyan" }, "Snapshot"),
        ...snapshot.map((line, index) =>
          React.createElement(Text, { key: `snapshot-${index}`, color: "gray", wrap: "truncate-end" }, line)
        )
      )
    );
  }

  function OverlayWindow({ view, width, height }: { view: SaneTuiAppView; width: number; height: number }): InkNode {
    const overlay = view.overlay!;
    if (overlay.kind !== "confirm" && overlay.kind !== "notice") {
      const modalWidth = computeOverlayWidth(width, 70, 6, 120);
      const compactEditor = width < 110;
      if (compactEditor) {
        const lineWidth = Math.max(20, modalWidth - 8);
        return React.createElement(
          Box,
          { justifyContent: "center", height: Math.max(18, height - 6) },
          React.createElement(
            Box,
            {
              borderStyle: "double",
              borderColor: "cyan",
              flexDirection: "column",
              paddingX: 2,
              width: modalWidth,
              minHeight: Math.min(Math.max(18, height - 8), 28)
            },
            React.createElement(Text, { bold: true, color: "cyan" }, overlay.title),
            ...overlay.headerLines.slice(1).map((line, index) =>
              React.createElement(Text, { key: `editor-header-${index}`, color: "gray", wrap: "truncate-end" }, line)
            ),
            React.createElement(Text, {}, ""),
            React.createElement(Text, { bold: true, color: "cyan" }, "Fields"),
            ...overlay.fieldLines.map((line, index) =>
              React.createElement(Text, {
                key: `editor-field-${index}`,
                color: line.startsWith("> ") ? "black" : undefined,
                backgroundColor: line.startsWith("> ") ? "cyan" : undefined,
                bold: line.startsWith("> "),
                wrap: "truncate-end"
              }, truncateEnd(line, lineWidth))
            ),
            React.createElement(Text, {}, ""),
            React.createElement(Text, { bold: true, color: "blue" }, overlay.detailsTitle),
            ...limitWithoutOverflowMarker(overlay.detailsLines, 4).map((line, index) =>
              React.createElement(Text, { key: `editor-help-${index}`, color: index > 2 ? "gray" : undefined, wrap: "truncate-end" }, line)
            )
          )
        );
      }
      const fieldWidth = Math.max(28, Math.min(54, Math.floor(modalWidth * 0.45)));
      return React.createElement(
        Box,
        { justifyContent: "center", height: Math.max(18, height - 6) },
        React.createElement(
          Box,
          {
            borderStyle: "double",
            borderColor: "cyan",
            flexDirection: "column",
            paddingX: 2,
            width: modalWidth,
            minHeight: Math.min(Math.max(18, height - 8), 28)
          },
          React.createElement(Text, { bold: true, color: "cyan" }, overlay.title),
          ...overlay.headerLines.slice(1).map((line, index) =>
            React.createElement(Text, { key: `editor-header-${index}`, color: "gray", wrap: "truncate-end" }, line)
          ),
          React.createElement(Text, {}, ""),
          React.createElement(
            Box,
            { gap: 2 },
            React.createElement(
              Box,
              { flexDirection: "column", width: fieldWidth },
              React.createElement(Text, { bold: true, color: "cyan" }, "Fields"),
              ...overlay.fieldLines.map((line, index) =>
                React.createElement(Text, {
                  key: `editor-field-${index}`,
                  color: line.startsWith("> ") ? "black" : undefined,
                  backgroundColor: line.startsWith("> ") ? "cyan" : undefined,
                  bold: line.startsWith("> "),
                  wrap: "truncate-end"
                }, truncateEnd(line, fieldWidth - 2))
              )
            ),
            React.createElement(
              Box,
              { flexDirection: "column", flexGrow: 1 },
              React.createElement(Text, { bold: true, color: "blue" }, overlay.detailsTitle),
              ...limitWithoutOverflowMarker(overlay.detailsLines, Math.max(8, height - 14)).map((line, index) =>
                React.createElement(Text, { key: `editor-help-${index}`, color: index > 2 ? "gray" : undefined, wrap: "truncate-end" }, line)
              )
            )
          )
        )
      );
    }
    const body =
      overlay.kind === "confirm"
        ? [overlay.header, "", ...overlay.bodyLines, "", overlay.footer]
        : [...overlay.bodyLines, "", overlay.footer];
    return React.createElement(
      Box,
      { justifyContent: "center", height: Math.max(12, height - 6) },
      React.createElement(
        Box,
        {
          borderStyle: "double",
          borderColor: overlay.kind === "confirm" ? "yellow" : "cyan",
          flexDirection: "column",
          paddingX: 2,
          width: computeOverlayWidth(width, 50, 6, 96)
        },
        React.createElement(Text, { bold: true, color: overlay.kind === "confirm" ? "yellow" : "cyan" }, overlay.title),
        ...compactLines(body, 16).map((line, index) =>
          React.createElement(Text, { key: `overlay-${index}`, wrap: "truncate-end" }, line)
        )
      )
    );
  }

  function Footer({ view, compact }: { view: SaneTuiAppView; compact: boolean }): InkNode {
    return React.createElement(
      Box,
      { marginTop: 1, justifyContent: "space-between" },
      React.createElement(Text, { color: "gray" }, compact ? "tab sections  enter run  q quit" : view.mode.hint),
      !compact && React.createElement(Text, { color: "gray" }, view.mode.label)
    );
  }

  return render(
    React.createElement(SaneInkTerminalApp),
    {
      ...inkRenderOptions(),
      ...options
    }
  );
}

type FocusAction = SaneTuiAppView["selectedAction"];

export function focusHelpLines(action: FocusAction, maxLines: number): string[] {
  return limitWithoutOverflowMarker(
    [
      actionImpactSummary(action),
      ...action.help.map((line) => line.trim()).filter((line) => line.length > 0)
    ],
    maxLines
  );
}

export function focusSnapshotLines(lines: string[], maxLines: number): string[] {
  return addSnapshotSpacing(prioritizeSnapshotLines(readableOverviewLines(lines), maxLines));
}

function prioritizeSnapshotLines(lines: string[], maxLines: number): string[] {
  const setupIndex = lines.indexOf("Current setup");
  if (setupIndex >= 0 && maxLines <= 4) {
    const title = lines[0] ? [lines[0]] : [];
    const status = lines.slice(setupIndex + 1, setupIndex + Math.max(2, maxLines - title.length + 1));
    return limitWithoutOverflowMarker([...title, "Current setup", ...status], maxLines);
  }

  return limitWithoutOverflowMarker(lines, maxLines);
}

function limitWithoutOverflowMarker(lines: string[], maxLines: number): string[] {
  return lines.filter((line) => !line.trim().startsWith("... ")).slice(0, maxLines);
}

function readableOverviewLines(lines: string[]): string[] {
  return lines.filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length > 0
      && !trimmed.startsWith("...")
      && !trimmed.startsWith("latest event")
      && !trimmed.startsWith("latest decision")
      && !trimmed.startsWith("latest artifact")
      && !trimmed.startsWith("runtime history")
      && !trimmed.startsWith("runtime summary")
    );
  });
}

function addSnapshotSpacing(lines: string[]): string[] {
  const spaced: string[] = [];
  lines.forEach((line, index) => {
    spaced.push(line);
    if ((index === 1 || line === "Guided flow") && index < lines.length - 1) {
      spaced.push("");
    }
  });
  return spaced;
}

function actionImpactSummary(action: FocusAction): string {
  if (action.kind === "editor") {
    return "Changes local Sane settings after you save.";
  }

  if (isReadOnlyAction(action)) {
    return "Opens details. No files change.";
  }

  return action.repoMutation
    ? "Changes this repo or Sane project files."
    : "Changes your Codex setup. Preview or confirmation appears first when needed.";
}

function focusActionHint(action: FocusAction): string {
  if (action.confirmation?.required) {
    return "Enter opens confirmation.";
  }

  if (action.kind === "editor") {
    return "Enter opens editor.";
  }

  if (isReadOnlyAction(action)) {
    return "Enter opens details.";
  }

  return "Enter runs this action.";
}

function isReadOnlyAction(action: FocusAction): boolean {
  return (
    action.id === "show_status"
    || action.id === "doctor"
    || action.id === "show_runtime_summary"
    || action.id === "show_config"
    || action.id === "show_codex_config"
    || action.id === "show_outcome_readiness"
    || action.id.startsWith("preview_")
  );
}

function windowAround<T>(items: T[], selectedIndex: number, slots: number): Array<T | null> {
  if (items.length <= slots) {
    return items;
  }
  const innerSlots = Math.max(1, slots - 2);
  const start = Math.max(0, Math.min(items.length - innerSlots, selectedIndex - Math.floor(innerSlots / 2)));
  const end = Math.min(items.length, start + innerSlots);
  return [
    ...(start > 0 ? [null] : []),
    ...items.slice(start, end),
    ...(end < items.length ? [null] : [])
  ];
}

export function computeOverlayWidth(
  viewportWidth: number,
  minWidth: number,
  inset: number,
  maxWidth: number
): number {
  const safeViewportWidth = Math.max(20, viewportWidth);
  const usableWidth = Math.max(20, safeViewportWidth - Math.max(0, inset));
  return Math.min(safeViewportWidth, Math.max(20, Math.min(maxWidth, Math.max(minWidth, usableWidth))));
}

export function truncateEnd(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) {
    return text;
  }

  if (maxWidth <= 3) {
    return text.slice(0, maxWidth);
  }

  return `${text.slice(0, maxWidth - 3)}...`;
}

function chipColor(tone: SaneTuiAppView["chips"][number]["tone"]): "green" | "yellow" | "gray" {
  switch (tone) {
    case "ok":
      return "green";
    case "warn":
      return "yellow";
    case "muted":
      return "gray";
  }
}

function compactChipLabel(id: string, label: string): string {
  switch (id) {
    case "codex-config":
      return "codex";
    case "user-skills":
      return "skills";
    default:
      return label.toLowerCase();
  }
}
