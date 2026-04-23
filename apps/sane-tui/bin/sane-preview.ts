import { parseCliArgs, runCliCommandFromDiscovery } from "../src/cli.js";
import { startTerminalLoop } from "../src/terminal-loop.js";
import { createTextTuiRuntimeFromDiscovery } from "../src/text-driver.js";

const args = process.argv.slice(2);
const parsed = parseCliArgs(args);

if (parsed.kind === "launch" && process.stdin.isTTY && process.stdout.isTTY) {
  const runtime = createTextTuiRuntimeFromDiscovery(process.cwd(), process.env, {
    launchShortcut: parsed.launchShortcut
  });

  const controller = startTerminalLoop(runtime, {
    stdin: process.stdin,
    stdout: process.stdout
  });

  const stop = () => {
    controller.stop();
  };

  process.once("SIGINT", () => {
    stop();
    process.exit(0);
  });

  process.once("SIGTERM", () => {
    stop();
    process.exit(0);
  });

  process.once("SIGHUP", () => {
    stop();
    process.exit(0);
  });
} else {
  const result = runCliCommandFromDiscovery(args, process.cwd(), process.env);
  process.stdout.write(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
  process.exitCode = result.exitCode;
}
