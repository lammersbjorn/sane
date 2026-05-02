import { COMMAND_SPECS } from "./command-registry-commands.js";
import { COMMAND_PLACEMENTS } from "./command-registry-placements.js";
import { SECTION_METADATA, SECTION_SHORTCUTS } from "./command-registry-sections.js";

export const COMMAND_METADATA_REGISTRY = {
  shortcuts: SECTION_SHORTCUTS,
  sections: SECTION_METADATA,
  commands: COMMAND_SPECS,
  placements: COMMAND_PLACEMENTS
} as const;
