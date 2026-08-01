# AGENTS.md

AI coding agent guidance for this repo. Read this before making changes.

## What this is

`cachereap` — a Linux CLI that cleans caches/disk on a Fedora/Next.js/Bun dev machine. A **faithful TypeScript port of `cachereap.sh`** (bash script kept in repo root). Output language is **Indonesian**, identical to the bash original. Behavioral differences vs bash are deliberately limited to 2 bug fixes — recorded in `docs/MIGRATION.md`. **Read `docs/MIGRATION.md` before changing any behavior.**

## Commands

```bash
npm install            # install
npm run build          # tsup -> dist/index.js (ESM, node20, shebang banner)
npm run dev            # tsup --watch
npm test               # vitest run (5 tests, 2 files, ~0.7s)
npm run typecheck      # tsc --noEmit
node dist/index.js --dry-run   # run without installing to PATH
```

- No lint or format config exists. Don't run `eslint`/`prettier` — there is none.
- After editing source, `npm run typecheck && npm run build` before verifying with `node dist/index.js`.
- Release flow: `.github/workflows/release.yml` runs release-please on `main` push — it bumps `package.json` version, opens a version-bump PR, and on merge creates tag `v*` + GitHub release (conventional commits required). Downstream jobs (npm publish + tarball attach) only run when `release_created == 'true'`. Don't push tags manually for releases; commit `feat:`/`fix:` and let release-please version it.

## Architecture map

```
src/index.ts               entry: assertLinux() -> runCli(argv)
src/cli.ts                 commander setup + flag dispatch (see traps below)
src/commands/              run, history, listSections, editConfig
src/core/                  config, fsSize, logger, confirm, state, run, history, platformGuard
src/cleaners/              14 section cleaners + util.ts + types.ts
test/                      vitest (config hermetic via XDG temp dirs)
```

### CLI traps (in `cli.ts`, do not "simplify" these)

- `--help` is handled **manually before commander** (`argv.includes("--help")`), because commander intercepts `--help` internally and never exposes it via `opts()`.
- `fullArgv` is reconstructed: commander requires `[node, script, ...args]`; passing a bare options array parses to empty `opts()` and every flag silently falls through to a real run — this caused two accidental destructive runs historically.
- Action flags win in order: `--edit-config` > `--history` > `--list-sections` > run. `setRunMode(opts.dryRun, opts.yes)` happens last.

### Dry-run / confirm semantics (critical)

- `runState` (`src/core/state.ts`) is a **shared mutable singleton** (`dryRun`, `autoYes`) — cleaners read it directly.
- `confirm()` returns `true` in dry-run **by design**: bash dry-run skipped sections silently; TS deliberately lets every section print its `○ (dry-run)` line for full simulation output. **Never gate on `runState.dryRun` manually inside a cleaner** — use `confirm()` + `run()`/`deleteEach()` which already handle it.
- `run()` (core/run.ts): dry-run → `○ (dry-run)`, else `▸ desc...` then `✓`/`✕` (non-fatal on throw). `deleteEach()` same pattern for dirs.
- Cleaners must be **non-fatal on any error** — a throwing cleaner kills the whole run.

### Config

- `conf` lib with `projectSuffix: ""` (line in `src/core/config.ts`). **Do not remove** — default would rename dir to `cachereap-nodejs`.
- Config file: `~/.config/cachereap/config.json` (JSON, `conf`). History stored **inside** it, key `history`, max 50 entries.
- Bash original used `~/.config/cachereap/config.conf` (shell format) — both files may exist; TS only reads the JSON.
- `ensureConfig()` materializes the file on first run.

### fsSize (core/fsSize.ts) — discovery vs sizing

- **Discovery** (finding dirs/files to clean): GNU `find` via execa, mirroring bash `mapfile < <(find ...)`. **Never replace with a JS walker** — the original JS recursive walker hung for tens of seconds on large project trees (documented in MIGRATION.md).
- **Sizing** (`dirBytes`): native readdir walker, throws `PermissionError` on EACCES → falls back to `sudo du -sh` for root-only dirs (`/var/cache/dnf`, `/var/log/journal`).

### Logger / output fidelity

- Colors are **raw 256-color ANSI** (`c(code)` helper emitting `38;5;N`) — picocolors only ships 16 colors. Keep exact codes (red 203, green 114, yellow 221, cyan 80, magenta 176...).
- `TERM_WIDTH`: `tput cols` capped at 80. `STEP_TOTAL = 14` (bash hardcoded 15 — bug fixed; counter prints `[i/14]`).
- Banner date: `execaSync("date", ...)` (system locale) — not `Intl.DateTimeFormat`.
- **Unconditional clear-screen** `\x1b[H\x1b[2J\x1b[3J` at run start, even when piped — matches bash, keep it.
- All user-facing strings are Indonesian and largely verbatim from bash. Preserve them; check `cachereap.sh` for the canonical text.

## Tests

- `test/config.test.ts`: `conf` is a **module singleton** reading `XDG_CONFIG_HOME` at construction — each test must `vi.resetModules()` + set a fresh temp `XDG_CONFIG_HOME` before importing. Asserts path is `<temp>/cachereap/config.json` (**no `-nodejs` suffix**).
- `test/fsSize.test.ts`: pure functions (`humanSize`, `expandHome`) — `humanSize` matches `du -h` formatting (1024 base; 1 decimal below 10, integer above).
- Run `npm test` after touching core/config or fsSize.

## Constraints

- TypeScript strict: `noUncheckedIndexedAccess` on — index access returns `T | undefined`. No `as any` / `@ts-ignore`.
- Linux-only (`platformGuard.ts`); package.json `os: ["linux"]`.
- The 14 cleaners are ordered in `src/cleaners/index.ts` — order matters (matches bash `[01/14]`…`[14/14]`).
- `kernel` and `configaudit` are report-only cleaners (never delete).
