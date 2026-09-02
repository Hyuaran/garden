import { describe, expect, it } from "vitest";
import { bankSearchTerms, branchSearchTerms, normalizeBankSearchTerm, normalizeBranchSearchTerm } from "./bank-search";

describe("銀行・支店の検索語", () => {
  it.each([
    ["みずほ銀行", "みずほ"],
    ["三菱UFJ銀行", "三菱ＵＦＪ"],
    ["ゆうちょ銀行", "ゆうちょ"],
    ["大阪信用金庫", "大阪信金"],
    ["近畿産業信用組合", "近畿産業信組"],
    ["住信SBIネット銀行", "ドコモＳＭＴＢネット"],
    ["三菱UFJ信託銀行", "三菱ＵＦＪ信託"],
  ])("%s を台帳の銀行名に合わせる", (input, expected) => {
    expect(bankSearchTerms(input).at(-1)).toBe(expected);
  });

  it("銀行名は前後の空白を落とし、信託・信金などは落とさない", () => {
    expect(normalizeBankSearchTerm("　大阪信用金庫　")).toBe("大阪信金");
    expect(normalizeBankSearchTerm("三菱UFJ信託銀行")).toBe("三菱UFJ信託");
  });

  it.each([
    ["渋谷支店", "渋谷"],
    ["本店", "本店"],
  ])("%s を台帳の支店名に合わせる", (input, expected) => {
    expect(normalizeBranchSearchTerm(input)).toBe(expected);
  });

  it("支店名はそのまま、末尾除去、英数字全角化の順で候補を作る", () => {
    expect(branchSearchTerms(" A1支店 ")).toEqual(["A1支店", "A1", "Ａ１"]);
  });

  it("絞り込みの区切りに使われる記号は落とす", () => {
    expect(normalizeBankSearchTerm("みずほ,三井銀行")).toBe("みずほ三井");
    expect(normalizeBankSearchTerm("（株）みずほ銀行")).toBe("株みずほ");
    expect(normalizeBranchSearchTerm("渋谷（本）支店")).toBe("渋谷本");
  });
});
