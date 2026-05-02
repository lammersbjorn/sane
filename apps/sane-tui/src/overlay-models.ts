import { enabledPackNames as configEnabledPackNames } from "@sane/config";
import { inspectPrivacyTransparencySnapshot } from "@sane/control-plane/preferences.js";
import { optionalPackSkillNames } from "@sane/framework-assets";

import {
  CONFIG_FIELD_METADATA,
  type ConfigEditorState,
  type PackEditorState,
  type PackFieldId,
  packFieldConfigKey,
  packFieldPackName,
  type PrivacyEditorState
} from "@sane/sane-tui/preferences-editor-state.js";
import { type TuiShell } from "@sane/sane-tui/shell.js";

export interface EditorOverlayModel {
  kind: "config" | "packs" | "privacy";
  title: string;
  headerLines: string[];
  fieldLines: string[];
  outputLines: string[];
  detailsTitle: string;
  detailsLines: string[];
}

export interface ConfirmOverlayModel {
  kind: "confirm";
  title: string;
  header: string;
  footer: string;
  bodyLines: string[];
  statusLines: string[];
}

export interface NoticeOverlayModel {
  kind: "notice";
  title: string;
  bodyLines: string[];
  footer: string;
}

export type OverlayModel = EditorOverlayModel | ConfirmOverlayModel | NoticeOverlayModel | null;
const PACK_FIELD_EXPLANATIONS: Record<PackFieldId, string> = {
  caveman:
    "Compressed communication guidance. Useful when you want less token-heavy prose by default.",
  rtk: "Shell-routing guidance. When enabled, route shell work through RTK instead of raw commands.",
  frontend_craft:
    "Frontend craft guidance. Biases Sane away from generic AI UI output and toward stronger design quality.",
  docs_craft:
    "Documentation guidance. Keeps README, user docs, changelogs, and release notes source-verified and concise."
};

export function loadOverlayModel(shell: TuiShell): OverlayModel {
  if (shell.notice) {
    return {
      kind: "notice",
      title: shell.notice.title,
      bodyLines: shell.notice.body.split("\n"),
      footer: shell.notice.footer
    };
  }

  if (shell.pendingConfirmation) {
    return {
      kind: "confirm",
      title: shell.pendingConfirmation.title,
      header: shell.pendingConfirmation.heading,
      footer: shell.pendingConfirmation.footer,
      bodyLines: shell.pendingConfirmation.body,
      statusLines: shell.lastResult.lines
    };
  }

  if (!shell.activeEditor) {
    return null;
  }

  switch (shell.activeEditor.kind) {
    case "config":
      return {
        kind: "config",
        title: "Model Defaults",
        headerLines: [
          "Model Defaults",
          "Arrows change value. Enter save. Esc close."
        ],
        fieldLines: configFieldLines(shell.activeEditor),
        outputLines: shell.lastResult.lines,
        detailsTitle: "Field Help",
        detailsLines: configFieldHelpLines(shell.activeEditor)
      };
    case "privacy":
      return {
        kind: "privacy",
        title: "Privacy",
        headerLines: [
          "Privacy / Reporting",
          "Arrows change value. Enter save. Esc close."
        ],
        fieldLines: privacyFieldLines(shell.activeEditor),
        outputLines: shell.lastResult.lines,
        detailsTitle: "Transparency",
        detailsLines: privacyLines(shell)
      };
    case "packs":
      return {
        kind: "packs",
        title: "Guidance Options",
        headerLines: [
          "Guidance Options",
          "Space toggles. Enter save. Esc close."
        ],
        fieldLines: packFieldLines(shell.activeEditor),
        outputLines: shell.lastResult.lines,
        detailsTitle: "Guidance Summary",
        detailsLines: packLines(shell.activeEditor)
      };
  }
}

function configFieldLines(editor: ConfigEditorState): string[] {
  return editor.fields.map((field, index) => {
    const metadata = CONFIG_FIELD_METADATA[field];
    const current = metadata.value(editor.config);
    const recommended = metadata.value(editor.defaults);
    const suffix = current === recommended ? "" : `  recommended ${recommended}`;
    return `${index === editor.selected ? "> " : "  "}${metadata.label}: ${current}${suffix}`;
  });
}

