export function windowLinesAroundSelection(
  lines: string[],
  selectedIndex: number,
  availableLines: number
): string[] {
  if (availableLines <= 0 || lines.length <= availableLines) {
    return lines;
  }

  const windowSize = Math.max(1, availableLines);
  const halfWindow = Math.floor(windowSize / 2);
  let start = Math.max(0, selectedIndex - halfWindow);
  let end = Math.min(lines.length, start + windowSize);

  if (end - start < windowSize) {
    start = Math.max(0, end - windowSize);
  }

  const visible = lines.slice(start, end);
  if (start > 0) {
    visible[0] = "...";
  }
  if (end < lines.length) {
    visible[visible.length - 1] = "...";
  }

  return visible;
}

export function readableOverviewLines(lines: string[]): string[] {
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
