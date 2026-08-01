# MIGRATION: big-cleanup.sh → big-cleanup (TypeScript)

Dokumen ini mencatat cara port dilakukan, perbedaan per section dengan versi bash, dan alasan di balik setiap keputusan. Sumber kebenaran: `big-cleanup.sh` (di repo ini).

## Ringkasan

| | Bash | TypeScript |
| --- | --- | --- |
| Runtime | bash + coreutils (Fedora) | Node.js ≥ 20 |
| Config | `~/.config/big-cleanup/config.conf` (shell) | `~/.config/big-cleanup/config.json` (`conf`) |
| History | `~/.local/share/big-cleanup/history.log` | field `history` dalam `config.json` (max 50) |
| Discovery | `mapfile < <(find ... 2>/dev/null)` | GNU `find` via `execaSync` (mirror persis) |
| Ukuran dir | `du -sh` (gagal senyap tanpa sudo) | walker native + fallback `sudo du -sh` pada EACCES |
| Counter section | `[i/15]` — salah (hanya 14 section; `STEP_TOTAL=15` hardcoded) | `[i/14]` — benar |
| Bahasa output | Indonesia | Indonesia (identik) |

## Perilaku yang dipertahankan 1:1

- **Banner**: `tput cols 2>/dev/null || echo 70`, cap 80, `=` berwarna cyan selebar kolom.
- **Clear screen**: bash `clear 2>/dev/null || true` (baris 236) — unconditional, mengirim `ESC[H ESC[2J ESC[3J` bahkan saat stdout dipipe. TS meniru persis (tanpa gate `isTTY`).
- **Tanggal**: `date '+%A, %d %B %Y — %H:%M'` — dipanggil via `execaSync("date", ...)` agar mengikuti locale sistem, sama seperti bash. (Versi awal memakai `Intl.DateTimeFormat("id-ID")` — diganti karena ketidakcocokan nama hari/bulan saat locale sistem bukan id.)
- **Prompt**: `? <prompt> [y/N]` magenta, hanya muncul saat TTY. `--yes` → `✓ auto-yes → <prompt>`.
- **Marker**: `✓ <desc>` hijau, `✕ <desc>` merah `(gagal/skip)`, `○ <desc>` kuning (dry-run / dilewati), `ℹ` info biru.
- **Pesan skip verbatim**: "Bun tidak terinstall, skip.", "Flatpak tidak terinstall, skip.", "Tidak ada yang stale — semua masih aktif dipakai.", "○ dilewati (SKIP_SECTIONS di config.conf)".
- **Free space**: `df -h /` sebelum/sesudah, delta hijau `(+N.NG / -N.NG)`.
- **Dry-run**: bash tetap memanggil `confirm()` (baris 82-96) di dry-run — saat stdout dipipe (non-TTY), `read -r ans` langsung gagal dan seksi dilewati senyap tanpa baris `○`. TS menahan prompt di dry-run (`runState.dryRun → true`), sehingga tiap seksi mencetak baris `○ (dry-run) ...` — perilaku dry-run yang lebih berguna (simulasi penuh tetap terlihat) dan merupakan deviasi disengaja.
- **Footer separator**: `hr()` bash (baris 59) memakai `printf ... | tr ' ' '─'` yang di locale ini menghasilkan byte rusak (`od`: `342 342 342 ...` = 0xE2 berulang, bukan `─` U+2500). TS mencetak `─` (0xE2 0x94 0x80) dengan benar.
- **SELESAI banner** dengan perintah cadangan bila perlu.

## Dua amendment binding (bug fix dari bash)

### 1. Counter 14/14
Bash meng-hardcode `STEP_TOTAL=15` (baris 71) padahal hanya ada 14 section, sehingga mencetak `[i/15]` untuk semua section — denominator off-by-one. TS mencetak `[i/14]` konsisten.

### 2. Ukuran direktori native + fallback sudo
Bash: `du -sh "$dir"` dijalankan polos; untuk direktori yang butuh root (mis. `/var/cache/dnf`, `/var/log/journal`), du gagal dan bash jatuh ke output "0" atau error senyap. TS:
1. Coba walker native (readdir recursive, symlink aman, error-tolerant).
2. Bila EACCES → `sudo du -sh` via execa (fallback ke ukuran dari `du` bila tersedia).
Hasilnya ukuran cache root-only dilaporkan akurat.

## Catatan teknik per keputusan

