import { type CodexPaths, type ProjectPaths } from "@sane/platform";
import {
  inspectCloudflareProfileApplyResult,
  inspectCloudflareProfileAudit,
  inspectOpencodeProfileApplyResult,
  inspectOpencodeProfileAudit,
  previewCloudflareProfile,
  previewOpencodeProfile
} from "@sane/control-plane/codex-config.js";
import { inspectPreferencesSnapshot } from "@sane/control-plane/preferences.js";
import { listSectionActions, type UiCommandId } from "@/command-registry.js";

export interface PreferencesScreenAction {
  id: Extract<
    UiCommandId,
    | "open_config_editor"
    | "open_pack_editor"
    | "open_privacy_editor"
    | "show_config"
    | "show_codex_config"
    | "preview_cloudflare_profile"
    | "apply_cloudflare_profile"
    | "preview_opencode_profile"
    | "apply_opencode_profile"
  >;
  title: string;
  kind: "config-editor" | "pack-editor" | "privacy-editor" | "backend";
}

export interface PreferencesScreenModel {
  summary: "Preferences";
  source: ReturnType<typeof inspectPreferencesSnapshot>["source"];
  models: ReturnType<typeof inspectPreferencesSnapshot>["models"];
  telemetry: ReturnType<typeof inspectPreferencesSnapshot>["telemetry"];
  enabledPacks: string[];
  cloudflareAudit: ReturnType<typeof inspectCloudflareProfileAudit>;
  cloudflareApply: ReturnType<typeof inspectCloudflareProfileApplyResult>;
  cloudflarePreview: ReturnType<typeof previewCloudflareProfile>;
  opencodeAudit: ReturnType<typeof inspectOpencodeProfileAudit>;
  opencodeApply: ReturnType<typeof inspectOpencodeProfileApplyResult>;
  opencodePreview: ReturnType<typeof previewOpencodeProfile>;
  actions: PreferencesScreenAction[];
}

export function loadPreferencesScreen(
  paths: ProjectPaths,
  codexPaths: CodexPaths
): PreferencesScreenModel {
  const actions: PreferencesScreenAction[] = listSectionActions("preferences").map((action) => ({
    id: action.id as PreferencesScreenAction["id"],
    title: action.label,
    kind:
      action.id === "open_pack_editor"
        ? "pack-editor"
        : action.id === "open_privacy_editor"
          ? "privacy-editor"
          : action.id === "open_config_editor"
            ? "config-editor"
            : "backend"
  }));
  const snapshot = inspectPreferencesSnapshot(paths, codexPaths);
  return {
    summary: "Preferences",
    source: snapshot.source,
    models: snapshot.models,
    telemetry: snapshot.telemetry,
    enabledPacks: snapshot.enabledPacks,
    cloudflareAudit: inspectCloudflareProfileAudit(codexPaths),
    cloudflareApply: inspectCloudflareProfileApplyResult(codexPaths),
    cloudflarePreview: previewCloudflareProfile(codexPaths),
    opencodeAudit: inspectOpencodeProfileAudit(codexPaths),
    opencodeApply: inspectOpencodeProfileApplyResult(codexPaths),
    opencodePreview: previewOpencodeProfile(codexPaths),
    actions
  };
}
