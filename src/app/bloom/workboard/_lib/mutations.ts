import { supabase } from "../../_lib/supabase";
import type { DailyLog, PlannedItem } from "../../_types/daily-log";
import type { WorkerStatus, WorkerStatusKind } from "../../_types/worker-status";

/**
 * 自分のステータスを upsert（1 社員 1 行）
 */
export async function upsertMyStatus(
  userId: string,
  status: WorkerStatusKind,
  options: { status_note?: string | null; until?: string | null } = {},
): Promise<WorkerStatus | null> {
  const payload = {
    user_id: userId,
    status,
    status_note: options.status_note ?? null,
    until: options.until ?? null,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };
  const { data, error } = await supabase
    .from("bloom_worker_status")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .maybeSingle();
  if (error) {
    console.error("[bloom] upsertMyStatus failed:", error.message);
    return null;
  }
  return (data as WorkerStatus | null) ?? null;
}

/**
 * 今日の日報の planned_items を差し替え（なければ新規作成）
 */
export async function upsertTodayPlannedItems(
  userId: string,
  dateISO: string,
  items: PlannedItem[],
): Promise<DailyLog | null> {
  const payload = {
    user_id: userId,
    log_date: dateISO,
    planned_items: items,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("bloom_daily_logs")
    .upsert(payload, { onConflict: "user_id,log_date" })
    .select()
    .maybeSingle();
  if (error) {
    console.error("[bloom] upsertTodayPlannedItems failed:", error.message);
    return null;
  }
  return (data as DailyLog | null) ?? null;
}
