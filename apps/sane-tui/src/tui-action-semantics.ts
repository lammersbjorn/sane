import { type SaneTuiAppView } from "@sane/sane-tui/app-view.js";

export type TuiAction = SaneTuiAppView["selectedAction"];

export function isReadOnlyAction(action: TuiAction): boolean {
  return (
    action.id === "show_status"
    || action.id === "doctor"
    || action.id === "show_runtime_summary"
    || action.id === "show_config"
    || action.id === "show_codex_config"
    || action.id === "show_outcome_readiness"
    || action.id.startsWith("preview_")
  );
}
