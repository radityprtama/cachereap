import { assertLinux } from "./core/platformGuard";
import { runCli } from "./cli";

assertLinux();

runCli(process.argv.slice(2)).catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
