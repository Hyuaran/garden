import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/system/mypage/mypage.module.css"), "utf8");

describe("mypage profile gate styling", () => {
  it("visually masks the non-password four-digit input in Chrome and Edge", () => {
    expect(css).toMatch(/\.unlockPanel \.unlockCode\s*\{[^}]*-webkit-text-security:disc/);
    expect(css).toMatch(/\.unlockPanel \.unlockCode::placeholder\s*\{[^}]*-webkit-text-security:none/);
  });
});
