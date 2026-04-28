const MANAGED_TOKSCALE_SUBMIT_HOOK_COMMAND_SUFFIX = "hook tokscale-submit";
const DEFAULT_MANAGED_TOKSCALE_SUBMIT_HOOK_EXECUTABLE = "sane";

export const MANAGED_TOKSCALE_STATUS_MESSAGE = "Submitting Codex usage to Tokscale";

export type ManagedTokscaleSubmitHookEvent = "session-end";

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
    "const output = [`sane tokscale hook: ${event}${dryRun ? ' dry-run' : ' submit'}`, result.stdout && result.stdout.trim(), result.stderr && result.stderr.trim()].filter(Boolean).join('\\n');",
    "if (result.error) { process.stdout.write(`${output}\\ntokscale unavailable or timed out: ${result.error.message}\\n`); process.exit(0); }",
    "if (typeof result.status === 'number' && result.status !== 0) { process.stdout.write(`${output}\\ntokscale exited ${result.status}; hook ignored to avoid blocking Codex.\\n`); process.exit(0); }",
    "process.stdout.write(`${output}\\n`);"
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
