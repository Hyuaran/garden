import { describe, it, expect } from "vitest";
import { validateRegularForm, validateCashbackForm } from "../transfer-form-schema";

function makeRegularInput() {
  return {
    request_company_id: "COMP-001",
    execute_company_id: "COMP-001",
    source_account_id: "ACC-001",
    payee_name: "株式会社山田",
    payee_bank_code: "0001",
    payee_branch_code: "100",
    payee_account_type: "1",
    payee_account_number: "1234567",
    payee_account_holder_kana: "ヤマダ タロウ",
    amount: 10000,
    scheduled_date: "2026-04-25",
  };
}

describe("validateRegularForm", () => {
  it("正常なデータなら valid", () => {
    const r = validateRegularForm(makeRegularInput());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual({});
  });

  it("payee_name が空ならエラー", () => {
    const r = validateRegularForm({ ...makeRegularInput(), payee_name: "" });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("payee_name");
  });

  it("amount が 0 以下ならエラー", () => {
    const r = validateRegularForm({ ...makeRegularInput(), amount: 0 });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("amount");
  });

  it("銀行コード 4 桁未満はエラー", () => {
    const r = validateRegularForm({ ...makeRegularInput(), payee_bank_code: "123" });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("payee_bank_code");
  });

  it("口座番号が 8 桁超はエラー", () => {
    const r = validateRegularForm({ ...makeRegularInput(), payee_account_number: "12345678" });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("payee_account_number");
  });

  it("支払期日未指定はエラー", () => {
    const r = validateRegularForm({ ...makeRegularInput(), scheduled_date: "" });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("scheduled_date");
  });
});

describe("validateCashbackForm", () => {
  function makeCashbackInput() {
    return {
      ...makeRegularInput(),
      cashback_applicant_name: "山田太郎",
      cashback_applicant_name_kana: "ヤマダ タロウ",
      cashback_product_name: "au光sonnet",
      cashback_channel_name: "DPリンク",
    };
  }

  it("正常なデータなら valid", () => {
    expect(validateCashbackForm(makeCashbackInput()).valid).toBe(true);
  });

  it("申込者名が空ならエラー", () => {
    const r = validateCashbackForm({
      ...makeCashbackInput(),
      cashback_applicant_name: "",
    });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveProperty("cashback_applicant_name");
  });

  it("商材名が空ならエラー", () => {
    const r = validateCashbackForm({
      ...makeCashbackInput(),
      cashback_product_name: "",
    });
    expect(r.valid).toBe(false);
  });
});
