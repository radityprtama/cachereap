import { getConfig } from "./config";
import { banner, bold, green, dim, gray } from "./logger";

const fmtDate = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function recordHistory(mode: string, before: number, after: number): void {
  const conf = getConfig();
  const history = conf.get("history");
  history.push({ ts: fmtDate(new Date()), mode, before, after, freed: Math.max(0, before - after) });
  conf.set("history", history.slice(-50));
}

export function showHistory(): void {
  const history = getConfig().get("history");
  banner("RIWAYAT CLEANUP", "10 run terakhir");

  if (history.length === 0) {
    console.log(`  ${dim("Belum ada riwayat — jalankan big-cleanup dulu.")}`);
    return;
  }

  const rows = history.slice(-10).reverse();
  const [hDate, hMode, hBefore, hAfter, hFreed] = [
    "Tanggal",
    "Mode",
    "Sebelum",
    "Sesudah",
    "Freed",
  ];
  const headerLine = `  ${bold(hDate.padEnd(19))}${bold(hMode.padEnd(10))}${bold(hBefore.padStart(10))}${bold(hAfter.padStart(10))}${bold(hFreed.padStart(10))}`;
  const sep = `  ${gray(`${"-".repeat(19)} ${"-".repeat(10)} ${"-".repeat(10)} ${"-".repeat(10)} ${"-".repeat(10)}`)}`;
  console.log(headerLine);
  console.log(sep);

  for (const h of rows) {
    const mode = h.mode === "dry-run" ? dim(h.mode) : h.mode;
    console.log(
      `  ${h.ts.padEnd(19)} ${mode.padEnd(10)} ${String(h.before).padStart(9)}GB ${String(h.after).padStart(9)}GB ${bold(green(`${String(h.freed).padStart(9)}GB`))}`,
    );
  }
  console.log(sep);

  const real = history.filter((h) => h.mode !== "dry-run");
  const totalFreed = real.reduce((acc, h) => acc + h.freed, 0);
  console.log(`  ${dim(`Total dari ${real.length} run nyata: ~${totalFreed}GB sudah direclaim sepanjang waktu.`)}`);
}
