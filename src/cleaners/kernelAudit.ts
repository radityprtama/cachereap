import { execa } from "execa";
import type { Cleaner } from "./types";
import { commandExists } from "../core/run";
import { bold, cyan, dim, green, I_INFO, I_OK, I_SKIP } from "../core/logger";

const kernelAudit: Cleaner = {
  key: "kernel",
  icon: "◉",
  title: "Kernel Lama (audit — tidak auto-hapus)",
  async run() {
    if (!(await commandExists("rpm"))) return;
    const current = (await execa("uname", ["-r"], { reject: false }).catch(() => ({ stdout: "" }))).stdout.trim();
    const { stdout } = await execa("rpm", ["-q", "kernel"], { reject: false }).catch(() => ({ stdout: "" }));
    const kernels = stdout.split("\n").map((k) => k.replace(/^kernel-/, "")).filter(Boolean);

    console.log(`      Kernel yang sedang jalan: ${bold(green(current))}`);
    console.log(`      Total kernel terinstall: ${kernels.length}`);
    for (const k of kernels) {
      if (k === current) {
        console.log(`      ${I_OK} ${k} ${dim("(aktif, jangan dihapus)")}`);
      } else {
        console.log(`      ${I_SKIP} ${k} ${dim("(kandidat dihapus)")}`);
      }
    }
    if (kernels.length > 2) {
      console.log(`      ${I_INFO} ${dim("Ada lebih dari 2 kernel. Fedora biasanya otomatis bersihin ini saat")}`);
      console.log(`      ${dim("  'dnf update'. Kalau mau hapus manual, JANGAN pakai script ini — cek dulu:")}`);
      console.log(`      ${cyan("  sudo dnf remove kernel-<versi-lama>")} ${dim("(ganti <versi-lama> yang BUKAN kernel aktif)")}`);
    } else {
      console.log(`      ${dim("Aman, cuma kernel yang wajar tersimpan.")}`);
    }
  },
};

export default kernelAudit;
