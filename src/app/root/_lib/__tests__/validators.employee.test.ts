/**
 * Garden Root — validateEmployee の Phase A-3-g 拡張テスト
 *
 * 対象:
 *   - employment_type='outsource' を受理する
 *   - 不正な employment_type を拒否する
 *   - contract_end_on < hire_date を拒否する
 *   - 外注以外で contract_end_on を入れたら拒否する
 *   - 正社員・アルバイトは従来どおり受理する
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
