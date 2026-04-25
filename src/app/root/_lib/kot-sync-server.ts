/**
 * Garden Root — KoT 同期のサーバ側フルフロー（Phase A-3-c）
 *
 * Cron / 管理スクリプト等、**クライアント承認を必要としない**自動同期ルート用。
 * `previewKotMonthlySync` がプレビューのみ（クライアント upsert 前提）だったのに対し、
 * 本ファイルの `runMonthlySyncFull` は preview → upsert → log 確定まで一括で実行する。
 *
 * 呼び出し制約:
 *   - Route Handler / Server Action / Node スクリプトからのみ
 *   - `"use server"` を付けず、普通の ESM 関数として提供（Route Handler からそのまま import できる）
 *   - 書込は `getSupabaseAdmin()` (service_role) で行うため RLS をバイパスする
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fetchKotEmployees,
  fetchKotMonthlyWorkings,
  KotApiClientError,
} from "./kot-api";
import type { KotMonthlyWorking } from "../_types/kot";
import type { Attendance } from "../_constants/types";
import {
  insertSyncLog,
  updateSyncLogComplete,
  updateSyncLogFailure,
} from "./kot-sync-log";
import { sanitizeUpsertPayload, NULLABLE_DATE_KEYS } from "./sanitize-payload";

// ------------------------------------------------------------
// 共通 helper（`_actions/kot-sync.ts` と一部重複。将来統合候補）
// ------------------------------------------------------------

function firstOfMonth(yyyymm: string): string {
  return `${yyyymm}-01`;
}

function minToHours(min: number | undefined): number {
  if (min === undefined || min === null || !Number.isFinite(min)) return 0;
  return Math.round((min / 60) * 10) / 10;
}

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

function holidayWorkMinutes(m: KotMonthlyWorking): number {
  const block = m.holidayWork;
  if (block && typeof block.minutes === "number") return block.minutes;
  const legal = m.legalHolidayWork?.minutes ?? 0;
  const general = m.generalHolidayWork?.minutes ?? 0;
  return legal + general;
}

// ------------------------------------------------------------
// Orphaned running cleanup
// ------------------------------------------------------------

export type OrphanedCleanupResult = {
  marked_failure: number;
  /** 処理実行日時（UTC ISO） */
  executed_at: string;
};

/**
 * 指定しきい値以上 `running` ステータスで残留しているログを `failure` に遷移させる。
 * Cron 冒頭で呼び、A-3-b 一覧の stale 表示をクリアする。
 *
 * @param olderThanMinutes  何分以上 running だったら orphaned とみなすか（既定: 30）
 */
export async function runOrphanedRunningCleanup(
  olderThanMinutes = 30,
): Promise<OrphanedCleanupResult> {
  const now = new Date();
  const threshold = new Date(now.getTime() - olderThanMinutes * 60 * 1000).toISOString();
  const supa = getSupabaseAdmin();

  const { data, error } = await supa
    .from("root_kot_sync_log")
    .update({
      status: "failure",
      error_code: "ORPHANED_RUNNING",
      error_message: `${olderThanMinutes} 分以上 running で残留していたためクリーンアップ（Cron 前段処理）`,
      completed_at: now.toISOString(),
    })
    .eq("status", "running")
    .lt("triggered_at", threshold)
    .select("id");

  if (error) {
    // cleanup は副次処理。失敗しても本体の同期は続行する。
    console.error("[kot-sync-server/runOrphanedRunningCleanup]", error.message);
    return { marked_failure: 0, executed_at: now.toISOString() };
  }
  return {
    marked_failure: (data ?? []).length,
    executed_at: now.toISOString(),
  };
}

// ------------------------------------------------------------
// 冪等性チェック: 直近 N 分以内に同じ target の running/success が有るなら重複と判定
// ------------------------------------------------------------

export async function hasRecentSyncAttempt(
  targetMonth: string,
  withinMinutes = 5,
): Promise<boolean> {
  const threshold = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("root_kot_sync_log")
    .select("id, status")
    .eq("sync_type", "monthly_attendance")
    .eq("sync_target", targetMonth)
    .in("status", ["running", "success"])
    .gte("triggered_at", threshold)
    .limit(1);
  if (error) {
    console.error("[kot-sync-server/hasRecentSyncAttempt]", error.message);
    return false; // 疑わしい時は続行
  }
  return (data ?? []).length > 0;
}

// ------------------------------------------------------------
// 月次勤怠フルフロー
// ------------------------------------------------------------

export type SyncMonthlyResult = {
  ok: boolean;
  target_month: string;
  log_id: string | null;
  records_fetched: number;
  records_inserted: number;
  records_updated: number;
  records_skipped: number;
  upsert_errors: number;
  /** 失敗時のみ */
  error_code?: string;
  error_message?: string;
};

/**
 * 月次勤怠同期フルフロー：preview → サーバ側 upsert → log 確定
 *
 * @param targetMonth   YYYY-MM
 * @param triggeredBy   'cron' / 'manual' / user_id 等
 * @param options       冪等性チェックをスキップするか等
 */
