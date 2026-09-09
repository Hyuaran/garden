import iconv from "iconv-lite";
import { normalizeName, weekdayJa, type KanriSourceRow } from "./kanri-core";
import { isJapaneseHoliday } from "./jp-holidays";
import type {
  KanriKotDailyIssue,
  KanriKotDailyIssueKind,
  KanriKotDailySummary,
  KanriManualInputs,
} from "./calc/kanri-sheet";
import type { KanriPerson } from "./calc/jisseki-sheet";

export type KotDailyHoursBasis = "auto" | "plan" | "actual";

export type KotDailyRow = {
  employeeCode: string;
  employmentKind: string;
  name: string;
  date: string;
  workdayKind: string;
  patternName: string;
  plannedClockIn: string;
  plannedClockOut: string;
  roundedClockIn: string;
  roundedClockOut: string;
  clockIn: string;
  clockOut: string;
  breakHours: number;
  plannedHours: number;
  actualHours: number;
  scheduledHours: number;
  lateHours: number;
  earlyLeaveHours: number;
  varianceHours: number;
  payload: Record<string, string>;
};

export type KotDailyImportResult = {
  rows: KotDailyRow[];
  sourceRows: KanriSourceRow[];
  inputs: KanriManualInputs;
  summary: KanriKotDailySummary;
  issues: KanriKotDailyIssue[];
};

const REQUIRED_HEADERS = [
  "従業員コード",
  "雇用区分",
  "名前",
  "日時（曜日なし）",
  "勤務日種別",
  "パターン名",
  "出勤予定時刻(時刻のみ)",
  "退勤予定時刻(時刻のみ)",
  "出勤打刻(丸め)(時刻のみ)",
  "退勤打刻(丸め)(時刻のみ)",
  "出勤時刻(時刻のみ)",
  "退勤時刻(時刻のみ)",
  "休憩時間",
  "労働予定時間",
  "労働合計時間",
  "所定時間",
  "遅刻時間",
  "早退時間",
  "労働時間予実差異",
] as const;

const REST_PATTERNS = new Set(["定休", "公休", "欠勤", "有給", "退職"]);
const DEFAULT_INCLUDE_DISPATCH_NAMES = ["梶野 恵園"];

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.replace(/\r$/, ""));
}

function parseCsv(text: string) {
  return text.replace(/^\uFEFF/, "").split(/\n/).filter((line) => line.replace(/\r/g, "").length > 0).map(parseCsvLine);
}

export function decodeKotDailyCsv(bytes: Buffer | Uint8Array | ArrayBuffer) {
  const buffer = Buffer.isBuffer(bytes)
    ? bytes
    : bytes instanceof ArrayBuffer
      ? Buffer.from(bytes)
      : Buffer.from(Array.from(bytes));
  return iconv.decode(buffer, "cp932");
}

