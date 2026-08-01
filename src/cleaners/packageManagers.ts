import { execa } from "execa";
import type { Cleaner } from "./types";
import { commandExists, run } from "../core/run";

const npmcache: Cleaner = {
  key: "npmcache",
  icon: "▣",
  title: "Package Manager Cache Lain",
  async run() {
    if (await commandExists("npm")) {
      await run("npm cache clean --force", () => execa("npm", ["cache", "clean", "--force"], { stdio: "inherit" }));
    }
    if (await commandExists("pnpm")) {
      await run("pnpm store prune", () => execa("pnpm", ["store", "prune"], { stdio: "inherit" }));
    }
    if (await commandExists("yarn")) {
      await run("yarn cache clean", () => execa("yarn", ["cache", "clean"], { stdio: "inherit" }));
    }
  },
};

export default npmcache;