function packFieldLines(editor: PackEditorState): string[] {
  return editor.fields.map((field, index) => {
    const enabled = editor.config.packs[packFieldConfigKey(field)];
    return `${index === editor.selected ? "> " : "  "}${packFieldLabel(field)}: ${enabled ? "on" : "off"}`;
  });
}

function privacyFieldLines(editor: PrivacyEditorState): string[] {
  return editor.fields.map((field, index) => {
    const prefix = index === editor.selected ? "> " : "  ";
    if (field === "telemetry") {
      return `${prefix}Telemetry: ${editor.config.privacy.telemetry}`;
    }
    return `${prefix}Issue relay: ${editor.config.issueRelay.mode}`;
  });
}

function configFieldHelpLines(editor: ConfigEditorState): string[] {
  const field = editor.fields[editor.selected]!;
  const metadata = CONFIG_FIELD_METADATA[field];
  const value = metadata.value(editor.config);
  const lines = [
    metadata.label,
    `Current value: ${value}`,
    `Recommended: ${metadata.value(editor.defaults)}`,
    "",
    metadata.explanation,
    "",
    "Editable defaults",
    "Default = baseline model and effort",
    "Explore = discovery/no edits",
    "Build = bounded code changes",
    "Review = checks and validation",
    "Quick helper = fast iteration",
    "",
    "Saved to Sane config.",
    "Exports reuse defaults where explicit model routing is supported.",
    "",
    "Choices"
  ];

  if (field.endsWith("_model")) {
    lines.push(metadata.options.join(", "));
  } else {
    lines.push(metadata.options.join(", "));
  }

  return lines;
}

function privacyLines(shell: TuiShell): string[] {
  const config = shell.activeEditor as PrivacyEditorState;
  const transparency = inspectPrivacyTransparencySnapshot(
    shell.paths,
    config.config.privacy.telemetry
  );

  return [
    `consent: ${transparency.consent}`,
    `policy: ${privacyConsentPolicy(transparency.consent)}`,
    `dir: ${transparency.dir}`,
    `summary.json: ${transparency.telemetry.summaryPresent ? "present" : "missing"}`,
    `events.jsonl: ${transparency.telemetry.eventsPresent ? "present" : "missing"}`,
    `queue.jsonl: ${transparency.telemetry.queuePresent ? "present" : "missing"}`,
    "",
    "No remote upload logic yet.",
    `issue relay: ${config.config.issueRelay.mode}`,
    "Issue relay is separate from telemetry and requires review before GitHub submission.",
    `summary path: ${transparency.summaryPath}`,
    `events path: ${transparency.eventsPath}`,
    `queue path: ${transparency.queuePath}`
  ];
}

function privacyConsentPolicy(consent: PrivacyEditorState["config"]["privacy"]["telemetry"]): string {
  switch (consent) {
    case "off":
      return "off removes optional telemetry files";
    case "local-only":
      return "local-only keeps summary/events local and removes upload queue";
    case "product-improvement":
      return "product-improvement keeps sanitized local aggregates; no upload transport yet";
  }
}

function packLines(editor: PackEditorState): string[] {
  const selected = editor.fields[editor.selected]!;
  const skillNames = selectedPackSkillNames(selected);
  return [
      `enabled guidance options: ${enabledPackNames(editor)}`,
    "",
    `selected option: ${packFieldLabel(selected)}`,
    packFieldExplanation(selected),
    `exports: ${skillNames.length === 0 ? "no dedicated skills" : skillNames.join(", ")}`,
    "",
    "Effect",
    "Updates local guidance config first.",
    "Some exports may need rerunning after save.",
    "No marketplace or third-party plugin API yet."
  ];
}

function enabledPackNames(editor: PackEditorState): string {
  return configEnabledPackNames(editor.config.packs).join(", ");
}

function packFieldLabel(field: PackFieldId): string {
  return packFieldPackName(field);
}

function packFieldExplanation(field: PackFieldId): string {
  return PACK_FIELD_EXPLANATIONS[field];
}

function selectedPackSkillNames(field: PackFieldId): string[] {
  return optionalPackSkillNames(packFieldPackName(field));
}
