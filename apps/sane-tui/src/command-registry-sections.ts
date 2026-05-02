import type { LaunchShortcut, TuiSectionMetadata } from "./command-registry-types.js";

export const SECTION_SHORTCUTS = {
    default: "status",
    install: "home",
    settings: "settings",
    status: "status",
    repair: "repair",
    uninstall: "uninstall"
  } as const satisfies Record<LaunchShortcut, string>;

export const SECTION_METADATA = [
    {
      id: "home",
      tabLabel: "Setup",
      docLabel: "Setup",
      launchShortcut: "default",
      description: [
        "Finish first-time setup in one pass.",
        "Prepare local files, pick defaults, review Codex changes, keep rollback point, then install Sane add-ons.",
        "After setup completes, normal `sane` should open Check."
      ]
    },
    {
      id: "settings",
      tabLabel: "Configure",
      docLabel: "Configure",
      launchShortcut: "settings",
      description: [
        "Change how Sane guides Codex before you install add-ons or recover a setup.",
        "Choose model defaults, guidance options, privacy, and optional Codex interface settings.",
        "Open with `sane settings` when you want to change behavior first."
      ]
    },
    {
      id: "add_to_codex",
      tabLabel: "Install",
      docLabel: "Install",
      description: [
        "Install or refresh Sane-managed Codex add-ons.",
        "Personal add-ons update your Codex setup. Repo writes stay explicit and optional.",
        "Use this when you want Codex to learn Sane workflow."
      ]
    },
    {
      id: "status",
      tabLabel: "Check",
      docLabel: "Check",
      launchShortcut: "status",
      description: [
        "Check setup health before changing anything.",
        "Spot missing, stale, disabled, or broken pieces without starting agent work.",
        "This should be normal landing screen after setup is complete."
      ]
    },
    {
      id: "repair",
      tabLabel: "Recover",
      docLabel: "Recover",
      launchShortcut: "repair",
      description: [
        "Recover from bad setup state without touching unrelated Codex files.",
        "Use backup and restore when Codex settings changes did not work for you.",
        "Use this when Sane-managed files are missing, stale, or invalid."
      ]
    },
    {
      id: "uninstall",
      tabLabel: "Remove",
      docLabel: "Remove",
      launchShortcut: "uninstall",
      description: [
        "Remove only Sane-managed pieces.",
        "Every broad removal stays explicit. Unrelated Codex settings, skills, agents, and plugins should stay."
      ]
    }
  ] satisfies TuiSectionMetadata[];