### Discovery pakai GNU `find`, bukan walker Node
Awalnya ditulis walker Node recursive (`readdir`). Pada tree project yang besar (`~/projects`), walker JS jauh lebih lambat dari GNU `find` dan sempat membuat run macet puluhan detik di section 03. Solusi: semua fungsi discovery (`findLines`, `findDirsBySuffix`, `findStaleNodeModules`, `deleteOldFiles`) memakai `execaSync("find", args)` dengan flag yang sama persis dengan bash:
- `-maxdepth N` (bun: 3, node_modules: 4, .next: 5)
- `-path '*/node_modules' -prune` untuk menghindari node_modules bersarang
- `-type d -name node_modules -atime +N` untuk stale
- `-type f -atime +N -delete` untuk journal/crash (bash pakai `find ... -exec rm -f {} \;`)

Output dibandingkan dengan bash `mapfile` semantics: baris dipisah newline, path absolut, tanpa `./` prefix.

### `dirBytes` tetap walker native
Hanya sizing (tidak discovery) yang memakai walker: dipakai untuk perbandingan ukuran sebelum/sesudah dan per-section. Aman karena berjalan di direktori yang sudah terkonfirmasi ada.

### Commander traps (mengapa dua run destruktif sempat terjadi)
Versi awal port mengeksekusi `confirmation.prompt()` sebelum parse flag commander, sehingga `--help` pun meminta konfirmasi dan mengarah ke run destruktif tak sengaja. Dua fix:
1. **Pre-check `--help`** sebelum inisialisasi apa pun (`argv.includes("--help") || argv.includes("-h")` → cetak help, exit 0).
2. **Rekonstruksi `fullArgv`** untuk `program.parseAsync` — commander butuh argv berformat `[node, script, ...args]`; menyusun ulang dari flag agar `--yes`/`--dry-run` tidak hilang.

Verifikasi: `--help` exit 0 tanpa prompt; `--list-sections` exit 0; `--history` tidak meminta konfirmasi.

### Config: `conf` dengan `projectSuffix: ""`
Library `conf` secara default menambah suffix `-nodejs` pada nama project (`big-cleanup-nodejs`). Di-set `projectSuffix: ""` agar path tetap `~/.config/big-cleanup/config.json` — konsisten dengan `CONFIG_DIR` bash.

### Platform guard
`platformGuard.ts` menolak jalan di non-Linux dengan pesan jelas. (Bash scriptnya sendiri tidak mengecek, tapi semua perintah adalah Linux-only.)

### Sudo & dry-run
- `dnf` section memanggil `sudo dnf autoremove` — di dry-run hanya dicetak (`○`), tidak dieksekusi.
- `sudo find` untuk hitung crash dump: `stdio: ["inherit","pipe","ignore"]` agar pesan `sudo: a terminal is required` dari count-check tidak bocor ke stderr saat dijalankan dari pipe (bash membuangnya via `2>/dev/null`).
- `trash` & `docker` sama: command dicetak di dry-run, dieksekusi hanya di mode normal.

## Verifikasi yang dilakukan

- `npx tsc --noEmit` — bersih.
- `npx tsup` — build `dist/index.js` sukses.
- `npx vitest run` — 2 file / 5 test pass (config hermetic via XDG temp dirs; fsSize).
- `--list-sections`, `--history`, `--help`, `--dry-run` — diverifikasi manual pada build segar.
- Full `--dry-run` menyelesaikan semua 14 section (~46 s) tanpa perintah destruktif, tanpa noise sudo.
- Header dibandingkan baris-per-baris dengan bash: tanggal, lebar banner, dan blok `df -h` identik.

## File yang berubah / ditambahkan

```
src/
  cli.ts, index.ts                     # entrypoint + commander traps
  commands/run.ts                      # orkestrasi 14 section + banner
  commands/history.ts                  # --history (10 run terakhir + total)
  commands/listSections.ts             # --list-sections
  commands/editConfig.ts               # --edit-config ($EDITOR, default nano)
  core/config.ts                       # conf wrapper + ensureConfig
  core/fsSize.ts                       # find wrappers + dirBytes + expandHome
  core/logger.ts                       # warna, TERM_WIDTH (tput cols), banner
  core/confirm.ts                      # prompt TTY-safe + auto-yes
  core/state.ts                        # runState bersama
  core/run.ts                          # orchestration core
  core/history.ts                      # log + tampilkan history
  core/platformGuard.ts                # Linux-only guard
  cleaners/…                           # 14 section cleaners + util.ts
test/
  config.test.ts                       # hermetic, XDG temp dirs
  fsSize.test.ts
```
