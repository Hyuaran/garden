import { readRootData } from "./read-data";
/**
 * Garden Root — CRUD クエリ関数
 *
 * 7テーブル分の一覧取得・追加・更新関数をまとめる。
 * 削除は行わず、is_active フラグの切り替えで無効化管理する。
 */

import { supabase } from "./supabase";
import type {
  Company,
  BankAccount,
  BankCorporation,
  Vendor,
  SalarySystem,
  Employee,
  Insurance,
  Attendance,
  GardenRole,
} from "../_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";



// 読み出しに失敗したとき、画面には読む人向けの文だけを出し、詳しい原因はブラウザの記録に残す（2026-09-18）


// ============================================================
// 共通: トグル is_active
// ============================================================
async function setActive(
  table: string,
  pkColumn: string,
  pkValue: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ is_active: isActive })
    .eq(pkColumn, pkValue);
  if (error) throw new Error(`${table}.setActive failed: ${error.message}`);
}

// ============================================================
// 1. 法人マスタ
// ============================================================
export async function fetchCompanies(): Promise<Company[]> {
  return readRootData("companies", "root-companies");
}

export async function upsertCompany(company: Partial<Company> & { company_id: string }): Promise<void> {
  const { error } = await supabase.from("root_companies").upsert(company, { onConflict: "company_id" });
  if (error) throw new Error(`upsertCompany failed: ${error.message}`);
}

export const setCompanyActive = (id: string, active: boolean) =>
  setActive("root_companies", "company_id", id, active);

// ============================================================
// 2. 銀行口座マスタ
// ============================================================
export async function fetchBankAccounts(): Promise<BankAccount[]> {
  return readRootData("bank-accounts", "root-bank-accounts");
}

export async function fetchBankCorporations(): Promise<BankCorporation[]> {
  return readRootData("corporations", "root-bank-accounts");
}
function bankAccountError(error: { code?: string }): Error {
  if (error.code === "23514") return new Error("入力の形が正しくありません（支店コードは数字3桁か空・口座番号は数字だけ）");
  return new Error(error.code === "23505" ? "同じ法人・銀行・口座番号の口座がもうあります" : "銀行口座を保存できませんでした。権限や入力内容を確認して、もう一度お試しください。");
}
function editableBankFields(a: BankAccount) {
  return { branch_name: a.branch_name?.trim() || null, branch_code: a.branch_code?.trim() || null, account_type: a.account_type,
    sub_account_label: a.sub_account_label?.trim() || null, has_csv_export: a.has_csv_export,
    needs_manual_balance: a.needs_manual_balance, notes: a.notes?.trim() || null };
}
export async function insertBankAccount(a: BankAccount): Promise<string> {
  const { data, error } = await supabase.from("root_bank_accounts").insert({
    ...editableBankFields(a), corp_code: a.corp_code, bank_code: a.bank_code,
    bank_name: a.bank_name, account_number: a.account_number, is_active: true,
  }).select("id").single();
  if (error) throw bankAccountError(error);
  return data.id;
}
export async function updateBankAccount(a: BankAccount): Promise<void> {
  const { error } = await supabase.from("root_bank_accounts").update(editableBankFields(a)).eq("id", a.id);
  if (error) throw bankAccountError(error);
}
export async function setBankAccountActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("root_bank_accounts").update({ is_active: active }).eq("id", id);
  if (error) throw bankAccountError(error);
}

// ============================================================
// 3. 取引先マスタ
// ============================================================
export async function fetchVendors(): Promise<Vendor[]> {
  return readRootData("vendors", "root-vendors");
}

export async function upsertVendor(vendor: Partial<Vendor> & { vendor_id: string }): Promise<void> {
  const { error } = await supabase.from("root_vendors").upsert(vendor, { onConflict: "vendor_id" });
  if (error) throw new Error(`upsertVendor failed: ${error.message}`);
}

export const setVendorActive = (id: string, active: boolean) =>
  setActive("root_vendors", "vendor_id", id, active);

// ============================================================
// 4. 給与体系マスタ
// ============================================================
export async function fetchSalarySystems(): Promise<SalarySystem[]> {
  return readRootData("salary-systems", "root-salary-systems");
}

