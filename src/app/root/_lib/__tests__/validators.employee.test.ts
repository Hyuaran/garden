/**
 * Garden Root — validateEmployee の Phase A-3-g / A-3-h 拡張テスト
 *
 * A-3-g:
 *   - employment_type='outsource' を受理する
 *   - 不正な employment_type を拒否する
 *   - contract_end_on < hire_date を拒否する
 *   - 外注以外で contract_end_on を入れたら拒否する
 *
 * A-3-h:
 *   - kou_otsu は null / 'kou' / 'otsu' のみ受理
 *   - dependents_count は 0〜20 の整数のみ受理
 *   - 給与関連フィールドが undefined / null なら検証スキップ
 */

import { describe, it, expect } from "vitest";
import { validateEmployee } from "@/app/root/_lib/validators";
import type { Employee } from "@/app/root/_constants/types";

function baseEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    employee_id: "EMP-0042",
    employee_number: "0042",
    name: "山田 太郎",
    name_kana: "ヤマダ タロウ",
    company_id: "COMP-001",
    employment_type: "正社員",
    salary_system_id: "SAL-SYS-001",
    hire_date: "2025-04-01",
    termination_date: null,
    contract_end_on: null,
    email: "taro@example.com",
    bank_name: "楽天銀行",
    bank_code: "0036",
    branch_name: "第一営業支店",
    branch_code: "251",
    account_type: "普通",
    account_number: "1234567",
    account_holder: "ヤマダ タロウ",
    account_holder_kana: "ヤマダ タロウ",
    kot_employee_id: null,
    mf_employee_id: null,
    insurance_type: "加入",
    is_active: true,
    notes: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("validateEmployee — employment_type", () => {
  it("accepts 正社員 / アルバイト", () => {
    expect(validateEmployee(baseEmployee({ employment_type: "正社員" })).employment_type).toBeUndefined();
    expect(validateEmployee(baseEmployee({ employment_type: "アルバイト" })).employment_type).toBeUndefined();
  });

  it("accepts outsource (Phase A-3-g)", () => {
    const errs = validateEmployee(baseEmployee({ employment_type: "outsource", contract_end_on: "2026-12-31" }));
    expect(errs.employment_type).toBeUndefined();
  });

  it("rejects unknown employment_type values", () => {
    const errs = validateEmployee(baseEmployee({ employment_type: "freelancer" }));
    expect(errs.employment_type).toBeDefined();
    expect(errs.employment_type).toContain("外注");
  });
});

describe("validateEmployee — kou_otsu (Phase A-3-h)", () => {
  it("accepts null (未設定)", () => {
    expect(validateEmployee(baseEmployee({ kou_otsu: null })).kou_otsu).toBeUndefined();
  });

  it("accepts undefined (フィールド未設定)", () => {
    expect(validateEmployee(baseEmployee({ kou_otsu: undefined })).kou_otsu).toBeUndefined();
  });

  it("accepts 'kou' (甲欄)", () => {
    expect(validateEmployee(baseEmployee({ kou_otsu: "kou" })).kou_otsu).toBeUndefined();
  });

  it("accepts 'otsu' (乙欄)", () => {
    expect(validateEmployee(baseEmployee({ kou_otsu: "otsu" })).kou_otsu).toBeUndefined();
  });

  it("rejects invalid kou_otsu values", () => {
    // @ts-expect-error runtime invalid value for validator coverage
    const errs = validateEmployee(baseEmployee({ kou_otsu: "hei" }));
    expect(errs.kou_otsu).toBeDefined();
    expect(errs.kou_otsu).toContain("kou");
  });
});

describe("validateEmployee — dependents_count (Phase A-3-h)", () => {
  it("accepts 0 (既定値)", () => {
    expect(validateEmployee(baseEmployee({ dependents_count: 0 })).dependents_count).toBeUndefined();
  });

  it("accepts 20 (境界値、最大)", () => {
    expect(validateEmployee(baseEmployee({ dependents_count: 20 })).dependents_count).toBeUndefined();
  });

  it("accepts undefined (省略時は検証スキップ)", () => {
    expect(validateEmployee(baseEmployee({ dependents_count: undefined })).dependents_count).toBeUndefined();
  });

  it("rejects negative values", () => {
    const errs = validateEmployee(baseEmployee({ dependents_count: -1 }));
    expect(errs.dependents_count).toBeDefined();
  });

  it("rejects > 20", () => {
    const errs = validateEmployee(baseEmployee({ dependents_count: 21 }));
    expect(errs.dependents_count).toBeDefined();
    expect(errs.dependents_count).toContain("0〜20");
  });

  it("rejects non-integer values", () => {
    const errs = validateEmployee(baseEmployee({ dependents_count: 2.5 }));
    expect(errs.dependents_count).toBeDefined();
    expect(errs.dependents_count).toContain("整数");
  });
});

