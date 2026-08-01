import type { Cleaner } from "./types";
import { confirm } from "../core/confirm";
import { dirSizeStr, findDirsBySuffix } from "../core/fsSize";
import { dim, listItem, I_WARN } from "../core/logger";
import { deleteEach, isDir } from "./util";

const next: Cleaner = {
  key: "next",
  icon: "▲",
  title: "Next.js Build Cache (.next/cache)",
  async run(ctx) {
    console.log(`      ${dim("Mencari di:")} ${ctx.projectDir}`);
    if (!(await isDir(ctx.projectDir))) {
      console.log(`      ${I_WARN} Folder ${ctx.projectDir} tidak ditemukan`);
      return;
    }
    const caches = await findDirsBySuffix(ctx.projectDir, ["/.next/cache"]);
    for (const d of caches) {
      listItem(d, await dirSizeStr(d));
    }
    console.log(`      ${dim(`Ditemukan ${caches.length} folder cache`)}`);
    if (caches.length > 0 && (await confirm("Hapus semua .next/cache di atas?"))) {
      await deleteEach(caches);
    }
  },
};

export default next;
