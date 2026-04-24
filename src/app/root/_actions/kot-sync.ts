"use server";

/**
 * Garden Root — KoT 月次勤怠同期 Server Action
 *
 * 手順:
 *   1. UI が target_month（YYYY-MM）を指定
 *   2. Server 側で KoT /employees と /monthly-workings を呼ぶ
 *   3. employeeKey → KoT code → root_employees.employee_number → employee_id の解決
 *   4. 変換済プレビュー行を UI へ返却（ここで commit はしない）
 *   5. UI 側が承認 → 既存 upsertAttendance（RLS 経由）を 1 行ずつ実行
 *
 * DB 書込はクライアント側の既存経路を再利用（Phase 1 と一貫）。
 * Server Action は KoT API アクセスと変換のみに専念し、秘密情報（トークン）を
 * クライアントに漏らさない。
 */

import {
  fetchKotEmployees,
  fetchKotMonthlyWorkings,
  KotApiClientError,
} from "../_lib/kot-api";
import type { KotMonthlyWorking, KotSyncPreviewResult, KotSyncPreviewRow } from "../_types/kot";
import { createClient } from "@supabase/supabase-js";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function assertYearMonth(yyyymm: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yyyymm)) {
    throw new Error(`target_month は YYYY-MM 形式で指定してください（受け取り: "${yyyymm}"）`);
  }
}

/** /employees?date 用に当月1日 (YYYY-MM-DD) を組み立てる（/employees は YYYY-MM-DD を受理） */
function firstOfMonth(yyyymm: string): string {
  return `${yyyymm}-01`;
}

/** 分 → 時間（小数 1 桁） */
function minToHours(min: number | undefined): number {
  if (min === undefined || min === null || !Number.isFinite(min)) return 0;
  return Math.round((min / 60) * 10) / 10;
}

/** KoT 休暇一覧 / customMonthlyWorkings から「有休」日数を抽出 */
function paidLeaveDays(m: KotMonthlyWorking): number {
  if (m.holidaysObtained) {
    const paid = m.holidaysObtained.find((h) => /有休|有給|年休/.test(h.name));
    if (paid?.dayCount) return paid.dayCount;
  }
  if (m.customMonthlyWorkings) {
    const paid = m.customMonthlyWorkings.find((c) => c.name && /有休|有給|年休/.test(c.name));
    if (paid?.dayCount) return paid.dayCount;
  }
  return 0;
}

/** 休日勤務の総分数を抽出 */
function holidayWorkMinutes(m: KotMonthlyWorking): number {
  const block = m.holidayWork;
  if (block && typeof block.minutes === "number") return block.minutes;
  const legal = m.legalHolidayWork?.minutes ?? 0;
  const general = m.generalHolidayWork?.minutes ?? 0;
  return legal + general;
}

/**
 * 内部用 Supabase クライアント（service_role）。
 * - root_employees.employee_number と KoT code を突合するため、RLS 越しに
 *   複数従業員を横断取得する必要がある。
 * - Server 実行のみなので service_role を使っても OK（トークン同様、クライアントに漏れない）。
 */
function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 環境変数が未設定（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ------------------------------------------------------------
// Public: プレビュー作成
// ------------------------------------------------------------

export async function previewKotMonthlySync(targetMonth: string): Promise<KotSyncPreviewResult> {
  try {
    assertYearMonth(targetMonth);
  } catch (e) {
    return {
      ok: false,
      source: "live",
      target_month: targetMonth,
      error_code: "INVALID_ARG",
      message: (e as Error).message,
    };
  }
  // /employees は yyyy-MM-DD、/monthly-workings は yyyy-MM を受理する（実機確認 2026-04-24）
  const employeesDate = firstOfMonth(targetMonth); // yyyy-MM-DD

  try {
    // 1. KoT 従業員一覧（employeeKey → code マップ用）
    const kotEmployees = await fetchKotEmployees({ date: employeesDate, includeResigner: true });
    const codeByKey = new Map<string, string>();
    for (const e of kotEmployees) {
      if (e.key && e.code) codeByKey.set(e.key, e.code);
    }

    // 2. KoT 月別勤怠（yyyy-MM をそのまま渡す）
    const monthlies = await fetchKotMonthlyWorkings(targetMonth);

    // 3. Garden 側の従業員マスタ（employee_number → employee_id / name / is_active）
    const supa = serviceSupabase();
    const { data: empRows, error: empErr } = await supa
      .from("root_employees")
      .select("employee_id, employee_number, name, is_active");
    if (empErr) {
      return {
        ok: false,
        source: "live",
        target_month: targetMonth,
        error_code: "SUPABASE_ERROR",
        message: `Garden 従業員マスタ取得に失敗: ${empErr.message}`,
      };
    }
    const gardenByNumber = new Map<string, { employee_id: string; name: string; is_active: boolean }>();
    for (const e of empRows ?? []) {
      gardenByNumber.set(e.employee_number, e);
      const padded = e.employee_number.padStart(4, "0");
      if (padded !== e.employee_number) gardenByNumber.set(padded, e);
    }

    // 4. 変換
    const rows: KotSyncPreviewRow[] = monthlies.map((m, i) => {
      const code = codeByKey.get(m.employeeKey) ?? null;
      const garden = code
        ? (gardenByNumber.get(code) ?? gardenByNumber.get(code.padStart(4, "0")))
        : undefined;

      const assigned = m.assigned ?? 0;
      const unassigned = m.unassigned ?? 0;
      const overtime = m.overtime ?? 0;
      const actualTotal = assigned + unassigned + overtime;

      const values = {
        target_month: targetMonth,
        working_days: m.workingdayCount ?? m.workingCount ?? 0,
        absence_days: m.absentdayCount ?? 0,
        paid_leave_days: paidLeaveDays(m),
        scheduled_hours: minToHours(assigned),
        actual_hours: minToHours(actualTotal),
        overtime_hours: minToHours(unassigned),
        legal_overtime_hours: minToHours(overtime),
        night_hours: minToHours(m.night),
        holiday_hours: minToHours(holidayWorkMinutes(m)),
        late_hours: minToHours(m.late),
        early_leave_hours: minToHours(m.earlyLeave),
      };

      let resolution: KotSyncPreviewRow["resolution"];
      if (!code) {
        resolution = { kind: "unresolved", reason: `KoT employeeKey → code の解決に失敗（/employees に該当無し）` };
      } else if (!garden) {
        resolution = { kind: "unresolved", reason: `Garden 従業員マスタに社員番号 ${code} が未登録` };
      } else if (!garden.is_active) {
        resolution = { kind: "warning", employee_id: garden.employee_id, employee_name: garden.name, reason: `無効化済の従業員（${garden.name}）` };
      } else {
        resolution = { kind: "resolved", employee_id: garden.employee_id, employee_name: garden.name };
      }

      return {
        index: i + 1,
        employee_key: m.employeeKey,
        employee_code: code,
        resolution,
        values,
        kot_record_id: `kot:mw:${targetMonth}:${m.employeeKey}`,
      };
    });

    return {
      ok: true,
      source: "live",
      target_month: targetMonth,
      rows,
      warnings: [],
    };
  } catch (e) {
    if (e instanceof KotApiClientError) {
      return {
        ok: false,
        source: "live",
        target_month: targetMonth,
        error_code: e.code,
        message: e.message,
        // detail は開発環境のみ返す
        detail: process.env.NODE_ENV === "production" ? undefined : e.detail,
      };
    }
    return {
      ok: false,
      source: "live",
      target_month: targetMonth,
      error_code: "UNKNOWN",
      message: (e as Error).message,
    };
  }
}
