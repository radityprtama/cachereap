# cachereap

Cleanup tool untuk Fedora / Next.js / Bun dev machine. Port TypeScript yang setia (faithful port) dari `cachereap.sh`, dengan perilaku, output, dan pesan yang identik — plus perbaikan dua bug binding dari versi bash.

Linux-only. Membutuhkan **Node.js ≥ 20**.

## Install & Build

```bash
npm install
npm run build        # tsup -> dist/index.js
npm test             # vitest
npm link             # opsional: pasang `cachereap` ke PATH
```

Jalankan langsung tanpa install:

```bash
node dist/index.js --dry-run
```

## Usage

```bash
cachereap [options]
```

| Option | Deskripsi |
| --- | --- |
| `--yes` | Auto-ya untuk semua konfirmasi (tanpa prompt) |
| `--dry-run` | Simulasi: hitung ukuran, cetak yang akan dihapus, TIDAK menghapus apa pun |
| `--edit-config` | Buka file config di `$EDITOR` (default `nano`) |
| `--history` | Tampilkan 10 run terakhir + total reclaim sepanjang waktu |
| `--list-sections` | Daftar semua section beserta key-nya |
| `--help` | Bantuan CLI |

## Sections

Ada **14 section** (bukan 15 — lihat [MIGRATION.md](docs/MIGRATION.md) untuk penjelasan bug counter bash):

| Key | Icon | Deskripsi |
| --- | --- | --- |
| `bun` | ⬡ | Cache install & build Bun |
| `npmcache` | ▣ | Cache npm / pnpm / yarn global |
| `next` | ▲ | Cache `.next/cache` di semua project |
| `nodemodules` | ▤ | `node_modules` stale (≥ `staleDays` tanpa akses) |
| `turbo` | ◈ | Cache `turbo` / `nx` di semua project |
| `langcache` | ◇ | Cache bahasa (rust, go, dsb.) di `~/.cache` |
| `dnf` | ⬢ | Cache `dnf` + hapus paket `dnf autoremove` |
| `kernel` | ◉ | Hapus kernel lama (report + cleanup) |
| `flatpak` | ▥ | Unused runtime flatpak |
| `journal` | ☰ | Vacuum journal log (vakum + hapus file > `staleDays`) |
| `crash` | ⊗ | Crash dump & coredump lama |
| `docker` | ▦ | Prune docker (images/containers/volumes dangling) |
| `trash` | ▽ | Trash bin & thumbnail cache |
| `configaudit` | ◎ | Audit config app ter-uninstall (report-only) |

`kernel` dan `configaudit` bersifat report-only (mencetak temuan, tidak menghapus).

## Konfigurasi

### Migrasi dari `config.conf` (bash)

Versi bash membaca `~/.config/cachereap/config.conf` (format shell). Versi TS membaca `~/.config/cachereap/config.json` (format JSON via library `conf`).

Pemetaan:

| Bash (`config.conf`) | TS (`config.json`) | Default |
| --- | --- | --- |
| `PROJECT_DIR="$HOME/projects"` | `"projectDir": "~/projects"` | `~/projects` |
| `STALE_DAYS=30` | `"staleDays": 30` | `30` |
| `SKIP_SECTIONS="docker,kernel"` | `"skipSections": ["docker","kernel"]` | `[]` |

Migrasi manual (sekali saja):

```bash
mkdir -p ~/.config/cachereap
node -e '
const fs = require("fs");
const c = {};
const lines = fs.readFileSync(process.env.HOME + "/.config/cachereap/config.conf", "utf8").split("\n");
for (const l of lines) {
  const m = l.match(/^\s*(\w+)=(.*)$/);
  if (!m) continue;
  if (m[1] === "PROJECT_DIR") c.projectDir = m[2].replace(/^\$HOME/, "~").replace(/^"|"$/g, "");
  if (m[1] === "STALE_DAYS") c.staleDays = Number(m[2]);
  if (m[1] === "SKIP_SECTIONS") c.skipSections = m[2] ? m[2].split(",") : [];
}
fs.writeFileSync(process.env.HOME + "/.config/cachereap/config.json", JSON.stringify(c, null, 2) + "\n");
'
```

Catatan: file `config.conf` lama dan `history.log` lama TIDAK dibaca oleh versi TS. Riwayat baru disimpan di dalam `config.json` (field `history`, max 50 entri). Salin angka dari `--history` bash ke TS jika ingin kontinuitas angka total reclaim.

### File config

- **Config**: `~/.config/cachereap/config.json`
- **History**: tersimpan di dalam `config.json` (field `history`)

`--edit-config` membuka file config dengan `$EDITOR` (default `nano`).

## Perbedaan dari bash (amendment binding)

Hanya dua perubahan perilaku dari `cachereap.sh` — keduanya bug fix, sisanya identik 1:1:

1. **Counter section benar (14/14)** — bash meng-hardcode `STEP_TOTAL=15` dan mencetak `[i/15]` untuk semua section padahal hanya ada 14. TS mencetak `[i/14]`.
2. **Ukuran direktori native** — bash menggunakan `du -sh` (tanpa sudo, gagal senyap di direktori yang butuh akses root). TS menggunakan walker native dengan fallback `sudo du -sh` saat EACCES, jadi ukuran cache seperti `/var/cache/dnf` dilaporkan dengan benar.

Lihat [docs/MIGRATION.md](docs/MIGRATION.md) untuk perbandingan detail per section dan catatan teknik port.

## Development

```bash
npm run dev        # tsup watch
npm run typecheck  # tsc --noEmit
npm test           # vitest
```

Struktur:

```
src/
  cli.ts                 # entrypoint + commander traps
  index.ts
  commands/              # run, history, listSections, editConfig
  core/                  # config, fsSize, history, logger, confirm, state
  cleaners/              # 14 section cleaners + util
test/                    # vitest (config hermetic via XDG dirs)
```
