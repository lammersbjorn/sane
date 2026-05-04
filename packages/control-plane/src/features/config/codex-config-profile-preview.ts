import { OperationKind, OperationResult } from "@sane/control-plane/core.js";
import { type CodexPaths } from "../../platform.js";

import type {
  CloudflareProfileAudit,
  CodexProfileAudit,
  IntegrationsProfileAudit,
  StatuslineProfileAudit
} from "./codex-config.js";
import { profilePreviewSummary } from "./codex-config-profile-support.js";

interface CodexInventoryReader {
  inspectCodexConfigInventory(codexPaths: CodexPaths): ReturnType<
    typeof import("./codex-config.js").inspectCodexConfigInventory
  >;
}

export function previewCodexProfileFromAudit(
  codexPaths: CodexPaths,
  audit: CodexProfileAudit,
  deps: CodexInventoryReader
): OperationResult {
  return new OperationResult({
    kind: OperationKind.PreviewCodexProfile,
    summary: profilePreviewSummary("codex-profile", audit),
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [deps.inspectCodexConfigInventory(codexPaths)]
  });
}

export function previewIntegrationsProfileFromAudit(
  codexPaths: CodexPaths,
  audit: IntegrationsProfileAudit,
  deps: CodexInventoryReader
): OperationResult {
  return new OperationResult({
    kind: OperationKind.PreviewIntegrationsProfile,
    summary: profilePreviewSummary("integrations-profile", audit),
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [deps.inspectCodexConfigInventory(codexPaths)]
  });
}

export function previewCloudflareProfileFromAudit(
  codexPaths: CodexPaths,
  audit: CloudflareProfileAudit,
  deps: CodexInventoryReader
): OperationResult {
  return new OperationResult({
    kind: OperationKind.PreviewCloudflareProfile,
    summary: profilePreviewSummary("cloudflare-profile", audit),
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [deps.inspectCodexConfigInventory(codexPaths)]
  });
}

export function previewStatuslineProfileFromAudit(
  codexPaths: CodexPaths,
  audit: StatuslineProfileAudit,
  deps: CodexInventoryReader
): OperationResult {
  return new OperationResult({
    kind: OperationKind.PreviewStatuslineProfile,
    summary: profilePreviewSummary("statusline-profile", audit),
    details: audit.details,
    pathsTouched: [codexPaths.configToml],
    inventory: [deps.inspectCodexConfigInventory(codexPaths)]
  });
}
