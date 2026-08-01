import { execaSync } from "execa";
import { cleaners } from "../cleaners";
import { ensureConfig, getConfig, getProjectDir, getSkipSections, getStaleDays } from "../core/config";
import { recordHistory } from "../core/history";
import { banner, bold, cyan, dim, green, hr, resetSectionCounter, section, skipNotice, yellow } from "../core/logger";
import { getAvailGb, printDf } from "../core/run";
import { runState } from "../core/state";

export async function runCleanup(): Promise<void> {
  // bash line 236: `clear 2>/dev/null || true` — unconditional, emits ESC[H ESC[2J ESC[3J even when piped
  process.stdout.write("\x1b[H\x1b[2J\x1b[3J");

  ensureConfig();
  const conf = getConfig();
  const projectDir = getProjectDir();
  const staleDays = getStaleDays();
  const skipSections = getSkipSections();

  // bash: $(date '+%A, %d %B %Y — %H:%M') — system locale, keep identical
  const now = execaSync("date", ["+%A, %d %B %Y — %H:%M"], { reject: false }).stdout.trim();

  banner("CACHEREAP", `Fedora Dev Machine  ·  ${now}`);

  const availBefore = await getAvailGb();
  console.log(`  ${dim("Free space sebelum:")}`);
  printDf();
  console.log(
    `  ${dim("Config:")} ${cyan(conf.path)}  ${dim("·  PROJECT_DIR=")}${cyan(projectDir)}  ${dim("·  STALE_DAYS=")}${cyan(String(staleDays))}`,
  );
  if (skipSections.length > 0) {
    console.log(`  ${dim("Skip sections:")} ${yellow(skipSections.join(","))}`);
  }
  if (runState.dryRun) {
    console.log(`  ${bold(yellow("◆ MODE DRY-RUN — tidak ada file yang benar-benar dihapus"))}`);
  }

  resetSectionCounter();
  for (const cleaner of cleaners) {
    section(cleaner.icon, cleaner.title);
    if (skipSections.includes(cleaner.key)) {
      skipNotice();
    } else {
      await cleaner.run({ projectDir, staleDays });
    }
  }

  const availAfter = await getAvailGb();
  const freed = availAfter - availBefore;
  recordHistory(runState.dryRun ? "dry-run" : "normal", availBefore, availAfter);

  banner("SELESAI", "");
  console.log(`  ${dim("Free space sesudah:")}`);
  printDf();
  console.log();
  if (runState.dryRun) {
    console.log(`  ${yellow("◆ Ini baru simulasi. Jalankan tanpa --dry-run untuk eksekusi beneran.")}`);
  } else if (freed > 0) {
    console.log(`  ${bold(green(`✓ Total ruang yang berhasil dibebaskan: ~${freed}GB`))}`);
  } else {
    console.log(`  ${dim("Tidak ada perubahan signifikan pada free space.")}`);
  }
  console.log(`  ${dim("Lihat riwayat lengkap:")} ${cyan("cachereap --history")}`);
  hr();
}
