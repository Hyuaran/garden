import { describe, expect, it } from "vitest";
import { createLinkCode, parseOneTimeLink } from "./link-code";
import { isOnboardingLoginTarget } from "@/app/system/onboarding/_lib/onboarding-login";
describe("使い切り番号", () => {
  it("紛らわしい文字を含まない4文字を作る", () => {
    for (let i = 0; i < 1000; i++) expect(createLinkCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });
  it.each(["連携 1571-4K7P", "連携　１５７１－４Ｋ７Ｐ", " 連携 1571 - 4k7p "])("全角と空白ゆれ: %s", text => {
    expect(parseOneTimeLink(text)).toEqual({ employeeNumber: "1571", code: "4K7P" });
  });
  it("従来の番号だけの文は従来処理へ渡す", () => expect(parseOneTimeLink("連携 1571")).toBeNull());
});
describe("ログイン時の入社案内", () => {
  it.each(["toss", "closer"])("%sは入社日で分ける", garden_role => {
    expect(isOnboardingLoginTarget({ garden_role, hire_date: "2026-10-24" })).toBe(false);
    expect(isOnboardingLoginTarget({ garden_role, hire_date: "2026-10-25" })).toBe(true);
    expect(isOnboardingLoginTarget({ garden_role, hire_date: null })).toBe(false);
  });
  it("外注を除き、社員はこれまで通り", () => {
    expect(isOnboardingLoginTarget({ garden_role: "outsource", hire_date: "2026-10-25" })).toBe(false);
    expect(isOnboardingLoginTarget({ garden_role: "staff", hire_date: "2020-01-01" })).toBe(true);
  });
});
