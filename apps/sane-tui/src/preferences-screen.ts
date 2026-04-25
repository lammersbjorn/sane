import { detectPlatform, type CodexPaths, type ProjectPaths } from "@sane/platform";
import {
  inspectCodexProfileFamilySnapshot
} from "@sane/control-plane/codex-config.js";
import { inspectPreferencesFamilySnapshot } from "@sane/control-plane/preferences.js";
import { listSectionActions, type UiCommandId } from "@sane/sane-tui/command-registry.js";

type PreferencesSnapshotModel = ReturnType<typeof inspectPreferencesFamilySnapshot>["preferences"];
type CodexProfileFamily = ReturnType<typeof inspectCodexProfileFamilySnapshot>;

export interface PreferencesScreenAction {
  id: Extract<
    UiCommandId,
    | "open_config_editor"
    | "open_pack_editor"
    | "open_privacy_editor"
    | "show_config"
    | "show_codex_config"
    | "preview_statusline_profile"
    | "apply_statusline_profile"
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
  source: PreferencesSnapshotModel["source"];
  models: PreferencesSnapshotModel["models"];
  derivedRouting: PreferencesSnapshotModel["derivedRouting"];
  subagents: PreferencesSnapshotModel["subagents"];
  modelCapabilities: PreferencesSnapshotModel["modelCapabilities"];
  telemetry: PreferencesSnapshotModel["telemetry"];
  telemetryFiles: PreferencesSnapshotModel["telemetryFiles"];
  enabledPacks: string[];
  statuslineAudit: ReturnType<typeof inspectCodexProfileFamilySnapshot>["statusline"]["audit"];
  statuslineApply: ReturnType<typeof inspectCodexProfileFamilySnapshot>["statusline"]["apply"];
  statuslinePreview: ReturnType<typeof inspectCodexProfileFamilySnapshot>["statusline"]["preview"];
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
  codexPaths: CodexPaths,
  profiles: CodexProfileFamily = inspectCodexProfileFamilySnapshot(codexPaths)
): PreferencesScreenModel {
  const hostPlatform = detectPlatform();
  const actions: PreferencesScreenAction[] = listSectionActions("preferences", hostPlatform).map((action) => ({
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
  const snapshot = inspectPreferencesFamilySnapshot(paths, codexPaths).preferences;
  return {
    summary: "Preferences",
    source: snapshot.source,
    models: snapshot.models,
    derivedRouting: snapshot.derivedRouting,
    subagents: snapshot.subagents,
    modelCapabilities: snapshot.modelCapabilities,
    telemetry: snapshot.telemetry,
    telemetryFiles: snapshot.telemetryFiles,
    enabledPacks: snapshot.enabledPacks,
    statuslineAudit: profiles.statusline.audit,
    statuslineApply: profiles.statusline.apply,
    statuslinePreview: profiles.statusline.preview,
    cloudflareAudit: profiles.cloudflare.audit,
    cloudflareApply: profiles.cloudflare.apply,
    cloudflarePreview: profiles.cloudflare.preview,
    opencodeAudit: profiles.opencode.audit,
    opencodeApply: profiles.opencode.apply,
    opencodePreview: profiles.opencode.preview,
    actions
  };
}
