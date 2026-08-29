import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/system/mypage/tabs/ProfileTab.tsx"), "utf8");

describe("ProfileTab icons", () => {
  it("uses inline line-art SVGs instead of emoji", () => {
    expect(source).not.toMatch(/[🔒📞🚃🏦📄]/u);
    expect(source).toContain('viewBox="0 0 24 24"');
    expect(source).toContain('fill="none"');
    expect(source).toContain('stroke="currentColor"');
    expect(source).toContain('aria-hidden="true"');
  });

  it("keeps all five submission actions", () => {
    for (const label of ["緊急連絡先変更", "通勤経路変更", "給与受取口座の変更", "退職届", "秘密保持誓約書"])
      expect(source).toContain(label);
  });
});
