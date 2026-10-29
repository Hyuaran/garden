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

describe("dependents change", () => {
 const payload = { count: "0", details: "dependents change", effectiveDate: "2026-10-29" };
 it.each([0, "0", 2, "2"]) ("accepts count %s", count => expect(validateSubmission("dependents", {...payload, count})).toBeNull());
 it.each([undefined, null, "", " ", -1, "-1", 1.5, "1.5", "abc", true, [], "1e2"]) ("rejects count %s", count => expect(validateSubmission("dependents", {...payload, count})).not.toBeNull());
 it.each(["count", "details", "effectiveDate"])("requires %s", key => expect(validateSubmission("dependents", {...payload, [key]: ""})).not.toBeNull());
 it.each(["2026-02-30", "invalid", "2026-13-01"]) ("rejects date %s", effectiveDate => expect(validateSubmission("dependents", {...payload, effectiveDate})).not.toBeNull());
});
