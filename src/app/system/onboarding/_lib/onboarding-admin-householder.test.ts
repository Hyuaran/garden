import { describe, expect, it } from "vitest";
import { parseAdminHouseholderInput } from "./onboarding-admin";

describe("事務用の世帯主保存入力", () => {
  it("送られた項目だけを読み取り、氏名の空欄と既存の続柄を許可する", () => {
    expect(parseAdminHouseholderInput({ householderName: " 吉田 陽菜 ", name: "変えない" })).toEqual({ householderName: "吉田 陽菜" });
    expect(parseAdminHouseholderInput({ householderRelation: "本人", address: "変えない" })).toEqual({ householderRelation: "本人" });
    expect(parseAdminHouseholderInput({ householderName: "", householderRelation: "" })).toEqual({ householderName: "", householderRelation: "" });
    expect(() => parseAdminHouseholderInput({ householderRelation: "未登録の続柄" })).toThrow();
    expect(() => parseAdminHouseholderInput({ householderName: "a".repeat(2001) })).toThrow();
    expect(() => parseAdminHouseholderInput({ email: "hy@example.jp" })).toThrow();
  });
});
