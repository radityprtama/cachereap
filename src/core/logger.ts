import pc from "picocolors";
import { execaSync } from "execa";
const { isColorSupported, bold, dim } = pc;

// 256-color codes from the original cachereap.sh, emitted as raw ANSI
// (picocolors only ships the 16-color palette).
const c = (code: number) => (s: string) =>
  isColorSupported ? `\u001b[38;5;${code}m${s}\u001b[0m` : s;
export const red = c(203); // 38;5;203
export const green = c(114); // 38;5;114
export const yellow = c(221); // 38;5;221
export const blue = c(75); // 38;5;75
export const cyan = c(80); // 38;5;80
export const magenta = c(176); // 38;5;176
export const gray = c(244); // 38;5;244
export const white = c(255); // 38;5;255

export { bold, dim };

export const I_OK = green("✓");
export const I_SKIP = yellow("○");
export const I_WARN = red("✕");
export const I_ARROW = cyan("▸");
export const I_INFO = blue("ℹ");
export const I_Q = magenta("?");
export const I_BULLET = gray("·");

export const STEP_TOTAL = 14;

// bash: TERM_WIDTH=$(tput cols 2>/dev/null || echo 70); cap at 80
const cols = (() => {
  try {
    const n = parseInt(execaSync("tput", ["cols"], { reject: false }).stdout.trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    /* fall through to 70 */
  }
  return 70;
})();
export const TERM_WIDTH = Math.min(cols, 80);

let stepNum = 0;

export function resetSectionCounter(): void {
  stepNum = 0;
}

export function hr(): void {
  console.log(gray("─".repeat(TERM_WIDTH)));
}

export function banner(title: string, subtitle: string): void {
  console.log();
  console.log(cyan("━".repeat(TERM_WIDTH)));
  console.log(`  ${bold(white(title))}`);
  if (subtitle) console.log(`  ${dim(subtitle)}`);
  console.log(cyan("━".repeat(TERM_WIDTH)));
}

export function section(icon: string, title: string): void {
  stepNum += 1;
  const num = String(stepNum).padStart(2, "0");
  console.log();
  console.log(`${gray(`[${num}/${STEP_TOTAL}]`)} ${bold(blue(icon))}  ${bold(title)}`);
  console.log(`${gray("      ")}${gray("─".repeat(title.length + 2))}`);
}

export function listItem(path: string, size: string): void {
  console.log(`      ${I_BULLET} ${path} ${dim(`(${size})`)}`);
}

export function skipNotice(): void {
  console.log(`      ${I_SKIP} ${dim("dilewati (SKIP_SECTIONS di config.conf)")}`);
}