describe("validateEmployee — contract_end_on", () => {
  it("allows null contract_end_on for outsource (契約継続)", () => {
    const errs = validateEmployee(baseEmployee({ employment_type: "outsource", contract_end_on: null }));
    expect(errs.contract_end_on).toBeUndefined();
  });

  it("allows null contract_end_on for 正社員", () => {
    const errs = validateEmployee(baseEmployee({ employment_type: "正社員", contract_end_on: null }));
    expect(errs.contract_end_on).toBeUndefined();
  });

  it("rejects contract_end_on on non-outsource employees", () => {
    const errs = validateEmployee(baseEmployee({ employment_type: "正社員", contract_end_on: "2026-12-31" }));
    expect(errs.contract_end_on).toBeDefined();
    expect(errs.contract_end_on).toContain("outsource");
  });

  it("rejects contract_end_on before hire_date for outsource", () => {
    const errs = validateEmployee(baseEmployee({
      employment_type: "outsource",
      hire_date: "2026-01-01",
      contract_end_on: "2025-12-31",
    }));
    expect(errs.contract_end_on).toBeDefined();
    expect(errs.contract_end_on).toContain("入社日");
  });

  it("accepts contract_end_on >= hire_date for outsource", () => {
    const errs = validateEmployee(baseEmployee({
      employment_type: "outsource",
      hire_date: "2026-01-01",
      contract_end_on: "2026-12-31",
    }));
    expect(errs.contract_end_on).toBeUndefined();
  });
});

describe("validateEmployee — 退職時の口座任意化", () => {
  const blankBank = {
    bank_name: "", bank_code: "", branch_name: "", branch_code: "",
    account_number: "", account_holder: "", account_holder_kana: "",
  };
  const requiredBankErrors = {
    bank_name: "必須", bank_code: "半角数字4桁", branch_name: "必須", branch_code: "半角数字3桁",
    account_number: "半角数字7桁", account_holder: "必須", account_holder_kana: "必須",
  };

  it("退職日あり・口座7項目すべて空は通る", () => {
    expect(validateEmployee(baseEmployee({ ...blankBank, termination_date: "2026-06-30" }))).toEqual({});
  });

  it.each([null, ""])("退職日が空（%s）なら従来どおり7項目がエラー", (termination_date) => {
    expect(validateEmployee(baseEmployee({ ...blankBank, termination_date }))).toEqual(requiredBankErrors);
  });

  it.each([
    ["bank_code", "123", "半角数字4桁"],
    ["bank_code", "１２３４", "半角数字4桁"],
    ["bank_code", "1234 ", "半角数字4桁"],
    ["branch_code", "12", "半角数字3桁"],
    ["branch_code", "１２３", "半角数字3桁"],
    ["account_number", "123456", "半角数字7桁"],
    ["account_number", "１２３４５６７", "半角数字7桁"],
    ["account_number", "123456A", "半角数字7桁"],
    ["account_holder_kana", "やまだ", "全角カタカナのみ"],
  ])("退職日があっても%sの不正値%sを拒否する", (field, value, message) => {
    expect(validateEmployee(baseEmployee({ ...blankBank, termination_date: "2026-06-30", [field]: value })))
      .toEqual({ [field]: message });
  });

  it("退職日あり・正しい口座情報は通る", () => {
    expect(validateEmployee(baseEmployee({ termination_date: "2026-06-30" }))).toEqual({});
  });

  it("退職者は口座の一部だけ入力しても、その値が正しければ通る", () => {
    expect(validateEmployee(baseEmployee({ ...blankBank, termination_date: "2026-06-30", bank_code: "0036" }))).toEqual({});
  });

  it("退職者の空白だけの口座は空として扱う", () => {
    const whitespaceBank = Object.fromEntries(Object.keys(blankBank).map(key => [key, "　 "]));
    expect(validateEmployee(baseEmployee({ ...whitespaceBank, termination_date: "2026-06-30" }))).toEqual({});
  });

  it("無効化だけでは在籍者の口座必須を解除しない", () => {
    expect(validateEmployee(baseEmployee({ ...blankBank, is_active: false }))).toEqual(requiredBankErrors);
  });

  it.each([
    "employee_id", "employee_number", "company_id", "name", "name_kana", "email",
    "employment_type", "salary_system_id", "insurance_type", "hire_date",
  ] as const)("退職日があっても%sの必須検証を維持する", field => {
    expect(validateEmployee(baseEmployee({ ...blankBank, termination_date: "2026-06-30", [field]: "" }))[field]).toBeDefined();
  });

  it("入社日より前の退職日は引き続き拒否する", () => {
    expect(validateEmployee(baseEmployee({ ...blankBank, termination_date: "2025-03-31" })))
      .toEqual({ termination_date: "入社日より前にはできません" });
  });
});
