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
import {
  insertSyncLog,
  updateSyncLogComplete,
  updateSyncLogFailure,
} from "../_lib/kot-sync-log";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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
 * - Phase A-3-a でシェアド `getSupabaseAdmin()`（`@/lib/supabase/admin`）に統一。
 */
function serviceSupabase() {
  return getSupabaseAdmin();
}

// ------------------------------------------------------------
// Public: プレビュー作成
// ------------------------------------------------------------

/**
 * @param targetMonth  YYYY-MM（例: "2026-04"）
 * @param triggeredBy  ログ triggered_by に入れる識別子。
 *                     client から呼ぶ場合は rootUser.user_id、
 *                     Cron から呼ぶ場合は 'cron' を想定。
 *                     未指定時は 'unknown' で記録（A-3-b で要 follow）。
 */
export async function previewKotMonthlySync(
  targetMonth: string,
  triggeredBy?: string,
): Promise<KotSyncPreviewResult> {
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

  // 同期開始ログ（失敗しても null を返すだけでメイン処理は続行）
  const syncLog = await insertSyncLog({
    sync_type: "monthly_attendance",
    sync_target: targetMonth,
    triggered_by: triggeredBy ?? "unknown",
    status: "running",
  });
  const logId = syncLog?.id;

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
      if (logId) {
        await updateSyncLogFailure(logId, {
          error_code: "SUPABASE_ERROR",
          error_message: `Garden 従業員マスタ取得に失敗: ${empErr.message}`,
        });
      }
      return {
        ok: false,
        source: "live",
        target_month: targetMonth,
        error_code: "SUPABASE_ERROR",
        message: `Garden 従業員マスタ取得に失敗: ${empErr.message}`,
        log_id: logId,
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

    // プレビュー取得成功。ここでは commit 結果（実際の upsert 結果）は分からないため、
    // 一旦 records_fetched のみ更新して status='running' のまま残し、
    // クライアント側 commit 後に commitKotSyncResult で status を確定させる。
    if (logId) {
      await getSupabaseAdmin()
        .from("root_kot_sync_log")
        .update({ records_fetched: rows.length })
        .eq("id", logId);
    }

    return {
      ok: true,
      source: "live",
      target_month: targetMonth,
      rows,
      warnings: [],
      log_id: logId,
    };
  } catch (e) {
    if (e instanceof KotApiClientError) {
      if (logId) {
        await updateSyncLogFailure(logId, {
          error_code: String(e.code),
          error_message: e.message,
          error_stack: e.stack ?? null,
        });
      }
      return {
        ok: false,
        source: "live",
        target_month: targetMonth,
        error_code: e.code,
        message: e.message,
        // detail は開発環境のみ返す
        detail: process.env.NODE_ENV === "production" ? undefined : e.detail,
        log_id: logId,
      };
    }
    const err = e as Error;
    if (logId) {
      await updateSyncLogFailure(logId, {
        error_code: "UNKNOWN",
        error_message: err.message,
        error_stack: err.stack ?? null,
      });
    }
    return {
      ok: false,
      source: "live",
      target_month: targetMonth,
      error_code: "UNKNOWN",
      message: err.message,
      log_id: logId,
    };
  }
}

// ------------------------------------------------------------
// Public: クライアント upsert 完了後のログ確定
// ------------------------------------------------------------

/**
 * クライアント側の一括 upsert が完了した後に呼ばれる Server Action。
 * previewKotMonthlySync で status='running' のまま保留したログ行を、
 * 最終結果（成功 / 部分成功）で締める。
 *
 * 失敗が発生した行がある場合は status='partial'、全件成功は status='success'。
 * 全件失敗や破滅的失敗はクライアント側で判断して `commitKotSyncFailure` を呼ぶ。
 *
 * @param logId    previewKotMonthlySync が返した log_id
 * @param stats    upsert の集計結果
 */
export async function commitKotSyncResult(
  logId: string,
  stats: {
    records_fetched: number;
    records_inserted: number;
    records_updated: number;
    records_skipped: number;
    upsert_errors: number;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const status: "success" | "partial" = stats.upsert_errors > 0 ? "partial" : "success";
    await updateSyncLogComplete(logId, {
      status,
      records_fetched: stats.records_fetched,
      records_inserted: stats.records_inserted,
      records_updated: stats.records_updated,
      records_skipped: stats.records_skipped,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/**
 * クライアント側の upsert が完全に破滅した場合に呼ばれる Server Action。
 * 例: commit 開始直後に Supabase RLS で全件拒否、ネットワーク切断等。
 */
export async function commitKotSyncFailure(
  logId: string,
  params: {
    error_code: string;
    error_message: string;
    records_fetched?: number;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await updateSyncLogFailure(logId, {
      error_code: params.error_code,
      error_message: params.error_message,
      records_fetched: params.records_fetched,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
