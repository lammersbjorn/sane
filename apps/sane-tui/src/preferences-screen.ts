import { type CodexPaths, type ProjectPaths } from "@sane/platform";
import {
  inspectCloudflareProfileSnapshot,
  inspectOpencodeProfileSnapshot
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
  derivedRouting: ReturnType<typeof inspectPreferencesSnapshot>["derivedRouting"];
  subagents: ReturnType<typeof inspectPreferencesSnapshot>["subagents"];
  telemetry: ReturnType<typeof inspectPreferencesSnapshot>["telemetry"];
  telemetryFiles: ReturnType<typeof inspectPreferencesSnapshot>["telemetryFiles"];
  enabledPacks: string[];
  cloudflareAudit: ReturnType<typeof inspectCloudflareProfileSnapshot>["audit"];
  cloudflareApply: ReturnType<typeof inspectCloudflareProfileSnapshot>["apply"];
  cloudflarePreview: ReturnType<typeof inspectCloudflareProfileSnapshot>["preview"];
  opencodeAudit: ReturnType<typeof inspectOpencodeProfileSnapshot>["audit"];
  opencodeApply: ReturnType<typeof inspectOpencodeProfileSnapshot>["apply"];
  opencodePreview: ReturnType<typeof inspectOpencodeProfileSnapshot>["preview"];
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
  const cloudflareProfile = inspectCloudflareProfileSnapshot(codexPaths);
  const opencodeProfile = inspectOpencodeProfileSnapshot(codexPaths);
  return {
    summary: "Preferences",
    source: snapshot.source,
    models: snapshot.models,
    derivedRouting: snapshot.derivedRouting,
    subagents: snapshot.subagents,
    telemetry: snapshot.telemetry,
    telemetryFiles: snapshot.telemetryFiles,
    enabledPacks: snapshot.enabledPacks,
    cloudflareAudit: cloudflareProfile.audit,
    cloudflareApply: cloudflareProfile.apply,
    cloudflarePreview: cloudflareProfile.preview,
    opencodeAudit: opencodeProfile.audit,
    opencodeApply: opencodeProfile.apply,
    opencodePreview: opencodeProfile.preview,
    actions
  };
}
