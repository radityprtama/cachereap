import { describe, it, expect, beforeEach, vi } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

// conf reads XDG_CONFIG_HOME at construction time (module singleton),
// so each test must re-import the module with a fresh temp XDG dir.
const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "bc-test-"));

async function loadConfig() {
  vi.resetModules();
  process.env.XDG_CONFIG_HOME = tempHome;
  return await import("../src/core/config");
}

describe("config defaults", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.XDG_CONFIG_HOME = tempHome;
  });

  it("has sane defaults", async () => {
    const { getConfig } = await loadConfig();
    const conf = getConfig();
    expect(conf.get("projectDir")).toBe("~/projects");
    expect(conf.get("staleDays")).toBe(30);
    expect(conf.get("skipSections")).toEqual([]);
    expect(conf.get("history")).toEqual([]);
  });

  it("persists edits", async () => {
    const { getConfig } = await loadConfig();
    const conf = getConfig();
    conf.set("staleDays", 7);
    conf.set("skipSections", ["docker", "kernel"]);
    expect(conf.get("staleDays")).toBe(7);
    expect(conf.get("skipSections")).toEqual(["docker", "kernel"]);
  });

  it("writes to ~/.config/cachereap/config.json (no -nodejs suffix)", async () => {
    const { getConfig } = await loadConfig();
    const conf = getConfig();
    expect(conf.path).toBe(path.join(tempHome, "cachereap", "config.json"));
  });
});
