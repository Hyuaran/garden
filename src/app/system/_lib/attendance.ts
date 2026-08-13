export const PUNCH_TYPES = ["clock_in", "clock_out", "break_start", "break_end"] as const;
export type PunchType = typeof PUNCH_TYPES[number];
export const PUNCH_LABELS: Record<PunchType, string> = {
  clock_in: "出勤", clock_out: "退勤", break_start: "休憩開始", break_end: "休憩終了",
};
export const SYNC_LABELS: Record<string, string> = {
  unsent: "未送信", sending: "送信中", synced: "同期済み", failed: "失敗",
  resend_wait: "再送待ち", needs_check: "要確認",
};
export const MANAGER_ROLES = new Set(["manager", "admin", "super_admin"]);
export const CLIENT_PUNCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPunchType(value: unknown): value is PunchType {
  return typeof value === "string" && (PUNCH_TYPES as readonly string[]).includes(value);
}

export function parseJstDate(value: string | null, now = new Date()) {
  const date = value ?? new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日付はYYYY-MM-DD形式で指定してください");
  const start = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(start.getTime()) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(start) !== date) {
    throw new Error("日付はYYYY-MM-DD形式で指定してください");
  }
  return { date, from: start.toISOString(), to: new Date(start.getTime() + 86_400_000).toISOString() };
}

export type AttendancePunch = {
  id: number; punch_type: PunchType; punched_at: string; kot_sync_status: string;
};

