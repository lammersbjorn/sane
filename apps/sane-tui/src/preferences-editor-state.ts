import {
  ISSUE_RELAY_MODES,
  PICKER_MODELS,
  REASONING_EFFORTS,
  TELEMETRY_LEVELS,
  createDefaultPackConfig,
  type LocalConfig
} from "@sane/config";
import { OPTIONAL_PACK_METADATA, type OptionalPackName } from "@sane/framework-assets";

export type ConfigFieldId =
  | "main_model"
  | "main_reasoning"
  | "explorer_model"
  | "explorer_reasoning"
  | "implementation_model"
  | "implementation_reasoning"
  | "reviewer_model"
  | "reviewer_reasoning"
  | "realtime_model"
  | "realtime_reasoning"
  | "frontend_craft_model"
  | "frontend_craft_reasoning";

export type PackFieldId = string;
export type PrivacyFieldId = "telemetry" | "issue_relay";

export interface ConfigEditorState {
  kind: "config";
  initial: LocalConfig;
  config: LocalConfig;
  defaults: LocalConfig;
  selected: number;
  fields: ConfigFieldId[];
  canSave: boolean;
  canReset: boolean;
}

export interface PackEditorState {
  kind: "packs";
  initial: LocalConfig["packs"];
  config: LocalConfig;
  defaults: LocalConfig["packs"];
  selected: number;
  fields: PackFieldId[];
  canSave: boolean;
  canReset: boolean;
}

export interface PrivacyEditorState {
  kind: "privacy";
  initial: Pick<LocalConfig, "privacy" | "issueRelay">;
  config: LocalConfig;
  defaults: Pick<LocalConfig, "privacy" | "issueRelay">;
  selected: number;
  fields: PrivacyFieldId[];
  canSave: boolean;
  canReset: boolean;
}

export interface ConfigFieldMetadata {
  label: string;
  explanation: string;
  options: typeof PICKER_MODELS | typeof REASONING_EFFORTS;
  value: (config: LocalConfig) => string;
  applyStep: (config: LocalConfig, step: 1 | -1) => void;
}

export const CONFIG_FIELD_METADATA: Record<ConfigFieldId, ConfigFieldMetadata> = {
  main_model: {
    label: "Main session model",
    explanation:
      "Default model for the top-level Codex session when Sane writes recommended Codex settings.",
    options: PICKER_MODELS,
    value: (config) => config.models.coordinator.model,
    applyStep: (config, step) => {
      config.models.coordinator.model = cycleValue(PICKER_MODELS, config.models.coordinator.model, step);
    }
  },
  main_reasoning: {
    label: "Main session reasoning",
    explanation: "Default reasoning depth for the top-level Codex session.",
    options: REASONING_EFFORTS,
    value: (config) => config.models.coordinator.reasoningEffort,
    applyStep: (config, step) => {
      config.models.coordinator.reasoningEffort = cycleValue(
        REASONING_EFFORTS,
        config.models.coordinator.reasoningEffort,
        step
      );
    }
  },
  explorer_model: {
    label: "Explorer agent model",
    explanation:
      "Default model for discovery agents that inspect code, docs, and state without editing files.",
    options: PICKER_MODELS,
    value: (config) => config.subagents.explorer.model,
    applyStep: (config, step) => {
      config.subagents.explorer.model = cycleValue(PICKER_MODELS, config.subagents.explorer.model, step);
      config.models.sidecar.model = config.subagents.explorer.model;
    }
  },
  explorer_reasoning: {
    label: "Explorer agent reasoning",
    explanation: "Default reasoning depth for discovery agents that inspect without editing.",
    options: REASONING_EFFORTS,
    value: (config) => config.subagents.explorer.reasoningEffort,
    applyStep: (config, step) => {
      config.subagents.explorer.reasoningEffort = cycleValue(
        REASONING_EFFORTS,
        config.subagents.explorer.reasoningEffort,
        step
      );
      config.models.sidecar.reasoningEffort = config.subagents.explorer.reasoningEffort;
    }
  },
  implementation_model: {
    label: "Implementation agent model",
    explanation: "Default model for bounded code-change agents.",
    options: PICKER_MODELS,
    value: (config) => config.subagents.implementation.model,
    applyStep: (config, step) => {
      config.subagents.implementation.model = cycleValue(PICKER_MODELS, config.subagents.implementation.model, step);
    }
  },
  implementation_reasoning: {
    label: "Implementation agent reasoning",
    explanation: "Default reasoning depth for bounded code-change agents.",
    options: REASONING_EFFORTS,
    value: (config) => config.subagents.implementation.reasoningEffort,
    applyStep: (config, step) => {
      config.subagents.implementation.reasoningEffort = cycleValue(
        REASONING_EFFORTS,
        config.subagents.implementation.reasoningEffort,
        step
      );
    }
  },
  reviewer_model: {
    label: "Reviewer agent model",
    explanation: "Default model for review, checking, and verification agents.",
    options: PICKER_MODELS,
    value: (config) => config.subagents.verifier.model,
    applyStep: (config, step) => {
      config.subagents.verifier.model = cycleValue(PICKER_MODELS, config.subagents.verifier.model, step);
      config.models.verifier.model = config.subagents.verifier.model;
    }
  },
  reviewer_reasoning: {
    label: "Reviewer agent reasoning",
    explanation: "Default reasoning depth for review, checking, and verification agents.",
    options: REASONING_EFFORTS,
    value: (config) => config.subagents.verifier.reasoningEffort,
    applyStep: (config, step) => {
      config.subagents.verifier.reasoningEffort = cycleValue(
        REASONING_EFFORTS,
        config.subagents.verifier.reasoningEffort,
        step
      );
      config.models.verifier.reasoningEffort = config.subagents.verifier.reasoningEffort;
    }
  },
  realtime_model: {
    label: "Realtime helper model",
    explanation: "Default model for fast iteration and lightweight helper work.",
    options: PICKER_MODELS,
    value: (config) => config.subagents.realtime.model,
    applyStep: (config, step) => {
      config.subagents.realtime.model = cycleValue(PICKER_MODELS, config.subagents.realtime.model, step);
    }
  },
  realtime_reasoning: {
    label: "Realtime helper reasoning",
    explanation: "Default reasoning depth for fast iteration and lightweight helper work.",
    options: REASONING_EFFORTS,
    value: (config) => config.subagents.realtime.reasoningEffort,
    applyStep: (config, step) => {
      config.subagents.realtime.reasoningEffort = cycleValue(
        REASONING_EFFORTS,
        config.subagents.realtime.reasoningEffort,
        step
      );
    }
  },
  frontend_craft_model: {
    label: "Frontend craft agent model",
    explanation: "Default model for UI generation, redesign, visual polish, and visual QA agents.",
    options: PICKER_MODELS,
    value: (config) => config.subagents.frontendCraft.model,
    applyStep: (config, step) => {
      config.subagents.frontendCraft.model = cycleValue(PICKER_MODELS, config.subagents.frontendCraft.model, step);
    }
  },
  frontend_craft_reasoning: {
    label: "Frontend craft agent reasoning",
    explanation:
      "Default reasoning depth for UI generation, redesign, screenshot/Figma parity, and visual QA.",
    options: REASONING_EFFORTS,
    value: (config) => config.subagents.frontendCraft.reasoningEffort,
    applyStep: (config, step) => {
      config.subagents.frontendCraft.reasoningEffort = cycleValue(
        REASONING_EFFORTS,
        config.subagents.frontendCraft.reasoningEffort,
        step
      );
    }
  }
};

