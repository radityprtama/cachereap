#!/usr/bin/env bash
#
# big-cleanup.sh — Biweekly deep clean untuk Fedora dev machine
# (Next.js / Bun / Tanstack Start / monorepo)
#
# Usage:
#   chmod +x big-cleanup.sh
#   ./big-cleanup.sh                 # jalan interaktif
#   ./big-cleanup.sh --yes           # otomatis tanpa konfirmasi (buat cron/systemd)
#   ./big-cleanup.sh --dry-run       # simulasi, tidak menghapus apapun
#   ./big-cleanup.sh --edit-config   # buka config file di $EDITOR
#   ./big-cleanup.sh --history       # tampilkan riwayat run sebelumnya
#   ./big-cleanup.sh --list-sections # tampilkan daftar key section (buat SKIP_SECTIONS)
#   ./big-cleanup.sh --help          # tampilkan bantuan
#
set -euo pipefail

CONFIG_DIR="$HOME/.config/big-cleanup"
CONFIG_FILE="$CONFIG_DIR/config.conf"
DATA_DIR="$HOME/.local/share/big-cleanup"
HISTORY_FILE="$DATA_DIR/history.log"

AUTO_YES=false
DRY_RUN=false
ACTION=""
for arg in "$@"; do
  case "$arg" in
  --yes) AUTO_YES=true ;;
  --dry-run) DRY_RUN=true ;;
  --edit-config) ACTION="edit-config" ;;
  --history) ACTION="history" ;;
  --list-sections) ACTION="list-sections" ;;
  --help|-h) ACTION="help" ;;
  esac
done

