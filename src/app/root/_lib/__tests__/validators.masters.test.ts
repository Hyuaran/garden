/**
 * Garden Root — 6マスタバリデーター 単体テスト
 *
 * 対象:
 *   1. validateCompany
 *   2. validateBankAccount
 *   3. validateVendor
 *   4. validateSalarySystem
 *   5. validateInsurance
 *   6. validateAttendance
 *
 * ※ validateEmployee は validators.employee.test.ts で網羅済みのため対象外。
 */

import { describe, it, expect } from "vitest";
import {
  validateCompany,
  validateBankAccount,
  validateVendor,
  validateSalarySystem,
  validateInsurance,
  validateAttendance,
} from "@/app/root/_lib/validators";
import type {
  Company,
  BankAccount,
  Vendor,
  SalarySystem,
  Insurance,
  Attendance,
} from "@/app/root/_constants/types";

// ============================================================
// ファクトリ関数
// ============================================================

function baseCompany(overrides: Partial<Company> = {}): Company {
  return {
    company_id: "COMP-001",
    company_name: "株式会社テスト",
    company_name_kana: "カブシキガイシャテスト",
    corporate_number: null,
    representative: "山田 太郎",
    address: "大阪府大阪市北区1-1-1",
    phone: null,
    default_bank: "楽天銀行",
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function baseBankAccount(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    account_id: "ACC-001",
    company_id: "COMP-001",
    bank_name: "楽天銀行",
    bank_code: "0036",
    branch_name: "第一営業支店",
    branch_code: "251",
    account_type: "普通",
    account_number: "1234567",
    account_holder: "カブシキガイシャテスト",
    purpose: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function baseVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    vendor_id: "VND-001",
    vendor_name: "株式会社サプライヤー",
    vendor_name_kana: "カブシキガイシャサプライヤー",
    vendor_type: null,
    bank_name: "みずほ銀行",
    bank_code: "0001",
    branch_name: "大阪支店",
    branch_code: "100",
    account_type: "普通",
    account_number: "7654321",
    account_holder_kana: "カブシキガイシャサプライヤー",
    fee_bearer: "当方負担",
    company_id: null,
    notes: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function baseSalarySystem(overrides: Partial<SalarySystem> = {}): SalarySystem {
  return {
    salary_system_id: "SAL-SYS-001",
    system_name: "正社員標準",
    employment_type: "正社員",
    base_salary_type: "月給",
    working_hours_day: 8,
    working_days_month: 20,
    overtime_rate: 1.25,
    night_overtime_rate: 1.35,
    holiday_overtime_rate: 1.35,
    allowances: null,
    deductions: null,
    is_active: true,
    notes: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function baseInsurance(overrides: Partial<Insurance> = {}): Insurance {
  return {
    insurance_id: "INS-0001",
    fiscal_year: "2026",
    effective_from: "2026-04-01",
    effective_to: null,
    health_insurance_rate: 9.98,
    nursing_insurance_rate: 1.82,
    pension_rate: 18.3,
    employment_insurance_rate: 1.55,
    child_support_rate: 0.36,
    grade_table: [],
    is_active: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function baseAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    attendance_id: "ATT-2026-04-0001",
    employee_id: "EMP-0042",
    target_month: "2026-04",
    working_days: 20,
    absence_days: 0,
    paid_leave_days: 1,
    scheduled_hours: 160,
    actual_hours: 165,
    overtime_hours: 5,
    legal_overtime_hours: 5,
    night_hours: 0,
    holiday_hours: 0,
    late_hours: 0,
    early_leave_hours: 0,
    training_hours: null,
    office_hours: null,
    imported_at: null,
    import_status: "取込済",
    kot_record_id: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

// ============================================================
// 1. validateCompany
// ============================================================

describe("validateCompany — happy path", () => {
  it("accepts a fully valid company", () => {
    const errs = validateCompany(baseCompany());
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("accepts optional phone number with valid format", () => {
    const errs = validateCompany(baseCompany({ phone: "06-1234-5678" }));
    expect(errs.phone).toBeUndefined();
  });

  it("accepts valid corporate_number (13 digits)", () => {
    const errs = validateCompany(baseCompany({ corporate_number: "1234567890123" }));
    expect(errs.corporate_number).toBeUndefined();
  });
});

describe("validateCompany — company_id format", () => {
  it("rejects wrong prefix", () => {
    const errs = validateCompany(baseCompany({ company_id: "ABC-001" }));
    expect(errs.company_id).toBeDefined();
    expect(errs.company_id).toContain("COMP-");
  });

  it("rejects too-short numeric part (fewer than 3 digits)", () => {
    const errs = validateCompany(baseCompany({ company_id: "COMP-01" }));
    expect(errs.company_id).toBeDefined();
  });

  it("accepts COMP-001 (minimum 3 digits)", () => {
    const errs = validateCompany(baseCompany({ company_id: "COMP-001" }));
    expect(errs.company_id).toBeUndefined();
  });

  it("accepts COMP-1000 (4+ digits)", () => {
    const errs = validateCompany(baseCompany({ company_id: "COMP-1000" }));
    expect(errs.company_id).toBeUndefined();
  });
});

describe("validateCompany — required fields", () => {
  it("rejects blank company_name", () => {
    const errs = validateCompany(baseCompany({ company_name: "   " }));
    expect(errs.company_name).toBeDefined();
    expect(errs.company_name).toContain("必須");
  });

  it("rejects blank company_name_kana", () => {
    const errs = validateCompany(baseCompany({ company_name_kana: "" }));
    expect(errs.company_name_kana).toBeDefined();
    expect(errs.company_name_kana).toContain("必須");
  });

  it("rejects blank representative", () => {
    const errs = validateCompany(baseCompany({ representative: "" }));
    expect(errs.representative).toBeDefined();
  });

  it("rejects blank address", () => {
    const errs = validateCompany(baseCompany({ address: "" }));
    expect(errs.address).toBeDefined();
  });

  it("rejects missing default_bank", () => {
    const errs = validateCompany(baseCompany({ default_bank: "" }));
    expect(errs.default_bank).toBeDefined();
  });
});

describe("validateCompany — kana / phone / corporate_number format", () => {
  it("rejects hiragana in company_name_kana", () => {
    const errs = validateCompany(baseCompany({ company_name_kana: "かぶしきがいしゃ" }));
    expect(errs.company_name_kana).toBeDefined();
    expect(errs.company_name_kana).toContain("カタカナ");
  });

  it("rejects romaji in company_name_kana", () => {
    const errs = validateCompany(baseCompany({ company_name_kana: "Kabushiki" }));
    expect(errs.company_name_kana).toBeDefined();
  });

  it("rejects invalid phone format", () => {
    const errs = validateCompany(baseCompany({ phone: "abc-def-ghij" }));
    expect(errs.phone).toBeDefined();
  });

  it("rejects corporate_number with wrong digit count (12 digits)", () => {
    const errs = validateCompany(baseCompany({ corporate_number: "123456789012" }));
    expect(errs.corporate_number).toBeDefined();
    expect(errs.corporate_number).toContain("13桁");
  });

  it("rejects corporate_number with non-digit characters", () => {
    const errs = validateCompany(baseCompany({ corporate_number: "123456789012X" }));
    expect(errs.corporate_number).toBeDefined();
  });
});

// ============================================================
// 2. validateBankAccount
// ============================================================

describe("validateBankAccount — happy path", () => {
  it("accepts a fully valid bank account", () => {
    const errs = validateBankAccount(baseBankAccount());
    expect(Object.keys(errs)).toHaveLength(0);
  });
});

describe("validateBankAccount — account_id format", () => {
  it("rejects wrong prefix", () => {
    const errs = validateBankAccount(baseBankAccount({ account_id: "BANK-001" }));
    expect(errs.account_id).toBeDefined();
    expect(errs.account_id).toContain("ACC-");
  });

  it("rejects too-short numeric part", () => {
    const errs = validateBankAccount(baseBankAccount({ account_id: "ACC-01" }));
    expect(errs.account_id).toBeDefined();
  });

  it("accepts ACC-001 (minimum 3 digits)", () => {
    const errs = validateBankAccount(baseBankAccount({ account_id: "ACC-001" }));
    expect(errs.account_id).toBeUndefined();
  });
});

describe("validateBankAccount — digit-length fields", () => {
  it("rejects bank_code with wrong length (3 digits)", () => {
    const errs = validateBankAccount(baseBankAccount({ bank_code: "003" }));
    expect(errs.bank_code).toBeDefined();
    expect(errs.bank_code).toContain("4桁");
  });

  it("rejects bank_code with wrong length (5 digits)", () => {
    const errs = validateBankAccount(baseBankAccount({ bank_code: "00361" }));
    expect(errs.bank_code).toBeDefined();
  });

  it("rejects branch_code with wrong length (2 digits)", () => {
    const errs = validateBankAccount(baseBankAccount({ branch_code: "25" }));
    expect(errs.branch_code).toBeDefined();
    expect(errs.branch_code).toContain("3桁");
  });

  it("rejects account_number with wrong length (6 digits)", () => {
    const errs = validateBankAccount(baseBankAccount({ account_number: "123456" }));
    expect(errs.account_number).toBeDefined();
    expect(errs.account_number).toContain("7桁");
  });

  it("rejects account_number with non-digit characters", () => {
    const errs = validateBankAccount(baseBankAccount({ account_number: "123456A" }));
    expect(errs.account_number).toBeDefined();
  });
});

describe("validateBankAccount — required fields", () => {
  it("rejects missing company_id", () => {
    const errs = validateBankAccount(baseBankAccount({ company_id: "" }));
    expect(errs.company_id).toBeDefined();
    expect(errs.company_id).toContain("必須");
  });

  it("rejects blank bank_name", () => {
    const errs = validateBankAccount(baseBankAccount({ bank_name: "  " }));
    expect(errs.bank_name).toBeDefined();
  });

  it("rejects blank branch_name", () => {
    const errs = validateBankAccount(baseBankAccount({ branch_name: "" }));
    expect(errs.branch_name).toBeDefined();
  });

  it("rejects missing account_type", () => {
    const errs = validateBankAccount(baseBankAccount({ account_type: "" }));
    expect(errs.account_type).toBeDefined();
  });

  it("rejects blank account_holder", () => {
    const errs = validateBankAccount(baseBankAccount({ account_holder: "" }));
    expect(errs.account_holder).toBeDefined();
  });
});

// ============================================================
// 3. validateVendor
// ============================================================

describe("validateVendor — happy path", () => {
  it("accepts a fully valid vendor", () => {
    const errs = validateVendor(baseVendor());
    expect(Object.keys(errs)).toHaveLength(0);
  });
});

describe("validateVendor — vendor_id format", () => {
  it("rejects wrong prefix", () => {
    const errs = validateVendor(baseVendor({ vendor_id: "VEND-001" }));
    expect(errs.vendor_id).toBeDefined();
    expect(errs.vendor_id).toContain("VND-");
  });

  it("rejects too-short numeric part", () => {
    const errs = validateVendor(baseVendor({ vendor_id: "VND-01" }));
    expect(errs.vendor_id).toBeDefined();
  });

  it("accepts VND-001 (minimum 3 digits)", () => {
    const errs = validateVendor(baseVendor({ vendor_id: "VND-001" }));
    expect(errs.vendor_id).toBeUndefined();
  });
});

describe("validateVendor — kana fields", () => {
  it("rejects blank vendor_name_kana", () => {
    const errs = validateVendor(baseVendor({ vendor_name_kana: "" }));
    expect(errs.vendor_name_kana).toBeDefined();
    expect(errs.vendor_name_kana).toContain("必須");
  });

  it("rejects hiragana in vendor_name_kana", () => {
    const errs = validateVendor(baseVendor({ vendor_name_kana: "さぷらいやー" }));
    expect(errs.vendor_name_kana).toBeDefined();
    expect(errs.vendor_name_kana).toContain("カタカナ");
  });

  it("rejects blank account_holder_kana", () => {
    const errs = validateVendor(baseVendor({ account_holder_kana: "" }));
    expect(errs.account_holder_kana).toBeDefined();
    expect(errs.account_holder_kana).toContain("必須");
  });

  it("rejects hiragana in account_holder_kana", () => {
    const errs = validateVendor(baseVendor({ account_holder_kana: "さぷらいやー" }));
    expect(errs.account_holder_kana).toBeDefined();
    expect(errs.account_holder_kana).toContain("カタカナ");
  });
});

describe("validateVendor — digit-length fields", () => {
  it("rejects bank_code with wrong length", () => {
    const errs = validateVendor(baseVendor({ bank_code: "001" }));
    expect(errs.bank_code).toBeDefined();
    expect(errs.bank_code).toContain("4桁");
  });

  it("rejects branch_code with wrong length", () => {
    const errs = validateVendor(baseVendor({ branch_code: "10" }));
    expect(errs.branch_code).toBeDefined();
    expect(errs.branch_code).toContain("3桁");
  });

  it("rejects account_number with wrong length", () => {
    const errs = validateVendor(baseVendor({ account_number: "654321" }));
    expect(errs.account_number).toBeDefined();
    expect(errs.account_number).toContain("7桁");
  });
});

describe("validateVendor — required fields", () => {
  it("rejects blank vendor_name", () => {
    const errs = validateVendor(baseVendor({ vendor_name: "" }));
    expect(errs.vendor_name).toBeDefined();
  });

  it("rejects missing account_type", () => {
    const errs = validateVendor(baseVendor({ account_type: "" }));
    expect(errs.account_type).toBeDefined();
  });

  it("rejects missing fee_bearer", () => {
    const errs = validateVendor(baseVendor({ fee_bearer: "" }));
    expect(errs.fee_bearer).toBeDefined();
  });
});

// ============================================================
// 4. validateSalarySystem
// ============================================================

describe("validateSalarySystem — happy path", () => {
  it("accepts a fully valid salary system", () => {
    const errs = validateSalarySystem(baseSalarySystem());
    expect(Object.keys(errs)).toHaveLength(0);
  });
});

describe("validateSalarySystem — salary_system_id format", () => {
  it("rejects wrong prefix", () => {
    const errs = validateSalarySystem(baseSalarySystem({ salary_system_id: "SYS-001" }));
    expect(errs.salary_system_id).toBeDefined();
    expect(errs.salary_system_id).toContain("SAL-SYS-");
  });

  it("rejects SAL-SYS- without trailing digits", () => {
    const errs = validateSalarySystem(baseSalarySystem({ salary_system_id: "SAL-SYS-" }));
    expect(errs.salary_system_id).toBeDefined();
  });

  it("accepts SAL-SYS-001", () => {
    const errs = validateSalarySystem(baseSalarySystem({ salary_system_id: "SAL-SYS-001" }));
    expect(errs.salary_system_id).toBeUndefined();
  });
});

describe("validateSalarySystem — required fields", () => {
  it("rejects blank system_name", () => {
    const errs = validateSalarySystem(baseSalarySystem({ system_name: "" }));
    expect(errs.system_name).toBeDefined();
    expect(errs.system_name).toContain("必須");
  });

  it("rejects missing employment_type", () => {
    const errs = validateSalarySystem(baseSalarySystem({ employment_type: "" }));
    expect(errs.employment_type).toBeDefined();
  });

  it("rejects missing base_salary_type", () => {
    const errs = validateSalarySystem(baseSalarySystem({ base_salary_type: "" }));
    expect(errs.base_salary_type).toBeDefined();
  });
});

describe("validateSalarySystem — working_hours_day boundary", () => {
  it("accepts 0 (lower boundary)", () => {
    const errs = validateSalarySystem(baseSalarySystem({ working_hours_day: 0 }));
    expect(errs.working_hours_day).toBeUndefined();
  });

  it("accepts 24 (upper boundary)", () => {
    const errs = validateSalarySystem(baseSalarySystem({ working_hours_day: 24 }));
    expect(errs.working_hours_day).toBeUndefined();
  });

  it("rejects negative value", () => {
    const errs = validateSalarySystem(baseSalarySystem({ working_hours_day: -1 }));
    expect(errs.working_hours_day).toBeDefined();
    expect(errs.working_hours_day).toContain("0〜24");
  });

  it("rejects value above 24", () => {
    const errs = validateSalarySystem(baseSalarySystem({ working_hours_day: 24.1 }));
    expect(errs.working_hours_day).toBeDefined();
  });
});

describe("validateSalarySystem — overtime_rate boundary", () => {
  it("accepts 1 (lower boundary)", () => {
    const errs = validateSalarySystem(baseSalarySystem({ overtime_rate: 1 }));
    expect(errs.overtime_rate).toBeUndefined();
  });

  it("accepts 3 (upper boundary)", () => {
    const errs = validateSalarySystem(baseSalarySystem({ overtime_rate: 3 }));
    expect(errs.overtime_rate).toBeUndefined();
  });

  it("rejects value below 1 (e.g. 0.99)", () => {
    const errs = validateSalarySystem(baseSalarySystem({ overtime_rate: 0.99 }));
    expect(errs.overtime_rate).toBeDefined();
    expect(errs.overtime_rate).toContain("1〜3");
  });

  it("rejects value above 3", () => {
    const errs = validateSalarySystem(baseSalarySystem({ overtime_rate: 3.01 }));
    expect(errs.overtime_rate).toBeDefined();
  });
});

describe("validateSalarySystem — night/holiday overtime rates", () => {
  it("rejects night_overtime_rate below 1", () => {
    const errs = validateSalarySystem(baseSalarySystem({ night_overtime_rate: 0.5 }));
    expect(errs.night_overtime_rate).toBeDefined();
    expect(errs.night_overtime_rate).toContain("1〜3");
  });

  it("rejects holiday_overtime_rate above 3", () => {
    const errs = validateSalarySystem(baseSalarySystem({ holiday_overtime_rate: 4 }));
    expect(errs.holiday_overtime_rate).toBeDefined();
  });
});

describe("validateSalarySystem — working_days_month boundary", () => {
  it("accepts 0 (lower boundary)", () => {
    const errs = validateSalarySystem(baseSalarySystem({ working_days_month: 0 }));
    expect(errs.working_days_month).toBeUndefined();
  });

  it("accepts 31 (upper boundary)", () => {
    const errs = validateSalarySystem(baseSalarySystem({ working_days_month: 31 }));
    expect(errs.working_days_month).toBeUndefined();
  });

  it("rejects value above 31", () => {
    const errs = validateSalarySystem(baseSalarySystem({ working_days_month: 32 }));
    expect(errs.working_days_month).toBeDefined();
  });
});

// ============================================================
// 5. validateInsurance
// ============================================================

describe("validateInsurance — happy path", () => {
  it("accepts a fully valid insurance record", () => {
    const errs = validateInsurance(baseInsurance());
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("accepts null effective_to (契約継続)", () => {
    const errs = validateInsurance(baseInsurance({ effective_to: null }));
    expect(errs.effective_to).toBeUndefined();
  });
});

describe("validateInsurance — insurance_id format", () => {
  it("rejects wrong prefix", () => {
    const errs = validateInsurance(baseInsurance({ insurance_id: "INS-001" }));
    expect(errs.insurance_id).toBeDefined();
    expect(errs.insurance_id).toContain("INS-");
  });

  it("rejects too-short numeric part (3 digits)", () => {
    const errs = validateInsurance(baseInsurance({ insurance_id: "INS-001" }));
    expect(errs.insurance_id).toBeDefined();
  });

  it("accepts INS-0001 (minimum 4 digits)", () => {
    const errs = validateInsurance(baseInsurance({ insurance_id: "INS-0001" }));
    expect(errs.insurance_id).toBeUndefined();
  });
});

describe("validateInsurance — fiscal_year format", () => {
  it("rejects non-4-digit fiscal year", () => {
    const errs = validateInsurance(baseInsurance({ fiscal_year: "26" }));
    expect(errs.fiscal_year).toBeDefined();
    expect(errs.fiscal_year).toContain("4桁");
  });

  it("rejects fiscal year with letters", () => {
    const errs = validateInsurance(baseInsurance({ fiscal_year: "R8年" }));
    expect(errs.fiscal_year).toBeDefined();
  });

  it("accepts valid 4-digit fiscal year", () => {
    const errs = validateInsurance(baseInsurance({ fiscal_year: "2026" }));
    expect(errs.fiscal_year).toBeUndefined();
  });
});

describe("validateInsurance — effective_from required", () => {
  it("rejects missing effective_from", () => {
    const errs = validateInsurance(baseInsurance({ effective_from: "" }));
    expect(errs.effective_from).toBeDefined();
    expect(errs.effective_from).toContain("必須");
  });
});

describe("validateInsurance — effective_to date relationship", () => {
  it("rejects effective_to before effective_from", () => {
    const errs = validateInsurance(baseInsurance({
      effective_from: "2026-04-01",
      effective_to: "2026-03-31",
    }));
    expect(errs.effective_to).toBeDefined();
    expect(errs.effective_to).toContain("開始日");
  });

  it("accepts effective_to equal to effective_from", () => {
    const errs = validateInsurance(baseInsurance({
      effective_from: "2026-04-01",
      effective_to: "2026-04-01",
    }));
    expect(errs.effective_to).toBeUndefined();
  });

  it("accepts effective_to after effective_from", () => {
    const errs = validateInsurance(baseInsurance({
      effective_from: "2026-04-01",
      effective_to: "2027-03-31",
    }));
    expect(errs.effective_to).toBeUndefined();
  });
});

describe("validateInsurance — rate boundaries (0〜100)", () => {
  it("accepts all rates at 0 (lower boundary)", () => {
    const errs = validateInsurance(baseInsurance({
      health_insurance_rate: 0,
      nursing_insurance_rate: 0,
      pension_rate: 0,
      employment_insurance_rate: 0,
      child_support_rate: 0,
    }));
    expect(errs.health_insurance_rate).toBeUndefined();
    expect(errs.nursing_insurance_rate).toBeUndefined();
    expect(errs.pension_rate).toBeUndefined();
    expect(errs.employment_insurance_rate).toBeUndefined();
    expect(errs.child_support_rate).toBeUndefined();
  });

  it("accepts all rates at 100 (upper boundary)", () => {
    const errs = validateInsurance(baseInsurance({
      health_insurance_rate: 100,
      nursing_insurance_rate: 100,
      pension_rate: 100,
      employment_insurance_rate: 100,
      child_support_rate: 100,
    }));
    expect(errs.health_insurance_rate).toBeUndefined();
    expect(errs.pension_rate).toBeUndefined();
  });

  it("rejects health_insurance_rate above 100", () => {
    const errs = validateInsurance(baseInsurance({ health_insurance_rate: 101 }));
    expect(errs.health_insurance_rate).toBeDefined();
    expect(errs.health_insurance_rate).toContain("0〜100");
  });

  it("rejects pension_rate below 0", () => {
    const errs = validateInsurance(baseInsurance({ pension_rate: -1 }));
    expect(errs.pension_rate).toBeDefined();
  });

  it("rejects child_support_rate above 100", () => {
    const errs = validateInsurance(baseInsurance({ child_support_rate: 100.1 }));
    expect(errs.child_support_rate).toBeDefined();
  });
});

// ============================================================
// 6. validateAttendance
// ============================================================

describe("validateAttendance — happy path", () => {
  it("accepts a fully valid attendance record", () => {
    const errs = validateAttendance(baseAttendance());
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("accepts null training_hours and office_hours", () => {
    const errs = validateAttendance(baseAttendance({ training_hours: null, office_hours: null }));
    expect(errs.training_hours).toBeUndefined();
    expect(errs.office_hours).toBeUndefined();
  });
});

describe("validateAttendance — required fields", () => {
  it("rejects blank attendance_id", () => {
    const errs = validateAttendance(baseAttendance({ attendance_id: "" }));
    expect(errs.attendance_id).toBeDefined();
    expect(errs.attendance_id).toContain("必須");
  });

  it("rejects missing employee_id", () => {
    const errs = validateAttendance(baseAttendance({ employee_id: "" }));
    expect(errs.employee_id).toBeDefined();
    expect(errs.employee_id).toContain("必須");
  });

  it("rejects missing import_status", () => {
    const errs = validateAttendance(baseAttendance({ import_status: "" }));
    expect(errs.import_status).toBeDefined();
    expect(errs.import_status).toContain("必須");
  });
});

describe("validateAttendance — target_month format", () => {
  it("accepts YYYY-MM format", () => {
    const errs = validateAttendance(baseAttendance({ target_month: "2026-04" }));
    expect(errs.target_month).toBeUndefined();
  });

  it("rejects YYYY/MM format", () => {
    const errs = validateAttendance(baseAttendance({ target_month: "2026/04" }));
    expect(errs.target_month).toBeDefined();
    expect(errs.target_month).toContain("YYYY-MM");
  });

  it("rejects YYYY-MM-DD (too specific)", () => {
    const errs = validateAttendance(baseAttendance({ target_month: "2026-04-01" }));
    expect(errs.target_month).toBeDefined();
  });

  it("rejects invalid month 13", () => {
    const errs = validateAttendance(baseAttendance({ target_month: "2026-13" }));
    expect(errs.target_month).toBeDefined();
  });
});

describe("validateAttendance — day count boundaries (0〜31)", () => {
  it("accepts 0 working_days (lower boundary)", () => {
    const errs = validateAttendance(baseAttendance({ working_days: 0 }));
    expect(errs.working_days).toBeUndefined();
  });

  it("accepts 31 working_days (upper boundary)", () => {
    const errs = validateAttendance(baseAttendance({ working_days: 31 }));
    expect(errs.working_days).toBeUndefined();
  });

  it("rejects working_days above 31", () => {
    const errs = validateAttendance(baseAttendance({ working_days: 32 }));
    expect(errs.working_days).toBeDefined();
    expect(errs.working_days).toContain("0〜31");
  });

  it("rejects negative absence_days", () => {
    const errs = validateAttendance(baseAttendance({ absence_days: -1 }));
    expect(errs.absence_days).toBeDefined();
  });
});

describe("validateAttendance — hour fields boundaries (0〜744)", () => {
  it("accepts 0 scheduled_hours (lower boundary)", () => {
    const errs = validateAttendance(baseAttendance({ scheduled_hours: 0 }));
    expect(errs.scheduled_hours).toBeUndefined();
  });

  it("accepts 744 actual_hours (upper boundary: 31 days × 24 hours)", () => {
    const errs = validateAttendance(baseAttendance({ actual_hours: 744 }));
    expect(errs.actual_hours).toBeUndefined();
  });

  it("rejects overtime_hours above 744", () => {
    const errs = validateAttendance(baseAttendance({ overtime_hours: 745 }));
    expect(errs.overtime_hours).toBeDefined();
    expect(errs.overtime_hours).toContain("0〜744");
  });

  it("rejects negative night_hours", () => {
    const errs = validateAttendance(baseAttendance({ night_hours: -1 }));
    expect(errs.night_hours).toBeDefined();
  });

  it("rejects holiday_hours above 744", () => {
    const errs = validateAttendance(baseAttendance({ holiday_hours: 800 }));
    expect(errs.holiday_hours).toBeDefined();
  });
});

describe("validateAttendance — optional training_hours / office_hours", () => {
  it("accepts valid training_hours within range", () => {
    const errs = validateAttendance(baseAttendance({ training_hours: 40 }));
    expect(errs.training_hours).toBeUndefined();
  });

  it("rejects training_hours above 744", () => {
    const errs = validateAttendance(baseAttendance({ training_hours: 745 }));
    expect(errs.training_hours).toBeDefined();
    expect(errs.training_hours).toContain("0〜744");
  });

  it("accepts valid office_hours within range", () => {
    const errs = validateAttendance(baseAttendance({ office_hours: 160 }));
    expect(errs.office_hours).toBeUndefined();
  });

  it("rejects negative office_hours", () => {
    const errs = validateAttendance(baseAttendance({ office_hours: -5 }));
    expect(errs.office_hours).toBeDefined();
  });
});
