import type { Cleaner } from "./types";
import { runSudo } from "../core/run";

const dnf: Cleaner = {
  key: "dnf",
  icon: "⬢",
  title: "DNF (System Packages)",
  async run() {
    await runSudo("DNF autoremove (paket dependency yatim)", ["dnf", "autoremove", "-y"]);
    await runSudo("DNF clean all", ["dnf", "clean", "all"]);
  },
};

export default dnf;
