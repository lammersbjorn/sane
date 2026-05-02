import type { CurrentRunState, JsonRecord, RunSummary } from "@sane/state";

export interface OutcomeAdvanceInput {
  objective?: string;
  completedTask?: string;
  nextTasks?: string[];
  blockingQuestions?: string[];
  toolError?: string;
  repeatedToolErrorCount?: number;
  verification?: {
    status: string;
    summary?: string | null;
  };
  milestone?: string;
  filesTouched?: string[];
}

export interface OutcomeMetadata {
  mode?: string;
  autonomousLoop?: boolean;
  lastAdvanceTsUnix?: number;
  stopCondition?: string;
  lastPhase?: string | null;
  phaseRepeatCount?: number;
  lastToolError?: string | null;
  repeatedToolErrorCount?: number;
}

export const OUTCOME_REPEATED_PHASE_THRESHOLD = 3;
export const OUTCOME_REPEATED_TOOL_ERROR_THRESHOLD = 3;

export function buildNextOutcomeCurrentRun(
  current: CurrentRunState,
  input: OutcomeAdvanceInput
): CurrentRunState {
  const activeTasks = normalizeList(input.nextTasks ?? current.activeTasks)
    .filter((task) => task !== input.completedTask);
  const blockingQuestions = normalizeList(input.blockingQuestions ?? current.blockingQuestions);
  const verification = input.verification
    ? {
        status: input.verification.status,
        summary: input.verification.summary ?? null
      }
    : current.verification;
  const existingOutcomeRecord = currentOutcomeJsonRecord(current);
  const existingOutcome = currentOutcomeMetadata(current);
  const next: CurrentRunState = {
    ...current,
    objective: normalizeText(input.objective) ?? current.objective,
    activeTasks,
    blockingQuestions,
    verification,
    extra: {
      ...current.extra,
      outcome: {
        ...existingOutcomeRecord,
        mode: "framework",
        autonomousLoop: false,
        lastAdvanceTsUnix: nowSeconds(),
        lastToolError: normalizeText(input.toolError) ?? existingOutcome.lastToolError ?? null,
        repeatedToolErrorCount: input.repeatedToolErrorCount ?? existingOutcome.repeatedToolErrorCount ?? 0,
        stopCondition: outcomeStopCondition(activeTasks, blockingQuestions, verification.status)
      }
    }
  };

  const phase = deriveOutcomePhase(next);
  const phaseRepeatCount = existingOutcome.lastPhase === phase
    ? (existingOutcome.phaseRepeatCount ?? 0) + 1
    : 1;

  return {
    ...next,
    phase,
    extra: {
      ...next.extra,
      outcome: {
        ...currentOutcomeJsonRecord(next),
        lastPhase: phase,
        phaseRepeatCount
      }
    }
  };
}

export function buildNextOutcomeSummary(
  summary: RunSummary,
  current: CurrentRunState,
  input: OutcomeAdvanceInput
): RunSummary {
  const completedMilestones = [...summary.completedMilestones];
  const milestone = normalizeText(input.milestone);
  if (milestone && !completedMilestones.includes(milestone)) {
    completedMilestones.push(milestone);
  }

  const filesTouched = unique([...summary.filesTouched, ...(input.filesTouched ?? [])]);
  const lastVerifiedOutputs = [...summary.lastVerifiedOutputs];
  if (current.verification.status.toLowerCase() === "passed" && current.verification.summary) {
    lastVerifiedOutputs.push(current.verification.summary);
  }

  return {
    ...summary,
    completedMilestones,
    filesTouched,
    lastVerifiedOutputs: unique(lastVerifiedOutputs)
  };
}

export function deriveOutcomePhase(current: CurrentRunState): string {
  const blockers = current.blockingQuestions.filter(isRealBlockingQuestion);
  const verificationStatus = current.verification.status.toLowerCase();

  if (blockers.length > 0) {
    return "blocked";
  }
  if (verificationStatus === "failed" || verificationStatus === "failing" || verificationStatus === "blocked") {
    return "repairing";
  }
  if (current.activeTasks.length === 0 && (verificationStatus === "passed" || verificationStatus === "verified")) {
    return "closing";
  }
  return "executing";
}

export function outcomeAdvanceStatus(current: CurrentRunState): "advanced" | "blocked" | "closing" {
  if (current.phase === "blocked") {
    return "blocked";
  }
  if (current.phase === "closing") {
    return "closing";
  }
  return "advanced";
}

export function outcomeAdvanceDetails(current: CurrentRunState): string[] {
  return [
    `objective: ${current.objective}`,
    `phase: ${current.phase}`,
    `active tasks: ${current.activeTasks.length === 0 ? "none" : current.activeTasks.join(", ")}`,
    `blocking questions: ${current.blockingQuestions.length === 0 ? "none" : current.blockingQuestions.join(", ")}`,
    `verification: ${current.verification.status}${current.verification.summary ? ` (${current.verification.summary})` : ""}`,
    "autonomous loop: disabled"
  ];
}

export function currentOutcomeLastAdvanceTsUnix(current: CurrentRunState): number | null {
  const value = currentOutcomeMetadata(current).lastAdvanceTsUnix;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function currentOutcomeMetadata(current: CurrentRunState): OutcomeMetadata {
  const outcome = currentOutcomeJsonRecord(current);

  return {
    mode: typeof outcome.mode === "string" ? outcome.mode : undefined,
    autonomousLoop: typeof outcome.autonomousLoop === "boolean" ? outcome.autonomousLoop : undefined,
    lastAdvanceTsUnix: typeof outcome.lastAdvanceTsUnix === "number" ? outcome.lastAdvanceTsUnix : undefined,
    stopCondition: typeof outcome.stopCondition === "string" ? outcome.stopCondition : undefined,
    lastPhase: typeof outcome.lastPhase === "string" || outcome.lastPhase === null ? outcome.lastPhase : undefined,
    phaseRepeatCount: typeof outcome.phaseRepeatCount === "number" ? outcome.phaseRepeatCount : undefined,
    lastToolError: typeof outcome.lastToolError === "string" || outcome.lastToolError === null ? outcome.lastToolError : undefined,
    repeatedToolErrorCount: typeof outcome.repeatedToolErrorCount === "number" ? outcome.repeatedToolErrorCount : undefined
  };
}

function currentOutcomeJsonRecord(current: CurrentRunState): JsonRecord {
  const outcome = current.extra.outcome;

  if (!outcome || Array.isArray(outcome) || typeof outcome !== "object") {
    return {};
  }

  return outcome as JsonRecord;
}

function outcomeStopCondition(
  activeTasks: string[],
  blockingQuestions: string[],
  verificationStatus: string
): string {
  if (blockingQuestions.some(isRealBlockingQuestion)) {
    return "needs_input";
  }
  if (activeTasks.length === 0 && ["passed", "verified"].includes(verificationStatus.toLowerCase())) {
    return "verified";
  }
  return "continue_until_verified";
}

function normalizeList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function isRealBlockingQuestion(question: string): boolean {
  const normalized = question.trim().toLowerCase();

  return normalized.length > 0 && normalized !== "none" && normalized !== "n/a";
}
