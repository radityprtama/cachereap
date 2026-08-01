import { describe, it, expect } from "vitest";
import { humanSize, expandHome } from "../src/core/fsSize";

describe("humanSize", () => {
  it("matches du -h formatting", () => {
    expect(humanSize(0)).toBe("0");
    expect(humanSize(512)).toBe("0");
    expect(humanSize(4096)).toBe("4.0K");
    expect(humanSize(1048576)).toBe("1.0M");
    expect(humanSize(12345678)).toBe("12M");
    expect(humanSize(1073741824)).toBe("1.0G");
    expect(humanSize(10 * 1024 ** 3)).toBe("10G");
  });
});

describe("expandHome", () => {
  it("expands leading ~", () => {
    const home = process.env.HOME ?? "/home/x";
    expect(expandHome("~/projects")).toBe(`${home}/projects`);
    expect(expandHome("/abs/path")).toBe("/abs/path");
  });
});
