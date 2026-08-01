import type { Cleaner } from "./types";
import { commandExists, runSudo } from "../core/run";
import { dim } from "../core/logger";

const flatpak: Cleaner = {
  key: "flatpak",
  icon: "▥",
  title: "Flatpak",
  async run() {
    if (await commandExists("flatpak")) {
      await runSudo("Flatpak uninstall unused runtimes", ["flatpak", "uninstall", "--unused", "-y"]);
    } else {
      console.log(`      ${dim("Flatpak tidak terinstall, skip.")}`);
    }
  },
};

export default flatpak;
