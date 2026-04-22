const MANAGED_SESSION_START_HOOK_COMMAND_SUFFIX = "hook session-start";
const DEFAULT_MANAGED_SESSION_START_HOOK_EXECUTABLE = "sane";

export const MANAGED_SESSION_START_STATUS_MESSAGE = "Loading Sane session defaults";
export const SESSION_START_HOOK_EVENT_NAME = "SessionStart";
export const SESSION_START_HOOK_ADDITIONAL_CONTEXT =
  "Sane active for this session: plain-language first, commands optional, avoid workflow lock-in, adapt model and subagent use to the task.";

export function buildManagedSessionStartHookCommand(
  executable: string = DEFAULT_MANAGED_SESSION_START_HOOK_EXECUTABLE
): string {
  const commandExecutable =
    executable.trim().length > 0 ? executable : DEFAULT_MANAGED_SESSION_START_HOOK_EXECUTABLE;
  return `${shellQuote(commandExecutable)} ${MANAGED_SESSION_START_HOOK_COMMAND_SUFFIX}`;
}

export function isManagedSessionStartHookCommand(command: string): boolean {
  return command.includes(MANAGED_SESSION_START_HOOK_COMMAND_SUFFIX);
}

export function renderSessionStartHookOutput(): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: SESSION_START_HOOK_EVENT_NAME,
      additionalContext: SESSION_START_HOOK_ADDITIONAL_CONTEXT
    }
  });
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}
