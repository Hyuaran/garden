import { describe, expect, it } from "vitest";
import { validateSubmission } from "./submission-types";
describe("mypage submission validation", () => {
  const emergency = {
    kind: "new",
    selfAddress: "東京都",
    selfPhone: "090",
    ecName: "家族A",
    ecRelationship: "母",
    ecAddress: "同上",
    ecPhone: "080",
  };
  it.each([
    ["emergency_contact", emergency],
    ["commute_route", { station: "東京駅", effectiveDate: "2026-09-01" }],
    [
      "bank_account",
      {
        bankName: "銀行",
        bankCode: "1234",
        branchName: "支店",
        branchCode: "123",
        accountNumber: "1234567",
        holderKana: "ヤマダ",
      },
    ],
    ["resignation", { desiredDate: "2026-10-01" }],
    ["nda", { kind: "new", pledgeDate: "2026-08-27", address: "東京都", signature: "山田", agreed: true }],
  ])("accepts %s", (type, payload) =>
    expect(validateSubmission(type as never, payload)).toBeNull(),
  );
  it("requires both addresses for emergency contacts", () => {
    expect(
      validateSubmission("emergency_contact", {
        ...emergency,
        selfAddress: "",
      }),
    ).toMatch(/必須/);
    expect(
      validateSubmission("emergency_contact", { ...emergency, ecAddress: "" }),
    ).toMatch(/必須/);
  });
  it("does not ask employees for commute amounts", () => {
    expect(
      validateSubmission("commute_route", {
        station: "東京駅",
        effectiveDate: "2026-09-01",
      }),
    ).toBeNull();
  });
  it("validates bank digits and nda agreement", () => {
    expect(
      validateSubmission("bank_account", {
        bankName: "銀行",
        bankCode: "12",
        branchName: "支店",
        branchCode: "1",
        accountNumber: "x",
        holderKana: "A",
      }),
    ).toMatch(/桁数/);
    expect(
      validateSubmission("nda", { kind: "new", pledgeDate: "2026-08-27", address: "東京都", signature: "山田", agreed: false }),
    ).toMatch(/同意/);
    expect(validateSubmission("nda", { kind: "other", pledgeDate: "2026-08-27", address: "東京都", signature: "山田", agreed: true })).toMatch(/区分/);
    for (const key of ["kind", "pledgeDate", "address", "signature"]) {
      expect(validateSubmission("nda", { kind: "new", pledgeDate: "2026-08-27", address: "東京都", signature: "山田", agreed: true, [key]: "" })).toMatch(/必須/);
    }
  });
});
