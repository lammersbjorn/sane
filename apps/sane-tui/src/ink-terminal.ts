import { type Instance, type Key, type RenderOptions } from "ink";

import { loadAppView, type SaneTuiAppView } from "@sane/sane-tui/app-view.js";
import { type TextTuiRuntime } from "@sane/sane-tui/text-driver.js";
import { type TuiInputKey } from "@sane/sane-tui/input-driver.js";
import { parseTerminalInput } from "@sane/sane-tui/terminal-keys.js";
import { compactLines } from "@sane/sane-tui/result-panel.js";
import { isReadOnlyAction } from "./tui-action-semantics.js";
import { readableOverviewLines, windowLinesAroundSelection } from "./tui-lines.js";
import {
  computeOverlayWidth,
  limitWithoutOverflowMarker,
  planInkEditorOverlay,
  planInkFocusedLayout,
  planSectionTabs,
  truncateEnd,
  wrapForInk
} from "./ink-terminal-layout.js";
import type { InkSectionTabItem } from "./ink-terminal-layout.js";

export type {
  InkEditorOverlayLayout,
  InkFocusedLayoutPlan,
  InkSectionTabItem,
  InkSectionTabsPlan
} from "./ink-terminal-layout.js";
export {
  computeOverlayWidth,
  limitWithoutOverflowMarker,
  planInkEditorOverlay,
  planInkFocusedLayout,
  planSectionTabs,
  truncateEnd,
  wrapForInk,
  wrapInkLine
} from "./ink-terminal-layout.js";

export type InkTuiInputKey = TuiInputKey | "quit";

