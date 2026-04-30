export class OperationKind {
  static readonly InstallRuntime = new OperationKind("InstallRuntime");
  static readonly ShowConfig = new OperationKind("ShowConfig");
  static readonly ShowCodexConfig = new OperationKind("ShowCodexConfig");
  static readonly ShowRuntimeSummary = new OperationKind("ShowRuntimeSummary");
  static readonly ShowOutcomeReadiness = new OperationKind("ShowOutcomeReadiness");
  static readonly AdvanceOutcome = new OperationKind("AdvanceOutcome");
  static readonly ReviewIssueDraft = new OperationKind("ReviewIssueDraft");
  static readonly SubmitIssueDraft = new OperationKind("SubmitIssueDraft");
  static readonly PreviewPolicy = new OperationKind("PreviewPolicy");
  static readonly BackupCodexConfig = new OperationKind("BackupCodexConfig");
  static readonly PreviewCodexProfile = new OperationKind("PreviewCodexProfile");
  static readonly PreviewIntegrationsProfile = new OperationKind("PreviewIntegrationsProfile");
  static readonly PreviewCloudflareProfile = new OperationKind("PreviewCloudflareProfile");
  static readonly PreviewStatuslineProfile = new OperationKind("PreviewStatuslineProfile");
  static readonly ApplyCodexProfile = new OperationKind("ApplyCodexProfile");
  static readonly ApplyIntegrationsProfile = new OperationKind("ApplyIntegrationsProfile");
  static readonly ApplyCloudflareProfile = new OperationKind("ApplyCloudflareProfile");
  static readonly ApplyStatuslineProfile = new OperationKind("ApplyStatuslineProfile");
  static readonly RestoreCodexConfig = new OperationKind("RestoreCodexConfig");
  static readonly ResetTelemetryData = new OperationKind("ResetTelemetryData");
  static readonly CheckUpdates = new OperationKind("CheckUpdates");
  static readonly ShowStatus = new OperationKind("ShowStatus");
  static readonly Doctor = new OperationKind("Doctor");
  static readonly ExportUserSkills = new OperationKind("ExportUserSkills");
  static readonly ExportRepoSkills = new OperationKind("ExportRepoSkills");
  static readonly ExportRepoAgents = new OperationKind("ExportRepoAgents");
  static readonly ExportGlobalAgents = new OperationKind("ExportGlobalAgents");
  static readonly ExportHooks = new OperationKind("ExportHooks");
  static readonly ExportCustomAgents = new OperationKind("ExportCustomAgents");
  static readonly ExportAll = new OperationKind("ExportAll");
  static readonly UninstallUserSkills = new OperationKind("UninstallUserSkills");
  static readonly UninstallRepoSkills = new OperationKind("UninstallRepoSkills");
  static readonly UninstallRepoAgents = new OperationKind("UninstallRepoAgents");
  static readonly UninstallGlobalAgents = new OperationKind("UninstallGlobalAgents");
  static readonly UninstallHooks = new OperationKind("UninstallHooks");
  static readonly UninstallCustomAgents = new OperationKind("UninstallCustomAgents");
  static readonly UninstallAll = new OperationKind("UninstallAll");

  private constructor(readonly value: string) {}
}

export class InventoryStatus {
  static readonly Installed = new InventoryStatus("installed");
  static readonly Configured = new InventoryStatus("configured");
  static readonly Disabled = new InventoryStatus("disabled");
  static readonly Missing = new InventoryStatus("missing");
  static readonly Invalid = new InventoryStatus("invalid");
  static readonly PresentWithoutSaneBlock = new InventoryStatus("present_without_sane_block");
  static readonly Removed = new InventoryStatus("removed");

  private constructor(private readonly value: string) {}

  asString(): string {
    return this.value;
  }

  displayString(): string {
    if (this === InventoryStatus.PresentWithoutSaneBlock) {
      return "present without Sane block";
    }

    return this.value;
  }
}

export class InventoryScope {
  static readonly LocalRuntime = new InventoryScope("local runtime");
  static readonly CodexNative = new InventoryScope("codex-native");
  static readonly Compatibility = new InventoryScope("compatibility");

  private constructor(private readonly label: string) {}

  displayString(): string {
    return this.label;
  }
}

export interface InventoryItem {
  name: string;
  scope: InventoryScope;
  status: InventoryStatus;
  path: string;
  repairHint: string | null;
}

export interface OperationRewriteMetadata {
  rewrittenPath: string;
  backupPath: string | null;
  firstWrite: boolean;
}

