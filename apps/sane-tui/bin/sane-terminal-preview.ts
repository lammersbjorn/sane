import { startInkTerminalLoop } from "../src/ink-terminal.js";
import { createTextTuiRuntimeFromDiscovery } from "../src/text-driver.js";

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("sane ts live preview requires an interactive TTY");
  process.exit(1);
}

const launchShortcut = process.argv[2] === "settings" ? "settings" : "default";

void main();

async function main(): Promise<void> {
  const runtime = createTextTuiRuntimeFromDiscovery(process.cwd(), process.env, {
    launchShortcut
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
}
