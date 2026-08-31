// @vitest-environment node
import { describe, expect, it } from "vitest";
import { COURT_LOCATIONS } from "./contract-court-locations";
import { rewriteTemplateCourtNames } from "./contract-template-courts";
import { sanitizeContractText } from "./contract-template.server";

describe("template court geography", () => {
  it.each([
    ["名古屋地方裁判所又は名古屋簡易裁判所", "大阪地方裁判所又は大阪簡易裁判所"],
    ["東京地方裁判所", "大阪地方裁判所"],
    ["大阪地方裁判所", "大阪地方裁判所"],
    ["東京地方裁判所立川支部", "大阪地方裁判所"],
    ["福岡家庭裁判所久留米支部", "大阪家庭裁判所"],
    ["名古屋高等裁判所金沢支部", "大阪高等裁判所"],
    ["大阪地方裁判所堺支部", "大阪地方裁判所"],
    ["福島地方裁判所いわき支部又は東京簡易裁判所", "大阪地方裁判所又は大阪簡易裁判所"],
    ["名古屋地方裁判所又は名古\n屋簡易裁判所", "大阪地方裁判所又は大阪簡易裁判所"],
    ["東 京 地 方 裁 判 所 立 川 支 部", "大阪地方裁判所"],
    ["さいたま家庭裁判所", "大阪家庭裁判所"],
    ["大津地方裁判所及び津地方裁判所", "大阪地方裁判所及び大阪地方裁判所"],
    ["仙台大阪地方裁判所または仙台大阪簡易裁判所", "大阪地方裁判所または大阪簡易裁判所"],
    ["甲及び乙は東京地方裁判所を専属的合意管轄裁判所とする。", "甲及び乙は大阪地方裁判所を専属的合意管轄裁判所とする。"],
    ["合意管轄東京地方裁判所", "合意管轄大阪地方裁判所"],
    ["当社東京地方裁判所担当者", "当社大阪地方裁判所担当者"],
    ["東京地方裁判所又は乙の支部所在地を管轄する簡易裁判所", "大阪地方裁判所又は乙の支部所在地を管轄する簡易裁判所"],
    ["東京地方裁判所\n支部を設置する。", "大阪地方裁判所\n支部を設置する。"],
  ])("rewrites only court geography: %s", (source, expected) => {
    expect(rewriteTemplateCourtNames(source)).toBe(expected);
    expect(rewriteTemplateCourtNames(expected)).toBe(expected);
  });

  it.each([
    "名古屋市瑞穂区、大阪市、東京で営業する。", "大阪府大阪市の大阪地方裁判所",
    "地方裁判所又は簡易裁判所を管轄裁判所とする。", "第一審の専属的合意管轄裁判所",
    "知的財産高等裁判所", "最高裁判所", "甲乙双方の代表者が記名捺印した書面",
  ])("preserves non-geographic court terms and other prose: %s", (text) => {
    expect(rewriteTemplateCourtNames(text)).toBe(text);
  });

  it("covers every listed court location, including non-prefectural summary courts", () => {
    expect(new Set(COURT_LOCATIONS).size).toBe(440);
    for (const place of COURT_LOCATIONS) for (const type of ["地方", "簡易", "家庭", "高等"]) {
      expect(rewriteTemplateCourtNames(`${place}${type}裁判所`)).toBe(`大阪${type}裁判所`);
    }
  });

  it("rewrites after physical lines are merged without changing existing address masking", () => {
    const result = sanitizeContractText("第16条（合意管轄裁判所）\n名古屋地方裁判所又は名古\n屋簡易裁判所を第一審の専属的合意管轄裁判所とする。\n甲：名古屋市瑞穂区雁道町1-16\nアメニティ雁道", { excludedTerms: [] });
    expect(result.paragraphs).toEqual(["第16条（合意管轄裁判所）", "大阪地方裁判所又は大阪簡易裁判所を第一審の専属的合意管轄裁判所とする。", "甲：＿＿＿＿"]);
  });

  it("also rewrites court geography in a title", () => {
    expect(sanitizeContractText("本文", { title: "東京地方裁判所 関連契約書", excludedTerms: [] }).title)
      .toBe("大阪地方裁判所 関連契約書");
  });
});
