export function compactActionLabel(label: string): string {
  return label
    .replace("Get this repo ready", "Set up local files")
    .replace("Choose how Codex should work", "Set Codex defaults")
    .replace("Teach Codex the Sane workflow", "Install Sane guidance")
    .replace("Set up local Sane files", "Create local Sane files")
    .replace("Add or refresh Codex add-ons", "Update Codex add-ons")
    .replace("View your current ", "View ")
    .replace("Preview optional ", "Preview ")
    .replace("Apply optional ", "Apply ")
    .replace("Enable or disable built-in guidance packs", "Manage guidance options")
    .replace("Edit default model and reasoning settings", "Edit model defaults")
    .replace("Choose your telemetry and privacy level", "Set telemetry and privacy")
    .replace("Show everything Sane currently manages", "Show managed files and settings")
    .replace("Run Sane doctor checks for problems", "Run health check")
    .replace("View saved Sane handoff notes", "View handoff notes")
    .replace("Explain Codex routing choices", "Explain routing")
    .replace("Check long-run readiness", "Check readiness")
    .replace("Codex settings", "Codex")
    .replace("compatibility settings", "compatibility")
    .replace("statusline settings", "statusline");
}

export function compactStatusSummary(summary: string): string {
  let result = "";
  let token = "";
  for (const char of summary) {
    if (isWhitespace(char)) {
      result += compactPathToken(token);
      result += char;
      token = "";
      continue;
    }
    token += char;
  }
  return result + compactPathToken(token);
}

function compactPathToken(token: string): string {
  const marker = "/.sane";
  const markerIndex = token.indexOf(marker);
  if (markerIndex < 0) {
    return token;
  }
  const afterMarker = markerIndex + marker.length;
  const next = token[afterMarker];
  if (next !== undefined && isWordChar(next)) {
    return token;
  }
  return `.sane${token.slice(afterMarker)}`;
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function isWordChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57)
    || (code >= 65 && code <= 90)
    || (code >= 97 && code <= 122)
    || char === "_"
  );
}