export async function upsertSalarySystem(system: Partial<SalarySystem> & { salary_system_id: string }): Promise<void> {
  const { error } = await supabase.from("root_salary_systems").upsert(system, { onConflict: "salary_system_id" });
  if (error) throw new Error(`upsertSalarySystem failed: ${error.message}`);
}

export const setSalarySystemActive = (id: string, active: boolean) =>
  setActive("root_salary_systems", "salary_system_id", id, active);

// ============================================================
// 5. 従業員マスタ
// ============================================================
export async function fetchEmployees(): Promise<Employee[]> {
  return readRootData("employees", "root-employees");
}

export async function upsertEmployee(employee: Partial<Employee> & { employee_id: string }): Promise<{warning?:string}> {
  const response = await fetch("/api/root/employees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(employee),
  });
  const body = await response.json().catch(() => null) as { error?: string; warning?:string } | null;
  if (!response.ok) throw new Error(`upsertEmployee failed: ${body?.error ?? response.statusText}`);
  return body ?? {};
}

export async function updateEmployeeGardenRole(
  employeeId: string,
  gardenRole: GardenRole,
): Promise<void> {
  const { error } = await supabase
    .from("root_employees")
    .update({ garden_role: gardenRole })
    .eq("employee_id", employeeId);
  if (error) throw new Error(`updateEmployeeGardenRole failed: ${error.message}`);
}

export const setEmployeeActive = (id: string, active: boolean) =>
  fetch("/api/root/employees", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ employee_id: id, is_active: active }),
  }).then(async (response) => {
    const body = await response.json().catch(() => null) as { error?: string;warning?:string } | null;
    if (!response.ok) throw new Error(`root_employees.setActive failed: ${body?.error ?? response.statusText}`);
    return body ?? {};
  });

// ============================================================
// 6. 社会保険マスタ
// ============================================================
export async function fetchInsurance(): Promise<Insurance[]> {
  return readRootData("insurance", "root-insurance");
}

export async function upsertInsurance(insurance: Partial<Insurance> & { insurance_id: string }): Promise<void> {
  const { error } = await supabase.from("root_insurance").upsert(insurance, { onConflict: "insurance_id" });
  if (error) throw new Error(`upsertInsurance failed: ${error.message}`);
}

export const setInsuranceActive = (id: string, active: boolean) =>
  setActive("root_insurance", "insurance_id", id, active);

// ============================================================
// 7. 勤怠データ
// ============================================================
export async function fetchAttendance(targetMonth?: string): Promise<Attendance[]> {
  return readRootData("attendance", "root-attendance", targetMonth ? { month: targetMonth } : {});
}

export async function upsertAttendance(attendance: Partial<Attendance> & { attendance_id: string }): Promise<void> {
  const { error } = await supabase.from("root_attendance").upsert(attendance, { onConflict: "attendance_id" });
  if (error) throw new Error(`upsertAttendance failed: ${error.message}`);
}

// ============================================================
// 認証: ログイン中ユーザーの root_employees 行を取得
// ============================================================

export type RootUser = {
  employee_id: string;
  employee_number: string;
  name: string;
  email: string;
  garden_role: GardenRole;
  company_id: string;
  company_name?: string | null;
  is_active: boolean;
  user_id: string;
};

export async function fetchRootUser(userId: string): Promise<RootUser | null> {
  const { data, error } = await supabase
    .from("root_employees")
    .select(
      [
        "employee_id",
        "employee_number",
        "name",
        "email",
        "garden_role",
        "company_id",
        "is_active",
        "termination_date",
        "deleted_at",
        "user_id",
      ].join(","),
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle<RootUser & { termination_date: string | null; deleted_at: string | null }>();

  if (error) {
    console.error("[fetchRootUser]", error.message);
    return null;
  }
  if (!data) return null;
  if (!isEmployeeActive(data)) return null;

  const rootUser = data as unknown as RootUser;
  const { data: company } = await supabase
    .from("root_companies")
    .select("company_name")
    .eq("company_id", rootUser.company_id)
    .maybeSingle<{ company_name: string | null }>();

  return {
    ...rootUser,
    company_name: company?.company_name ?? null,
  };
}
