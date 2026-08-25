import { describe, expect, it } from "vitest";
import { createValidSalesMasterRecord, DEFERRED_ADDRESS_RULE_IDS, evaluateGardenCheck, NTT_EAST_PREFECTURES, NTT_WEST_PREFECTURES, nttArea } from "./zenkaku-check";
import type { GardenCheckRuleId, SalesMasterRecord } from "./zenkaku-check";

const checkedAt = new Date(2026, 7, 22);
const evaluate = (overrides: Partial<SalesMasterRecord> = {}) => evaluateGardenCheck(createValidSalesMasterRecord(overrides), [], checkedAt);
const hasRule = (overrides: Partial<SalesMasterRecord>, ruleId: GardenCheckRuleId) => evaluate(overrides).blocking.some((issue) => issue.ruleId === ruleId);

describe("Garden check rules", () => {
  it("R1 blocks a value other than acquired and passes acquired", () => {
    expect(hasRule({ flag: "見込" }, "R1")).toBe(true); expect(hasRule({ flag: "獲得" }, "R1")).toBe(false);
  });
  it("R3 requires both mobile details only when a mobile number is present", () => {
    const result = evaluate({ mobileNumber: "09012345678", mobileCarrier: null, mobileDeviceType: null });
    expect(result.blocking.find((issue) => issue.ruleId === "R3")?.missingFields).toEqual(["携帯キャリア営業用", "携帯端末タイプ"]);
    expect(hasRule({ mobileNumber: null, mobileCarrier: null, mobileDeviceType: null }, "R3")).toBe(false);
    expect(hasRule({ mobileNumber: "09012345678", mobileCarrier: "au", mobileDeviceType: "iPhone" }, "R3")).toBe(false);
  });
  it("R4 lists all and only the three missing line fields", () => {
    const result = evaluate({ productCategory1: "回線", applicationPlanName: null, applicationIsp: " ", constructionType: null });
    expect(result.blocking.find((issue) => issue.ruleId === "R4")?.missingFields).toEqual(["申込プラン名", "工事種別", "申込ISP"]);
    expect(hasRule({ productCategory1: "回線以外", applicationPlanName: null }, "R4")).toBe(false);
    expect(hasRule({ productCategory1: "回線" }, "R4")).toBe(false);
  });
  it("R5 uses the check date for the exact 65-year boundary and requires all nine fields", () => {
    const missing = { thirdPartyLastNameKana: null, thirdPartyFirstNameKana: null, thirdPartyLastName: null, thirdPartyFirstName: null, thirdPartyBirthday: null, thirdPartyAge: null, thirdPartyGender: null, thirdPartyRelationship: null, thirdPartyTalkedAt: null };
    expect(evaluate({ applicantBirthday: "1961-08-22", ...missing }).blocking.find((issue) => issue.ruleId === "R5")?.missingFields).toHaveLength(9);
    expect(hasRule({ applicantBirthday: "1961-08-23", ...missing }, "R5")).toBe(false);
    expect(hasRule({ applicantBirthday: "1960-08-22", ...missing }, "R5")).toBe(true);
    expect(hasRule({ applicantBirthday: "1961-08-22" }, "R5")).toBe(false);
  });
  it("R6 requires a transfer approval number for either transfer type", () => {
    expect(hasRule({ constructionType: "転用　他社転用", transferApprovalNumber: null }, "R6")).toBe(true);
    expect(hasRule({ constructionType: "転用 自社転用", transferApprovalNumber: "W123" }, "R6")).toBe(false);
    expect(hasRule({ constructionType: "新規", transferApprovalNumber: null }, "R6")).toBe(false);
  });
  it("R7 requires the displayed provider number only for provider change", () => {
    expect(hasRule({ constructionType: "事業者間変更", providerChangeApprovalNumber: null }, "R7")).toBe(true);
    expect(hasRule({ constructionType: "事業者間変更", providerChangeApprovalNumber: "T123" }, "R7")).toBe(false);
    expect(hasRule({ constructionType: "新規", providerChangeApprovalNumber: null }, "R7")).toBe(false);
  });
  it("R8 requires CAF only for BIGLOBE light in the NTT west area", () => {
    expect(hasRule({ productCategory2: "BIGLOBE光", installationPrefecture: "大阪府", cafNumber: null }, "R8")).toBe(true);
    expect(hasRule({ productCategory2: "BIGLOBE光", installationPrefecture: "東京都", cafNumber: null }, "R8")).toBe(false);
    expect(hasRule({ productCategory2: "他商材", installationPrefecture: "大阪府", cafNumber: null }, "R8")).toBe(false);
    expect(hasRule({ productCategory2: "BIGLOBE光", installationPrefecture: "大阪府", cafNumber: "CAF123" }, "R8")).toBe(false);
  });
  it("maps all 47 prefectures to exactly one NTT area", () => {
    const all = [...NTT_EAST_PREFECTURES, ...NTT_WEST_PREFECTURES];
    expect(all).toHaveLength(47); expect(new Set(all).size).toBe(47);
    expect(all.every((prefecture) => nttArea(prefecture) !== null)).toBe(true);
    expect(nttArea("新潟県")).toBe("east"); expect(nttArea("静岡県")).toBe("west");
  });
  it("R9 always requires the installation postal code", () => {
    expect(hasRule({ installationPostalCode: null }, "R9")).toBe(true); expect(hasRule({ installationPostalCode: "100-0001" }, "R9")).toBe(false);
  });
  it("R10 returns a non-blocking warning with the duplicate case details", () => {
    const record = createValidSalesMasterRecord();
    const duplicate = { caseId: "L26000123", productName: "BIGLOBE光", registeredDate: "2026-07-18" };
    const result = evaluateGardenCheck(record, [duplicate], checkedAt);
    expect(result.blocking).toHaveLength(0); expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain("案件ID L26000123 ／ BIGLOBE光 ／ 2026-07-18");
    expect(evaluateGardenCheck(record, [], checkedAt).warnings).toHaveLength(0);
  });
  it("keeps only R2-5 deferred without producing a finding when postal data is unavailable", () => {
    const result = evaluate();
    expect(DEFERRED_ADDRESS_RULE_IDS).toEqual(["R2-5"]);
    expect(result.deferredRuleIds).toEqual(DEFERRED_ADDRESS_RULE_IDS); expect(result.notices).toHaveLength(0);
  });
  it("R2-1 to R2-3 accept normalized addresses and any matching duplicate candidate", () => {
    const context = { enabled: true, byPostalCode: { "1000001": [
      { prefecture: "東京都", city: "千代田区", town: "丸の内", cityKana: "チヨダク", townKana: "マルノウチ", special: false },
      { prefecture: "東京都", city: "千代田区", town: "千代田", cityKana: "チヨダク", townKana: "チヨダ", special: false },
    ] } };
    const record = createValidSalesMasterRecord({ installationPostalCode: "１００－０００１", installationPrefecture: " 東京都 ", installationCity: "千代田区", installationTown: "千 代田", installationCityKana: "チヨダク", installationTownKana: "チヨダ" });
    expect(evaluateGardenCheck(record, [], checkedAt, context).notices).toHaveLength(0);
  });
  it("R2 address mismatches and unknown postal codes are non-blocking notices", () => {
    const candidate = { prefecture: "東京都", city: "千代田区", town: "千代田", cityKana: "チヨダク", townKana: "チヨダ", special: false };
    const mismatch = evaluateGardenCheck(createValidSalesMasterRecord({ installationCity: "新宿区", installationTown: "西新宿", installationCityKana: "シンジュクク", installationTownKana: "ニシシンジュク" }), [], checkedAt, { enabled: true, byPostalCode: { "1000001": [candidate] } });
    expect(mismatch.notices.map((issue) => issue.ruleId)).toEqual(["R2-1", "R2-2", "R2-3"]); expect(mismatch.blocking).toHaveLength(0);
    expect(evaluateGardenCheck(createValidSalesMasterRecord(), [], checkedAt, { enabled: true, byPostalCode: {} }).notices[0]).toMatchObject({ ruleId: "R2-4", message: "この郵便番号が見つかりません。ご確認ください。" });
  });
  it("skips special rows and an empty shipping address", () => {
    const special = { prefecture: "北海道", city: "札幌市", town: "以下に掲載がない場合", cityKana: "サッポロシ", townKana: "イカニケイサイガナイバアイ", special: true };
    const result = evaluateGardenCheck(createValidSalesMasterRecord({ shippingPostalCode: null }), [], checkedAt, { enabled: true, byPostalCode: { "1000001": [special] } });
    expect(result.notices).toHaveLength(0);
  });
  it("R2-2 compares the town before a parenthesized range", () => {
    const candidate = { prefecture: "北海道", city: "札幌市中央区", town: "大通西（１〜１９丁目）", cityKana: "サッポロシチュウオウク", townKana: "オオドオリニシ（１−１９チョウメ）", special: false };
    const context = { enabled: true, byPostalCode: { "0600042": [candidate] } };
    const record = createValidSalesMasterRecord({ installationPostalCode: "060-0042", installationPrefecture: "北海道", installationCity: "札幌市中央区", installationCityKana: "サッポロシチュウオウク", installationTownKana: "オオドオリニシ" });
    for (const installationTown of ["大通西１丁目", "大通西"]) {
      expect(evaluateGardenCheck({ ...record, installationTown }, [], checkedAt, context).notices.some((issue) => issue.ruleId === "R2-2")).toBe(false);
    }
    expect(evaluateGardenCheck({ ...record, installationTown: "別の町" }, [], checkedAt, context).notices.some((issue) => issue.ruleId === "R2-2")).toBe(true);
  });
  it("R2-3 compares town kana before a parenthesized range", () => {
    const candidate = { prefecture: "北海道", city: "札幌市中央区", town: "大通西（１〜１９丁目）", cityKana: "サッポロシチュウオウク", townKana: "オオドオリニシ（１−１９チョウメ）", special: false };
    const record = createValidSalesMasterRecord({ installationPostalCode: "0600042", installationPrefecture: "北海道", installationCity: "札幌市中央区", installationTown: "大通西", installationCityKana: "サッポロシチュウオウク", installationTownKana: "オオドオリニシ" });
    expect(evaluateGardenCheck(record, [], checkedAt, { enabled: true, byPostalCode: { "0600042": [candidate] } }).notices.some((issue) => issue.ruleId === "R2-3")).toBe(false);
  });
  it("never exposes FileMaker field names in findings", () => {
    const result = evaluateGardenCheck(createValidSalesMasterRecord({ flag: "見込", mobileNumber: "090", mobileCarrier: null, mobileDeviceType: null, productCategory1: "回線", applicationPlanName: null, installationPostalCode: null }), [], checkedAt);
    expect(JSON.stringify(result)).not.toMatch(/P_/);
  });
});
