import { describe, expect, it } from "vitest";

import { buildTossRecord, resolveSubmissionPartnerCode, validateTossInput, type TossFormInput } from "../form";

const input: TossFormInput = {
  useTossCb: "利用しない", tossCbAmount: "0", tossUpItems: ["電気"],
  comment: "確認用", rank: "A", preferredTimes: ["午前"], listCategory: "リスト内",
  pdManagementNumber: "PD-001", pd: "PD-001", applicantType: "本人", applicantLastName: "庭",
  applicantFirstName: "太郎", applicantLastKana: "ニワ", applicantFirstKana: "タロウ", birthDate: "1990-01-01",
  addressType: "現住所", postalCode: "1000001", prefecture: "東京都", city: "千代田区", town: "千代田1",
  building: "", room: "", contactType: "本人", contactPhone: "09000000000", smartphoneCarrier: "その他",
};

describe("toss form mapping", () => {
  it("always maps the authenticated partner code", () => {
    const record = buildTossRecord(input, "PARTNER-01");
    expect(record.ルックアップ.value).toBe("PARTNER-01");
    expect(record.ルックアップ_0.value).toBe("PD-001");
    expect(record.チェックボックス.value).toEqual(["電気"]);
    expect(record.LINK.value).toBe("");
    expect(record.文字列__1行__37.value).toBe("");
  });

  it("maps the trusted staff account name as the toss person name", () => {
    const record = buildTossRecord(input, "1010003", "萩尾 拓也");
    expect(record.ルックアップ.value).toBe("1010003");
    expect(record.文字列__1行__37.value).toBe("萩尾 拓也");
  });

  it("rejects invalid postal codes", () => {
    expect(() => validateTossInput({ ...input, postalCode: "123" })).toThrow("7桁");
  });

  it("requires a PD number only for records inside the Kanden list", () => {
    expect(() => validateTossInput({ ...input, pdManagementNumber: "", pd: "" })).toThrow("pdManagementNumber");
    expect(validateTossInput({ ...input, listCategory: "リスト外", pdManagementNumber: "", pd: "" }).pdManagementNumber).toBe("");
  });

  it("partner uses the session code and ignores request code", () => {
    expect(resolveSubmissionPartnerCode("partner", "SESSION-01", "REQUEST-99")).toBe("SESSION-01");
  });

  it("staff must provide a partner code", () => {
    expect(resolveSubmissionPartnerCode("staff", "1010003", "9999999")).toBe("1010003");
    expect(resolveSubmissionPartnerCode("staff", undefined, " 7654321 ")).toBe("7654321");
    expect(() => resolveSubmissionPartnerCode("staff", undefined, "")).toThrow("パートナーコード");
  });
});
