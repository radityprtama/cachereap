import { Command } from "commander";
import { banner, cyan, dim } from "./core/logger";
import { ensureConfig, getConfig } from "./core/config";
import { historyCommand } from "./commands/history";
import { listSectionsCommand } from "./commands/listSections";
import { editConfigCommand } from "./commands/editConfig";
import { runCleanup } from "./commands/run";
import { setRunMode } from "./core/state";

function showHelp(): void {
  banner("CACHEREAP", "Fedora Dev Machine — Bantuan");
  const conf = getConfig();
  console.log(`  Usage: cachereap [opsi]`);
  console.log();
  console.log(`  Opsi:`);
  console.log(`    (tanpa opsi)      Jalan interaktif, tanya konfirmasi tiap section`);
  console.log(`    --yes             Jalan otomatis tanpa konfirmasi (untuk cron/systemd)`);
  console.log(`    --dry-run         Simulasi, tidak menghapus apapun`);
  console.log(`    --edit-config     Buka config file di $EDITOR`);
  console.log(`    --history         Tampilkan riwayat run sebelumnya`);
  console.log(`    --list-sections   Tampilkan daftar key section (untuk SKIP_SECTIONS)`);
  console.log(`    --help            Tampilkan bantuan ini`);
  console.log();
  console.log(`  Config file : ${conf.path}`);
  console.log(`  History     : disimpan di config file yang sama (key "history")`);
  console.log();
}

export async function runCli(argv: string[]): Promise<void> {
  ensureConfig();

  // bash semantics: --help first. Handle manually — commander never exposes
  // it via opts() (it intercepts --help internally even with helpOption(false)).
  if (argv.includes("--help")) return showHelp();

  const program = new Command();
  program
    .name("cachereap")
    .helpOption(false)
    .allowUnknownOption(false)
    .option("--yes", "jalan otomatis tanpa konfirmasi")
    .option("--dry-run", "simulasi, tidak menghapus apapun")
    .option("--edit-config", "buka config file di $EDITOR")
    .option("--history", "tampilkan riwayat run sebelumnya")
    .option("--list-sections", "tampilkan daftar key section");

  // commander expects the full argv (node, script, ...) — a bare options
  // array parses to empty opts() and every flag falls through to run.
  const fullArgv =
    argv.length >= 2 && !(argv[0] ?? "").startsWith("-") ? argv : [process.argv0, "cachereap", ...argv];
  program.parse(fullArgv);
  const opts = program.opts();

  // bash semantics: later action flags win; --help first.
  if (opts.editConfig) return editConfigCommand();
  if (opts.history) return historyCommand();
  if (opts.listSections) return listSectionsCommand();

  setRunMode(Boolean(opts.dryRun), Boolean(opts.yes));
  await runCleanup();
}
