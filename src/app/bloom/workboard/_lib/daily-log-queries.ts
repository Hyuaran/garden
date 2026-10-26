import { bloomRead } from '../../_lib/view-read';
import type { DailyLog } from "../../_types/daily-log";

export async function fetchTodayLog(
  userId: string,
  dateISO: string,
): Promise<DailyLog | null> {
return bloomRead('todayLog',{dateISO});
}

export async function fetchRecentLogs(
  userId: string,
  sinceISO: string,
): Promise<DailyLog[]> {
return bloomRead('recentLogs',{sinceISO});
}
