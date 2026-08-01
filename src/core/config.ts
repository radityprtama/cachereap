import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Conf from "conf";
import { expandHome } from "./fsSize";
import { I_INFO, cyan, dim } from "./logger";

export interface HistoryEntry {
  ts: string;
  mode: string;
  before: number;
  after: number;
  freed: number;
}

export interface ConfigShape {
  projectDir: string;
  staleDays: number;
  skipSections: string[];
  history: HistoryEntry[];
}

const conf = new Conf<ConfigShape>({
  projectName: "cachereap",
  projectSuffix: "", // keep ~/.config/cachereap/ (conf appends "-nodejs" by default)
  defaults: {
    projectDir: "~/projects",
    staleDays: 30,
    skipSections: [],
    history: [],
  },
});

export function getConfig(): Conf<ConfigShape> {
  return conf;
}

export function getProjectDir(): string {
  return expandHome(conf.get("projectDir"));
}

export function getStaleDays(): number {
  return conf.get("staleDays");
}

export function getSkipSections(): string[] {
  return conf.get("skipSections");
}

// Materialize the config file on first run (bash wrote config.conf via heredoc).
export function ensureConfig(): void {
  const p = conf.path;
  if (existsSync(p)) return;
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(conf.store, null, 2)}\n`, "utf8");
  console.log(`  ${I_INFO} ${dim("Config default dibuat di")} ${cyan(p)}`);
}
