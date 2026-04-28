import { runCliCommandFromDiscovery } from "../src/cli.js";
import { startInkTerminalLoop } from "../src/ink-terminal.js";
import { planPreviewLaunch } from "../src/preview-launch.js";
import { createTextTuiRuntimeFromDiscovery } from "../src/text-driver.js";

const args = process.argv.slice(2);
const plan = planPreviewLaunch(args, {
  stdinIsTty: Boolean(process.stdin.isTTY),
  stdoutIsTty: Boolean(process.stdout.isTTY)
});

void main();

async function main(): Promise<void> {
  if (plan.kind === "terminal") {
    const runtime = createTextTuiRuntimeFromDiscovery(process.cwd(), process.env, {
      launchShortcut: plan.launchShortcut
    });

    const controller = await startInkTerminalLoop(runtime, {
      stdin: process.stdin,
      stdout: process.stdout
    });

    const stop = () => {
      controller.unmount();
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
    return;
  }

  const result = runCliCommandFromDiscovery(plan.args, process.cwd(), process.env);
  process.stdout.write(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
  process.exitCode = result.exitCode;
}
