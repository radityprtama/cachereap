import { stat } from "node:fs/promises";
import { rmrf } from "../core/fsSize";
import { I_OK, I_SKIP } from "../core/logger";
import { runState } from "../core/state";

export async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

// bash: `if $DRY_RUN; then echo "○ (dry-run) rm -rf $d"; else rm -rf && echo "✓ dihapus: $d"`
export async function deleteEach(dirs: string[]): Promise<void> {
  for (const d of dirs) {
    if (runState.dryRun) {
      console.log(`      ${I_SKIP} (dry-run) rm -rf ${d}`);
    } else {
      await rmrf(d);
      console.log(`      ${I_OK} dihapus: ${d}`);
    }
  }
}
