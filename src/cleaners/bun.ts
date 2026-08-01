import os from "node:os";
import type { Cleaner } from "./types";
import { commandExists, run } from "../core/run";
import { confirm } from "../core/confirm";
import { dirSizeStr, rmContents } from "../core/fsSize";
import { bold, dim, yellow } from "../core/logger";

const bun: Cleaner = {
  key: "bun",
  icon: "⬡",
  title: "Bun Cache",
  async run() {
    if (!(await commandExists("bun"))) {
      console.log(`      ${dim("Bun tidak terinstall, skip.")}`);
      return;
    }
    const cache = `${os.homedir()}/.bun/install/cache`;
    if (!(await exists(cache))) {
      console.log(`      ${dim("Tidak ada cache ditemukan.")}`);
      return;
    }
    console.log(`      Ukuran saat ini: ${bold(yellow(await dirSizeStr(cache)))}`);
    if (await confirm("Bersihkan Bun global cache?")) {
      await run("Hapus isi Bun cache", () => rmContents(cache));
    }
  },
};

async function exists(p: string): Promise<boolean> {
  const { stat } = await import("node:fs/promises");
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export default bun;
