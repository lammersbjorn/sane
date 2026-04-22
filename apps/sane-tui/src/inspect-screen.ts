import { type CodexPaths, type ProjectPaths } from "@sane/platform";

import {
  inspectSnapshot
} from "@sane/control-plane";
import { listSectionActions, type UiCommandId } from "@/command-registry.js";

export interface InspectScreenAction {
  id: Extract<
    UiCommandId,
    | "show_status"
    | "doctor"
    | "show_runtime_summary"
    | "show_config"
    | "show_codex_config"
    | "preview_integrations_profile"
    | "preview_policy"
  >;
  title: string;
}

export interface InspectScreenModel {
  summary: "Inspect";
  actions: InspectScreenAction[];
}

type InspectScreenSnapshot = ReturnType<typeof inspectSnapshot>;

export interface InspectScreenModel extends InspectScreenSnapshot {
  summary: "Inspect";
  actions: InspectScreenAction[];
}

export function loadInspectScreen(paths: ProjectPaths, codexPaths: CodexPaths): InspectScreenModel {
  const snapshot = inspectSnapshot(paths, codexPaths);

  return {
    summary: "Inspect",
    actions: listSectionActions("inspect").map((action) => ({
      id: action.id as InspectScreenAction["id"],
      title: action.label
    })),
    ...snapshot
  };
}
