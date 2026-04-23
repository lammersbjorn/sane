import { type SaneTuiAppView } from "@/app-view.js";

export function renderTextAppView(view: SaneTuiAppView): string {
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

  if (!view.overlay) {
    return sections.join("\n");
  }

  return [
    ...sections,
    "",
    "[Overlay]",
    `kind: ${view.overlay.kind}`,
    `title: ${view.overlay.title}`,
    ...overlayLines(view.overlay)
  ].join("\n");
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
