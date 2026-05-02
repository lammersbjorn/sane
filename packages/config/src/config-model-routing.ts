import type {
  DetectedAvailableModel,
  ModelPreset,
  ModelRoutingPresets,
  ReasoningEffort,
} from './index.js';

export const COORDINATOR_PRIORITY = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2',
  'gpt-5.4-mini',
  'gpt-5.3-codex-spark',
  'gpt-5.1-codex',
  'gpt-5-codex',
  'gpt-5.1-codex-mini',
] as const;

export const EXECUTION_PRIORITY = [
  'gpt-5.3-codex',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.2',
  'gpt-5.3-codex-spark',
  'gpt-5.1-codex',
  'gpt-5-codex',
  'gpt-5.4-mini',
  'gpt-5.1-codex-mini',
] as const;

export const SIDECAR_PRIORITY = [
  'gpt-5.4-mini',
  'gpt-5.3-codex-spark',
  'gpt-5.3-codex',
  'gpt-5.4',
  'gpt-5.5',
  'gpt-5.2',
  'gpt-5.1-codex-mini',
  'gpt-5.1-codex',
  'gpt-5-codex',
] as const;

export const VERIFIER_PRIORITY = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2',
  'gpt-5.4-mini',
  'gpt-5.3-codex-spark',
  'gpt-5.1-codex',
  'gpt-5-codex',
  'gpt-5.1-codex-mini',
] as const;

export const REALTIME_PRIORITY = [
  'gpt-5.3-codex-spark',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.4',
  'gpt-5.5',
  'gpt-5.2',
  'gpt-5.1-codex-mini',
  'gpt-5.1-codex',
  'gpt-5-codex',
] as const;

export const FRONTEND_CRAFT_PRIORITY = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2',
  'gpt-5.4-mini',
  'gpt-5.3-codex-spark',
  'gpt-5.1-codex',
  'gpt-5-codex',
  'gpt-5.1-codex-mini',
] as const;

export const COORDINATOR_REASONING: readonly ReasoningEffort[] = ['high', 'xhigh', 'medium', 'low'];
export const EXECUTION_REASONING: readonly ReasoningEffort[] = ['medium', 'high', 'low', 'xhigh'];
export const SIDECAR_REASONING: readonly ReasoningEffort[] = ['medium', 'low', 'high', 'xhigh'];
export const VERIFIER_REASONING: readonly ReasoningEffort[] = ['high', 'medium', 'xhigh', 'low'];
export const REALTIME_REASONING: readonly ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh'];
export const FRONTEND_CRAFT_REASONING: readonly ReasoningEffort[] = ['high', 'xhigh', 'medium', 'low'];

export const COORDINATOR_REASONING_BY_MODEL: Record<string, readonly ReasoningEffort[]> = {
  'gpt-5.5': ['medium', 'high', 'xhigh', 'low'],
};

export function buildRecommendedModelRoutingPresets(
  availableModels: readonly DetectedAvailableModel[],
): ModelRoutingPresets | undefined {
  if (availableModels.length === 0) {
    return undefined;
  }

  return {
    coordinator:
      pickModelPreset(
        availableModels,
        COORDINATOR_PRIORITY,
        COORDINATOR_REASONING,
        COORDINATOR_REASONING_BY_MODEL,
      ) ?? selectAvailableModelPreset(availableModels, true, COORDINATOR_REASONING)!,
    execution:
      pickModelPreset(availableModels, EXECUTION_PRIORITY, EXECUTION_REASONING) ??
      selectAvailableModelPreset(availableModels, true, EXECUTION_REASONING)!,
    sidecar:
      pickModelPreset(availableModels, SIDECAR_PRIORITY, SIDECAR_REASONING) ??
      selectAvailableModelPreset(availableModels, false, SIDECAR_REASONING)!,
    verifier:
      pickModelPreset(availableModels, VERIFIER_PRIORITY, VERIFIER_REASONING) ??
      selectAvailableModelPreset(availableModels, true, VERIFIER_REASONING)!,
    realtime:
      pickModelPreset(availableModels, REALTIME_PRIORITY, REALTIME_REASONING) ??
      selectAvailableModelPreset(availableModels, false, REALTIME_REASONING)!,
  };
}

export function buildRecommendedSubagentFrontendCraftPreset(
  availableModels: readonly DetectedAvailableModel[],
): ModelPreset | undefined {
  return (
    pickModelPreset(availableModels, FRONTEND_CRAFT_PRIORITY, FRONTEND_CRAFT_REASONING) ??
    selectAvailableModelPreset(availableModels, true, FRONTEND_CRAFT_REASONING)
  );
}

export function pickReasoningForModel(
  availableModels: readonly DetectedAvailableModel[],
  model: string,
  reasoningPriority: readonly ReasoningEffort[],
  fallback: ReasoningEffort,
): ReasoningEffort {
  const detected = availableModels.find((candidate) => candidate.slug === model);
  if (!detected) {
    return fallback;
  }

  const reasoningEffort =
    reasoningPriority.find((candidate) => detected.reasoningEfforts.includes(candidate)) ??
    detected.reasoningEfforts[0];

  return reasoningEffort ?? fallback;
}

function pickModelPreset(
  availableModels: readonly DetectedAvailableModel[],
  priority: readonly string[],
  reasoningPriority: readonly ReasoningEffort[],
  reasoningPriorityByModel: Readonly<Record<string, readonly ReasoningEffort[]>> = {},
): ModelPreset | undefined {
  for (const slug of priority) {
    const model = availableModels.find((candidate) => candidate.slug === slug);
    if (!model) {
      continue;
    }

    const candidateReasoningPriority = reasoningPriorityByModel[slug] ?? reasoningPriority;
    const reasoningEffort =
      candidateReasoningPriority.find((candidate) => model.reasoningEfforts.includes(candidate)) ??
      model.reasoningEfforts[0];
    if (!reasoningEffort) {
      continue;
    }

    return {
      model: model.slug,
      reasoningEffort,
    };
  }

  return undefined;
}

function selectAvailableModelPreset(
  availableModels: readonly DetectedAvailableModel[],
  strongest: boolean,
  reasoningPriority: readonly ReasoningEffort[],
): ModelPreset | undefined {
  const model = strongest ? availableModels[0] : availableModels[availableModels.length - 1];
  if (!model) {
    return undefined;
  }

  const reasoningEffort =
    reasoningPriority.find((candidate) => model.reasoningEfforts.includes(candidate)) ??
    model.reasoningEfforts[0];
  if (!reasoningEffort) {
    return undefined;
  }

  return {
    model: model.slug,
    reasoningEffort,
  };
}