export function parseKotDecimal(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const number = Number(text.replace(":", ".").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

export function normalizeKotName(value: unknown) {
  return normalizeName(value);
}

function normalizeDate(value: string) {
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function minuteOfDay(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function hasPunch(row: KotDailyRow) {
  return Boolean(row.roundedClockIn || row.clockIn);
}

function hasShift(row: KotDailyRow) {
  return Boolean(row.patternName && !REST_PATTERNS.has(row.patternName));
}

function hasManualFieldSalesInput(fieldSales: KanriManualInputs["fieldSales"], personName: string, date: string) {
  const current = fieldSales?.byPerson?.[personName]?.days?.[date];
  return Boolean(current && Object.values(current).some((value) => value !== undefined && value !== null && value !== ""));
}

function isWeekendOrHoliday(row: KotDailyRow) {
  if (row.workdayKind && row.workdayKind !== "平日") return true;
  if (isJapaneseHoliday(row.date)) return true;
  return ["土", "日"].includes(weekdayJa(row.date));
}

// テレマの実績時間の数え方（東海林さん決定 2026-09-09）：
// 出勤は次の 30 分へ、退勤は前の 30 分へ丸め、平日は 14:00〜21:00・土日祝は 10:00〜21:00 の枠の中だけを数える。休憩は引く。
// 例：13:26〜21:02（平日）→ 14:00〜21:00 ＝ 7.0h、09:49〜21:00（平日）→ 14:00〜21:00 ＝ 7.0h、15:37〜21:03 → 16:00〜21:00 ＝ 5.0h
export function countedActualHours(row: KotDailyRow) {
  const clockIn = minuteOfDay(row.roundedClockIn || row.clockIn);
  const clockOut = minuteOfDay(row.roundedClockOut || row.clockOut);
  if (clockIn === null || clockOut === null) return 0;
  const windowStart = (isWeekendOrHoliday(row) ? 10 : 14) * 60;
  const windowEnd = 21 * 60;
  const start = Math.max(Math.ceil(clockIn / 30) * 30, windowStart);
  const end = Math.min(Math.floor(clockOut / 30) * 30, windowEnd);
  if (end <= start) return 0;
  return Math.max(0, Math.round((end - start) / 60 * 100) / 100 - row.breakHours);
}

function teamHours(row: KotDailyRow, hoursBasis: KotDailyHoursBasis, actualThroughDate: string) {
  if (hoursBasis === "actual") return countedActualHours(row);
  if (hoursBasis === "plan") return row.plannedHours;
  return row.date <= actualThroughDate ? countedActualHours(row) : row.plannedHours;
}

function diffMinutes(from: string, to: string) {
  const start = minuteOfDay(from);
  const end = minuteOfDay(to);
  if (start === null || end === null) return null;
  return end - start;
}

export function parseKotDailyCsv(text: string): KotDailyRow[] {
  const records = parseCsv(text);
  const headers = records[0] ?? [];
  const validLayout = REQUIRED_HEADERS.length === headers.length
    && REQUIRED_HEADERS.every((header, index) => headers[index] === header);
  if (!validLayout) throw new Error("kot_daily_layout_mismatch");

  return records.slice(1).map((cells) => {
    const payload = Object.fromEntries(REQUIRED_HEADERS.map((header, index) => [header, cells[index] ?? ""]));
    return {
      employeeCode: payload["従業員コード"],
      employmentKind: payload["雇用区分"],
      name: payload["名前"],
      date: normalizeDate(payload["日時（曜日なし）"]),
      workdayKind: payload["勤務日種別"],
      patternName: payload["パターン名"],
      plannedClockIn: payload["出勤予定時刻(時刻のみ)"],
      plannedClockOut: payload["退勤予定時刻(時刻のみ)"],
      roundedClockIn: payload["出勤打刻(丸め)(時刻のみ)"],
      roundedClockOut: payload["退勤打刻(丸め)(時刻のみ)"],
      clockIn: payload["出勤時刻(時刻のみ)"],
      clockOut: payload["退勤時刻(時刻のみ)"],
      breakHours: parseKotDecimal(payload["休憩時間"]),
      plannedHours: parseKotDecimal(payload["労働予定時間"]),
      actualHours: parseKotDecimal(payload["労働合計時間"]),
      scheduledHours: parseKotDecimal(payload["所定時間"]),
      lateHours: parseKotDecimal(payload["遅刻時間"]),
      earlyLeaveHours: parseKotDecimal(payload["早退時間"]),
      varianceHours: parseKotDecimal(payload["労働時間予実差異"]),
      payload,
    };
  }).filter((row) => row.name && row.date);
}

function personLookup(people: KanriPerson[]) {
  const byName = new Map<string, KanriPerson>();
  people.filter((person) => person.active !== false).forEach((person) => {
    byName.set(normalizeKotName(person.name), person);
    if (person.kot_name) byName.set(normalizeKotName(person.kot_name), person);
  });
  return byName;
}

function includedInTeamHours(person: KanriPerson, includeDispatchNames: string[]) {
  if (!person.department.endsWith("チーム")) return false;
  if (person.employment_kind === "派遣") {
    const included = new Set(includeDispatchNames.map(normalizeKotName));
    return included.has(normalizeKotName(person.kot_name ?? person.name));
  }
  return true;
}

function issueCounts(issues: KanriKotDailyIssue[]) {
  return {
    遅刻: issues.filter((issue) => issue.kind === "遅刻").length,
    早退: issues.filter((issue) => issue.kind === "早退").length,
    予定なしの出勤: issues.filter((issue) => issue.kind === "予定なしの出勤").length,
    予定ありで打刻なし: issues.filter((issue) => issue.kind === "予定ありで打刻なし").length,
  } satisfies Record<KanriKotDailyIssueKind, number>;
}

function buildIssues(rows: KotDailyRow[], byName: Map<string, KanriPerson>, lastDate: string) {
  const issues: KanriKotDailyIssue[] = [];
  rows.forEach((row) => {
    const person = byName.get(normalizeKotName(row.name));
    const team = person?.department ?? "";
    const planned = [row.plannedClockIn, row.plannedClockOut].filter(Boolean).join(" - ");
    const punched = [row.roundedClockIn || row.clockIn, row.roundedClockOut || row.clockOut].filter(Boolean).join(" - ");
    if (row.lateHours > 0) {
      const minutes = diffMinutes(row.plannedClockIn, row.roundedClockIn || row.clockIn);
      issues.push({ date: row.date, team, name: person?.name ?? row.name, kind: "遅刻", planned, punched, diffMinutes: minutes !== null && minutes > 0 ? minutes : null });
    }
    if (row.earlyLeaveHours > 0 || ((row.roundedClockOut || row.clockOut) && row.plannedClockOut && (diffMinutes(row.roundedClockOut || row.clockOut, row.plannedClockOut) ?? 0) > 0)) {
      const minutes = diffMinutes(row.roundedClockOut || row.clockOut, row.plannedClockOut);
      issues.push({ date: row.date, team, name: person?.name ?? row.name, kind: "早退", planned, punched, diffMinutes: minutes !== null && minutes > 0 ? minutes : null });
    }
    if (!hasShift(row) && hasPunch(row)) {
      issues.push({ date: row.date, team, name: person?.name ?? row.name, kind: "予定なしの出勤", planned: row.patternName || "予定なし", punched, diffMinutes: null });
    }
    if (hasShift(row) && !hasPunch(row) && row.date <= lastDate) {
      issues.push({ date: row.date, team, name: person?.name ?? row.name, kind: "予定ありで打刻なし", planned, punched: "打刻なし", diffMinutes: null });
    }
  });
  return issues;
}

export function calculateKotDailyImport(input: {
  rows: KotDailyRow[];
  people: KanriPerson[];
  currentInputs: KanriManualInputs;
  hoursBasis?: KotDailyHoursBasis;
  includeDispatchNames?: string[];
  actualThroughDate?: string;
  importedAt?: string;
}): KotDailyImportResult {
  const hoursBasis = input.hoursBasis ?? input.currentInputs.monthlySettings?.kot?.hoursBasis ?? "auto";
  const includeDispatchNames = input.includeDispatchNames
    ?? input.currentInputs.monthlySettings?.kot?.includeDispatchNames
    ?? DEFAULT_INCLUDE_DISPATCH_NAMES;
  const byName = personLookup(input.people);
  const dates = input.rows.map((row) => row.date).filter(Boolean).sort();
  const startDate = dates[0] ?? "";
  const endDate = dates[dates.length - 1] ?? "";
  const actualThroughDate = input.actualThroughDate ?? endDate;
  const missingNames = [...new Set(input.rows.map((row) => row.name).filter((name) => !byName.has(normalizeKotName(name))))].sort();

  const hoursByTeamByDate: KanriManualInputs["hoursByTeamByDate"] = { ...input.currentInputs.hoursByTeamByDate };
  const fieldSales: KanriManualInputs["fieldSales"] = {
    ...(input.currentInputs.fieldSales ?? {}),
    byPerson: { ...(input.currentInputs.fieldSales?.byPerson ?? {}) },
  };
  const teamSums = new Map<string, number>();
  const personMonthly = { ...(input.currentInputs.personMonthly ?? {}) };
  const personSums = new Map<string, { actual: number; days: Set<string>; futurePlan: number }>();

  input.people.filter((person) => person.active !== false).forEach((person) => {
    personSums.set(person.name, { actual: 0, days: new Set<string>(), futurePlan: 0 });
  });

  input.rows.forEach((row) => {
    const person = byName.get(normalizeKotName(row.name));
    if (!person) return;
    if (includedInTeamHours(person, includeDispatchNames)) {
      const key = `${person.department}\t${row.date}`;
      const hours = teamHours(row, hoursBasis, actualThroughDate);
      teamSums.set(key, (teamSums.get(key) ?? 0) + hours);
    }
    const hasManualSalesDay = hasManualFieldSalesInput(input.currentInputs.fieldSales, person.name, row.date)
      || Boolean(person.kot_name && hasManualFieldSalesInput(input.currentInputs.fieldSales, person.kot_name, row.date));
    if (person.is_field_sales && row.date <= actualThroughDate && !hasManualSalesDay) {
      if (hasShift(row) && (hasPunch(row) || row.plannedHours > 0)) {
        const currentPerson = fieldSales.byPerson?.[person.name] ?? {};
        const currentDays = currentPerson.days ?? {};
        fieldSales.byPerson = {
          ...(fieldSales.byPerson ?? {}),
          [person.name]: {
            ...currentPerson,
            days: {
              ...currentDays,
              [row.date]: { status: "出勤", hours: isWeekendOrHoliday(row) ? 11 : 7 },
            },
          },
        };
      }
    }
    const monthly = personSums.get(person.name);
    if (monthly) {
      if (row.date <= actualThroughDate) {
        monthly.actual += person.is_field_sales ? row.actualHours : countedActualHours(row);
        if (hasPunch(row)) monthly.days.add(row.date);
      } else {
        monthly.futurePlan += row.plannedHours;
      }
    }
  });

  const overwrittenCells: KanriKotDailySummary["overwrittenCells"] = [];
  teamSums.forEach((value, key) => {
    const [team, date] = key.split("\t");
    const next = Math.round(value * 100) / 100;
    const previous = input.currentInputs.hoursByTeamByDate[team]?.[date];
    if (previous !== undefined && Number(previous) !== next) overwrittenCells.push({ team, date, previous: Number(previous), next });
    hoursByTeamByDate[team] = { ...(hoursByTeamByDate[team] ?? {}), [date]: next };
  });

  personSums.forEach((value, personName) => {
    if (value.actual === 0 && value.days.size === 0 && value.futurePlan === 0) return;
    personMonthly[personName] = {
      ...(personMonthly[personName] ?? {}),
      workHours: Math.round(value.actual * 100) / 100,
      workDays: value.days.size,
      landingHours: Math.round((value.actual + value.futurePlan) * 100) / 100,
    };
  });

  const issues = buildIssues(input.rows, byName, actualThroughDate);
  const summary = {
    startDate,
    endDate,
    peopleCount: new Set(input.rows.map((row) => normalizeKotName(row.name)).filter(Boolean)).size,
    rowCount: input.rows.length,
    teamDayCount: teamSums.size,
    overwrittenCells,
    missingNames,
    issueCounts: issueCounts(issues),
    hoursBasis,
  } satisfies KanriKotDailySummary;

  const importedAt = input.importedAt ?? new Date().toISOString();
  return {
    rows: input.rows,
    sourceRows: input.rows.map((row) => ({
      source: "kot_daily",
      sourceApp: "Garden管理表ポータル（日）",
      recordId: `${row.employeeCode}-${row.date}`,
      payload: row.payload,
    })),
    inputs: {
      ...input.currentInputs,
      hoursByTeamByDate,
      personMonthly,
      fieldSales,
      monthlySettings: {
        ...(input.currentInputs.monthlySettings ?? {}),
        kot: { hoursBasis, includeDispatchNames },
      },
      kotDaily: { importedAt, summary, issues },
    },
    summary,
    issues,
  };
}

export function readKotDailyCsv(bytes: Buffer | Uint8Array | ArrayBuffer) {
  return parseKotDailyCsv(decodeKotDailyCsv(bytes));
}
