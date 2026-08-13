import iconv from "iconv-lite";
import type { PunchType } from "@/app/system/_lib/attendance";

export type KotExportRow = {
  id: number;
  punch_type: PunchType;
  punched_at: string;
  root_employees: { name?: string | null; kot_employee_id?: string | null } | null;
};

const KOT_PUNCH_CODES: Record<PunchType, string> = {
  clock_in: "1",
  clock_out: "2",
  break_start: "3",
  break_end: "4",
};

export function toKotPunchCode(type: PunchType) {
  return KOT_PUNCH_CODES[type];
}

export function formatKotJstDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("打刻日時が不正です");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}`;
}

function csvField(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function buildKotCsvText(rows: KotExportRow[]) {
  return rows.map((row) => {
    const employeeCode = row.root_employees?.kot_employee_id?.trim();
    if (!employeeCode) throw new Error("従業員コード未設定の打刻が含まれています");
    if (!/^[A-Za-z0-9]{3,10}$/.test(employeeCode)) throw new Error(`KOT従業員コードの形式が不正です: ${employeeCode}`);
    const name = row.root_employees?.name?.trim() ?? "";
    return [employeeCode, name, toKotPunchCode(row.punch_type), formatKotJstDateTime(row.punched_at)]
      .map(csvField).join(",");
  }).join("\r\n") + (rows.length ? "\r\n" : "");
}

export function encodeKotCsv(rows: KotExportRow[]) {
  const text = buildKotCsvText(rows);
  const encoded = iconv.encode(text, "Shift_JIS");
  if (iconv.decode(encoded, "Shift_JIS") !== text) {
    throw new Error("Shift-JISで表現できない文字が含まれています");
  }
  return encoded;
}

export function getKotImportRange(now = new Date()) {
  const jstParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(jstParts.find((item) => item.type === type)?.value);
  const shiftMonths = (amount: number) => {
    const year = part("year");
    const monthIndex = part("month") - 1 + amount;
    const targetYear = year + Math.floor(monthIndex / 12);
    const targetMonth = ((monthIndex % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const asUtc = Date.UTC(targetYear, targetMonth, Math.min(part("day"), lastDay), part("hour"), part("minute"), part("second"), now.getUTCMilliseconds());
    return new Date(asUtc - 9 * 60 * 60 * 1000);
  };
  return { from: shiftMonths(-6).toISOString(), to: shiftMonths(1).toISOString() };
}
