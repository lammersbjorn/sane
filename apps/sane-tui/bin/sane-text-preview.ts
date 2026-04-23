import { runCliCommandFromDiscovery } from "../src/cli.js";

const result = runCliCommandFromDiscovery(process.argv.slice(2), process.cwd(), process.env);
process.stdout.write(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
process.exitCode = result.exitCode;
