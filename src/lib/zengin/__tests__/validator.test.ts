import { describe, it, expect } from "vitest";
import { validateTransfer, validateSourceAccount } from "../validator";
import type { ZenginTransferInput, ZenginSourceAccount } from "../types";

function makeValid(): ZenginTransferInput {
  return {
    payee_bank_code: "0001",
    payee_branch_code: "100",
    payee_account_type: "1",
    payee_account_number: "1234567",
    payee_account_holder_kana: "ヤマダ タロウ",
    amount: 10000,
  };
}

describe("validateTransfer", () => {
  it("正常なデータなら valid=true", () => {
    const result = validateTransfer(makeValid());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("銀行コードが4桁数字以外ならエラー", () => {
    const t = { ...makeValid(), payee_bank_code: "ABC" };
    const result = validateTransfer(t);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("銀行コード"))).toBe(true);
  });

  it("銀行コードが3桁ならエラー", () => {
    const t = { ...makeValid(), payee_bank_code: "123" };
    const result = validateTransfer(t);
    expect(result.valid).toBe(false);
  });

  it("支店コードが3桁数字以外ならエラー", () => {
    const t = { ...makeValid(), payee_branch_code: "12A" };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("口座番号が7桁超ならエラー", () => {
    const t = { ...makeValid(), payee_account_number: "12345678" };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("口座番号が空ならエラー", () => {
    const t = { ...makeValid(), payee_account_number: "" };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("口座番号が7桁未満でも valid（自動 0 埋めされる前提）", () => {
    const t = { ...makeValid(), payee_account_number: "123" };
    expect(validateTransfer(t).valid).toBe(true);
  });

  it("金額が 0 以下ならエラー", () => {
    const t = { ...makeValid(), amount: 0 };
    expect(validateTransfer(t).valid).toBe(false);
    const t2 = { ...makeValid(), amount: -100 };
    expect(validateTransfer(t2).valid).toBe(false);
  });

  it("金額が 10桁超（9,999,999,999 円超）ならエラー", () => {
    const t = { ...makeValid(), amount: 10_000_000_000 };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("金額が小数ならエラー", () => {
    const t = { ...makeValid(), amount: 100.5 };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("受取人名カナが空ならエラー", () => {
    const t = { ...makeValid(), payee_account_holder_kana: "" };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("受取人名カナが半角 30 桁超ならエラー", () => {
    const t = {
      ...makeValid(),
      payee_account_holder_kana: "ｱ".repeat(31),
    };
    expect(validateTransfer(t).valid).toBe(false);
  });

  it("受取人名カナに漢字が含まれる場合、警告のみ（半角変換後に削除される）", () => {
    const t = { ...makeValid(), payee_account_holder_kana: "山田タロウ" };
    const result = validateTransfer(t);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("預金種目が 1/2/4 以外はエラー（型レベルで弾かれるが念のため）", () => {
    const t = { ...makeValid(), payee_account_type: "9" as "1" };
    expect(validateTransfer(t).valid).toBe(false);
  });
});

describe("validateSourceAccount", () => {
  function makeValidSource(): ZenginSourceAccount {
    return {
      consignor_code: "0000001234",
      consignor_name: "ｶ)ﾋｭｱﾗﾝ",
      transfer_date: "0425",
      source_bank_code: "0036",
      source_bank_name: "ﾗｸﾃﾝ",
      source_branch_code: "251",
      source_branch_name: "ﾀﾞｲｲﾁ",
      source_account_type: "1",
      source_account_number: "7853952",
    };
  }

  it("正常なデータなら valid=true", () => {
    expect(validateSourceAccount(makeValidSource()).valid).toBe(true);
  });

  it("consignor_name に全角文字が含まれる場合エラー", () => {
    const s = { ...makeValidSource(), consignor_name: "株式会社ヒュアラン" };
    expect(validateSourceAccount(s).valid).toBe(false);
  });

  it("source_bank_code が 4 桁でなければエラー", () => {
    const s = { ...makeValidSource(), source_bank_code: "123" };
    expect(validateSourceAccount(s).valid).toBe(false);
  });

  it("transfer_date が 4 桁でなければエラー", () => {
    const s = { ...makeValidSource(), transfer_date: "425" };
    expect(validateSourceAccount(s).valid).toBe(false);
  });
});
