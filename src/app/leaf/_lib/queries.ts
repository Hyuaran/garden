/**
 * Garden-Leaf 関電業務委託 — Supabase クエリ
 */

import { supabase } from "./supabase";
import type { KandenCase, KandenCalendar, StatusDateUpdate } from "./types";

// ─── 案件一覧 ─────────────────────────────────────────────────────────────────

/** 案件一覧取得（新着順、最大1000件） */
export async function fetchCases(companyId?: string): Promise<KandenCase[]> {
  let q = supabase
    .from("soil_kanden_cases")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(1000);

  if (companyId) {
    q = q.eq("company_id", companyId);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as KandenCase[];
}

/** 案件1件取得 */
export async function fetchCase(caseId: string): Promise<KandenCase | null> {
  const { data, error } = await supabase
    .from("soil_kanden_cases")
    .select("*")
    .eq("case_id", caseId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new Error(error.message);
  }
  return data as KandenCase;
}

// ─── 案件 CRUD ────────────────────────────────────────────────────────────────

/**
 * 案件作成
 * case_id は自前で生成して渡す（generateCaseId() を使う）
 */
export async function createCase(
  payload: Omit<KandenCase, "created_at" | "updated_at">,
): Promise<KandenCase> {
  const { data, error } = await supabase
    .from("soil_kanden_cases")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as KandenCase;
}

/** 案件更新 */
export async function updateCase(
  caseId: string,
  payload: Partial<KandenCase>,
): Promise<KandenCase> {
  const { data, error } = await supabase
    .from("soil_kanden_cases")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("case_id", caseId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as KandenCase;
}

/** ステータスと対応日付を更新 */
export async function updateCaseStatus(
  caseId: string,
  update: StatusDateUpdate,
): Promise<KandenCase> {
  return updateCase(caseId, update);
}

// ─── カレンダー ───────────────────────────────────────────────────────────────

/** 年度のカレンダー全件取得 */
export async function fetchCalendar(
  fiscalYear: number,
): Promise<KandenCalendar[]> {
  const { data, error } = await supabase
    .from("kanden_calendar")
    .select("*")
    .eq("fiscal_year", fiscalYear)
    .order("month_num")
    .order("schedule_code");

  if (error) throw new Error(error.message);
  return (data ?? []) as KandenCalendar[];
}

// ─── 従業員情報（Root連携・新規案件の営業自動補完用） ───────────────────────

export interface EmployeeLite {
  employee_number: string;
  name: string | null;
  company_id: string | null;
}

/**
 * 社員番号から従業員情報を取得（root_employees 参照）
 * 新規案件の営業担当フィールド自動補完に使用
 *
 * NOTE: root_employees には department カラムが無いため、
 *       営業部署は手動入力に委ねる（自動補完対象外）
 */
export async function fetchEmployeeByNumber(
  empNumber: string,
): Promise<EmployeeLite | null> {
  const { data, error } = await supabase
    .from("root_employees")
    .select("employee_number, name, company_id")
    .eq("employee_number", empNumber)
    .maybeSingle();

  if (error) {
    console.warn("fetchEmployeeByNumber failed:", error.message);
    return null;
  }
  return data as EmployeeLite | null;
}

// ─── 次の案件ID生成 ───────────────────────────────────────────────────────────

/** 今日の日付ベースで次の案件IDを生成 */
export async function generateCaseId(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `K-${today.slice(0, 4)}${today.slice(4, 6)}${today.slice(6, 8)}-`;

  const { data } = await supabase
    .from("soil_kanden_cases")
    .select("case_id")
    .like("case_id", `${prefix}%`)
    .order("case_id", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) {
    return `${prefix}001`;
  }

  const lastId = data[0].case_id as string;
  const lastNum = parseInt(lastId.split("-")[2] ?? "0", 10);
  return `${prefix}${String(lastNum + 1).padStart(3, "0")}`;
}
