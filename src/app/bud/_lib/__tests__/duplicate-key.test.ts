import { describe, it, expect } from "vitest";
import { buildDuplicateKey } from "../duplicate-key";

describe("buildDuplicateKey", () => {
  it("全フィールド揃えば連結キーを返す", () => {
    const key = buildDuplicateKey({
      scheduled_date: "2026-04-25",
      payee_bank_code: "0179",
      payee_branch_code: "685",
      payee_account_number: "1207991",
      amount: 24980,
    });
    expect(key).toBe("20260425,0179,685,1207991,24980");
  });

  it("scheduled_date が null なら null を返す", () => {
    const key = buildDuplicateKey({
      scheduled_date: null,
      payee_bank_code: "0179",
      payee_branch_code: "685",
      payee_account_number: "1207991",
      amount: 24980,
    });
    expect(key).toBeNull();
  });

  it("いずれかのフィールドが空文字なら null を返す", () => {
    const key = buildDuplicateKey({
      scheduled_date: "2026-04-25",
      payee_bank_code: "",
      payee_branch_code: "685",
      payee_account_number: "1207991",
      amount: 24980,
    });
    expect(key).toBeNull();
  });

  it("金額が 0 でもキーは生成される（重複判定は一致性のみ）", () => {
    const key = buildDuplicateKey({
      scheduled_date: "2026-04-25",
      payee_bank_code: "0179",
      payee_branch_code: "685",
      payee_account_number: "1207991",
      amount: 0,
    });
    expect(key).toBe("20260425,0179,685,1207991,0");
  });

  it("日付の / を除去して YYYYMMDD 形式に", () => {
    const key = buildDuplicateKey({
      scheduled_date: "2026/04/25",
      payee_bank_code: "0179",
      payee_branch_code: "685",
      payee_account_number: "1207991",
      amount: 24980,
    });
    expect(key).toBe("20260425,0179,685,1207991,24980");
  });

  it("日付の - を除去して YYYYMMDD 形式に", () => {
    const key = buildDuplicateKey({
      scheduled_date: "2026-04-25",
      payee_bank_code: "0001",
      payee_branch_code: "100",
      payee_account_number: "1234567",
      amount: 100,
    });
    expect(key).toBe("20260425,0001,100,1234567,100");
  });
});
