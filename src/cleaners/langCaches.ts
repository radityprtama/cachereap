import { stat } from "node:fs/promises";
import type { Cleaner } from "./types";
import { confirm } from "../core/confirm";
import { dirSizeStr, rmrf } from "../core/fsSize";
import { dim, listItem } from "../core/logger";
import { commandExists, run } from "../core/run";
import { execa } from "execa";

const langCaches: Cleaner = {
  key: "langcache",
  icon: "◇",
  title: "Cache Tool Bahasa Lain (pip/cargo/go)",
  async run() {
    const home = process.env.HOME ?? "";
    const pip = `${home}/.cache/pip`;
    const cargo = `${home}/.cargo/registry/cache`;
    const go = `${home}/.cache/go-build`;

    if (await isDir(pip)) {
      listItem(pip, await dirSizeStr(pip));
      if (await confirm("Bersihkan pip cache?")) {
        await run("pip cache purge", () => rmrf(pip));
      }
    }
    if (await isDir(cargo)) {
      listItem(cargo, await dirSizeStr(cargo));
      if (await confirm("Bersihkan Cargo registry cache?")) {
        await run("Hapus cargo registry cache", () => rmrf(cargo));
      }
    }
    if (await isDir(go)) {
      listItem(go, await dirSizeStr(go));
      if (await confirm("Bersihkan Go build cache?")) {
        if (await commandExists("go")) {
          await run("go clean -cache", () => execa("go", ["clean", "-cache"], { stdio: "inherit" }));
        } else {
          await run("Hapus go-build cache", () => rmrf(go));
        }
      }
    }
    if (!(await isDir(pip)) && !(await isDir(cargo)) && !(await isDir(go))) {
      console.log(`      ${dim("Tidak ada cache pip/cargo/go ditemukan.")}`);
    }
  },
};

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

export default langCaches;