const CONFIG_FIELDS: ConfigFieldId[] = Object.keys(CONFIG_FIELD_METADATA) as ConfigFieldId[];

const PACK_FIELD_ID_BY_NAME = Object.fromEntries(
  OPTIONAL_PACK_METADATA.map((entry) => [entry.name, packNameToFieldId(entry.name)])
) as Record<OptionalPackName, PackFieldId>;

const PACK_NAME_BY_FIELD = Object.fromEntries(
  OPTIONAL_PACK_METADATA.map((entry) => [packNameToFieldId(entry.name), entry.name])
) as Record<PackFieldId, OptionalPackName>;

const PACK_CONFIG_KEY_BY_FIELD = Object.fromEntries(
  OPTIONAL_PACK_METADATA.map((entry) => [packNameToFieldId(entry.name), entry.configKey])
) as Record<PackFieldId, keyof LocalConfig["packs"]>;

const PACK_FIELDS: PackFieldId[] = OPTIONAL_PACK_METADATA.map(
  (entry) => PACK_FIELD_ID_BY_NAME[entry.name]
);
const PRIVACY_FIELDS: PrivacyFieldId[] = ["telemetry", "issue_relay"];

export function createConfigEditorState(
  config: LocalConfig,
  defaults: LocalConfig
): ConfigEditorState {
  return withConfigAffordances({
    kind: "config",
    initial: structuredClone(config),
    config: structuredClone(config),
    defaults: structuredClone(defaults),
    selected: 0,
    fields: CONFIG_FIELDS
  });
}

export function moveConfigFieldSelection(
  state: ConfigEditorState,
  step: 1 | -1
): ConfigEditorState {
  return withConfigAffordances({
    ...state,
    selected: wrapIndex(state.selected + step, state.fields.length)
  });
}

export function cycleSelectedConfigField(
  state: ConfigEditorState,
  step: 1 | -1
): ConfigEditorState {
  const next = structuredClone(state);
  const field = state.fields[state.selected]!;
  CONFIG_FIELD_METADATA[field].applyStep(next.config, step);

  return withConfigAffordances(next);
}

