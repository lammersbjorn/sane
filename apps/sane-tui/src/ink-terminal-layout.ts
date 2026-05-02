export type InkFocusedLayoutPlan =
  | {
      mode: "wide";
      actionWidth: number;
      detailWidth: number;
      topHeight: number;
      contextHeight: number;
    }
  | {
      mode: "stacked";
      detailHeight: number;
      actionHeight: number;
    }
  | {
      mode: "list-only";
      actionHeight: number;
    };

export interface InkEditorOverlayLayout {
  modalWidth: number;
  modalHeight: number;
  compactEditor: boolean;
  headerSlots: number;
  fieldSlots: number;
  detailSlots: number;
  showHelp: boolean;
  contentHeight: number;
}

export interface InkSectionTabItem {
  id: string;
  label: string;
}

export type InkSectionTabsPlan =
  | {
      mode: "full";
      items: Array<InkSectionTabItem & { active: boolean }>;
    }
  | {
      mode: "neighbors";
      previous: InkSectionTabItem;
      current: InkSectionTabItem;
      next: InkSectionTabItem;
    }
  | {
      mode: "current";
      current: InkSectionTabItem;
    };

export function planInkFocusedLayout(width: number, height: number): InkFocusedLayoutPlan {
  if (width >= 118 && height >= 18) {
    const actionWidth = Math.min(48, Math.max(42, Math.floor(width * 0.36)));
    const detailWidth = Math.max(40, width - actionWidth - 2);
    const topHeight = Math.min(height, Math.max(14, Math.min(22, Math.floor(height * 0.5))));
    const contextHeight = Math.max(0, height - topHeight - 1);
    return { mode: "wide", actionWidth, detailWidth, topHeight, contextHeight };
  }

  if (height < 11) {
    return { mode: "list-only", actionHeight: height };
  }

  const detailHeight = height >= 17 ? 9 : height >= 14 ? 8 : 6;
  return {
    mode: "stacked",
    detailHeight,
    actionHeight: Math.max(4, height - detailHeight - 1)
  };
}

export function planSectionTabs(
  items: InkSectionTabItem[],
  selected: string,
  width: number
): InkSectionTabsPlan {
  const safeItems = items.length > 0 ? items : [{ id: "current", label: "Current" }];
  const selectedIndex = Math.max(0, safeItems.findIndex((item) => item.id === selected));
  const current = safeItems[selectedIndex] ?? safeItems[0]!;
  const fullWidth = safeItems.reduce(
    (total, item, index) => total + (index > 0 ? 1 : 0) + tabCellWidth(item.label, item.id === current.id),
    0
  );

  if (fullWidth <= width) {
    return {
      mode: "full",
      items: safeItems.map((item) => ({ ...item, active: item.id === current.id }))
    };
  }

  const previous = safeItems[(selectedIndex - 1 + safeItems.length) % safeItems.length]!;
  const next = safeItems[(selectedIndex + 1) % safeItems.length]!;
  const neighborWidth = tabCellWidth(previous.label) + tabCellWidth(current.label, true) + tabCellWidth(next.label) + 6;
  if (neighborWidth <= width) {
    return { mode: "neighbors", previous, current, next };
  }

  return { mode: "current", current };
}

function tabCellWidth(label: string, active = false): number {
  return label.length + (active ? 4 : 2);
}

export function planInkEditorOverlay(width: number, height: number): InkEditorOverlayLayout {
  const modalWidth = computeOverlayWidth(width, 70, 4, 120);
  const modalHeight = Math.max(4, height);
  const compactEditor = width < 110 || modalHeight < 16;

  if (compactEditor) {
    const contentSlots = Math.max(1, modalHeight - 2);
    const showHelp = contentSlots >= 7;
    const headerSlots = contentSlots >= 6 ? 1 : 0;
    const fieldSlots = Math.max(1, contentSlots - 2 - headerSlots - (showHelp ? 2 : 0));
    return {
      modalWidth,
      modalHeight,
      compactEditor,
      headerSlots,
      fieldSlots,
      detailSlots: showHelp ? 1 : 0,
      showHelp,
      contentHeight: contentSlots
    };
  }

  const contentHeight = Math.max(1, modalHeight - 5);
  return {
    modalWidth,
    modalHeight,
    compactEditor,
    headerSlots: 1,
    fieldSlots: Math.max(1, contentHeight - 1),
    detailSlots: Math.max(1, contentHeight - 1),
    showHelp: true,
    contentHeight
  };
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

export function limitWithoutOverflowMarker(lines: string[], maxLines: number): string[] {
  return lines.filter((line) => !line.trim().startsWith("... ")).slice(0, maxLines);
}

export function wrapForInk(lines: string[], width: number): string[] {
  const safeWidth = Math.max(8, width);
  return lines.flatMap((line) => wrapInkLine(line, safeWidth));
}

export function wrapInkLine(line: string, width: number): string[] {
  if (line.length === 0) {
    return [""];
  }

  const words = line.split(" ");
  const result: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
      continue;
    }

    result.push(current);
    current = word;
  }

  if (current.length > 0) {
    result.push(current);
  }

  return result.flatMap((wrappedLine) => {
    if (wrappedLine.length <= width) {
      return [wrappedLine];
    }

    const chunks: string[] = [];
    for (let index = 0; index < wrappedLine.length; index += width) {
      chunks.push(wrappedLine.slice(index, index + width));
    }
    return chunks;
  });
}
