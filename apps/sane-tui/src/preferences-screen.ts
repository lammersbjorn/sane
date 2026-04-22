import { type CodexPaths, type ProjectPaths } from "@sane/platform";
import {
  inspectCodexProfileFamilySnapshot
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
  cloudflareAudit: ReturnType<typeof inspectCodexProfileFamilySnapshot>["cloudflare"]["audit"];
  cloudflareApply: ReturnType<typeof inspectCodexProfileFamilySnapshot>["cloudflare"]["apply"];
  cloudflarePreview: ReturnType<typeof inspectCodexProfileFamilySnapshot>["cloudflare"]["preview"];
  opencodeAudit: ReturnType<typeof inspectCodexProfileFamilySnapshot>["opencode"]["audit"];
  opencodeApply: ReturnType<typeof inspectCodexProfileFamilySnapshot>["opencode"]["apply"];
  opencodePreview: ReturnType<typeof inspectCodexProfileFamilySnapshot>["opencode"]["preview"];
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
  const profiles = inspectCodexProfileFamilySnapshot(codexPaths);
  return {
    summary: "Preferences",
    source: snapshot.source,
    models: snapshot.models,
    derivedRouting: snapshot.derivedRouting,
    subagents: snapshot.subagents,
    telemetry: snapshot.telemetry,
    telemetryFiles: snapshot.telemetryFiles,
    enabledPacks: snapshot.enabledPacks,
    cloudflareAudit: profiles.cloudflare.audit,
    cloudflareApply: profiles.cloudflare.apply,
    cloudflarePreview: profiles.cloudflare.preview,
    opencodeAudit: profiles.opencode.audit,
    opencodeApply: profiles.opencode.apply,
    opencodePreview: profiles.opencode.preview,
    actions
  };
}