export async function runMonthlySyncFull(
  targetMonth: string,
  triggeredBy: string,
  options: { skipIdempotencyCheck?: boolean } = {},
): Promise<SyncMonthlyResult> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
    return {
      ok: false,
      target_month: targetMonth,
      log_id: null,
      records_fetched: 0,
      records_inserted: 0,
      records_updated: 0,
      records_skipped: 0,
      upsert_errors: 0,
      error_code: "INVALID_ARG",
      error_message: `targetMonth は YYYY-MM 形式で指定してください（受け取り: "${targetMonth}"）`,
    };
  }

  // 冪等性ガード（同 target が 5 分以内に running/success している場合は skip）
  if (!options.skipIdempotencyCheck) {
    const dup = await hasRecentSyncAttempt(targetMonth);
    if (dup) {
      return {
        ok: true,
        target_month: targetMonth,
        log_id: null,
        records_fetched: 0,
        records_inserted: 0,
        records_updated: 0,
        records_skipped: 0,
        upsert_errors: 0,
        error_code: "SKIPPED_DUPLICATE",
        error_message: "直近 5 分以内に同 target の同期が running / success のため skip",
      };
    }
  }

  const syncLog = await insertSyncLog({
    sync_type: "monthly_attendance",
    sync_target: targetMonth,
    triggered_by: triggeredBy,
    status: "running",
  });
  const logId = syncLog?.id ?? null;
  const employeesDate = firstOfMonth(targetMonth);

  try {
    // 1. KoT 従業員一覧
    const kotEmployees = await fetchKotEmployees({ date: employeesDate, includeResigner: true });
    const codeByKey = new Map<string, string>();
    for (const e of kotEmployees) {
      if (e.key && e.code) codeByKey.set(e.key, e.code);
    }

    // 2. KoT 月別勤怠
    const monthlies = await fetchKotMonthlyWorkings(targetMonth);

    // 3. Garden 従業員マスタ（service_role 横断取得）
    const supa = getSupabaseAdmin();
    const { data: empRows, error: empErr } = await supa
      .from("root_employees")
      .select("employee_id, employee_number, name, is_active");
    if (empErr) throw new Error(`Garden 従業員マスタ取得失敗: ${empErr.message}`);

    const gardenByNumber = new Map<string, { employee_id: string; is_active: boolean }>();
    for (const e of empRows ?? []) {
      gardenByNumber.set(e.employee_number, { employee_id: e.employee_id, is_active: e.is_active });
      const padded = e.employee_number.padStart(4, "0");
      if (padded !== e.employee_number) {
        gardenByNumber.set(padded, { employee_id: e.employee_id, is_active: e.is_active });
      }
    }

    // 4. 解決 + upsert
    let inserted = 0;
    let errors = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const m of monthlies) {
      const code = codeByKey.get(m.employeeKey);
      const garden = code ? gardenByNumber.get(code) ?? gardenByNumber.get(code.padStart(4, "0")) : undefined;
      if (!code || !garden) {
        skipped++;
        continue;
      }
      const employeeId = garden.employee_id;
      const attendance_id = `ATT-${targetMonth}-${employeeId.replace("EMP-", "")}`;
      const assigned = m.assigned ?? 0;
      const unassigned = m.unassigned ?? 0;
      const overtime = m.overtime ?? 0;
      const actualTotal = assigned + unassigned + overtime;
      const raw: Attendance = {
        attendance_id,
        employee_id: employeeId,
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
        training_hours: null,
        office_hours: null,
        imported_at: now,
        import_status: "取込済",
        kot_record_id: `kot:mw:${targetMonth}:${m.employeeKey}`,
        created_at: "",
        updated_at: "",
      };
      const payload = sanitizeUpsertPayload(raw, {
        nullableDateKeys: NULLABLE_DATE_KEYS.attendance,
      });
      const { error: upErr } = await supa
        .from("root_attendance")
        .upsert(payload, { onConflict: "attendance_id" });
      if (upErr) {
        errors++;
        console.error("[runMonthlySyncFull/upsert]", upErr.message, { attendance_id });
      } else {
        inserted++;
      }
    }

    if (logId) {
      if (errors > 0 && inserted === 0) {
        await updateSyncLogFailure(logId, {
          error_code: "ALL_UPSERT_FAILED",
          error_message: `全 ${errors} 行 upsert 失敗`,
          records_fetched: monthlies.length,
        });
        return {
          ok: false,
          target_month: targetMonth,
          log_id: logId,
          records_fetched: monthlies.length,
          records_inserted: 0,
          records_updated: 0,
          records_skipped: skipped,
          upsert_errors: errors,
          error_code: "ALL_UPSERT_FAILED",
          error_message: "全行 upsert 失敗",
        };
      }
      await updateSyncLogComplete(logId, {
        status: errors > 0 ? "partial" : "success",
        records_fetched: monthlies.length,
        records_inserted: inserted,
        records_updated: 0,
        records_skipped: skipped,
      });
    }

    return {
      ok: errors === 0,
      target_month: targetMonth,
      log_id: logId,
      records_fetched: monthlies.length,
      records_inserted: inserted,
      records_updated: 0,
      records_skipped: skipped,
      upsert_errors: errors,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e instanceof KotApiClientError ? String(e.code) : "UNKNOWN";
    if (logId) {
      await updateSyncLogFailure(logId, {
        error_code: code,
        error_message: msg,
        error_stack: e instanceof Error ? e.stack ?? null : null,
      });
    }
    return {
      ok: false,
      target_month: targetMonth,
      log_id: logId,
      records_fetched: 0,
      records_inserted: 0,
      records_updated: 0,
      records_skipped: 0,
      upsert_errors: 0,
      error_code: code,
      error_message: msg,
    };
  }
}