export function inkInputToTuiKeys(input: string, key: Key): InkTuiInputKey[] {
  const parsedInput = input.length > 1 || input.startsWith("\u001b")
    ? parseTerminalInput(input)
    : [];
  if (parsedInput.length > 0) {
    return parsedInput;
  }

  const mapped = inkInputToTuiKey(input, key);
  return mapped ? [mapped] : [];
}

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
  if (input === "r" || input === "d" || input === "y" || input === "n" || input === "g" || input === "G" || input === "?") {
    return input as TuiInputKey;
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

    React.useEffect(() => {
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const handleResize = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          stdout.write?.("\u001b[2J\u001b[H");
          setVersion((version) => version + 1);
        }, 80);
      };
      stdout.on?.("resize", handleResize);
      return () => {
        stdout.off?.("resize", handleResize);
        if (resizeTimer) clearTimeout(resizeTimer);
      };
    }, [stdout]);

    useInput((input, key) => {
      const mappedKeys = inkInputToTuiKeys(input, key);
      if (mappedKeys.length === 0) {
        return;
      }
      for (const mapped of mappedKeys) {
        if (mapped === "quit") {
          exit();
          return;
        }
        runtime.handleInput(mapped);
      }
      setVersion((version) => version + 1);
    });

    return React.createElement(InkShell, { view, width, height });
  }

  function InkShell({ view, width, height }: { view: SaneTuiAppView; width: number; height: number }): InkNode {
    const compact = width < 92 || height < 24;
    const innerWidth = Math.max(20, width - 2);
    const tight = height < 20;
    const headerHeight = tight ? 2 : 4;
    const footerHeight = tight ? 1 : 3;
    const bodyHeight = Math.max(tight ? 3 : 6, height - headerHeight - footerHeight);
    return React.createElement(
      Box,
      { flexDirection: "column", paddingX: 1, width, height },
      React.createElement(Header, { view, compact, tight, width: innerWidth }),
      view.overlay
        ? React.createElement(OverlayWindow, { view, width: innerWidth, height: bodyHeight })
        : React.createElement(MainWindows, { view, width: innerWidth, height: bodyHeight, compact }),
      React.createElement(Footer, { view, compact, tight, width: innerWidth })
    );
  }

  function Header({ view, compact, tight, width }: { view: SaneTuiAppView; compact: boolean; tight: boolean; width: number }): InkNode {
    const title = compact ? `${view.title} / ${view.activeSection.docLabel}` : `${view.title} / ${view.activeSection.docLabel} / ${view.projectLabel}`;
    const label = compact || tight ? title : `${title}  -  ${view.experience.title}`;
    return React.createElement(
      Box,
      { flexDirection: "column", marginBottom: tight ? 0 : 1 },
      React.createElement(Text, { bold: true, color: "cyan" }, truncateEnd(label, width)),
      React.createElement(SectionTabs, { view, width }),
      !tight && React.createElement(ChipsRow, { chips: view.chips, width })
    );
  }

  function ChipsRow({ chips, width }: { chips: SaneTuiAppView["chips"]; width: number }): InkNode {
    const elements: InkNode[] = [];
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i]!;
      const toneColor = chip.tone === "ok" ? "green" : chip.tone === "warn" ? "yellow" : "gray";
      if (i > 0) {
        elements.push(React.createElement(Text, { key: `chip-sep-${i}`, color: "gray" }, " · "));
      }
      elements.push(React.createElement(Text, { key: `chip-${chip.id}`, color: toneColor }, `${chip.label}: ${chip.value}`));
    }
    return React.createElement(Box, { flexDirection: "row", flexWrap: "wrap", width }, ...elements);
  }

  function SectionTabs({ view, width }: { view: SaneTuiAppView; width: number }): InkNode {
    const plan = planSectionTabs(view.tabs.items, view.tabs.selected, width);
    if (plan.mode === "current") {
      return React.createElement(
        Box,
        { width, overflow: "hidden" },
        renderTabCell(plan.current, true, "current", width)
      );
    }

    if (plan.mode === "neighbors") {
      return React.createElement(
        Box,
        { width, overflow: "hidden" },
        React.createElement(Text, { color: "gray" }, "< "),
        renderTabCell(plan.previous, false, "previous"),
        React.createElement(Text, { color: "gray" }, " "),
        renderTabCell(plan.current, true, "current"),
        React.createElement(Text, { color: "gray" }, " "),
        renderTabCell(plan.next, false, "next"),
        React.createElement(Text, { color: "gray" }, " >")
      );
    }

    return React.createElement(
      Box,
      { width, overflow: "hidden" },
      ...plan.items.flatMap((item, index) => {
        const displayLabel = item.id === "home" && view.attentionItems.length > 0
          ? `${item.label} ●`
          : item.label;
        return [
          ...(index > 0 ? [React.createElement(Text, { key: `tab-gap-${item.id}`, color: "gray" }, " ")] : []),
          renderTabCell({ ...item, label: displayLabel }, item.active, item.id)
        ];
      })
    );
  }

  function renderTabCell(item: InkSectionTabItem, active: boolean, key: string, maxWidth?: number): InkNode {
    const label = maxWidth ? truncateEnd(item.label, Math.max(1, maxWidth - (active ? 4 : 2))) : item.label;
    return React.createElement(
      Text,
      {
        key,
        color: active ? "black" : "gray",
        backgroundColor: active ? "cyan" : undefined,
        bold: active
      },
      active ? ` [${label}] ` : ` ${label} `
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
    return React.createElement(
      Box,
      { flexDirection: "column", width },
      React.createElement(FocusedJobWindow, { view, width, height })
    );
  }

  function FocusedJobWindow({ view, width, height }: { view: SaneTuiAppView; width: number; height: number }): InkNode {
    const plan = planInkFocusedLayout(width, height);

    if (plan.mode === "wide") {
      return React.createElement(
        Box,
        { flexDirection: "column", width, height },
        React.createElement(
          Box,
          { gap: 2, width, height: plan.topHeight },
          React.createElement(ActionListPane, { view, width: plan.actionWidth, height: plan.topHeight, fill: true }),
          React.createElement(SelectedMovePane, { view, width: plan.detailWidth, height: plan.topHeight, fill: true })
        ),
        plan.contextHeight >= 7
          ? React.createElement(ContextPanelsPane, { view, width, height: plan.contextHeight })
          : null
      );
    }

    if (plan.mode === "list-only") {
      return React.createElement(ActionListPane, { view, width, height: plan.actionHeight, fill: true });
    }

    return React.createElement(
      Box,
      { flexDirection: "column", width, height },
      React.createElement(SelectedMovePane, { view, width, height: plan.detailHeight, fill: true }),
      React.createElement(Box, { height: 1 }),
      React.createElement(ActionListPane, { view, width, height: plan.actionHeight, fill: true })
    );
  }

  function SelectedMovePane({
    view,
    width,
    height,
    fill = false
  }: {
    view: SaneTuiAppView;
    width: number;
    height: number;
    fill?: boolean;
  }): InkNode {
    const lineWidth = Math.max(18, width - 6);
    const detailCopy = selectedMoveDetailLines(view);
    const detailLines = wrapForInk(
      [
        `${actionIconForCommand(view.selectedAction.id)} ${view.experience.selectedTitle}`,
        "",
        ...detailCopy,
        "",
        ...actionSafetyLines(view.selectedAction),
        "",
        focusActionHint(view.selectedAction)
      ],
      lineWidth
    );
    const paneHeight = fill ? height : Math.min(height, Math.max(8, Math.min(detailLines.length + 4, 14)));
    const verticalPadding = paneVerticalPadding(paneHeight);
    const detailLineLimit = Math.max(1, paneHeight - 3 - (verticalPadding * 2));

    return React.createElement(
      Box,
      {
        borderStyle: "round",
        borderColor: "cyan",
        flexDirection: "column",
        paddingX: 2,
        paddingY: verticalPadding,
        width,
        height: paneHeight
      },
      React.createElement(Text, { bold: true, color: "cyan" }, view.selectedAction.label),
      ...limitWithoutOverflowMarker(detailLines, detailLineLimit).map((line, index) =>
        React.createElement(Text, {
          key: `selected-${index}`,
          color: selectedMoveLineColor(line, index),
          bold: index === 0 || line.startsWith("Will:") || line.startsWith("Undo:")
        }, line)
      )
    );
  }

  function ActionListPane({
    view,
    width,
    height,
    fill = false
  }: {
    view: SaneTuiAppView;
    width: number;
    height: number;
    fill?: boolean;
  }): InkNode {
    const actionLines = experienceActionLines(view, Math.max(5, height - 5));
    const labelWidth = Math.max(8, width - 4);
    const paneHeight = fill ? height : Math.min(height, Math.max(8, Math.min(actionLines.length + 4, 20)));
    const verticalPadding = paneVerticalPadding(paneHeight);
    const actionLineLimit = Math.max(1, paneHeight - 3 - (verticalPadding * 2));

    const M = view.actions.length;
    const N = Math.max(1, view.actions.findIndex(a => a.id === view.selectedAction.id) + 1);
      return React.createElement(
        Box,
        {
          borderStyle: "round",
          borderColor: "gray",
          flexDirection: "column",
          paddingX: 1,
          paddingY: verticalPadding,
          width,
          height: paneHeight
        },
        React.createElement(Text, { bold: true, color: "cyan" }, `Actions (${N}/${M})`),
      ...limitWithoutOverflowMarker(actionLines, actionLineLimit).map((line, index) =>
        React.createElement(Text, {
          key: `action-line-${index}`,
          color: actionLineColor(line),
          backgroundColor: line.startsWith("> ") ? "cyan" : undefined,
          bold: line.startsWith("> ") || isActionGroupLine(line)
        }, line.startsWith("> ") ? truncateEnd(line, labelWidth) : truncateEnd(line, labelWidth))
      )
    );
  }

  function ContextPanelsPane({ view, width, height }: { view: SaneTuiAppView; width: number; height: number }): InkNode {
    const panelWidth = Math.max(26, Math.floor((width - 2) / Math.max(1, Math.min(2, view.experience.panels.length))));
    const panels = view.experience.panels.slice(0, 2);
    return React.createElement(
      Box,
      { gap: 2, width, height, marginTop: 1 },
      ...panels.map((panel, panelIndex) =>
        React.createElement(
          Box,
          {
            key: `context-panel-${panel.title}`,
            borderStyle: "single",
            borderColor: panelIndex === 0 ? "blue" : "gray",
            flexDirection: "column",
            paddingX: 1,
            width: panels.length === 1 ? width : panelWidth,
            height
          },
          React.createElement(Text, { bold: true, color: panelIndex === 0 ? "blue" : "gray" }, panel.title),
          ...wrapForInk(panel.lines.slice(0, Math.max(2, height - 3)), Math.max(14, panelWidth - 4))
            .slice(0, Math.max(1, height - 3))
            .map((line, index) => React.createElement(Text, { key: `context-${panelIndex}-${index}`, color: "gray" }, line))
        )
      )
    );
  }

  function OverlayWindow({ view, width, height }: { view: SaneTuiAppView; width: number; height: number }): InkNode {
    const overlay = view.overlay!;
    // Help overlay (HelpOverlayModel type added by overlay-models.ts)
    if (overlay.kind === "help") {
      const helpOverlay = overlay;
      const modalWidth = computeOverlayWidth(width, 52, 4, 80);
      const modalHeight = Math.min(height, Math.max(10, 4 + helpOverlay.sections.reduce((sum, s) => sum + 2 + s.rows.length, 0)));
      const bodyLimit = Math.max(0, modalHeight - 4);
      const helpLines = helpOverlay.sections.flatMap((section) => [
          { kind: "heading" as const, text: section.heading },
          ...section.rows.map(([key, desc]) => ({ kind: "row" as const, key, desc }))
        ]);
      const bodyLines = bodyLimit > 0 && helpLines.length > bodyLimit
        ? [...helpLines.slice(0, Math.max(0, bodyLimit - 1)), "..."]
        : helpLines.slice(0, bodyLimit);
      return React.createElement(
        Box,
        { justifyContent: "center", height },
        React.createElement(
          Box,
          {
            borderStyle: "double",
            borderColor: "cyan",
            flexDirection: "column",
            paddingX: 2,
            paddingY: 1,
            width: modalWidth,
            height: modalHeight
          },
          React.createElement(Text, { bold: true, color: "cyan" }, helpOverlay.title),
          React.createElement(Text, {}, ""),
          ...bodyLines.map((line, index) =>
            typeof line === "string"
              ? React.createElement(Text, { key: `help-more-${index}`, color: "gray" }, line)
              : line.kind === "heading"
                ? React.createElement(Text, { key: `help-heading-${index}`, bold: true, color: "blue" }, line.text)
                : (
              React.createElement(
                Box,
                { key: `help-row-${index}` },
                React.createElement(Text, { color: "cyan" }, line.key.padEnd(14)),
                React.createElement(Text, { color: "gray" }, line.desc)
              )
            )
          ),
          React.createElement(Text, {}, ""),
          React.createElement(Text, { color: "gray" }, "? or esc closes")
        )
      );
    }
    if (overlay.kind !== "confirm" && overlay.kind !== "notice") {
      const layout = planInkEditorOverlay(width, height);
      if (layout.compactEditor) {
        const lineWidth = Math.max(20, layout.modalWidth - 8);
        return React.createElement(
          Box,
          { justifyContent: "center", height: layout.modalHeight },
          React.createElement(
            Box,
            {
              borderStyle: "double",
              borderColor: "cyan",
              flexDirection: "column",
              paddingX: 2,
              width: layout.modalWidth,
              height: layout.modalHeight
            },
            React.createElement(Text, { bold: true, color: "cyan" }, overlay.title),
            ...overlay.headerLines.slice(1, 1 + layout.headerSlots).map((line, index) =>
              React.createElement(Text, { key: `editor-header-${index}`, color: "gray" }, truncateEnd(line, lineWidth))
            ),
            React.createElement(Text, { bold: true, color: "cyan" }, "Fields"),
            ...windowLinesAroundSelection(
              overlay.fieldLines,
              Math.max(0, overlay.fieldLines.findIndex((line) => line.startsWith("> "))),
              layout.fieldSlots
            ).map((line, index) =>
              React.createElement(Text, {
                key: `editor-field-${index}`,
                color: line.startsWith("> ") ? "black" : undefined,
                backgroundColor: line.startsWith("> ") ? "cyan" : undefined,
                bold: line.startsWith("> ")
              }, truncateEnd(line, lineWidth))
            ),
            layout.showHelp ? React.createElement(Text, { bold: true, color: "blue" }, overlay.detailsTitle) : null,
            ...(layout.showHelp
              ? limitWithoutOverflowMarker(wrapForInk(overlay.detailsLines, lineWidth), layout.detailSlots).map((line, index) =>
                  React.createElement(Text, { key: `editor-help-${index}`, color: "gray" }, line)
                )
              : [])
          )
        );
      }
      const fieldWidth = Math.max(28, Math.min(54, Math.floor(layout.modalWidth * 0.45)));
      return React.createElement(
        Box,
        { justifyContent: "center", height: layout.modalHeight },
        React.createElement(
          Box,
          {
            borderStyle: "double",
            borderColor: "cyan",
            flexDirection: "column",
            paddingX: 2,
            width: layout.modalWidth,
            height: layout.modalHeight
          },
          React.createElement(Text, { bold: true, color: "cyan" }, overlay.title),
          ...overlay.headerLines.slice(1, 1 + layout.headerSlots).map((line, index) =>
            React.createElement(Text, { key: `editor-header-${index}`, color: "gray" }, truncateEnd(line, layout.modalWidth - 6))
          ),
          React.createElement(Text, {}, ""),
          React.createElement(
            Box,
            { gap: 2, height: layout.contentHeight },
            React.createElement(
              Box,
              { flexDirection: "column", width: fieldWidth, height: layout.contentHeight },
              React.createElement(Text, { bold: true, color: "cyan" }, "Fields"),
              ...windowLinesAroundSelection(
                overlay.fieldLines,
                Math.max(0, overlay.fieldLines.findIndex((line) => line.startsWith("> "))),
                layout.fieldSlots
              ).map((line, index) =>
                React.createElement(Text, {
                  key: `editor-field-${index}`,
                  color: line.startsWith("> ") ? "black" : undefined,
                  backgroundColor: line.startsWith("> ") ? "cyan" : undefined,
                  bold: line.startsWith("> ")
                }, truncateEnd(line, fieldWidth - 2))
              )
            ),
            React.createElement(
              Box,
              { flexDirection: "column", flexGrow: 1, height: layout.contentHeight },
              React.createElement(Text, { bold: true, color: "blue" }, overlay.detailsTitle),
              ...limitWithoutOverflowMarker(
                wrapForInk(overlay.detailsLines, Math.max(24, layout.modalWidth - fieldWidth - 8)),
                layout.detailSlots
              ).map((line, index) =>
                React.createElement(Text, { key: `editor-help-${index}`, color: index > 2 ? "gray" : undefined }, line)
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
    const modalWidth = computeOverlayWidth(width, Math.min(64, Math.max(34, width - 4)), 4, 92);
    const lineWidth = Math.max(20, modalWidth - 6);
    const wrappedBody = wrapForInk(body, lineWidth);
    const modalHeight = Math.max(4, Math.min(height, Math.min(14, wrappedBody.length + 4)));
    const bodyLines = limitWithoutOverflowMarker(wrappedBody, Math.max(3, modalHeight - 4));
    return React.createElement(
      Box,
      { justifyContent: "center", height },
      React.createElement(
        Box,
        {
          borderStyle: "double",
          borderColor: overlay.kind === "confirm" ? "yellow" : "cyan",
          flexDirection: "column",
          paddingX: 2,
          paddingY: 1,
          width: modalWidth,
          height: modalHeight
        },
        React.createElement(Text, { bold: true, color: overlay.kind === "confirm" ? "yellow" : "cyan" }, overlay.title),
        ...bodyLines.map((line, index) =>
          React.createElement(Text, { key: `overlay-${index}` }, line)
        )
      )
    );
  }

  function Footer({ view, compact, tight, width }: { view: SaneTuiAppView; compact: boolean; tight: boolean; width: number }): InkNode {
    const hint = footerHint(view);
    if (tight) {
      const status = compactStatusline(view, width);
      const combined = `${hint} | ${status}`;
      const line = combined.length <= width
        ? combined
        : hint.length <= width
          ? hint
          : compactFooterHint(view);
      return React.createElement(
        Box,
        { marginTop: 0 },
        React.createElement(Text, { color: "gray" }, truncateEnd(line, width))
      );
    }

    return React.createElement(
      Box,
      { marginTop: 1, flexDirection: "column" },
      React.createElement(Text, { color: "gray" }, truncateEnd(hint, width)),
      React.createElement(Text, { color: "gray" }, compact ? compactStatusline(view, width) : fullStatusline(view))
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

function experienceActionLines(view: SaneTuiAppView, maxLines: number): string[] {
  const lines = view.experience.actionGroups.flatMap((group, groupIndex) => [
    ...(groupIndex > 0 ? [""] : []),
    group.title,
    ...group.items.map((item) => {
      const marker = item.selected ? ">" : item.recommended ? "*" : " ";
      return `${marker} ${actionIconForCommand(item.id)} ${item.label}`;
    })
  ]);

  return windowLinesAroundSelection(
    lines,
    Math.max(0, lines.findIndex((line) => line.startsWith("> "))),
    maxLines
  );
}

function selectedExperienceLines(view: SaneTuiAppView, maxLines: number): string[] {
  const lines = view.experience.selectedLines.length > 0
    ? view.experience.selectedLines
    : ["No extra details."];

  return limitWithoutOverflowMarker(compactLines(lines, maxLines), maxLines);
}

function selectedMoveDetailLines(view: SaneTuiAppView): string[] {
  const lines = view.experience.selectedLines
    .map((line) => line.trim())
    .filter((line) => (
      line.length > 0
      && !line.startsWith("What happens:")
      && !line.startsWith("Files changed:")
      && !line.startsWith("Safety")
      && !line.startsWith("Confirmation required")
      && !line.startsWith("audit:")
      && !line.startsWith("apply readiness:")
    ));

  return lines.length > 0 ? lines.slice(0, 1) : selectedExperienceLines(view, 1);
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
  return limitWithoutOverflowMarker(
    addSnapshotSpacing(prioritizeSnapshotLines(readableOverviewLines(lines), maxLines)),
    maxLines
  );
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
    ? "Changes this project. Preview or confirmation appears first."
    : "Changes your Codex setup. Preview or confirmation appears first.";
}

export function actionIconForCommand(id: string): string {
  const normalized = id.toLowerCase();

  if (
    normalized.includes("uninstall")
    || normalized.includes("remove")
    || normalized.includes("reset")
    || normalized.includes("restore")
  ) {
    return "⚠";
  }

  if (
    normalized.startsWith("show_")
    || normalized.startsWith("preview_")
    || normalized === "doctor"
    || normalized.includes("status")
    || normalized.includes("readiness")
  ) {
    return "◎";
  }

  if (
    normalized.includes("install")
    || normalized.includes("add")
    || normalized.includes("apply")
    || normalized.includes("export")
    || normalized.includes("backup")
  ) {
    return "→";
  }

  if (
    normalized.includes("editor")
    || normalized.includes("config")
    || normalized.includes("pack")
    || normalized.includes("privacy")
    || normalized.includes("repair")
    || normalized.includes("update")
    || normalized.includes("drift")
  ) {
    return "⚙";
  }

  return "→";
}

function actionSafetyLines(action: FocusAction): string[] {
  if (action.kind === "editor") {
    return [
      "Will: save local Sane config.",
      "Undo: reopen editor and change it back."
    ];
  }

  if (isReadOnlyAction(action)) {
    return [
      "Will: show details only. No files change.",
      "Undo: none needed."
    ];
  }

  return action.repoMutation
    ? [
        "Will: change this project after confirm.",
        "Undo: revert selected hunks with git."
      ]
    : [
        "Will: change Codex setup after confirm.",
        "Undo: use matching remove/reset move."
      ];
}

function selectedMoveLineColor(line: string, index: number): "cyan" | "gray" | "yellow" | undefined {
  if (index === 0) {
    return "cyan";
  }
  if (line.length === 0) {
    return undefined;
  }
  if (line.startsWith("Will:") || line.startsWith("Undo:")) {
    return "yellow";
  }
  if (line.startsWith("Why now:") || line.startsWith("Enter ")) {
    return "gray";
  }
  return undefined;
}

function actionLineColor(line: string): "black" | "cyan" | "gray" | "yellow" | undefined {
  if (line.startsWith("> ")) {
    return "black";
  }
  if (line.startsWith("* ")) {
    return "yellow";
  }
  if (isActionGroupLine(line)) {
    return "cyan";
  }
  if (line === "...") {
    return "gray";
  }
  return undefined;
}

function paneVerticalPadding(height: number): 0 | 1 {
  return height < 12 ? 0 : 1;
}

function isActionGroupLine(line: string): boolean {
  return line.length > 0 && !line.startsWith(" ") && !line.startsWith("> ") && !line.startsWith("* ") && line !== "...";
}

function footerHint(view: SaneTuiAppView): string {
  const action = footerActionLabel(view);
  return `${action} | up/down move | left/right tab | ? help | q quit`;
}

function compactFooterHint(view: SaneTuiAppView): string {
  return `${footerActionLabel(view)} | up/down | left/right tab | ? | q`;
}

function footerActionLabel(view: SaneTuiAppView): string {
  const action = view.selectedAction.confirmation?.required
    ? "enter confirm"
    : view.selectedAction.kind === "editor"
      ? "enter edit"
      : isReadOnlyAction(view.selectedAction)
        ? "enter open"
        : "enter run";
  return action;
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

function fullStatusline(view: SaneTuiAppView): string {
  return `State: local ${view.footer.status.runtime} | codex ${view.footer.status.codex} | skills ${view.footer.status.user} | hooks ${view.footer.status.hooks} | drift ${view.chips.find((chip) => chip.id === "drift")?.value ?? "unknown"}`;
}

function compactStatusline(view: SaneTuiAppView, width = 80): string {
  const drift = view.chips.find((chip) => chip.id === "drift")?.value ?? "unknown";
  if (width < 64) {
    return `State: local ${view.footer.status.runtime} | drift ${drift}`;
  }
  return `State: local ${view.footer.status.runtime} | cx ${view.footer.status.codex} | sk ${view.footer.status.user} | hk ${view.footer.status.hooks} | dr ${drift}`;
}
