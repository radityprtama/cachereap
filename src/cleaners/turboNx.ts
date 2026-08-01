import os from "node:os";
import type { Cleaner } from "./types";
import { confirm } from "../core/confirm";
import { dirSizeStr, findDirsBySuffix, rmrf } from "../core/fsSize";
import { dim, listItem } from "../core/logger";
import { run } from "../core/run";
import { deleteEach, isDir } from "./util";

const turboNx: Cleaner = {
  key: "turbo",
  icon: "◈",
  title: "Turborepo & Nx Cache",
  async run(ctx) {
    if (!(await isDir(ctx.projectDir))) return;
    const turboCaches = await findDirsBySuffix(ctx.projectDir, ["/.turbo"], 5);
    const nxCaches = await findDirsBySuffix(ctx.projectDir, ["/node_modules/.cache/nx"], 5);
    const all = [...turboCaches, ...nxCaches];
    for (const d of all) {
      listItem(d, await dirSizeStr(d));
    }
    console.log(`      ${dim(`Ditemukan ${all.length} folder cache`)}`);
    if (all.length > 0 && (await confirm("Hapus semua cache Turbo/Nx di atas?"))) {
      await deleteEach(all);
    }
    const turboGlobal = `${os.homedir()}/.cache/turbo`;
    if (await isDir(turboGlobal)) {
      console.log();
      listItem(`${turboGlobal} (global)`, await dirSizeStr(turboGlobal));
      if (await confirm("Hapus Turbo global cache juga?")) {
        await run("Hapus turbo global cache", () => rmrf(turboGlobal));
      }
    }
  },
};

export default turboNx;
