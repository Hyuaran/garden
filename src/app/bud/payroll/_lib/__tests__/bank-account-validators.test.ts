/**
 * D-09 口座情報バリデーター 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-09-bank-accounts.md
 *
 * 網羅項目:
 *   - bank_code / branch_code / account_number 各 4/3/1-8 桁
 *   - account_type enum
 *   - account_holder_kana 半角カナ
 *   - applies_month 月初日 + NULL OK
 *   - recipient_type と employee_id の整合性
 *   - effective_from / effective_to 順序
 *   - 複合 validateEmployeeBankAccount / validatePaymentRecipient
 */

import { describe, it, expect } from "vitest";
import {
  validateBankCode,
  validateBranchCode,
  validateAccountNumber,
  validateAccountType,
  validateAccountHolderKana,
  validateRecipientType,
  validateAppliesMonth,
  validateRecipientTypeAndEmployeeId,
  validateEffectiveDates,
  validateEmployeeBankAccount,
  validatePaymentRecipient,
} from "../bank-account-validators";

// ============================================================
// bank_code (4 桁数字)
// ============================================================

describe("validateBankCode", () => {
  it.each([["0001"], ["1234"], ["9999"]])(
    "正常系: %s",
    (v) => {
      expect(validateBankCode(v).ok).toBe(true);
    },
  );

  it.each([
    ["", "空文字"],
    ["123", "3 桁"],
    ["12345", "5 桁"],
    ["abcd", "英字"],
    ["１２３４", "全角数字"],
    ["12 4", "スペース混入"],
  ])("異常系: %s (%s)", (v) => {
    expect(validateBankCode(v).ok).toBe(false);
  });
});

// ============================================================
// branch_code (3 桁数字)
// ============================================================

describe("validateBranchCode", () => {
  it.each([["001"], ["123"], ["999"]])("正常系: %s", (v) => {
    expect(validateBranchCode(v).ok).toBe(true);
  });

  it.each([
    [""],
    ["12"],
    ["1234"],
    ["abc"],
  ])("異常系: %s", (v) => {
    expect(validateBranchCode(v).ok).toBe(false);
  });
});

// ============================================================
// account_number (1-8 桁数字)
// ============================================================

describe("validateAccountNumber", () => {
  it.each([["1"], ["1234567"], ["12345678"]])("正常系: %s", (v) => {
    expect(validateAccountNumber(v).ok).toBe(true);
  });

  it.each([
    [""],
    ["123456789"], // 9 桁
    ["abc"],
    ["12-34"],
  ])("異常系: %s", (v) => {
    expect(validateAccountNumber(v).ok).toBe(false);
  });
});

// ============================================================
// account_type (enum)
// ============================================================

describe("validateAccountType", () => {
  it.each([["普通"], ["当座"], ["貯蓄"]])("正常系: %s", (v) => {
    expect(validateAccountType(v).ok).toBe(true);
  });

  it.each([[""], ["普通預金"], ["普通 "], ["futsuu"]])(
    "異常系: %s",
    (v) => {
      expect(validateAccountType(v).ok).toBe(false);
    },
  );
});

// ============================================================
// account_holder_kana (半角カナ)
// ============================================================

describe("validateAccountHolderKana", () => {
  it.each([
    ["ﾔﾏﾀﾞ ﾀﾛｳ"],
    ["ｶﾌﾞｼｷｶﾞｲｼｬ ﾋｭｱﾗﾝ"],
    ["ABC123"],
    ["ｱｲｳｴｵ"],
    ["ﾀ-ﾅｶ"],
  ])("正常系: %s", (v) => {
    expect(validateAccountHolderKana(v).ok).toBe(true);
  });

  it.each([
    ["", "空文字"],
    ["山田太郎", "漢字"],
    ["ヤマダ タロウ", "全角カナ"],
    ["やまだ", "ひらがな"],
    ["abc", "小文字英"],
  ])("異常系: %s (%s)", (v) => {
    expect(validateAccountHolderKana(v).ok).toBe(false);
  });
});

// ============================================================
// recipient_type
// ============================================================

describe("validateRecipientType", () => {
  it.each([
    ["external_company"],
    ["individual_special"],
    ["employee_special"],
  ])("正常系: %s", (v) => {
    expect(validateRecipientType(v).ok).toBe(true);
  });

  it.each([[""], ["company"], ["external_individual"]])(
    "異常系: %s",
    (v) => {
      expect(validateRecipientType(v).ok).toBe(false);
    },
  );
});

// ============================================================
// applies_month (YYYY-MM-01)
// ============================================================

describe("validateAppliesMonth", () => {
  it("null は OK（通年継続支払）", () => {
    expect(validateAppliesMonth(null).ok).toBe(true);
    expect(validateAppliesMonth(undefined).ok).toBe(true);
  });

  it.each([["2026-01-01"], ["2026-05-01"], ["2026-12-01"]])(
    "正常系: %s",
    (v) => {
      expect(validateAppliesMonth(v).ok).toBe(true);
    },
  );

  it.each([
    ["2026-05-15", "月途中"],
    ["2026-05-31", "月末"],
    ["2026-13-01", "月 13"],
    ["2026-00-01", "月 0"],
    ["20260501", "区切りなし"],
    ["", "空文字"],
  ])("異常系: %s (%s)", (v) => {
    expect(validateAppliesMonth(v).ok).toBe(false);
  });
});

