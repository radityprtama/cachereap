import { readdir, stat, lstat, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";

export class PermissionError extends Error {}

// du -h style formatting (1024 base, one decimal below 10, integer above).
export function humanSize(bytes: number): string {
  if (bytes < 1024) return "0";
  const units = ["K", "M", "G", "T", "P"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const s = v >= 10 ? String(Math.round(v)) : v.toFixed(1);
  return `${s}${units[i]}`;
}

// Native recursive directory size (du -s replacement). Throws PermissionError
// when a directory can't be traversed without root (EACCES).
export async function dirBytes(dir: string): Promise<number> {
  let total = 0;
  async function walk(d: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(d);
    } catch (err) {
      if (isEACCES(err)) throw new PermissionError(d);
      throw err;
    }
    for (const name of entries) {
      const p = path.join(d, name);
      try {
        const st = await lstat(p);
        if (st.isDirectory()) {
          await walk(p);
        } else {
          total += st.size;
        }
      } catch (err) {
        if (isEACCES(err)) throw new PermissionError(p);
        // race: file vanished; skip silently (like du 2>/dev/null)
      }
    }
  }
  await walk(dir);
  return total;
}

export function isEACCES(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "EACCES";
}

// Size string for a directory. Native first; falls back to `sudo du -sh` for
// root-only dirs (e.g. /var/lib/systemd/coredump) — the only documented
// exception to native sizing.
export async function dirSizeStr(dir: string): Promise<string> {
  try {
    return humanSize(await dirBytes(dir));
  } catch (err) {
    if (err instanceof PermissionError) {
      try {
        const { stdout } = await execa("sudo", ["du", "-sh", dir], { reject: false });
        return stdout.trim().split(/\s+/)[0] || "0";
      } catch {
        return "0";
      }
    }
    return "0";
  }
}

export async function rmrf(target: string): Promise<void> {
  await rm(target, { recursive: true, force: true });
}

// rm -rf dir/* — keep the directory itself, delete its contents.
export async function rmContents(dir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  await Promise.all(entries.map((name) => rm(path.join(dir, name), { recursive: true, force: true })));
}

// Run `find root <args>` with stderr suppressed, return matching dirs/files.
// Mirrors bash `mapfile -t X < <(find ... 2>/dev/null)`.
async function findLines(root: string, args: string[]): Promise<string[]> {
  const { stdout } = await execa("find", [root, ...args], { reject: false });
  return stdout.split("\n").filter((l) => l.length > 0);
}

// `find root -type d -path "*<suffix>"` equivalent (errors ignored).
export async function findDirsBySuffix(root: string, suffixes: string[], maxDepth = Infinity): Promise<string[]> {
  const out: string[] = [];
  for (const suffix of suffixes) {
    const depth = maxDepth === Infinity ? [] : ["-maxdepth", String(maxDepth)];
    out.push(...(await findLines(root, [...depth, "-type", "d", "-path", `*${suffix}`])));
  }
  return out;
}

// `find root -maxdepth N -type d -name node_modules -atime +days` equivalent.
export async function findStaleNodeModules(root: string, days: number, maxDepth: number): Promise<string[]> {
  return findLines(root, ["-maxdepth", String(maxDepth), "-type", "d", "-name", "node_modules", "-atime", `+${days}`]);
}

// `find dir -type f -atime +days -delete` equivalent.
export async function deleteOldFiles(dir: string, days: number): Promise<void> {
  await execa("find", [dir, "-type", "f", "-atime", `+${days}`, "-delete"], { reject: false });
}

export async function countEntries(dir: string): Promise<number> {
  try {
    return (await readdir(dir)).length;
  } catch {
    return 0;
  }
}

export function expandHome(p: string): string {
  return p.replace(/^~(?=\/|$)/, process.env.HOME ?? "");
}
