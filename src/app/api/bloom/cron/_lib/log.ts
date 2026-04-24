/**
 * bloom_cron_log への書き込みヘルパ
 *
 * 設計方針（Phase 1 誤送信防止）:
 *   1. 送信前に status='pending' で INSERT（message_snapshot 含む）
 *   2. API レスポンス後に status='success'/'failure' で UPDATE
 *   3. Dry-run のときは status='skipped' を記録
 *
 * service role key でバイパス書き込みするため、呼び出しは Route Handler/Cron のみ。
 */

import { getSupabaseAdmin } from "../../../../../lib/supabase/admin";
import type { ChatworkNotificationKind } from "../../../../../lib/chatwork/types";

export type CronLogStartInput = {
  cron_kind: ChatworkNotificationKind | "manual";
  dry_run: boolean;
  room_id: string;
  message_snapshot: string;
};

export type CronLogStartResult = {
  id: string | null;
};

export async function startCronLog(input: CronLogStartInput): Promise<CronLogStartResult> {
  const payload = {
    cron_kind: input.cron_kind,
    dry_run: input.dry_run,
    room_id: input.room_id,
    message_snapshot: input.message_snapshot,
    status: input.dry_run ? ("skipped" as const) : ("pending" as const),
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bloom_cron_log")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[bloom/cron] startCronLog failed:", error.message);
    return { id: null };
  }
  return { id: (data?.id as string | undefined) ?? null };
}

type FinishSuccessInput = {
  id: string;
  chatwork_response: unknown;
};

export async function finishCronLogSuccess(input: FinishSuccessInput): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("bloom_cron_log")
    .update({
      status: "success",
      chatwork_response: input.chatwork_response as object,
    })
    .eq("id", input.id);
  if (error) {
    console.error("[bloom/cron] finishCronLogSuccess failed:", error.message);
  }
}

type FinishFailureInput = {
  id: string;
  error_detail: string;
  chatwork_response?: unknown;
};

export async function finishCronLogFailure(input: FinishFailureInput): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("bloom_cron_log")
    .update({
      status: "failure",
      error_detail: input.error_detail.slice(0, 4000),
      chatwork_response: (input.chatwork_response ?? null) as object | null,
    })
    .eq("id", input.id);
  if (error) {
    console.error("[bloom/cron] finishCronLogFailure failed:", error.message);
  }
}
