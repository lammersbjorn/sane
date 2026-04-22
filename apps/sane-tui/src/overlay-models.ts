import { PICKER_MODELS, REASONING_EFFORTS, enabledPackNames as configEnabledPackNames } from "@sane/config";
import { inspectPrivacyTransparencySnapshot } from "@sane/control-plane/preferences.js";
import { optionalPackSkillNames } from "@sane/framework-assets";

import {
  type ConfigEditorState,
  type ConfigFieldId,
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
  const value = configFieldValue(field, editor);
  const lines = [
    configFieldLabel(field),
    `Current value: ${value}`,
    "",
    configFieldExplanation(field),
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
    lines.push(PICKER_MODELS.join(", "));
  } else {
    lines.push(REASONING_EFFORTS.join(", "));
  }

  return lines;
}

function configFieldLabel(field: ConfigFieldId): string {
  switch (field) {
    case "coordinator_model":
      return "Coordinator model";
    case "coordinator_reasoning":
      return "Coordinator reasoning";
    case "sidecar_model":
      return "Sidecar model";
    case "sidecar_reasoning":
      return "Sidecar reasoning";
    case "verifier_model":
      return "Verifier model";
    case "verifier_reasoning":
      return "Verifier reasoning";
  }
}

function configFieldValue(field: ConfigFieldId, editor: ConfigEditorState): string {
  switch (field) {
    case "coordinator_model":
      return editor.config.models.coordinator.model;
    case "coordinator_reasoning":
      return editor.config.models.coordinator.reasoningEffort;
    case "sidecar_model":
      return editor.config.models.sidecar.model;
    case "sidecar_reasoning":
      return editor.config.models.sidecar.reasoningEffort;
    case "verifier_model":
      return editor.config.models.verifier.model;
    case "verifier_reasoning":
      return editor.config.models.verifier.reasoningEffort;
  }
}

function configFieldExplanation(field: ConfigFieldId): string {
  switch (field) {
    case "coordinator_model":
      return "Editable default model for highest-context work: planning, shaping, integration, and hard calls.";
    case "coordinator_reasoning":
      return "Default reasoning depth for the main coordinator role.";
    case "sidecar_model":
      return "Editable default model for bounded helper work that should not consume coordinator budget.";
    case "sidecar_reasoning":
      return "Default reasoning depth for sidecar tasks such as narrow inspections or support work.";
    case "verifier_model":
      return "Editable default model when Sane runs reviewer or checker work.";
    case "verifier_reasoning":
      return "Default reasoning depth for review, checking, and verification tasks.";
  }
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
  switch (field) {
    case "caveman":
      return "Compressed communication guidance. Useful when you want less token-heavy prose by default.";
    case "cavemem":
      return "Compact durable-memory guidance for long sessions and cleaner handoffs.";
    case "rtk":
      return "Shell-routing guidance: if RTK policy exists, prefer RTK-routed command execution.";
    case "frontend_craft":
      return "Frontend craft guidance. Biases Sane away from generic AI UI output and toward stronger design quality.";
  }
}

function selectedPackSkillNames(field: PackFieldId): string[] {
  return optionalPackSkillNames(packFieldPackName(field));
}