// ============================================================
// recipient_type と employee_id の整合性
// ============================================================

describe("validateRecipientTypeAndEmployeeId", () => {
  it("external_company + employee_id null → OK", () => {
    expect(
      validateRecipientTypeAndEmployeeId("external_company", null).ok,
    ).toBe(true);
  });

  it("external_company + employee_id 値あり → NG", () => {
    expect(
      validateRecipientTypeAndEmployeeId("external_company", "abc-123").ok,
    ).toBe(false);
  });

  it("individual_special + employee_id null → OK", () => {
    expect(
      validateRecipientTypeAndEmployeeId("individual_special", null).ok,
    ).toBe(true);
  });

  it("individual_special + employee_id 値あり → NG", () => {
    expect(
      validateRecipientTypeAndEmployeeId("individual_special", "abc").ok,
    ).toBe(false);
  });

  it("employee_special + employee_id 値あり → OK", () => {
    expect(
      validateRecipientTypeAndEmployeeId("employee_special", "abc-123").ok,
    ).toBe(true);
  });

  it("employee_special + employee_id null → NG", () => {
    expect(
      validateRecipientTypeAndEmployeeId("employee_special", null).ok,
    ).toBe(false);
  });
});

// ============================================================
// effective_from / effective_to 順序
// ============================================================

describe("validateEffectiveDates", () => {
  it("effective_to が NULL → OK", () => {
    expect(validateEffectiveDates("2026-04-01", null).ok).toBe(true);
  });

  it("effective_from < effective_to → OK", () => {
    expect(validateEffectiveDates("2026-04-01", "2026-04-30").ok).toBe(true);
  });

  it("effective_from === effective_to → OK", () => {
    expect(validateEffectiveDates("2026-04-01", "2026-04-01").ok).toBe(true);
  });

  it("effective_from > effective_to → NG", () => {
    expect(validateEffectiveDates("2026-05-01", "2026-04-30").ok).toBe(false);
  });
});

// ============================================================
// 複合: validateEmployeeBankAccount
// ============================================================

describe("validateEmployeeBankAccount", () => {
  const valid = {
    bankCode: "0001",
    branchCode: "100",
    accountType: "普通",
    accountNumber: "1234567",
    accountHolderKana: "ﾔﾏﾀﾞ ﾀﾛｳ",
    effectiveFrom: "2026-04-01",
    effectiveTo: null,
  };

  it("全項目正常 → OK", () => {
    expect(validateEmployeeBankAccount(valid).ok).toBe(true);
  });

  it("複数エラー集約", () => {
    const result = validateEmployeeBankAccount({
      ...valid,
      bankCode: "12", // NG
      accountNumber: "abc", // NG
      accountType: "futsuu", // NG
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================
// 複合: validatePaymentRecipient
// ============================================================

describe("validatePaymentRecipient", () => {
  const baseExternal = {
    recipientType: "external_company",
    employeeId: null,
    bankCode: "0005",
    branchCode: "200",
    accountType: "当座",
    accountNumber: "9999999",
    accountHolderKana: "ｶﾌﾞｼｷｶﾞｲｼｬｴｲｺﾞｳ",
    appliesMonth: "2026-05-01",
    amount: 500000,
  };

  it("external_company 正常 → OK", () => {
    expect(validatePaymentRecipient(baseExternal).ok).toBe(true);
  });

  it("external_company に employee_id 値 → NG", () => {
    const result = validatePaymentRecipient({
      ...baseExternal,
      employeeId: "abc-123",
    });
    expect(result.ok).toBe(false);
  });

  it("employee_special + employee_id 値 → OK", () => {
    const result = validatePaymentRecipient({
      ...baseExternal,
      recipientType: "employee_special",
      employeeId: "abc-123",
    });
    expect(result.ok).toBe(true);
  });

  it("employee_special + employee_id null → NG", () => {
    const result = validatePaymentRecipient({
      ...baseExternal,
      recipientType: "employee_special",
      employeeId: null,
    });
    expect(result.ok).toBe(false);
  });

  it("amount 負数 → NG", () => {
    const result = validatePaymentRecipient({
      ...baseExternal,
      amount: -100,
    });
    expect(result.ok).toBe(false);
  });

  it("amount null → OK（通年継続）", () => {
    const result = validatePaymentRecipient({
      ...baseExternal,
      amount: null,
      appliesMonth: null,
    });
    expect(result.ok).toBe(true);
  });

  it("applies_month 月途中 → NG", () => {
    const result = validatePaymentRecipient({
      ...baseExternal,
      appliesMonth: "2026-05-15",
    });
    expect(result.ok).toBe(false);
  });

  it("recipient_type 不正 → 早期リターン（他検査スキップ）", () => {
    const result = validatePaymentRecipient({
      ...baseExternal,
      recipientType: "invalid",
    });
    expect(result.ok).toBe(false);
    // recipient_type 不正のみエラー、他の正常項目は検査されない
    expect(result.errors.length).toBe(1);
  });
});