# ---------- Warna (auto-disable kalau output bukan terminal) ----------
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[38;5;203m'; C_GREEN=$'\033[38;5;114m'; C_YELLOW=$'\033[38;5;221m'
  C_BLUE=$'\033[38;5;75m'; C_CYAN=$'\033[38;5;80m'; C_MAGENTA=$'\033[38;5;176m'
  C_GRAY=$'\033[38;5;244m'; C_WHITE=$'\033[38;5;255m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""
  C_BLUE=""; C_CYAN=""; C_MAGENTA=""; C_GRAY=""; C_WHITE=""
fi

I_OK="${C_GREEN}✓${C_RESET}"
I_SKIP="${C_YELLOW}○${C_RESET}"
I_WARN="${C_RED}✕${C_RESET}"
I_ARROW="${C_CYAN}▸${C_RESET}"
I_INFO="${C_BLUE}ℹ${C_RESET}"
I_Q="${C_MAGENTA}?${C_RESET}"
I_BULLET="${C_GRAY}·${C_RESET}"

TERM_WIDTH=$(tput cols 2>/dev/null || echo 70)
[ "$TERM_WIDTH" -gt 80 ] && TERM_WIDTH=80

hr() { printf "${C_GRAY}%*s${C_RESET}\n" "$TERM_WIDTH" '' | tr ' ' '─'; }

banner() {
  local title="$1" subtitle="$2"
  echo
  printf "${C_CYAN}"; printf '━%.0s' $(seq 1 "$TERM_WIDTH"); printf "${C_RESET}\n"
  printf "  ${C_BOLD}${C_WHITE}%s${C_RESET}\n" "$title"
  [ -n "$subtitle" ] && printf "  ${C_DIM}%s${C_RESET}\n" "$subtitle"
  printf "${C_CYAN}"; printf '━%.0s' $(seq 1 "$TERM_WIDTH"); printf "${C_RESET}\n"
}

STEP_NUM=0
STEP_TOTAL=15
section() {
  local icon="$1" title="$2"
  STEP_NUM=$((STEP_NUM + 1))
  echo
  printf "${C_GRAY}[%02d/%d]${C_RESET} ${C_BOLD}${C_BLUE}%s${C_RESET}  ${C_BOLD}%s${C_RESET}\n" "$STEP_NUM" "$STEP_TOTAL" "$icon" "$title"
  printf "${C_GRAY}      "; printf '─%.0s' $(seq 1 $((${#title} + 2))); printf "${C_RESET}\n"
}

list_item() { echo "      ${I_BULLET} $1 ${C_DIM}($2)${C_RESET}"; }

confirm() {
  local msg="$1"
  if $AUTO_YES; then
    echo "      ${I_OK} ${C_DIM}auto-yes${C_RESET} → $msg"
    return 0
  fi
  printf "      ${I_Q} %s ${C_DIM}[y/N]${C_RESET} " "$msg"
  read -r ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

run() {
  local desc="$1"; shift
  if $DRY_RUN; then
    echo "      ${I_SKIP} ${C_DIM}(dry-run)${C_RESET} $desc"
    return
  fi
  echo "      ${I_ARROW} $desc..."
  if "$@"; then
    echo "      ${I_OK} $desc"
  else
    echo "      ${I_WARN} $desc ${C_RED}(gagal/skip)${C_RESET}"
  fi
}

human_size() { du -sh "$1" 2>/dev/null | cut -f1 || echo "0"; }
get_avail_gb() { df --output=avail -BG / 2>/dev/null | tail -1 | tr -dc '0-9'; }

# ================= KONFIGURASI ==================
SECTION_KEYS="bun npmcache next nodemodules turbo langcache dnf kernel flatpak journal crash docker trash configaudit"

ensure_config() {
  mkdir -p "$CONFIG_DIR" "$DATA_DIR"
  if [ ! -f "$CONFIG_FILE" ]; then
    cat > "$CONFIG_FILE" << 'CONF_EOF'
# ~/.config/big-cleanup/config.conf
# Konfigurasi big-cleanup.sh — edit sesuai kebutuhan, lalu simpan.

# Lokasi folder project/monorepo yang discan untuk .next/cache, node_modules, turbo/nx cache
PROJECT_DIR="$HOME/projects"

# Berapa hari node_modules dianggap "stale" (belum diakses)
STALE_DAYS=30

# Section yang mau di-skip otomatis tiap run (comma-separated, tanpa spasi).
# Jalankan './big-cleanup.sh --list-sections' untuk lihat daftar key yang valid.
# Contoh: SKIP_SECTIONS="docker,kernel"
SKIP_SECTIONS=""
CONF_EOF
    echo "  ${I_INFO} Config default dibuat di ${C_CYAN}$CONFIG_FILE${C_RESET}"
  fi
}

load_config() {
  ensure_config
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
}

should_skip() {
  local key="$1"
  [[ ",${SKIP_SECTIONS:-}," == *",$key,"* ]]
}

skip_notice() {
  echo "      ${I_SKIP} ${C_DIM}dilewati (SKIP_SECTIONS di config.conf)${C_RESET}"
}

# ================= ACTIONS (non-cleanup) ==================
show_help() {
  banner "BIG CLEANUP" "Fedora Dev Machine — Bantuan"
  cat << EOF
  Usage: ./big-cleanup.sh [opsi]

  Opsi:
    (tanpa opsi)      Jalan interaktif, tanya konfirmasi tiap section
    --yes             Jalan otomatis tanpa konfirmasi (untuk cron/systemd)
    --dry-run         Simulasi, tidak menghapus apapun
    --edit-config     Buka config file di \$EDITOR
    --history         Tampilkan riwayat run sebelumnya
    --list-sections   Tampilkan daftar key section (untuk SKIP_SECTIONS)
    --help            Tampilkan bantuan ini

  Config file : $CONFIG_FILE
  History log : $HISTORY_FILE
EOF
}

show_list_sections() {
  banner "DAFTAR SECTION" "Pakai key ini di SKIP_SECTIONS pada config.conf"
  echo
  echo "  bun          - Bun global cache"
  echo "  npmcache     - npm/pnpm/yarn cache"
  echo "  next         - Next.js .next/cache"
  echo "  nodemodules  - node_modules stale (30+ hari)"
  echo "  turbo        - Turborepo & Nx cache"
  echo "  langcache    - pip/cargo/go cache"
  echo "  dnf          - DNF autoremove & clean"
  echo "  kernel       - Audit kernel lama (report-only)"
  echo "  flatpak      - Flatpak unused runtime"
  echo "  journal      - Systemd journal logs"
  echo "  crash        - Coredump & ABRT"
  echo "  docker       - Docker system prune"
  echo "  trash        - Trash bin & thumbnail cache"
  echo "  configaudit  - Audit config app ter-uninstall (report-only)"
  echo
}

show_history() {
  banner "RIWAYAT CLEANUP" "10 run terakhir"
  if [ ! -f "$HISTORY_FILE" ] || [ ! -s "$HISTORY_FILE" ]; then
    echo "  ${C_DIM}Belum ada riwayat. Jalankan cleanup dulu tanpa --dry-run.${C_RESET}"
    echo
    return
  fi
  echo
  printf "  ${C_BOLD}%-19s %-10s %10s %10s %10s${C_RESET}\n" "Tanggal" "Mode" "Sebelum" "Sesudah" "Freed"
  printf "  ${C_GRAY}%-19s %-10s %10s %10s %10s${C_RESET}\n" "-------------------" "----------" "----------" "----------" "----------"
  tail -n 10 "$HISTORY_FILE" | while IFS='|' read -r ts mode before after freed; do
    local color="$C_GREEN"
    [ "$mode" = "dry-run" ] && color="$C_YELLOW"
    printf "  %-19s ${color}%-10s${C_RESET} %9sGB %9sGB ${C_BOLD}${C_GREEN}%9sGB${C_RESET}\n" "$ts" "$mode" "$before" "$after" "$freed"
  done
  echo
  TOTAL_FREED=$(awk -F'|' '$2 != "dry-run" {sum += $5} END {print sum+0}' "$HISTORY_FILE")
  RUN_COUNT=$(awk -F'|' '$2 != "dry-run"' "$HISTORY_FILE" | wc -l)
  echo "  ${C_DIM}Total dari $RUN_COUNT run nyata: ${C_RESET}${C_BOLD}${C_GREEN}~${TOTAL_FREED}GB${C_RESET} ${C_DIM}sudah direclaim sepanjang waktu.${C_RESET}"
  echo
}

log_history() {
  local mode="normal"
  $DRY_RUN && mode="dry-run"
  echo "$(date '+%Y-%m-%d %H:%M')|$mode|$AVAIL_BEFORE|$AVAIL_AFTER|$FREED" >> "$HISTORY_FILE"
}

# ================= HANDLE ACTIONS DULUAN ==================
mkdir -p "$CONFIG_DIR" "$DATA_DIR"
case "$ACTION" in
  help) show_help; exit 0 ;;
  list-sections) show_list_sections; exit 0 ;;
  history) show_history; exit 0 ;;
  edit-config)
    ensure_config
    "${EDITOR:-nano}" "$CONFIG_FILE"
    exit 0
    ;;
esac

load_config
SEARCH_DIR="${PROJECT_DIR:-$HOME/projects}"
STALE_DAYS="${STALE_DAYS:-30}"

# ================= START CLEANUP ==================
clear 2>/dev/null || true
banner "BIG CLEANUP" "Fedora Dev Machine  ·  $(date '+%A, %d %B %Y — %H:%M')"

AVAIL_BEFORE=$(get_avail_gb)
echo "  ${C_DIM}Free space sebelum:${C_RESET}"
df -h / 2>/dev/null | awk 'NR==1 || NR==2 {print "    " $0}'
echo "  ${C_DIM}Config: ${C_CYAN}$CONFIG_FILE${C_RESET}  ${C_DIM}·  PROJECT_DIR=${C_CYAN}$SEARCH_DIR${C_RESET}  ${C_DIM}·  STALE_DAYS=${C_CYAN}$STALE_DAYS${C_RESET}"
[ -n "${SKIP_SECTIONS:-}" ] && echo "  ${C_DIM}Skip sections: ${C_YELLOW}$SKIP_SECTIONS${C_RESET}"
$DRY_RUN && echo "  ${C_YELLOW}${C_BOLD}◆ MODE DRY-RUN — tidak ada file yang benar-benar dihapus${C_RESET}"

# ---------- 1. Bun cache ----------
section "⬡" "Bun Cache"
if should_skip bun; then skip_notice; else
  if command -v bun >/dev/null; then
    BUN_CACHE="$HOME/.bun/install/cache"
    if [ -d "$BUN_CACHE" ]; then
      echo "      Ukuran saat ini: ${C_BOLD}${C_YELLOW}$(human_size "$BUN_CACHE")${C_RESET}"
      if confirm "Bersihkan Bun global cache?"; then
        run "Hapus isi Bun cache" bash -c "rm -rf '$BUN_CACHE'/*"
      fi
    else
      echo "      ${C_DIM}Tidak ada cache ditemukan.${C_RESET}"
    fi
  else
    echo "      ${C_DIM}Bun tidak terinstall, skip.${C_RESET}"
  fi
fi

# ---------- 2. npm / pnpm / yarn cache ----------
section "▣" "Package Manager Cache Lain"
if should_skip npmcache; then skip_notice; else
  if command -v npm >/dev/null; then run "npm cache clean --force" npm cache clean --force; fi
  if command -v pnpm >/dev/null; then run "pnpm store prune" pnpm store prune; fi
  if command -v yarn >/dev/null; then run "yarn cache clean" yarn cache clean; fi
fi

# ---------- 3. Next.js .next/cache ----------
section "▲" "Next.js Build Cache (.next/cache)"
if should_skip next; then skip_notice; else
  echo "      ${C_DIM}Mencari di: $SEARCH_DIR${C_RESET}"
  if [ -d "$SEARCH_DIR" ]; then
    mapfile -t NEXT_CACHES < <(find "$SEARCH_DIR" -type d -path "*/.next/cache" 2>/dev/null)
    for d in "${NEXT_CACHES[@]}"; do list_item "$d" "$(human_size "$d")"; done
    echo "      ${C_DIM}Ditemukan ${#NEXT_CACHES[@]} folder cache${C_RESET}"
    if [ "${#NEXT_CACHES[@]}" -gt 0 ] && confirm "Hapus semua .next/cache di atas?"; then
      for d in "${NEXT_CACHES[@]}"; do
        if $DRY_RUN; then echo "      ${I_SKIP} (dry-run) rm -rf $d"
        else rm -rf "$d" && echo "      ${I_OK} dihapus: $d"; fi
      done
    fi
  else
    echo "      ${I_WARN} Folder $SEARCH_DIR tidak ditemukan"
  fi
fi

# ---------- 4. node_modules stale ----------
section "▤" "node_modules Stale (${STALE_DAYS}+ hari tidak diakses)"
if should_skip nodemodules; then skip_notice; else
  if [ -d "$SEARCH_DIR" ]; then
    mapfile -t STALE_NM < <(find "$SEARCH_DIR" -maxdepth 4 -type d -name node_modules -atime +"$STALE_DAYS" 2>/dev/null)
    for d in "${STALE_NM[@]}"; do list_item "$d" "$(human_size "$d")"; done
    if [ "${#STALE_NM[@]}" -gt 0 ]; then
      echo "      ${C_DIM}Catatan: reinstall gampang → cd <project> && bun install${C_RESET}"
      if confirm "Hapus juga node_modules di atas sekarang?"; then
        for d in "${STALE_NM[@]}"; do
          if $DRY_RUN; then echo "      ${I_SKIP} (dry-run) rm -rf $d"
          else rm -rf "$d" && echo "      ${I_OK} dihapus: $d"; fi
        done
      fi
    else
      echo "      ${C_DIM}Tidak ada yang stale — semua masih aktif dipakai.${C_RESET}"
    fi
  fi
fi

# ---------- 4b. Turborepo & Nx cache ----------
section "◈" "Turborepo & Nx Cache"
if should_skip turbo; then skip_notice; else
  if [ -d "$SEARCH_DIR" ]; then
    mapfile -t TURBO_CACHES < <(find "$SEARCH_DIR" -maxdepth 5 -type d -path "*/.turbo" 2>/dev/null)
    mapfile -t NX_CACHES < <(find "$SEARCH_DIR" -maxdepth 5 -type d -path "*/node_modules/.cache/nx" 2>/dev/null)
    ALL_BUILD_CACHES=("${TURBO_CACHES[@]}" "${NX_CACHES[@]}")
    for d in "${ALL_BUILD_CACHES[@]}"; do list_item "$d" "$(human_size "$d")"; done
    echo "      ${C_DIM}Ditemukan ${#ALL_BUILD_CACHES[@]} folder cache${C_RESET}"
    if [ "${#ALL_BUILD_CACHES[@]}" -gt 0 ] && confirm "Hapus semua cache Turbo/Nx di atas?"; then
      for d in "${ALL_BUILD_CACHES[@]}"; do
        if $DRY_RUN; then echo "      ${I_SKIP} (dry-run) rm -rf $d"
        else rm -rf "$d" && echo "      ${I_OK} dihapus: $d"; fi
      done
    fi
    TURBO_GLOBAL="$HOME/.cache/turbo"
    if [ -d "$TURBO_GLOBAL" ]; then
      echo
      list_item "$TURBO_GLOBAL (global)" "$(human_size "$TURBO_GLOBAL")"
      if confirm "Hapus Turbo global cache juga?"; then
        run "Hapus turbo global cache" rm -rf "$TURBO_GLOBAL"
      fi
    fi
  fi
fi

# ---------- 4c. Cache tool bahasa lain ----------
section "◇" "Cache Tool Bahasa Lain (pip/cargo/go)"
if should_skip langcache; then skip_notice; else
  PIP_CACHE="$HOME/.cache/pip"
  if [ -d "$PIP_CACHE" ]; then
    list_item "$PIP_CACHE" "$(human_size "$PIP_CACHE")"
    if confirm "Bersihkan pip cache?"; then run "pip cache purge" bash -c "rm -rf '$PIP_CACHE'"; fi
  fi
  CARGO_CACHE="$HOME/.cargo/registry/cache"
  if [ -d "$CARGO_CACHE" ]; then
    list_item "$CARGO_CACHE" "$(human_size "$CARGO_CACHE")"
    if confirm "Bersihkan Cargo registry cache?"; then run "Hapus cargo registry cache" bash -c "rm -rf '$CARGO_CACHE'"; fi
  fi
  GO_CACHE="$HOME/.cache/go-build"
  if [ -d "$GO_CACHE" ]; then
    list_item "$GO_CACHE" "$(human_size "$GO_CACHE")"
    if confirm "Bersihkan Go build cache?"; then
      if command -v go >/dev/null; then run "go clean -cache" go clean -cache
      else run "Hapus go-build cache" bash -c "rm -rf '$GO_CACHE'"; fi
    fi
  fi
  if [ ! -d "$PIP_CACHE" ] && [ ! -d "$CARGO_CACHE" ] && [ ! -d "$GO_CACHE" ]; then
    echo "      ${C_DIM}Tidak ada cache pip/cargo/go ditemukan.${C_RESET}"
  fi
fi

# ---------- 5. DNF cache ----------
section "⬢" "DNF (System Packages)"
if should_skip dnf; then skip_notice; else
  run "DNF autoremove (paket dependency yatim)" sudo dnf autoremove -y
  run "DNF clean all" sudo dnf clean all
fi

# ---------- 5b. Kernel lama (report-only) ----------
section "◉" "Kernel Lama (audit — tidak auto-hapus)"
if should_skip kernel; then skip_notice; else
  if command -v rpm >/dev/null; then
    CURRENT_KERNEL=$(uname -r)
    mapfile -t INSTALLED_KERNELS < <(rpm -q kernel 2>/dev/null | sed 's/^kernel-//')
    echo "      Kernel yang sedang jalan: ${C_BOLD}${C_GREEN}$CURRENT_KERNEL${C_RESET}"
    echo "      Total kernel terinstall: ${#INSTALLED_KERNELS[@]}"
    for k in "${INSTALLED_KERNELS[@]}"; do
      if [[ "$k" == "$CURRENT_KERNEL" ]]; then
        echo "      ${I_OK} $k ${C_DIM}(aktif, jangan dihapus)${C_RESET}"
      else
        echo "      ${I_SKIP} $k ${C_DIM}(kandidat dihapus)${C_RESET}"
      fi
    done
    if [ "${#INSTALLED_KERNELS[@]}" -gt 2 ]; then
      echo "      ${I_INFO} ${C_DIM}Ada lebih dari 2 kernel. Fedora biasanya otomatis bersihin ini saat${C_RESET}"
      echo "      ${C_DIM}  'dnf update'. Kalau mau hapus manual, JANGAN pakai script ini — cek dulu:${C_RESET}"
      echo "      ${C_CYAN}  sudo dnf remove kernel-<versi-lama>${C_RESET} ${C_DIM}(ganti <versi-lama> yang BUKAN kernel aktif)${C_RESET}"
    else
      echo "      ${C_DIM}Aman, cuma kernel yang wajar tersimpan.${C_RESET}"
    fi
  fi
fi

# ---------- 6. Flatpak unused ----------
section "▥" "Flatpak"
if should_skip flatpak; then skip_notice; else
  if command -v flatpak >/dev/null; then
    run "Flatpak uninstall unused runtimes" sudo flatpak uninstall --unused -y
  else
    echo "      ${C_DIM}Flatpak tidak terinstall, skip.${C_RESET}"
  fi
fi

# ---------- 7. systemd journal ----------
section "☰" "Systemd Journal Logs"
if should_skip journal; then skip_notice; else
  if command -v journalctl >/dev/null; then
    run "Vacuum journal (>14 hari)" sudo journalctl --vacuum-time=14d
    run "Vacuum journal (batasi 200M)" sudo journalctl --vacuum-size=200M
  fi
fi

# ---------- 7b. Crash dumps & ABRT ----------
section "⊗" "Crash Dumps & Laporan Error"
if should_skip crash; then skip_notice; else
  COREDUMP_DIR="/var/lib/systemd/coredump"
  if [ -d "$COREDUMP_DIR" ] && [ "$(sudo find "$COREDUMP_DIR" -type f 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "      Ukuran systemd-coredump: ${C_BOLD}${C_YELLOW}$(sudo du -sh "$COREDUMP_DIR" 2>/dev/null | cut -f1)${C_RESET}"
    if confirm "Hapus semua coredump lama?"; then
      run "Bersihkan coredump" sudo bash -c "rm -rf $COREDUMP_DIR/*"
    fi
  else
    echo "      ${C_DIM}Tidak ada coredump ditemukan.${C_RESET}"
  fi
  ABRT_DIR="/var/spool/abrt"
  if [ -d "$ABRT_DIR" ] && [ "$(sudo find "$ABRT_DIR" -mindepth 1 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "      Ukuran laporan ABRT: ${C_BOLD}${C_YELLOW}$(sudo du -sh "$ABRT_DIR" 2>/dev/null | cut -f1)${C_RESET}"
    if confirm "Hapus semua laporan crash ABRT?"; then
      run "Bersihkan ABRT" sudo bash -c "rm -rf $ABRT_DIR/*"
    fi
  else
    echo "      ${C_DIM}Tidak ada laporan ABRT.${C_RESET}"
  fi
fi

# ---------- 8. Docker ----------
section "▦" "Docker"
if should_skip docker; then skip_notice; else
  if command -v docker >/dev/null; then
    docker system df 2>/dev/null | awk 'NR==1{print "      "$0} NR>1{print "      "$0}'
    echo
    echo "      ${C_YELLOW}◆ Volume aktif TIDAK ikut kehapus dengan --volumes kecuali unused.${C_RESET}"
    if confirm "Jalankan docker system prune -a --volumes?"; then
      run "Docker prune" docker system prune -af --volumes
    fi
  else
    echo "      ${C_DIM}Docker tidak terinstall, skip.${C_RESET}"
  fi
fi

# ---------- 9. Trash bin & cache lain-lain ----------
section "▽" "Trash Bin & Cache Sistem Lain-lain"
if should_skip trash; then skip_notice; else
  TRASH_DIR="$HOME/.local/share/Trash"
  if [ -d "$TRASH_DIR" ] && [ "$(find "$TRASH_DIR" -mindepth 1 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "      Ukuran Trash bin: ${C_BOLD}${C_YELLOW}$(human_size "$TRASH_DIR")${C_RESET}"
    if confirm "Kosongkan Trash bin?"; then
      run "Kosongkan trash" bash -c "rm -rf '$TRASH_DIR'/files/* '$TRASH_DIR'/info/*"
    fi
  else
    echo "      ${C_DIM}Trash bin kosong.${C_RESET}"
  fi
  run "Bersihkan thumbnail cache" bash -c "rm -rf $HOME/.cache/thumbnails/*"
  run "Bersihkan ~/.cache umum (>30 hari)" bash -c "find $HOME/.cache -type f -atime +30 -delete"
fi

# ---------- 10. Audit config app ter-uninstall (report-only) ----------
section "◎" "Audit Config App Ter-uninstall (laporan saja)"
if should_skip configaudit; then skip_notice; else
  echo "      ${C_DIM}Mengecek ~/.config yang appnya kemungkinan sudah tidak terinstall...${C_RESET}"
  if command -v flatpak >/dev/null; then
    mapfile -t FLATPAK_IDS < <(flatpak list --app --columns=application 2>/dev/null)
  else
    FLATPAK_IDS=()
  fi
  ORPHAN_COUNT=0
  if [ -d "$HOME/.config" ]; then
    for d in "$HOME/.config"/*/; do
      [ -d "$d" ] || continue
      name=$(basename "$d")
      case "$name" in
        autostart|systemd|environment.d|user-tmpfiles.d|dconf|pulse|gtk-*|mimeapps.list) continue ;;
      esac
      if command -v "$name" >/dev/null 2>&1; then continue; fi
      if compgen -G "/usr/share/applications/*${name}*.desktop" >/dev/null 2>&1; then continue; fi
      if compgen -G "$HOME/.local/share/applications/*${name}*.desktop" >/dev/null 2>&1; then continue; fi
      is_flatpak=false
      for fid in "${FLATPAK_IDS[@]:-}"; do
        [[ "$fid" == *"$name"* ]] && is_flatpak=true && break
      done
      $is_flatpak && continue
      echo "      ${I_SKIP} ~/.config/$name ${C_DIM}($(human_size "$d"))${C_RESET}"
      ORPHAN_COUNT=$((ORPHAN_COUNT + 1))
    done
  fi
  if [ "$ORPHAN_COUNT" -eq 0 ]; then
    echo "      ${I_OK} ${C_DIM}Tidak ada kandidat config orphan yang jelas.${C_RESET}"
  else
    echo
    echo "      ${I_INFO} ${C_DIM}Ini HEURISTIK, bisa false-positive (misal config CLI tool tanpa .desktop file).${C_RESET}"
    echo "      ${C_DIM}Cek manual dulu sebelum hapus, misal:${C_RESET} ${C_CYAN}rm -rf ~/.config/<nama>${C_RESET}"
  fi
fi

# ================= SUMMARY & LOGGING ==================
AVAIL_AFTER=$(get_avail_gb)
FREED=$(( AVAIL_AFTER - AVAIL_BEFORE ))
log_history

banner "SELESAI" ""
echo "  ${C_DIM}Free space sesudah:${C_RESET}"
df -h / 2>/dev/null | awk 'NR==1 || NR==2 {print "    " $0}'
echo
if $DRY_RUN; then
  echo "  ${C_YELLOW}◆ Ini baru simulasi. Jalankan tanpa --dry-run untuk eksekusi beneran.${C_RESET}"
elif [ "$FREED" -gt 0 ]; then
  echo "  ${C_BOLD}${C_GREEN}✓ Total ruang yang berhasil dibebaskan: ~${FREED}GB${C_RESET}"
else
  echo "  ${C_DIM}Tidak ada perubahan signifikan pada free space.${C_RESET}"
fi
echo "  ${C_DIM}Lihat riwayat lengkap: ${C_RESET}${C_CYAN}./big-cleanup.sh --history${C_RESET}"
hr
