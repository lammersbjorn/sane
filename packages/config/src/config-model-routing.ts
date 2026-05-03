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
export const EXECUTION_REASONING: readonly ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh'];
export const SIDECAR_REASONING: readonly ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh'];
export const VERIFIER_REASONING: readonly ReasoningEffort[] = ['high', 'medium', 'xhigh', 'low'];
export const REALTIME_REASONING: readonly ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh'];
export const FRONTEND_CRAFT_REASONING: readonly ReasoningEffort[] = ['high', 'xhigh', 'medium', 'low'];

export const COORDINATOR_REASONING_BY_MODEL: Record<string, readonly ReasoningEffort[]> = {
  'gpt-5.5': ['low', 'medium', 'high', 'xhigh'],
  'gpt-5.4-mini': ['medium', 'low', 'high', 'xhigh'],
  'gpt-5.3-codex-spark': ['medium', 'low', 'high', 'xhigh'],
  'gpt-5.1-codex-mini': ['medium', 'low', 'high', 'xhigh'],
};

type RoutingClass =
  | 'coordinator'
  | 'execution'
  | 'sidecar'
  | 'verifier'
  | 'realtime'
  | 'frontendCraft';

interface ModelScoreProfile {
  frontier: number;
  coding: number;
  economy: number;
  realtime: number;
  review: number;
  visual: number;
}

const MODEL_SCORE_PROFILES: Record<string, ModelScoreProfile> = {
  'gpt-5.5': {
    frontier: 100,
    coding: 95,
    economy: 62,
    realtime: 42,
    review: 100,
    visual: 100,
  },
  'gpt-5.4': {
    frontier: 86,
    coding: 82,
    economy: 58,
    realtime: 45,
    review: 86,
    visual: 84,
  },
  'gpt-5.4-mini': {
    frontier: 54,
    coding: 62,
    economy: 100,
    realtime: 74,
    review: 58,
    visual: 44,
  },
  'gpt-5.3-codex': {
    frontier: 78,
    coding: 90,
    economy: 70,
    realtime: 56,
    review: 78,
    visual: 68,
  },
  'gpt-5.3-codex-spark': {
    frontier: 46,
    coding: 70,
    economy: 92,
    realtime: 100,
    review: 48,
    visual: 36,
  },
  'gpt-5.2': {
    frontier: 70,
    coding: 70,
    economy: 54,
    realtime: 40,
    review: 68,
    visual: 58,
  },
  'gpt-5.1-codex': {
    frontier: 58,
    coding: 68,
    economy: 55,
    realtime: 44,
    review: 58,
    visual: 48,
  },
  'gpt-5-codex': {
    frontier: 54,
    coding: 64,
    economy: 52,
    realtime: 42,
    review: 54,
    visual: 44,
  },
  'gpt-5.1-codex-mini': {
    frontier: 34,
    coding: 46,
    economy: 86,
    realtime: 70,
    review: 34,
    visual: 28,
  },
};

const ROUTING_SCORE_WEIGHTS: Record<RoutingClass, ModelScoreProfile> = {
  coordinator: {
    frontier: 5,
    coding: 2,
    economy: 2,
    realtime: 0,
    review: 2,
    visual: 0,
  },
  execution: {
    frontier: 3,
    coding: 6,
    economy: 1,
    realtime: 0,
    review: 0,
    visual: 0,
  },
  sidecar: {
    frontier: 0,
    coding: 1,
    economy: 5,
    realtime: 1,
    review: 0,
    visual: 0,
  },
  verifier: {
    frontier: 3,
    coding: 1,
    economy: 0,
    realtime: 0,
    review: 5,
    visual: 0,
  },
  realtime: {
    frontier: 0,
    coding: 1,
    economy: 3,
    realtime: 5,
    review: 0,
    visual: 0,
  },
  frontendCraft: {
    frontier: 3,
    coding: 2,
    economy: 0,
    realtime: 0,
    review: 1,
    visual: 5,
  },
};

const REASONING_SCORE: Record<ReasoningEffort, number> = {
  low: 4,
  medium: 3,
  high: 2,
  xhigh: 1,
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
        'coordinator',
        COORDINATOR_PRIORITY,
        COORDINATOR_REASONING,
        COORDINATOR_REASONING_BY_MODEL,
      ) ?? selectAvailableModelPreset(availableModels, true, COORDINATOR_REASONING)!,
    execution:
      pickModelPreset(availableModels, 'execution', EXECUTION_PRIORITY, EXECUTION_REASONING) ??
      selectAvailableModelPreset(availableModels, true, EXECUTION_REASONING)!,
    sidecar:
      pickModelPreset(availableModels, 'sidecar', SIDECAR_PRIORITY, SIDECAR_REASONING) ??
      selectAvailableModelPreset(availableModels, false, SIDECAR_REASONING)!,
    verifier:
      pickModelPreset(availableModels, 'verifier', VERIFIER_PRIORITY, VERIFIER_REASONING) ??
      selectAvailableModelPreset(availableModels, true, VERIFIER_REASONING)!,
    realtime:
      pickModelPreset(availableModels, 'realtime', REALTIME_PRIORITY, REALTIME_REASONING) ??
      selectAvailableModelPreset(availableModels, false, REALTIME_REASONING)!,
  };
}

export function buildRecommendedSubagentFrontendCraftPreset(
  availableModels: readonly DetectedAvailableModel[],
): ModelPreset | undefined {
  return (
    pickModelPreset(
      availableModels,
      'frontendCraft',
      FRONTEND_CRAFT_PRIORITY,
      FRONTEND_CRAFT_REASONING,
    ) ??
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
  routingClass: RoutingClass,
  priority: readonly string[],
  reasoningPriority: readonly ReasoningEffort[],
  reasoningPriorityByModel: Readonly<Record<string, readonly ReasoningEffort[]>> = {},
): ModelPreset | undefined {
  const candidates = priority.flatMap((slug, priorityIndex) => {
    const model = availableModels.find((candidate) => candidate.slug === slug);
    const profile = MODEL_SCORE_PROFILES[slug];
    if (!model || !profile) {
      return [];
    }

    const candidateReasoningPriority = reasoningPriorityByModel[slug] ?? reasoningPriority;
    const reasoningEffort =
      candidateReasoningPriority.find((candidate) => model.reasoningEfforts.includes(candidate)) ??
      model.reasoningEfforts[0];
    if (!reasoningEffort) {
      return [];
    }

    return [{
      preset: {
        model: model.slug,
        reasoningEffort,
      },
      priorityIndex,
      score:
        scoreModelForRoutingClass(profile, ROUTING_SCORE_WEIGHTS[routingClass]) +
        scoreReasoning(reasoningEffort, candidateReasoningPriority),
    }];
  });

  candidates.sort(
    (left, right) => right.score - left.score || left.priorityIndex - right.priorityIndex,
  );

  return candidates[0]?.preset;
}

function scoreModelForRoutingClass(profile: ModelScoreProfile, weights: ModelScoreProfile): number {
  return (
    profile.frontier * weights.frontier +
    profile.coding * weights.coding +
    profile.economy * weights.economy +
    profile.realtime * weights.realtime +
    profile.review * weights.review +
    profile.visual * weights.visual
  );
}

function scoreReasoning(
  reasoningEffort: ReasoningEffort,
  reasoningPriority: readonly ReasoningEffort[],
): number {
  const priorityBonus = Math.max(0, reasoningPriority.length - reasoningPriority.indexOf(reasoningEffort));
  return REASONING_SCORE[reasoningEffort] + priorityBonus;
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
