import { enabledPackNames as configEnabledPackNames } from "@sane/config";
import { inspectPrivacyTransparencySnapshot } from "@sane/control-plane/preferences.js";
import { optionalPackSkillNames } from "@sane/framework-assets";

import {
  CONFIG_FIELD_METADATA,
  type ConfigEditorState,
  type PackEditorState,
  type PackFieldId,
  packFieldPackName,
  type PrivacyEditorState
} from "@/preferences-editor-state.js";
import { type TuiShell } from "@/shell.js";

export interface EditorOverlayModel {
  kind: "config" | "packs" | "privacy";
  title: string;
  headerLines: string[];
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
  cavemem: "Compact durable-memory guidance for long sessions and cleaner handoffs.",
  rtk: "Shell-routing guidance. When enabled, route shell work through RTK instead of raw commands.",
  frontend_craft:
    "Frontend craft guidance. Biases Sane away from generic AI UI output and toward stronger design quality."
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
          "Up/down picks field. Left/right cycles. Enter saves. r resets to this machine's recommended defaults. Esc backs out."
        ],
        outputLines: shell.lastResult.lines,
        detailsTitle: "Field Help",
        detailsLines: configFieldHelpLines(shell.activeEditor)
      };
    case "privacy":
      return {
        kind: "privacy",
        title: "Privacy",
        headerLines: [
          "Privacy / Telemetry",
          "Left/right changes consent. Enter saves. d deletes local telemetry data. Esc backs out.",
          "Telemetry stays optional and product-improvement-only."
        ],
        outputLines: shell.lastResult.lines,
        detailsTitle: "Transparency",
        detailsLines: privacyLines(shell)
      };
    case "packs":
      return {
        kind: "packs",
        title: "Built-in Packs",
        headerLines: [
          "Built-in Packs",
          "core stays on. Up/down selects. Space toggles optional packs. Enter saves. Esc backs out.",
          "Packs change local guidance and may make exports stale until you re-export."
        ],
        outputLines: shell.lastResult.lines,
        detailsTitle: "Pack Summary",
        detailsLines: packLines(shell.activeEditor)
      };
  }
}

function configFieldHelpLines(editor: ConfigEditorState): string[] {
  const field = editor.fields[editor.selected]!;
  const metadata = CONFIG_FIELD_METADATA[field];
  const value = metadata.value(editor.config);
  const lines = [
    metadata.label,
    `Current value: ${value}`,
    "",
    metadata.explanation,
    "",
    "Editable defaults",
    "Coordinator = top-level session baseline",
    "Sidecar = bounded helper default",
    "Verifier = review/checking default",
    "",
    "Routing behavior",
    "Coordinator/sidecar/verifier are editable defaults.",
    "Sane also derives execution and realtime-iteration classes from detected model availability.",
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
    `dir: ${transparency.dir}`,
    `summary.json: ${transparency.telemetry.summaryPresent ? "present" : "missing"}`,
    `events.jsonl: ${transparency.telemetry.eventsPresent ? "present" : "missing"}`,
    `queue.jsonl: ${transparency.telemetry.queuePresent ? "present" : "missing"}`,
    "",
    "No remote upload logic yet.",
    "Issue reporting stays separate.",
    `summary path: ${transparency.summaryPath}`,
    `events path: ${transparency.eventsPath}`,
    `queue path: ${transparency.queuePath}`
  ];
}

function packLines(editor: PackEditorState): string[] {
  const selected = editor.fields[editor.selected]!;
  const skillNames = selectedPackSkillNames(selected);
  return [
    `enabled packs: ${enabledPackNames(editor)}`,
    "",
    `selected pack: ${packFieldLabel(selected)}`,
    packFieldExplanation(selected),
    `exports: ${skillNames.length === 0 ? "no dedicated skills" : skillNames.join(", ")}`,
    "",
    "Effect",
    "Updates local pack config first.",
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
