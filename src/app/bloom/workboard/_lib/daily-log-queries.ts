import { supabase } from "../../_lib/supabase";
import type { DailyLog } from "../../_types/daily-log";

export async function fetchTodayLog(
  userId: string,
  dateISO: string,
): Promise<DailyLog | null> {
  const { data, error } = await supabase
    .from("bloom_daily_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", dateISO)
    .maybeSingle();
  if (error) {
    console.error("[bloom] fetchTodayLog failed:", error.message);
    return null;
  }
  return (data as DailyLog | null) ?? null;
}

export async function fetchRecentLogs(
  userId: string,
  sinceISO: string,
): Promise<DailyLog[]> {
  const { data, error } = await supabase
    .from("bloom_daily_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", sinceISO)
    .order("log_date", { ascending: false });
  if (error) {
    console.error("[bloom] fetchRecentLogs failed:", error.message);
    return [];
  }
  return (data ?? []) as DailyLog[];
}
