import { type HostPlatform } from "@sane/control-plane/platform.js";

import { COMMAND_METADATA_REGISTRY } from "./command-registry-registry.js";
import { WINDOWS_EXPORT_ALL_FILES_TOUCHED, WINDOWS_EXPORT_ALL_INCLUDES } from "./command-registry-platform-paths.js";

import type { CommandSpec, SectionActionMetadata, TuiSectionId, TuiSectionMetadata, UiCommandId } from "./command-registry-types.js";

export { COMMAND_METADATA_REGISTRY };
export type {
  BackendCommandId,
  CommandConfirmationSpec,
  CommandPlacement,
  CommandSpec,
  LaunchShortcut,
  SectionActionMetadata,
  TuiSectionId,
  TuiSectionMetadata,
  UiCommandId
} from "./command-registry-types.js";

export function listSections(hostPlatform?: HostPlatform): TuiSectionMetadata[] {
  return COMMAND_METADATA_REGISTRY.sections.map((section) => getSectionMetadata(section.id, hostPlatform));
}

export function getSectionMetadata(
  sectionId: TuiSectionId,
  hostPlatform?: HostPlatform
): TuiSectionMetadata {
  const section = COMMAND_METADATA_REGISTRY.sections.find((entry) => entry.id === sectionId)!;

  if (sectionId !== "add_to_codex" || hostPlatform !== "windows") {
    return { ...section, description: [...section.description] };
  }

  return {
    ...section,
    description: [
      "Install or refresh Sane-managed Codex add-ons.",
      "Personal add-ons update your Codex setup. Repo writes stay explicit and optional.",
      "On native Windows, hooks stay outside personal bundle. Use WSL for hook-enabled flows."
    ]
  };
}

export function getCommandSpec(commandId: UiCommandId, hostPlatform?: HostPlatform): CommandSpec {
  const spec = COMMAND_METADATA_REGISTRY.commands[commandId] as CommandSpec;

  if (hostPlatform !== "windows") {
    return {
      ...spec,
      help: [...spec.help],
      filesTouched: [...spec.filesTouched],
      includes: spec.includes ? [...spec.includes] : undefined
    };
  }

  if (commandId === "export_hooks") {
    return {
      ...spec,
      help: [...spec.help],
      filesTouched: []
    };
  }

  if (commandId === "export_all") {
    return {
      ...spec,
      help: [...spec.help],
      filesTouched: [...WINDOWS_EXPORT_ALL_FILES_TOUCHED],
      includes: [...WINDOWS_EXPORT_ALL_INCLUDES]
    };
  }

  return {
    ...spec,
    help: [...spec.help],
    filesTouched: [...spec.filesTouched],
    includes: spec.includes ? [...spec.includes] : undefined
  };
}

export function listSectionActions(
  sectionId: TuiSectionId,
  hostPlatform?: HostPlatform
): SectionActionMetadata[] {
  return COMMAND_METADATA_REGISTRY.placements
    .filter((placement) => placement.section === sectionId)
    .sort((left, right) => left.order - right.order)
    .map((placement) => ({
      ...getCommandSpec(placement.commandId, hostPlatform),
      label: placement.label,
      order: placement.order,
      section: placement.section
    }));
}
