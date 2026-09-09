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
  Vendor,
  SalarySystem,
  Employee,
  Insurance,
  Attendance,
  GardenRole,
} from "../_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";

const ROOT_EMPLOYEE_SELECT_FIELDS = [
  "employee_id",
  "employee_number",
  "name",
  "name_kana",
  "company_id",
  "employment_type",
  "salary_system_id",
  "hire_date",
  "termination_date",
  "contract_end_on",
  "kou_otsu",
  "dependents_count",
  "deleted_at",
  "email",
  "bank_name",
  "bank_code",
  "branch_name",
  "branch_code",
  "account_type",
  "account_number",
  "account_holder",
  "account_holder_kana",
  "kot_employee_id",
  "mf_employee_id",
  "commute_daily_allowance",
  "roster_record_id",
  "garden_role_manual",
  "chatwork_account_name",
  "chatwork_token_updated_at",
  "insurance_type",
  "is_active",
  "notes",
  "created_at",
  "updated_at",
  "garden_role",
].join(",");

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
  const { data, error } = await supabase
    .from("root_companies")
    .select("*")
    .order("company_id", { ascending: true });
  if (error) throw new Error(`fetchCompanies failed: ${error.message}`);
  return (data ?? []) as Company[];
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
  const { data, error } = await supabase
    .from("root_bank_accounts")
    .select("*")
    .order("company_id", { ascending: true })
    .order("account_id", { ascending: true });
  if (error) throw new Error(`fetchBankAccounts failed: ${error.message}`);
  return (data ?? []) as BankAccount[];
}

export async function upsertBankAccount(account: Partial<BankAccount> & { account_id: string }): Promise<void> {
  const { error } = await supabase.from("root_bank_accounts").upsert(account, { onConflict: "account_id" });
  if (error) throw new Error(`upsertBankAccount failed: ${error.message}`);
}

export const setBankAccountActive = (id: string, active: boolean) =>
  setActive("root_bank_accounts", "account_id", id, active);

// ============================================================
// 3. 取引先マスタ
// ============================================================
export async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from("root_vendors")
    .select("*")
    .order("vendor_name_kana", { ascending: true });
  if (error) throw new Error(`fetchVendors failed: ${error.message}`);
  return (data ?? []) as Vendor[];
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
  const { data, error } = await supabase
    .from("root_salary_systems")
    .select("*")
    .order("salary_system_id", { ascending: true });
  if (error) throw new Error(`fetchSalarySystems failed: ${error.message}`);
  return (data ?? []) as SalarySystem[];
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
  const { data, error } = await supabase
    .from("root_employees")
    .select(ROOT_EMPLOYEE_SELECT_FIELDS)
    .order("company_id", { ascending: true })
    .order("employee_number", { ascending: true });
  if (error) throw new Error(`fetchEmployees failed: ${error.message}`);
  return (data ?? []) as unknown as Employee[];
}

export async function upsertEmployee(employee: Partial<Employee> & { employee_id: string }): Promise<void> {
  const response = await fetch("/api/root/employees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(employee),
  });
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(`upsertEmployee failed: ${body?.error ?? response.statusText}`);
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
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(`root_employees.setActive failed: ${body?.error ?? response.statusText}`);
  });

// ============================================================
// 6. 社会保険マスタ
// ============================================================
export async function fetchInsurance(): Promise<Insurance[]> {
  const { data, error } = await supabase
    .from("root_insurance")
    .select("*")
    .order("fiscal_year", { ascending: false });
  if (error) throw new Error(`fetchInsurance failed: ${error.message}`);
  return (data ?? []) as Insurance[];
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
  let query = supabase.from("root_attendance").select("*").order("target_month", { ascending: false }).order("employee_id", { ascending: true });
  if (targetMonth) query = query.eq("target_month", targetMonth);
  const { data, error } = await query;
  if (error) throw new Error(`fetchAttendance failed: ${error.message}`);
  return (data ?? []) as Attendance[];
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

  return data as unknown as RootUser;
}
