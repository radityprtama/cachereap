# Architecture

Reference for agents working on `cachereap`. Complements [AGENTS.md](../AGENTS.md) (operational guidance) and [MIGRATION.md](MIGRATION.md) (bash→TS port record). Read this file first when you need to understand *how the code is wired*, AGENTS.md for *what not to break*.

## Runtime flow

```
node dist/index.js
  └─ src/index.ts
       assertLinux()                     # exit(1) if not linux
       runCli(process.argv.slice(2))
         └─ src/cli.ts
              ensureConfig()             # materialize ~/.config/cachereap/config.json
              --help pre-check           # manual, BEFORE commander
              commander parse (fullArgv) # reconstructed [node, script, ...args]
              dispatch:
                --edit-config  → commands/editConfig.ts
                --history      → commands/history.ts   → core/history.ts (showHistory)
                --list-sections→ commands/listSections.ts
                else           → setRunMode(dryRun, yes) → commands/run.ts (runCleanup)
```

### runCleanup() sequence (commands/run.ts)

1. **Unconditional clear-screen** `\x1b[H\x1b[2J\x1b[3J` (matches bash, even piped).
2. `ensureConfig()`; read `projectDir`, `staleDays`, `skipSections` from `conf`.
3. Banner `CACHEREAP` + date via `execaSync("date", ...)` (system locale).
4. `getAvailGb()` + `printDf()` — "Free space sebelum".
5. `resetSectionCounter()`; loop 14 cleaners in order: `section(icon, title)` → skip? → `cleaner.run(ctx)`.
6. `getAvailGb()` again; `recordHistory(mode, before, after)` — appended to `conf` key `history`, sliced to 50.
7. "SELESAI" banner + freed-space summary. `freed` = avail delta (GB).

## Cleaner contract (src/cleaners/types.ts)

```ts
interface CleanContext { projectDir: string; staleDays: number }
interface Cleaner {
  key: string;          // used in SKIP_SECTIONS (config)
  icon: string;         // single glyph in section header
  title: string;        // Indonesian, verbatim from bash
  run(ctx: CleanContext): Promise<void>;
}
```

- Registered in `src/cleaners/index.ts` — **array order defines `[01/14]`…`[14/14]` and matches bash section order**. Add new sections at the end unless the bash script says otherwise.
- `run()` receives only `{ projectDir, staleDays }`. Everything else (skip logic, mode) is read from `runState` / `conf` directly.
- **Cleaners must never throw** — wrap risky work in `run()`/`runSudo()`/`deleteEach()` which catch and print `✕ (gagal/skip)`, or guard with `try/catch`. A thrown error propagates to `src/index.ts` and aborts the whole run.

## The 14 sections

| # | key | file | what it does |
| --- | --- | --- | --- |
| 01 | `bun` | cleaners/bun.ts | rm `~/.bun/install/cache` contents (skip if no bun) |
| 02 | `npmcache` | cleaners/packageManagers.ts | `npm cache clean --force`, `pnpm store prune`, `yarn cache clean` (each gated on `commandExists`) |
| 03 | `next` | cleaners/nextjs.ts | `.next/cache` dirs in project tree (`find -type d -path "*/.next/cache"`, no maxdepth) |
| 04 | `nodemodules` | cleaners/nodeModulesStale.ts | stale `node_modules` (`-atime +staleDays`, maxdepth 4) |
| 05 | `turbo` | cleaners/turboNx.ts | `/.turbo` + `/node_modules/.cache/nx` dirs (maxdepth 5) |
| 06 | `langcache` | cleaners/langCaches.ts | pip cache, Cargo registry cache, Go build cache (each gated on `commandExists`) |
| 07 | `dnf` | cleaners/dnf.ts | `sudo dnf autoremove -y` + `sudo dnf clean all` |
| 08 | `kernel` | cleaners/kernelAudit.ts | report-only: `uname -r` vs `rpm -q kernel`, list old kernels, no delete |
| 09 | `flatpak` | cleaners/flatpak.ts | `sudo flatpak uninstall --unused -y` (skip if no flatpak) |
| 10 | `journal` | cleaners/journal.ts | `sudo journalctl --vacuum-time=14d` + `--vacuum-size=200M` (if journalctl exists) |
| 11 | `crash` | cleaners/crashDumps.ts | coredump (`/var/lib/systemd/coredump`) + ABRT (`/var/spool/abrt`): `sudo rm -rf <dir>/*` after confirm |
| 12 | `docker` | cleaners/docker.ts | `docker system prune -af --volumes` (prune all unused, incl. volumes) |
| 13 | `trash` | cleaners/trash.ts | Trash bin + thumbnail cache + `~/.cache` >30d files |
| 14 | `configaudit` | cleaners/configAudit.ts | report-only: orphan `~/.config` dirs heuristic |

