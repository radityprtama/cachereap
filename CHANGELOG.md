# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/), versi mengikuti [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-08-01

### Added
- Port TypeScript dari `big-cleanup.sh` dengan fidelitas perilaku 1:1 (output Indonesia, prompt konfirmasi, marker `✓`/`✕`/`○`, banner, ANSI 256).
- 14 section cleanup: `bun`, `npmcache`, `next`, `nodemodules`, `turbo`, `langcache`, `dnf`, `kernel`, `flatpak`, `journal`, `crash`, `docker`, `trash`, `configaudit`.
- CLI flags: `--yes`, `--dry-run`, `--edit-config`, `--history`, `--list-sections`, `--help`.
- Konfigurasi JSON (`~/.config/big-cleanup/config.json`) via library `conf` — pengganti `config.conf` bash.
- Riwayat cleanup tersimpan di dalam config (`field history`, max 50 entri) — pengganti `history.log`.
- Safety: mode `--dry-run` tidak pernah mengeksekusi perintah destruktif; `confirm.ts` mengembalikan `true` saat dry-run agar output simulasi lengkap.
- Deteksi platform: menolak jalan di non-Linux (Linux-only).
- Tes vitest untuk config (hermetic via XDG temp dirs) dan fsSize.

### Changed
- **Counter section dikoreksi menjadi 14/14** (bash meng-hardcode `STEP_TOTAL=15` dan mencetak `[i/15]` padahal hanya ada 14 section). Ini adalah amendment binding pertama.
- **Ukuran direktori native** dengan fallback `sudo du -sh` saat EACCES (bash memakai `du -sh` tanpa sudo dan gagal senyap pada direktori root-only). Amendment binding kedua.
- Discovery file/direktori memakai GNU `find` via execa — mirror dari `mapfile < <(find ...)` bash, dan jauh lebih cepat dari walker Node pada tree project besar.
- Banner memakai `date '+%A, %d %B %Y — %H:%M'` dan `TERM_WIDTH=$(tput cols || echo 70)` (cap 80) — identik dengan bash, termasuk saat stdout dipipe.

### Fixed
- **Regresi crash**: dua run destruktif tak disengaja di versi awal port (fix: pre-check `--help` + rekonstruksi `fullArgv` di commander).
- **Noise sudo**: `sudo find` untuk hitung crash dump membocorkan `sudo: a terminal is required` ke stderr — kini `stdio: ["inherit","pipe","ignore"]`.
- **Hang section 03**: walker Node recursive macet pada tree project besar — diganti GNU `find`.
- Simbol tidak terdefinisi (`lstat`).

### Removed
- (tidak ada — semua fitur bash dipertahankan)

[0.1.0]: https://github.com/radityra/cachereap/releases/tag/v0.1.0
