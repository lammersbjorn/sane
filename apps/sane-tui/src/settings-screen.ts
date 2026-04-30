import { detectPlatform, type CodexPaths, type HostPlatform, type ProjectPaths } from "@sane/platform";
import {
  inspectCodexProfileFamilySnapshot
} from "@sane/control-plane/codex-config.js";
import { inspectPreferencesFamilySnapshot } from "@sane/control-plane/preferences.js";
import { listSectionActions, type UiCommandId } from "@sane/sane-tui/command-registry.js";

type SettingsSnapshotModel = ReturnType<typeof inspectPreferencesFamilySnapshot>["preferences"];
type CodexProfileFamily = ReturnType<typeof inspectCodexProfileFamilySnapshot>;
type SettingsFamily = ReturnType<typeof inspectPreferencesFamilySnapshot>;

export interface SettingsScreenAction {
  id: Extract<
    UiCommandId,
    | "open_config_editor"
    | "open_pack_editor"
    | "open_privacy_editor"
    | "toggle_auto_updates"
    | "show_config"
    | "show_codex_config"
    | "preview_statusline_profile"
    | "apply_statusline_profile"
    | "preview_cloudflare_profile"
    | "apply_cloudflare_profile"
  >;
  title: string;
  kind: "config-editor" | "pack-editor" | "privacy-editor" | "backend";
}

export interface SettingsScreenModel {
  summary: "Settings";
  source: SettingsSnapshotModel["source"];
  models: SettingsSnapshotModel["models"];
  derivedRouting: SettingsSnapshotModel["derivedRouting"];
  subagents: SettingsSnapshotModel["subagents"];
  modelCapabilities: SettingsSnapshotModel["modelCapabilities"];
  telemetry: SettingsSnapshotModel["telemetry"];
  autoUpdates: SettingsSnapshotModel["autoUpdates"];
  telemetryFiles: SettingsSnapshotModel["telemetryFiles"];
  enabledPacks: string[];
  statuslineAudit: ReturnType<typeof inspectCodexProfileFamilySnapshot>["statusline"]["audit"];
  statuslineApply: ReturnType<typeof inspectCodexProfileFamilySnapshot>["statusline"]["apply"];
  statuslinePreview: ReturnType<typeof inspectCodexProfileFamilySnapshot>["statusline"]["preview"];
  cloudflareAudit: ReturnType<typeof inspectCodexProfileFamilySnapshot>["cloudflare"]["audit"];
  cloudflareApply: ReturnType<typeof inspectCodexProfileFamilySnapshot>["cloudflare"]["apply"];
  cloudflarePreview: ReturnType<typeof inspectCodexProfileFamilySnapshot>["cloudflare"]["preview"];
  actions: SettingsScreenAction[];
}

export function loadSettingsScreen(
  paths: ProjectPaths,
  codexPaths: CodexPaths,
  profiles: CodexProfileFamily = inspectCodexProfileFamilySnapshot(codexPaths),
  preferencesFamily: SettingsFamily = inspectPreferencesFamilySnapshot(paths, codexPaths),
  hostPlatform: HostPlatform = detectPlatform()
): SettingsScreenModel {
  const actions: SettingsScreenAction[] = listSectionActions("settings", hostPlatform).map((action) => ({
    id: action.id as SettingsScreenAction["id"],
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
  const snapshot = preferencesFamily.preferences;
  return {
    summary: "Settings",
    source: snapshot.source,
    models: snapshot.models,
    derivedRouting: snapshot.derivedRouting,
    subagents: snapshot.subagents,
    modelCapabilities: snapshot.modelCapabilities,
    telemetry: snapshot.telemetry,
    autoUpdates: snapshot.autoUpdates,
    telemetryFiles: snapshot.telemetryFiles,
    enabledPacks: snapshot.enabledPacks,
    statuslineAudit: profiles.statusline.audit,
    statuslineApply: profiles.statusline.apply,
    statuslinePreview: profiles.statusline.preview,
    cloudflareAudit: profiles.cloudflare.audit,
    cloudflareApply: profiles.cloudflare.apply,
    cloudflarePreview: profiles.cloudflare.preview,
    actions
  };
}