`kernel` (08) and `configaudit` (14) are **report-only** — they print findings, never delete.

## Module responsibilities

### core/

| file | responsibility |
| --- | --- |
| `config.ts` | `conf` singleton (`projectSuffix: ""` — keep!), `HistoryEntry`/`ConfigShape` types, defaults (`projectDir: "~/projects"`, `staleDays: 30`, `skipSections: []`, `history: []`), `ensureConfig()` |
| `state.ts` | `runState = { dryRun, autoYes }` mutable singleton + `setRunMode()` |
| `confirm.ts` | TTY prompt `? msg [y/N]`. `dryRun → true`, `autoYes → true` (logs `auto-yes →`), non-TTY without `--yes → false` (no hang) |
| `run.ts` | `run(desc, fn)` (dry-run `○`, else `▸`→`✓`/`✕`), `sudo()`/`runSudo()` (stdio inherit for password prompt), `commandExists()`, `getAvailGb()`, `printDf()` |
| `fsSize.ts` | `humanSize` (du -h format), `dirBytes` (native walker, throws `PermissionError`), `dirSizeStr` (sudo fallback), `rmrf`/`rmContents`, `findLines`/`findDirsBySuffix`/`findStaleNodeModules`/`deleteOldFiles` (GNU find), `countEntries`, `expandHome` |
| `logger.ts` | 256-color ANSI helpers (`c(code)`), markers (`✓`/`○`/`✕`/`▸`/`ℹ`/`?`/`·`), `STEP_TOTAL = 14`, `TERM_WIDTH` (tput cols, cap 80), `banner`, `section`, `hr`, `skipNotice`, `listItem` |
| `history.ts` | `recordHistory(mode, before, after)` → `conf.set("history", slice(-50))`; `showHistory()` → last 10 reversed + lifetime total (dry-run excluded from total) |
| `platformGuard.ts` | `assertLinux()` — exit(1) with Indonesian message off-Linux |

### commands/

Thin wrappers over core. `run.ts` is the only one with real orchestration logic. `listSections.ts` iterates `cleaners` to print `key - title`.

### cleaners/util.ts

Shared helpers: `isDir()`, `deleteEach(dirs)` (dry-run logs `○ (dry-run) rm -rf`, else `rmrf` + `✓ dihapus:`).

## Data flow: config → cleaner

```
conf (config.json)                    runState (mode)
  ├─ projectDir → CleanContext        ├─ dryRun → confirm()/run()/deleteEach()
  ├─ staleDays  → CleanContext        └─ autoYes → confirm()
  └─ skipSections → runCleanup loop (skipNotice if key matches)
```

Cleaners never import `conf` directly — they receive `ctx` and consult `runState`/`confirm()` for mode decisions.

## Command execution rules

- **`sudo`** via `runSudo`/`sudo()`: `stdio: "inherit"` so the password prompt reaches the user. Never `sudo ... < /dev/null` style in cleaners — dry-run short-circuits in `run()` before exec.
- **Discovery `find`**: stderr suppressed by default (`reject: false`); paths returned are absolute, newline-split (bash `mapfile` semantics). Don't filter `./` prefixes.
- **Sudo noise**: crash-dump count check uses `stdio: ["inherit","pipe","ignore"]` so `sudo: a terminal is required` doesn't leak to stderr when piped (see MIGRATION.md).
- **Deletion**: prefer `deleteEach()`/`run()` over raw `rm` — they carry the dry-run marker contract. Raw `rm`/`unlink` is fine inside `run(desc, fn)`.

## Error handling conventions

- Cleaner-level errors: non-fatal, `✕ (gagal/skip)` — never rethrow.
- Discovery errors: `reject: false` on execa, `try/catch` returning `[]` or `0` (bash `2>/dev/null` parity).
- `PermissionError` is the ONLY documented exception path to native sizing → `sudo du -sh`.
- `src/index.ts` catches top-level failures: prints message, `exit(1)`.

## Testing strategy

- Pure logic → unit tests (`humanSize`, `expandHome`).
- Config → hermetic: fresh temp `XDG_CONFIG_HOME` + `vi.resetModules()` before each import (conf reads env at construction).
- Cleaners → **not unit-tested** (they shell out to system tools / need a Fedora box). Manual verification via `node dist/index.js --dry-run` — must complete all 14 sections without destructive commands.
- Before claiming a change works: `npm run typecheck && npm run build && npm test`, then a real `--dry-run`.

## Where things can go wrong (historical)

1. **Accidental destructive runs** — `--help` falling through to a real run (cli.ts `fullArgv` + pre-check). See AGENTS.md "CLI traps".
2. **Walker hangs** on large trees — discovery must stay on GNU `find`.
3. **`-nodejs` suffix** on config dir if `projectSuffix: ""` is removed.
4. **`[i/15]` counter** if `STEP_TOTAL` drifts from the actual cleaner count.
