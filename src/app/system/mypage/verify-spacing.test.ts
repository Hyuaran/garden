import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/system/mypage/mypage.module.css"), "utf8");

describe("mypage verification card spacing", () => {
  it("keeps deliberate vertical space between every verification element", () => {
    expect(css).toMatch(/\.unlockPanel\s*\{\s*padding:40px 36px/);
    expect(css).toMatch(/\.lockIcon\s*\{[^}]*margin:0 auto 20px/);
    expect(css).toMatch(/\.unlockPanel > p\s*\{\s*margin:0 0 18px/);
    expect(css).toMatch(/\.unlockPanel > button\s*\{\s*margin-top:20px/);
  });

  it("does not change the verification card width", () => {
    expect(css).toMatch(/\.unlockPanel, \.comingSoon\s*\{\s*max-width:520px/);
  });
});