export function resetConfigEditor(state: ConfigEditorState): ConfigEditorState {
  return withConfigAffordances({
    ...state,
    config: structuredClone(state.defaults)
  });
}

export function createPackEditorState(config: LocalConfig): PackEditorState {
  return withPackAffordances({
    kind: "packs",
    initial: structuredClone(config.packs),
    config: structuredClone(config),
    defaults: createDefaultPackConfig(),
    selected: 0,
    fields: PACK_FIELDS
  });
}

export function movePackSelection(state: PackEditorState, step: 1 | -1): PackEditorState {
  return withPackAffordances({
    ...state,
    selected: wrapIndex(state.selected + step, state.fields.length)
  });
}

export function toggleSelectedPack(state: PackEditorState): PackEditorState {
  const next = structuredClone(state);
  const field = state.fields[state.selected]!;
  const configKey = packFieldConfigKey(field);
  next.config.packs[configKey] = !next.config.packs[configKey];

  next.config.packs.core = true;
  return withPackAffordances(next);
}

export function packFieldPackName(field: PackFieldId): OptionalPackName {
  return PACK_NAME_BY_FIELD[field];
}

export function packFieldConfigKey(field: PackFieldId): keyof LocalConfig["packs"] {
  return PACK_CONFIG_KEY_BY_FIELD[field];
}

export function resetPackEditor(state: PackEditorState): PackEditorState {
  return withPackAffordances({
    ...state,
    config: {
      ...structuredClone(state.config),
      packs: structuredClone(state.defaults)
    }
  });
}

export function createPrivacyEditorState(config: LocalConfig): PrivacyEditorState {
  return withPrivacyAffordances({
    kind: "privacy",
    initial: {
      privacy: structuredClone(config.privacy),
      issueRelay: structuredClone(config.issueRelay)
    },
    config: structuredClone(config),
    defaults: {
      privacy: { telemetry: "off" },
      issueRelay: { mode: "off" }
    },
    selected: 0,
    fields: PRIVACY_FIELDS
  });
}

export function movePrivacySelection(state: PrivacyEditorState, step: 1 | -1): PrivacyEditorState {
  return withPrivacyAffordances({
    ...state,
    selected: wrapIndex(state.selected + step, state.fields.length)
  });
}

export function cycleTelemetryLevel(
  state: PrivacyEditorState,
  step: 1 | -1
): PrivacyEditorState {
  const field = state.fields[state.selected]!;
  if (field === "issue_relay") {
    return withPrivacyAffordances({
      ...state,
      config: {
        ...structuredClone(state.config),
        issueRelay: {
          mode: cycleValue(ISSUE_RELAY_MODES, state.config.issueRelay.mode, step)
        }
      }
    });
  }

  return withPrivacyAffordances({
    ...state,
    config: {
      ...structuredClone(state.config),
      privacy: {
        telemetry: cycleValue(TELEMETRY_LEVELS, state.config.privacy.telemetry, step)
      }
    }
  });
}

export function resetPrivacyEditor(state: PrivacyEditorState): PrivacyEditorState {
  return withPrivacyAffordances({
    ...state,
    config: {
      ...structuredClone(state.config),
      privacy: {
        telemetry: "off"
      },
      issueRelay: {
        mode: "off"
      }
    }
  });
}

function cycleValue<const T extends readonly string[]>(
  values: T,
  current: string,
  step: 1 | -1
): T[number] {
  const index = values.indexOf(current as T[number]);
  return values[wrapIndex((index === -1 ? 0 : index) + step, values.length)]!;
}

function wrapIndex(index: number, length: number): number {
  return (index + length) % length;
}

function packNameToFieldId(packName: string): PackFieldId {
  return packName.replaceAll("-", "_");
}

function withConfigAffordances(state: Omit<ConfigEditorState, "canSave" | "canReset">): ConfigEditorState {
  const canSave = JSON.stringify(state.config) !== JSON.stringify(state.initial);
  const canReset = JSON.stringify(state.config) !== JSON.stringify(state.defaults);
  return {
    ...state,
    canSave,
    canReset
  };
}

function withPackAffordances(state: Omit<PackEditorState, "canSave" | "canReset">): PackEditorState {
  const canSave = JSON.stringify(state.config.packs) !== JSON.stringify(state.initial);
  const canReset = JSON.stringify(state.config.packs) !== JSON.stringify(state.defaults);
  return {
    ...state,
    canSave,
    canReset
  };
}

function withPrivacyAffordances(
  state: Omit<PrivacyEditorState, "canSave" | "canReset">
): PrivacyEditorState {
  const current = {
    privacy: state.config.privacy,
    issueRelay: state.config.issueRelay
  };
  const canSave = JSON.stringify(current) !== JSON.stringify(state.initial);
  const canReset = JSON.stringify(current) !== JSON.stringify(state.defaults);
  return {
    ...state,
    canSave,
    canReset
  };
}
