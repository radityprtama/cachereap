import { banner } from "../core/logger";
import { cleaners } from "../cleaners";

export function listSectionsCommand(): void {
  banner("DAFTAR SECTION", "Pakai key ini di SKIP_SECTIONS pada config.conf");
  console.log();
  for (const c of cleaners) {
    console.log(`  ${c.key.padEnd(13)} - ${c.title}`);
  }
  console.log();
}
