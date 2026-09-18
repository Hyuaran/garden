import { isJapaneseHoliday } from "@/app/system/kanri/_lib/jp-holidays";
import type { KotDailyRow } from "@/app/system/kanri/_lib/kot-daily";

// 新人チーム＝チームに所属する前の新人（2026-09-19 東海林さん）。石原チームの次に出す
export const SHUKKIN_GROUPS = ["訪販社員", "ＢＹ", "テレマ社員", "宮永チーム", "小泉チーム", "石原チーム", "新人チーム"] as const;
export type ShukkinGroup = (typeof SHUKKIN_GROUPS)[number];

export type ShukkinMember = {
  employeeNumber: string;
  name: string;
  displayName?: string;
  groupName: ShukkinGroup;
  sortOrder: number;
  active?: boolean;
};

export type ShukkinPlanFields = {
  hyuaran: string;
  interview: string;
  training: string;
  ueda: string;
  afterConfirm: string;
};

export type ShukkinIssueSummary = {
  missingInKot: ShukkinMember[];
  missingInOrder: KotDailyRow[];
};

export type LineShiftBlock = {
  shift: string;
  people: ShukkinMember[];
  message: string;
};

const REST_KINDS = new Set(["定休", "公休", "欠勤", "有給", "退職"]);
// LINE のシフト連絡の対象＝アルバイト全員（3 チーム＋新人チーム）。社員の区分は出さない
const TEAM_GROUPS = new Set<ShukkinGroup>(["宮永チーム", "小泉チーム", "石原チーム", "新人チーム"]);
// KOT の雇用区分の値そのまま（スペースなし・2026-09 の実データで確認）
export const SHUKKIN_MISSING_ORDER_EXCLUDED_EMPLOYMENT_KINDS = ["SES事業部"] as const;
const MISSING_ORDER_EXCLUDED_EMPLOYMENT_KINDS = new Set<string>(SHUKKIN_MISSING_ORDER_EXCLUDED_EMPLOYMENT_KINDS);
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export const DEFAULT_PLAN_FIELDS: ShukkinPlanFields = {
  hyuaran: "なし",
  interview: "なし",
  training: "なし",
  ueda: "なし",
  afterConfirm: "なし",
};

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function weekdayLabel(date: string) {
  return WEEKDAYS[parseDate(date).getUTCDay()];
}

export function slashDate(date: string) {
  return date.replace(/-/g, "/");
}

export function compactSlashDate(date: string) {
  const [, month, day] = date.split("-");
  return `${month}/${day}`;
}

export function isWeekendOrHoliday(date: string) {
  const day = parseDate(date).getUTCDay();
  return day === 0 || day === 6 || isJapaneseHoliday(date);
}

export function normalizeEmployeeNumber(value: string | number | null | undefined) {
  return String(value ?? "").trim().padStart(4, "0");
}

export function formatFiveCharName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name.trim();
  const family = parts[0];
  const given = parts.slice(1).join("");
  const missing = Math.max(0, 5 - (family.length + given.length));
  return `${family}${"　".repeat(missing)}${given}`;
}

// 名前は Garden の従業員名簿を優先（東海林さん 2026-09-19：改姓が名簿に未反映でも名簿の表記でよい）。
// 名簿に無い人（派遣・外注で未登録）だけ KOT の名前、それも無ければ足したときの名前
export function resolvedMemberName(member: ShukkinMember, row?: KotDailyRow) {
  return member.name.trim() || row?.name.trim() || member.displayName?.trim() || member.employeeNumber;
}

function minutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeForShift(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = match[1].padStart(2, "0");
  return match[2] === "00" ? hour : `${hour}:${match[2]}`;
}

function fullWidthTime(value: string) {
  return value.replace(":", "：");
}

export function shiftLabel(row: KotDailyRow) {
  const start = timeForShift(row.plannedClockIn);
  const end = timeForShift(row.plannedClockOut);
  return start && end ? `${start}-${end}` : "";
}

function hasPlan(row: KotDailyRow | undefined) {
  if (!row) return false;
  if (REST_KINDS.has(row.workdayKind)) return false;
  return Boolean(row.plannedClockIn && row.plannedClockOut);
}

function shukkinShift(row: KotDailyRow | undefined, groupName: ShukkinGroup) {
  if (!row) return groupName === "ＢＹ" ? "公休" : "×";
  // ＢＹは予定の無い日を「公休」と出す（有給など休みの種類が入っていればその文字）。
  // 実物の KOT では休みの日の勤務日種別が空欄・「平日」のことがある（2026-09-19 の実データで確認）
  if (!hasPlan(row)) {
    if (groupName !== "ＢＹ") return "×";
    return REST_KINDS.has(row.workdayKind) ? row.workdayKind : "公休";
  }
  return shiftLabel(row) || "×";
}

function confirmationMark(row: KotDailyRow | undefined, tableTime: "10:00" | "14:00") {
  if (!row || !hasPlan(row)) return "";
  const planned = minutes(row.plannedClockIn);
  const table = minutes(tableTime);
  if (planned === null || table === null || planned > table) return "";
  const punchedText = row.clockIn || row.roundedClockIn;
  const punched = punchedText ? minutes(punchedText) : null;
  if (punched === null) return "※不明/打刻漏れの可能性";
  if (punched <= planned) return "○";
  return `※${fullWidthTime(punchedText)}打刻`;
}

