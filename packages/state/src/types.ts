export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonRecord;
export interface JsonRecord {
  [key: string]: JsonValue;
}

export type TomlPrimitive = string | number | boolean;
export type TomlValue = TomlPrimitive | TomlPrimitive[] | TomlTable;
export interface TomlTable {
  [key: string]: TomlValue;
}

export interface RunSnapshot {
  version: number;
  objective: string;
}

export interface RunSummary {
  version: number;
  acceptedDecisions: string[];
  completedMilestones: string[];
  constraints: string[];
  lastVerifiedOutputs: string[];
  filesTouched: string[];
  extra: JsonRecord;
}

export interface RunSummaryPromotion {
  pathsTouched: string[];
  milestone?: string | null;
}

export interface LocalStateConfig {
  version: number;
  extra: TomlTable;
}

export interface VerificationStatus {
  status: string;
  summary: string | null;
}

export interface CurrentRunState {
  version: number;
  objective: string;
  phase: string;
  activeTasks: string[];
  blockingQuestions: string[];
  verification: VerificationStatus;
  lastCompactionTsUnix: number | null;
  extra: JsonRecord;
}

export interface LayeredStateHistoryCounts {
  events: number;
  decisions: number;
  artifacts: number;
}

export interface LayeredStateHistoryPreview {
  latestEvent: {
    tsUnix: number;
    action: string;
    summary: string;
    result: string;
  } | null;
  latestDecision: {
    tsUnix: number;
    summary: string;
    rationale: string;
  } | null;
  latestArtifact: {
    tsUnix: number;
    kind: string;
    summary: string;
    path: string;
  } | null;
}

export interface CanonicalStatePaths {
  configPath: string;
  summaryPath: string;
  currentRunPath: string;
  briefPath: string;
  eventsPath?: string;
  decisionsPath?: string;
  artifactsPath?: string;
}

export type LayeredStateLayerStatus = 'missing' | 'invalid' | 'present';

export interface LayeredStateBundle {
  config: LocalStateConfig | null;
  summary: RunSummary | null;
  currentRun: CurrentRunState | null;
  brief: string | null;
  layerStatus: {
    config: LayeredStateLayerStatus;
    summary: LayeredStateLayerStatus;
    currentRun: LayeredStateLayerStatus;
    brief: LayeredStateLayerStatus;
  };
  historyCounts: LayeredStateHistoryCounts;
  historyPreview: LayeredStateHistoryPreview;
  latestPolicyPreview: LatestPolicyPreviewSnapshot;
}

export type CanonicalStateFormat = 'json' | 'toml';

export interface CanonicalWriteOptions<T> {
  format: CanonicalStateFormat;
  stringify?: (value: T) => string;
}

export interface CanonicalRewriteResult {
  rewrittenPath: string;
  backupPath: string | null;
  firstWrite: boolean;
}

export interface EventRecord {
  tsUnix: number;
  category: string;
  action: string;
  result: string;
  summary: string;
  paths: string[];
}

export interface DecisionRecord {
  version: number;
  tsUnix: number;
  summary: string;
  rationale: string;
  paths: string[];
  context: JsonRecord | null;
}

export interface PolicyPreviewDecisionContext extends JsonRecord {
  kind: 'policy_preview';
  scenarios: PolicyPreviewDecisionScenario[];
}

export interface PolicyPreviewDecisionScenarioInput {
  id: string;
  summary?: string | null;
  input?: PolicyPreviewDecisionScenarioInputSnapshot | null;
  obligations?: string[];
  roles?: PolicyPreviewDecisionRolesInput | null;
  orchestration?: PolicyPreviewScenarioOrchestrationInput | null;
  continuation?: PolicyPreviewScenarioContinuationInput | null;
  trace?: PolicyPreviewDecisionTraceEntryInput[];
}

export interface PolicyPreviewDecisionScenarioInputSnapshot {
  intent?: string | null;
  taskShape?: string | null;
  risk?: string | null;
  ambiguity?: string | null;
  parallelism?: string | null;
  contextPressure?: string | null;
  runState?: string | null;
}

export interface PolicyPreviewDecisionRolesInput {
  coordinator?: boolean | null;
  sidecar?: boolean | null;
  verifier?: boolean | null;
}

export interface PolicyPreviewScenarioOrchestrationInput {
  subagents?: string | null;
  subagentReadiness?: string | null;
  reviewPosture?: string | null;
  verifierTiming?: string | null;
}

export interface PolicyPreviewScenarioContinuationInput {
  strategy?: string | null;
  stopCondition?: string | null;
}

export interface PolicyPreviewDecisionTraceEntryInput {
  obligation?: string | null;
  rule?: string | null;
}

export interface PolicyPreviewDecisionScenario {
  [key: string]: JsonValue;
  id: string;
  summary: string | null;
  input: {
    [key: string]: JsonValue;
    intent: string | null;
    taskShape: string | null;
    risk: string | null;
    ambiguity: string | null;
    parallelism: string | null;
    contextPressure: string | null;
    runState: string | null;
  } | null;
  obligations: string[];
  roles: {
    [key: string]: JsonValue;
    coordinator: boolean;
    sidecar: boolean;
    verifier: boolean;
  } | null;
  orchestration: {
    [key: string]: JsonValue;
    subagents: string | null;
    subagentReadiness: string | null;
    reviewPosture: string | null;
    verifierTiming: string | null;
  } | null;
  continuation: {
    [key: string]: JsonValue;
    strategy: string | null;
    stopCondition: string | null;
  } | null;
  trace: Array<{
    [key: string]: JsonValue;
    obligation: string;
    rule: string;
  }>;
}

export interface LatestPolicyPreviewScenarioSnapshot {
  id: string;
  summary: string | null;
  input: {
    [key: string]: JsonValue;
    intent: string | null;
    taskShape: string | null;
    risk: string | null;
    ambiguity: string | null;
    parallelism: string | null;
    contextPressure: string | null;
    runState: string | null;
  } | null;
  roles: {
    [key: string]: JsonValue;
    coordinator: boolean;
    sidecar: boolean;
    verifier: boolean;
  } | null;
  orchestration: {
    [key: string]: JsonValue;
    subagents: string | null;
    subagentReadiness: string | null;
    reviewPosture: string | null;
    verifierTiming: string | null;
  } | null;
  continuation: {
    [key: string]: JsonValue;
    strategy: string | null;
    stopCondition: string | null;
  } | null;
  obligationCount: number;
  traceCount: number;
  trace: Array<{
    obligation: string;
    rule: string;
  }>;
}

export interface LatestPolicyPreviewSnapshot {
  status: 'missing' | 'present';
  scenarioCount: number;
  scenarioIds: string[];
  scenarios: LatestPolicyPreviewScenarioSnapshot[];
  tsUnix: number | null;
  summary: string | null;
}

export interface ArtifactRecord {
  version: number;
  tsUnix: number;
  kind: string;
  path: string;
  summary: string;
  paths: string[];
}
