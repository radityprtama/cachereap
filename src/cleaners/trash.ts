import { readdir } from "node:fs/promises";
import os from "node:os";
import type { Cleaner } from "./types";
import { confirm } from "../core/confirm";
import { deleteOldFiles, dirSizeStr } from "../core/fsSize";
import { bold, dim, yellow } from "../core/logger";
import { run } from "../core/run";
import { isDir } from "./util";

const trash: Cleaner = {
  key: "trash",
  icon: "▽",
  title: "Trash Bin & Cache Sistem Lain-lain",
  async run() {
    const home = os.homedir();
    const trashDir = `${home}/.local/share/Trash`;
    if ((await isDir(trashDir)) && (await entryCount(trashDir)) > 0) {
      console.log(`      Ukuran Trash bin: ${bold(yellow(await dirSizeStr(trashDir)))}`);
      if (await confirm("Kosongkan Trash bin?")) {
        await run("Kosongkan trash", () => rmTrashContents(trashDir));
      }
    } else {
      console.log(`      ${dim("Trash bin kosong.")}`);
    }
    await run("Bersihkan thumbnail cache", () => rmThumbnails(`${home}/.cache/thumbnails`));
    await run("Bersihkan ~/.cache umum (>30 hari)", () => deleteOldFiles(`${home}/.cache`, 30));
  },
};

async function entryCount(dir: string): Promise<number> {
  try {
    return (await readdir(dir)).length;
  } catch {
    return 0;
  }
}

async function rmTrashContents(trashDir: string): Promise<void> {
  const { rm } = await import("node:fs/promises");
  for (const sub of ["files", "info"]) {
    try {
      const entries = await readdir(`${trashDir}/${sub}`);
      await Promise.all(entries.map((e) => rm(`${trashDir}/${sub}/${e}`, { recursive: true, force: true })));
    } catch {
      // subdir may not exist
    }
  }
}

async function rmThumbnails(dir: string): Promise<void> {
  const { rm } = await import("node:fs/promises");
  try {
    const entries = await readdir(dir);
    await Promise.all(entries.map((e) => rm(`${dir}/${e}`, { recursive: true, force: true })));
  } catch {
    // nothing to clean
  }
}

export default trash;
