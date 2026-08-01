import { execa } from "execa";
import type { Cleaner } from "./types";
import { confirm } from "../core/confirm";
import { dirSizeStr, rmContents } from "../core/fsSize";
import { bold, dim, yellow } from "../core/logger";
import { runSudo } from "../core/run";
import { isDir } from "./util";

const COREDUMP_DIR = "/var/lib/systemd/coredump";
const ABRT_DIR = "/var/spool/abrt";

const crashDumps: Cleaner = {
  key: "crash",
  icon: "⊗",
  title: "Crash Dumps & Laporan Error",
  async run() {
    if ((await isDir(COREDUMP_DIR)) && (await sudoFindCount(COREDUMP_DIR, ["-type", "f"])) > 0) {
      console.log(`      Ukuran systemd-coredump: ${bold(yellow(await dirSizeStr(COREDUMP_DIR)))}`);
      if (await confirm("Hapus semua coredump lama?")) {
        await runSudo("Bersihkan coredump", ["bash", "-c", `rm -rf ${COREDUMP_DIR}/*`]);
      }
    } else {
      console.log(`      ${dim("Tidak ada coredump ditemukan.")}`);
    }

    if ((await isDir(ABRT_DIR)) && (await sudoFindCount(ABRT_DIR, ["-mindepth", "1"])) > 0) {
      console.log(`      Ukuran laporan ABRT: ${bold(yellow(await dirSizeStr(ABRT_DIR)))}`);
      if (await confirm("Hapus semua laporan crash ABRT?")) {
        await runSudo("Bersihkan ABRT", ["bash", "-c", `rm -rf ${ABRT_DIR}/*`]);
      }
    } else {
      console.log(`      ${dim("Tidak ada laporan ABRT.")}`);
    }
  },
};

async function sudoFindCount(dir: string, args: string[]): Promise<number> {
  // stderr ignored — bash pipes these through 2>/dev/null; without a TTY,
  // sudo would otherwise print "a terminal is required" noise.
  const res = await execa("sudo", ["find", dir, ...args], { reject: false, stdio: ["inherit", "pipe", "ignore"] });
  const stdout = typeof res.stdout === "string" ? res.stdout : "";
  return stdout.split("\n").filter((l) => l.trim().length > 0).length;
}

export default crashDumps;