function rowsByNumber(rows: KotDailyRow[], date: string) {
  const map = new Map<string, KotDailyRow>();
  rows.filter((row) => row.date === date).forEach((row) => map.set(normalizeEmployeeNumber(row.employeeCode), row));
  return map;
}

function activeMembers(members: ShukkinMember[]) {
  return members
    .filter((member) => member.active !== false)
    .slice()
    .sort((a, b) => SHUKKIN_GROUPS.indexOf(a.groupName) - SHUKKIN_GROUPS.indexOf(b.groupName) || a.sortOrder - b.sortOrder);
}

export function summarizeKotCoverage(input: { rows: KotDailyRow[]; members: ShukkinMember[]; date: string }): ShukkinIssueSummary {
  const byNumber = rowsByNumber(input.rows, input.date);
  const ordered = activeMembers(input.members);
  const memberNumbers = new Set(ordered.map((member) => member.employeeNumber));
  return {
    missingInKot: ordered.filter((member) => !byNumber.has(member.employeeNumber)),
    missingInOrder: input.rows.filter((row) => row.date === input.date
      && !memberNumbers.has(normalizeEmployeeNumber(row.employeeCode))
      && !MISSING_ORDER_EXCLUDED_EMPLOYMENT_KINDS.has(row.employmentKind)),
  };
}

export function buildAttendanceMessage(input: {
  rows: KotDailyRow[];
  members: ShukkinMember[];
  date: string;
  tableTime: "10:00" | "14:00";
  withConfirmation: boolean;
  planFields?: Partial<ShukkinPlanFields>;
}) {
  const byNumber = rowsByNumber(input.rows, input.date);
  const lines = [`【出勤表】${slashDate(input.date)}（${weekdayLabel(input.date)}）${fullWidthTime(input.tableTime)}`];
  const members = activeMembers(input.members);

  SHUKKIN_GROUPS.forEach((groupName) => {
    const groupMembers = members.filter((member) => member.groupName === groupName);
    if (groupMembers.length === 0) return;
    lines.push("", `＜${groupName}＞`);
    groupMembers.forEach((member) => {
      const row = byNumber.get(member.employeeNumber);
      const mark = input.withConfirmation ? confirmationMark(row, input.tableTime) : "";
      lines.push(`(${formatFiveCharName(resolvedMemberName(member, row))})${shukkinShift(row, groupName)}　${mark}`);
    });
  });

  const plans = { ...DEFAULT_PLAN_FIELDS, ...(input.planFields ?? {}) };
  [
    ["ヒュアラン予定", plans.hyuaran],
    ["面接予定", plans.interview],
    ["研修予定", plans.training],
    ["上田予定", plans.ueda],
    ["後確予定", plans.afterConfirm],
  ].forEach(([title, body]) => {
    lines.push("", `【${title}】`, body.trim() || "なし");
  });

  return lines.join("\n");
}

function shiftSortValue(shift: string) {
  const [start, end] = shift.split("-");
  return [(minutes(start.includes(":") ? start : `${start}:00`) ?? 9999), (minutes(end.includes(":") ? end : `${end}:00`) ?? 9999)];
}

export function buildLineShiftBlocks(input: { rows: KotDailyRow[]; members: ShukkinMember[]; date: string }): LineShiftBlock[] {
  const byNumber = rowsByNumber(input.rows, input.date);
  const buckets = new Map<string, ShukkinMember[]>();
  activeMembers(input.members)
    .filter((member) => TEAM_GROUPS.has(member.groupName))
    .forEach((member) => {
      const row = byNumber.get(member.employeeNumber);
      if (!row || !hasPlan(row)) return;
      const shift = shiftLabel(row);
      if (!shift) return;
      buckets.set(shift, [...(buckets.get(shift) ?? []), member]);
    });

  return [...buckets.entries()]
    .sort(([a], [b]) => {
      const [as, ae] = shiftSortValue(a);
      const [bs, be] = shiftSortValue(b);
      return as - bs || ae - be;
    })
    .map(([shift, people]) => {
      const dateLabel = `${compactSlashDate(input.date)}(${weekdayLabel(input.date)})`;
      // LINE の名前は姓と名の間を半角スペース 1 つに（Garden の登録は全角スペース）
      const personLines = people.map((person) => {
        const row = byNumber.get(person.employeeNumber);
        return `${person.employeeNumber} ${resolvedMemberName(person, row).trim().split(/\s+/).join(" ")}`;
      });
      const message = [
        shift,
        ...personLines,
        "",
        "お疲れ様です！！",
        `明日【${dateLabel}】は`,
        `【${shift}】の勤務シフトです。`,
        "本日21時までに出勤確認の返信を必ず下さい。",
      ].join("\n");
      return { shift, people, message };
    });
}

export function defaultAttendanceTime(date: string, now = new Date()): "10:00" | "14:00" {
  if (!isWeekendOrHoliday(date)) return "14:00";
  const jstHour = Number(new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", hour12: false }).format(now));
  return jstHour < 12 ? "10:00" : "14:00";
}

export function nextDateWithPlan(rows: KotDailyRow[], fromDate: string) {
  const plannedDates = [...new Set(rows.filter(hasPlan).map((row) => row.date))].sort();
  return plannedDates.find((date) => date >= fromDate) ?? fromDate;
}
