import { execa } from "execa";
import { ensureConfig, getConfig } from "../core/config";
import { cyan, dim, I_INFO } from "../core/logger";

export async function editConfigCommand(): Promise<void> {
  ensureConfig();
  const conf = getConfig();
  console.log(`  ${I_INFO} ${dim("Buka config:")} ${cyan(conf.path)}`);
  const editor = process.env.EDITOR || "nano";
  await execa(editor, [conf.path], { stdio: "inherit" });
}
