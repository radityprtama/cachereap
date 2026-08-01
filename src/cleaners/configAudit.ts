import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import type { Cleaner } from "./types";
import { dirSizeStr } from "../core/fsSize";
import { cyan, dim, I_INFO, I_OK, I_SKIP } from "../core/logger";
import { commandExists } from "../core/run";

const SKIP_NAMES = new Set([
  "autostart",
  "systemd",
  "environment.d",
  "user-tmpfiles.d",
  "dconf",
  "pulse",
  "mimeapps.list",
]);

const configAudit: Cleaner = {
  key: "configaudit",
  icon: "◎",
  title: "Audit Config App Ter-uninstall (laporan saja)",
  async run() {
    const home = os.homedir();
    console.log(`      ${dim("Mengecek ~/.config yang appnya kemungkinan sudah tidak terinstall...")}`);
    let flatpakIds: string[] = [];
    if (await commandExists("flatpak")) {
      const { stdout } = await execa("flatpak", ["list", "--app", "--columns=application"], { reject: false }).catch(() => ({ stdout: "" }));
      flatpakIds = stdout.split("\n").filter(Boolean);
    }
    let orphanCount = 0;
    const configDir = `${home}/.config`;
    let entries: string[] = [];
    try {
      entries = await readdir(configDir);
    } catch {
      entries = [];
    }
    for (const name of entries) {
      if (SKIP_NAMES.has(name) || /^gtk-/.test(name)) continue;
      const full = path.join(configDir, name);
      let isDir = false;
      try {
        isDir = (await stat(full)).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;
      if (await commandExists(name)) continue;
      if (await hasDesktopFile(name, home)) continue;
      if (flatpakIds.some((fid) => fid.includes(name))) continue;
      console.log(`      ${I_SKIP} ~/.config/${name} ${dim(`(${await dirSizeStr(full)})`)}`);
      orphanCount++;
    }
    if (orphanCount === 0) {
      console.log(`      ${I_OK} ${dim("Tidak ada kandidat config orphan yang jelas.")}`);
    } else {
      console.log();
      console.log(`      ${I_INFO} ${dim("Ini HEURISTIK, bisa false-positive (misal config CLI tool tanpa .desktop file).")}`);
      console.log(`      ${dim("Cek manual dulu sebelum hapus, misal:")} ${cyan("rm -rf ~/.config/<nama>")}`);
    }
  },
};

async function hasDesktopFile(name: string, home: string): Promise<boolean> {
  for (const base of ["/usr/share/applications", `${home}/.local/share/applications`]) {
    try {
      const files = await readdir(base);
      if (files.some((f) => f.includes(name))) return true;
    } catch {
      // dir may not exist
    }
  }
  return false;
}

export default configAudit;
