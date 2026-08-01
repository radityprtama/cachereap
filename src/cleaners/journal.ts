import type { Cleaner } from "./types";
import { commandExists, runSudo } from "../core/run";

const journal: Cleaner = {
  key: "journal",
  icon: "☰",
  title: "Systemd Journal Logs",
  async run() {
    if (await commandExists("journalctl")) {
      await runSudo("Vacuum journal (>14 hari)", ["journalctl", "--vacuum-time=14d"]);
      await runSudo("Vacuum journal (batasi 200M)", ["journalctl", "--vacuum-size=200M"]);
    }
  },
};

export default journal;
