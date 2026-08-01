import type { Cleaner } from "./types";
import bun from "./bun";
import npmcache from "./packageManagers";
import next from "./nextjs";
import nodeModulesStale from "./nodeModulesStale";
import turboNx from "./turboNx";
import langCaches from "./langCaches";
import dnf from "./dnf";
import kernelAudit from "./kernelAudit";
import flatpak from "./flatpak";
import journal from "./journal";
import crashDumps from "./crashDumps";
import docker from "./docker";
import trash from "./trash";
import configAudit from "./configAudit";

export const cleaners: Cleaner[] = [
  bun,
  npmcache,
  next,
  nodeModulesStale,
  turboNx,
  langCaches,
  dnf,
  kernelAudit,
  flatpak,
  journal,
  crashDumps,
  docker,
  trash,
  configAudit,
];

export { type Cleaner, type CleanContext } from "./types";
