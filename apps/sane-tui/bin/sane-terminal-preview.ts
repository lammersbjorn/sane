import { startTerminalLoop } from "../src/terminal-loop.js";
import { createTextTuiRuntimeFromDiscovery } from "../src/text-driver.js";

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("sane ts live preview requires an interactive TTY");
  process.exit(1);
}

const launchShortcut = process.argv[2] === "settings" ? "settings" : "default";

const runtime = createTextTuiRuntimeFromDiscovery(process.cwd(), process.env, {
  launchShortcut
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
