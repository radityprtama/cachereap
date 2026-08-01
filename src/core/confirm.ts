import readline from "node:readline";
import { runState } from "./state";
import { I_Q, magenta, dim, I_OK } from "./logger";

// `read -r -p "? msg [y/N] "` equivalent. Non-TTY without --yes = no (no hang).
// In dry-run mode bash doesn't prompt — it simulates every candidate, so always
// proceed and let each cleaner print its `○ (dry-run)` line.
export async function confirm(prompt: string): Promise<boolean> {
  if (runState.dryRun) return true;
  if (runState.autoYes) {
    console.log(`      ${I_OK} ${dim(`auto-yes → ${prompt}`)}`);
    return true;
  }
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`      ${I_Q} ${prompt} ${magenta("[y/N]")} `, resolve);
    });
    return /^[Yy]$/.test(answer.trim());
  } finally {
    rl.close();
  }
}