export interface PolicyPreviewTraceEntry {
  obligation: string;
  rule: string;
}

export interface PolicyPreviewScenarioInput {
  intent: string;
  taskShape: string;
  risk: string;
  ambiguity: string;
  parallelism: string;
  contextPressure: string;
  runState: string;
}

export interface PolicyPreviewScenario {
  id: string;
  summary: string;
  input: PolicyPreviewScenarioInput;
  obligations: string[];
  roles: {
    coordinator: boolean;
    sidecar: boolean;
    verifier: boolean;
  };
  orchestration: {
    subagents: string;
    subagentReadiness: string;
    reviewPosture: string;
    verifierTiming: string;
  };
  continuation: {
    strategy: string;
    stopCondition: string;
  };
  trace: PolicyPreviewTraceEntry[];
}

export interface PolicyPreviewPayload {
  scenarios: PolicyPreviewScenario[];
}

export interface OperationResultInput {
  kind: OperationKind;
  summary: string;
  status?: OperationResultStatus;
  rewrite?: OperationRewriteMetadata | null;
  details?: string[];
  pathsTouched?: string[];
  inventory?: InventoryItem[];
  policyPreview?: PolicyPreviewPayload | null;
}

export type OperationResultStatus = "ok" | "blocked" | "failed" | "warning";

export class OperationResult {
  readonly kind: OperationKind;
  readonly summary: string;
  readonly status: OperationResultStatus;
  readonly rewrite: OperationRewriteMetadata | null;
  readonly details: string[];
  readonly pathsTouched: string[];
  readonly inventory: InventoryItem[];
  readonly policyPreview: PolicyPreviewPayload | null;

  constructor(input: OperationResultInput) {
    this.kind = input.kind;
    this.summary = input.summary;
    this.status = input.status ?? inferOperationResultStatus(input.summary, input.details ?? []);
    this.rewrite = input.rewrite ?? null;
    this.details = input.details ?? [];
    this.pathsTouched = input.pathsTouched ?? [];
    this.inventory = input.inventory ?? [];
    this.policyPreview = input.policyPreview ?? null;
  }

  renderText(): string {
    const lines = [this.summary, ...this.details];

    if (this.inventory.length > 0) {
      const scopes = [InventoryScope.LocalRuntime, InventoryScope.CodexNative, InventoryScope.Compatibility];
      const multipleScopes = this.inventory.some((item) => item.scope !== this.inventory[0]?.scope);

      for (const scope of scopes) {
        const items = this.inventory.filter((item) => item.scope === scope);
        if (items.length === 0) {
          continue;
        }

        if (multipleScopes) {
          lines.push(`${scope.displayString()}:`);
        }

        for (const item of items) {
          const prefix = multipleScopes ? "  " : "";
          const hint = item.repairHint ? ` (${item.repairHint})` : "";
          lines.push(
            `${prefix}${item.name}: ${item.status.displayString()}${hint}`
          );
        }
      }
    }

    if (this.pathsTouched.length > 0) {
      lines.push(`paths: ${this.pathsTouched.join(", ")}`);
    }

    return lines.join("\n");
  }
}

export function inferOperationResultStatus(
  summary: string,
  details: string[] = []
): OperationResultStatus {
  const content = [summary, ...details].join("\n").toLowerCase();
  if (content.includes("failed") || content.includes("error")) {
    return "failed";
  }
  if (content.includes("blocked")) {
    return "blocked";
  }
  if (content.includes("invalid") || content.includes("warning") || content.includes("warn")) {
    return "warning";
  }

  return "ok";
}

export function upsertManagedBlock(
  existing: string,
  begin: string,
  end: string,
  body: string
): string {
  const managed = `${begin}\n${body}\n${end}\n`;
  const stripped = removeManagedBlock(existing, begin, end);

  if (stripped.trim().length === 0) {
    return managed;
  }

  return `${stripped.trimEnd()}\n\n${managed}`;
}

export function removeManagedBlock(existing: string, begin: string, end: string): string {
  const start = existing.indexOf(begin);
  const endIndex = existing.indexOf(end);

  if (start === -1 || endIndex === -1 || endIndex < start) {
    return existing;
  }

  const endExclusive = endIndex + end.length;
  const before = existing.slice(0, start).trimEnd();
  const after = existing.slice(endExclusive).trimStart().trimEnd();

  if (before.length === 0 && after.length === 0) {
    return "";
  }

  if (after.length === 0) {
    return `${before}\n`;
  }

  if (before.length === 0) {
    return `${after}\n`;
  }

  return `${before}\n\n${after}\n`;
}
