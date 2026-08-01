import type { Cleaner } from "./types";
import { confirm } from "../core/confirm";
import { dirSizeStr, findStaleNodeModules } from "../core/fsSize";
import { dim, listItem } from "../core/logger";
import { deleteEach, isDir } from "./util";

const nodeModulesStale: Cleaner = {
  key: "nodemodules",
  icon: "▤",
  title: "node_modules Stale (30+ hari tidak diakses)",
  async run(ctx) {
    if (!(await isDir(ctx.projectDir))) return;
    const stale = await findStaleNodeModules(ctx.projectDir, ctx.staleDays, 4);
    for (const d of stale) {
      listItem(d, await dirSizeStr(d));
    }
    if (stale.length > 0) {
      console.log(`      ${dim("Catatan: reinstall gampang → cd <project> && bun install")}`);
      if (await confirm("Hapus juga node_modules di atas sekarang?")) {
        await deleteEach(stale);
      }
    } else {
      console.log(`      ${dim("Tidak ada yang stale — semua masih aktif dipakai.")}`);
    }
  },
};

export default nodeModulesStale;
