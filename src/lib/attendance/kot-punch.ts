import {
  transformDayPunches,
  type KotTransformPunch,
} from "@/app/api/system/attendance/kot-export/_lib/kot-transform";
export function currentPunchAgent(version: string | null | undefined) {
  if (!/^\d+\.\d+\.\d+$/.test(version || "")) return false;
  const [major, minor] = version!.split(".").map(Number);
  return major > 1 || (major === 1 && minor >= 4);
}
export function punchDeadline(date: string) {
  return Date.parse(date + "T00:00:00+09:00") + 2 * 86400000;
}
export function classifyPunchDay(input: {
  date: string;
  punches: KotTransformPunch[];
  isOffice: boolean;
  pending: boolean;
  now?: number;
}) {
  const transformed = transformDayPunches(input);
  const complete =
    input.punches.some((row) => row.punch_type === "clock_in") &&
    input.punches.some((row) => row.punch_type === "clock_out");
  const status = input.pending
    ? "pending"
    : (input.now ?? Date.now()) >= punchDeadline(input.date)
      ? "expired"
      : transformed.issues.length || !complete
        ? "needs_check"
        : "ready";
  const reason = input.pending
    ? "未承認の修正があります"
    : status === "expired"
      ? "KING OF TIME の画面で入力してください"
      : transformed.issues.map((row) => row.message).join("、") ||
        (!complete ? "出勤または退勤の打刻が足りません" : "");
  return { status, reason, transformed };
}
export const punchCodes = {
  clock_in: "1",
  clock_out: "2",
  break_start: "3",
  break_end: "4",
};
export function kotTimestamp(iso: string) {
  return (
    new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 16) +
    ":00+09:00"
  );
}
