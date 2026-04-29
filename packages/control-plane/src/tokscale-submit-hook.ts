const MANAGED_TOKSCALE_SUBMIT_HOOK_COMMAND_SUFFIX = "hook tokscale-submit";
const DEFAULT_MANAGED_TOKSCALE_SUBMIT_HOOK_EXECUTABLE = "sane";

export const MANAGED_TOKSCALE_STATUS_MESSAGE = "Submitting Codex usage to Tokscale";
export const TOKSCALE_SUBMIT_HOOK_EVENT_NAME = "Stop";

export type ManagedTokscaleSubmitHookEvent = "stop";

export function buildManagedTokscaleSubmitHookCommand(
  event: ManagedTokscaleSubmitHookEvent,
  options: { dryRun?: boolean; executable?: string } = {}
): string {
  const dryRunFlag = options.dryRun === false ? "" : " --dry-run";
  if (options.executable === undefined) {
    return buildInlineTokscaleSubmitHookCommand(event, options.dryRun !== false);
  }
  const executable = options.executable ?? DEFAULT_MANAGED_TOKSCALE_SUBMIT_HOOK_EXECUTABLE;
  const commandExecutable =
    executable.trim().length > 0 ? executable : DEFAULT_MANAGED_TOKSCALE_SUBMIT_HOOK_EXECUTABLE;
  return `${shellQuote(commandExecutable)} ${MANAGED_TOKSCALE_SUBMIT_HOOK_COMMAND_SUFFIX} --event ${event}${dryRunFlag}`;
}

export function isManagedTokscaleSubmitHookCommand(command: string): boolean {
  return command.includes(MANAGED_TOKSCALE_SUBMIT_HOOK_COMMAND_SUFFIX);
}

export function renderTokscaleSubmitHookOutput(): string {
  return JSON.stringify({});
}

function buildInlineTokscaleSubmitHookCommand(event: ManagedTokscaleSubmitHookEvent, dryRun: boolean): string {
  const args = ["submit", "--codex"];
  if (dryRun) {
    args.push("--dry-run");
  }
  const script = [
    "const { spawnSync } = require('node:child_process');",
    `const event = ${JSON.stringify(event)};`,
    `const dryRun = ${JSON.stringify(dryRun)};`,
    `const result = spawnSync('tokscale', ${JSON.stringify(args)}, { encoding: 'utf8', timeout: 20000 });`,
    "void result;",
    "process.stdout.write(JSON.stringify({}));"
  ].join(" ");
  return buildInlineNodeCommand(
    script,
    `${MANAGED_TOKSCALE_SUBMIT_HOOK_COMMAND_SUFFIX} --event ${event}${dryRun ? " --dry-run" : ""}`
  );
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function buildInlineNodeCommand(script: string, managedMarker: string): string {
  return `${shellQuote(process.execPath)} -e ${shellQuote(script)} # ${managedMarker}`;
}
