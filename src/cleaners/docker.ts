import { execa } from "execa";
import type { Cleaner } from "./types";
import { confirm } from "../core/confirm";
import { dim, yellow } from "../core/logger";
import { commandExists, run } from "../core/run";

const docker: Cleaner = {
  key: "docker",
  icon: "▦",
  title: "Docker",
  async run() {
    if (!(await commandExists("docker"))) {
      console.log(`      ${dim("Docker tidak terinstall, skip.")}`);
      return;
    }
    const { stdout } = await execa("docker", ["system", "df"], { reject: false }).catch(() => ({ stdout: "" }));
    console.log(stdout.split("\n").filter((l) => l.trim().length > 0).map((l) => `      ${l}`).join("\n"));
    console.log();
    console.log(`      ${yellow("◆ Volume aktif TIDAK ikut kehapus dengan --volumes kecuali unused.")}`);
    if (await confirm("Jalankan docker system prune -a --volumes?")) {
      await run("Docker prune", () => execa("docker", ["system", "prune", "-af", "--volumes"], { stdio: "inherit" }));
    }
  },
};

export default docker;
