import { execa, execaSync, type Options } from "execa";
import { runState } from "./state";
import { I_SKIP, I_ARROW, I_OK, I_WARN, dim } from "./logger";

// Bash `run "desc" cmd...` equivalent: dry-run shows ○, otherwise ▸ then ✓/✕.
// fn throws (or execa rejects on non-zero exit) -> ✕, non-fatal.
export async function run(desc: string, fn: () => Promise<unknown>): Promise<boolean> {
  if (runState.dryRun) {
    console.log(`      ${I_SKIP} ${dim(`(dry-run) ${desc}`)}`);
    return false;
  }
  console.log(`      ${I_ARROW} ${desc}...`);
  try {
    await fn();
    console.log(`      ${I_OK} ${desc}`);
    return true;
  } catch {
    console.log(`      ${I_WARN} ${desc} ${dim("(gagal/skip)")}`);
    return false;
  }
}

// Run a command with sudo, inheriting stdio so the password prompt works.
export function sudo(args: string[], opts: Options = {}): ReturnType<typeof execa> {
  return execa("sudo", args, { stdio: "inherit", ...opts });
}

export async function runSudo(desc: string, args: string[]): Promise<boolean> {
  return run(desc, () => sudo(args));
}

export async function commandExists(cmd: string): Promise<boolean> {
  const { exitCode } = await execa("sh", ["-c", `command -v ${cmd}`], { reject: false, stdio: "ignore" });
  return exitCode === 0;
}

// `df --output=avail -BG /` first number, in GB.
export async function getAvailGb(): Promise<number> {
  try {
    const { stdout } = await execa("df", ["--output=avail", "-BG", "/"], { reject: false });
    const last = stdout.trim().split(/\s+/).pop() ?? "0";
    return parseInt(last.replace("G", ""), 10) || 0;
  } catch {
    return 0;
  }
}

export function printDf(): void {
  // `df -h /` first two lines, indented 4 spaces (stdio passthrough).
  const { stdout, exitCode } = execaSync("df", ["-h", "/"], { reject: false });
  if (exitCode === 0) {
    console.log(stdout.split("\n").slice(0, 2).map((l) => `    ${l}`).join("\n"));
  }
}
