import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import {
  calculateKotDailyImport,
  decodeKotDailyCsv,
  normalizeKotName,
  parseKotDailyCsv,
  parseKotDecimal,
  type KotDailyRow,
} from "./kot-daily";
import type { KanriPerson } from "./calc/jisseki-sheet";

const HEADERS = [
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
];

function csv(rows: string[][]) {
  return [HEADERS, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\r\n");
}

function person(name: string, department: string, employmentKind: "社員" | "アルバイト" | "派遣" = "アルバイト"): KanriPerson {
  return {
    name,
    kot_name: name.replace("　", " "),
    team: department,
    department,
    employment_kind: employmentKind,
    base_wage: employmentKind === "アルバイト" ? 1400 : null,
    is_field_sales: false,
    active: true,
    sort_order: 10,
  };
}

function row(partial: Partial<KotDailyRow>): KotDailyRow {
  return {
    employeeCode: partial.employeeCode ?? "001",
    employmentKind: partial.employmentKind ?? "アルバイト",
    name: partial.name ?? "山田 花子",
    date: partial.date ?? "2026-09-01",
    workdayKind: partial.workdayKind ?? "平日",
    patternName: partial.patternName ?? "14-21",
    plannedClockIn: partial.plannedClockIn ?? "14:00",
    plannedClockOut: partial.plannedClockOut ?? "21:00",
    roundedClockIn: partial.roundedClockIn ?? "14:00",
    roundedClockOut: partial.roundedClockOut ?? "21:00",
    clockIn: partial.clockIn ?? "14:00",
    clockOut: partial.clockOut ?? "21:00",
    breakHours: partial.breakHours ?? 0,
    plannedHours: partial.plannedHours ?? 7,
    actualHours: partial.actualHours ?? 7,
    scheduledHours: partial.scheduledHours ?? 7,
    lateHours: partial.lateHours ?? 0,
    earlyLeaveHours: partial.earlyLeaveHours ?? 0,
    varianceHours: partial.varianceHours ?? 0,
    payload: {},
  };
}

describe("KOT daily import", () => {
  it("decodes cp932 and parses the fixed layout", () => {
    const text = csv([["001", "アルバイト", "山田 花子", "2026/09/01", "平日", "14-21", "14:00", "21:00", "14:00", "21:00", "14:00", "21:00", "0.00", "7.00", "7:06", "7.00", "0.00", "0.00", "0.06"]]);
    const decoded = decodeKotDailyCsv(iconv.encode(text, "cp932"));
    const rows = parseKotDailyCsv(decoded);

    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-09-01");
    expect(rows[0].actualHours).toBe(7.06);
  });

  it("treats dot and colon as decimal separators", () => {
    expect(parseKotDecimal("7.06")).toBe(7.06);
    expect(parseKotDecimal("7:06")).toBe(7.06);
    expect(parseKotDecimal("")).toBe(0);
  });

  it("normalizes name spacing", () => {
    expect(normalizeKotName("山田　花子")).toBe(normalizeKotName("山田 花子"));
  });

  it("counts leaders and configured dispatch workers in team hours", () => {
    const result = calculateKotDailyImport({
      rows: [
        row({ name: "責任者 太郎", plannedHours: 5 }),
        row({ name: "派遣 一子", plannedHours: 6 }),
        row({ name: "派遣 二子", plannedHours: 8 }),
      ],
      people: [
        person("責任者　太郎", "Aチーム", "社員"),
        person("派遣　一子", "Aチーム", "派遣"),
        person("派遣　二子", "Aチーム", "派遣"),
      ],
      currentInputs: { hoursByTeamByDate: {}, openRateByTeamByProduct: {} },
      includeDispatchNames: ["派遣 一子"],
      importedAt: "2026-09-01T00:00:00.000Z",
    });

    expect(result.inputs.hoursByTeamByDate.Aチーム["2026-09-01"]).toBe(11);
  });

  it("calculates landing hours from actual days plus later planned days", () => {
    const result = calculateKotDailyImport({
      rows: [
        row({ name: "山田 花子", date: "2026-09-01", actualHours: 6, plannedHours: 7 }),
        row({ name: "山田 花子", date: "2026-09-02", actualHours: 0, plannedHours: 7, roundedClockIn: "", clockIn: "" }),
      ],
      people: [person("山田　花子", "Aチーム")],
      currentInputs: { hoursByTeamByDate: {}, openRateByTeamByProduct: {} },
      actualThroughDate: "2026-09-01",
      importedAt: "2026-09-01T00:00:00.000Z",
    });

    expect(result.inputs.personMonthly?.["山田　花子"]?.workHours).toBe(6);
    expect(result.inputs.personMonthly?.["山田　花子"]?.workDays).toBe(1);
    expect(result.inputs.personMonthly?.["山田　花子"]?.landingHours).toBe(13);
  });

  it("finds the four attendance checks", () => {
    const result = calculateKotDailyImport({
      rows: [
        row({ name: "山田 花子", lateHours: 0.1, roundedClockIn: "14:06" }),
        row({ name: "山田 花子", earlyLeaveHours: 0.2, roundedClockOut: "20:45" }),
        row({ name: "山田 花子", patternName: "公休", roundedClockIn: "14:00" }),
        row({ name: "山田 花子", patternName: "14-21", roundedClockIn: "", clockIn: "" }),
      ],
      people: [person("山田　花子", "Aチーム")],
      currentInputs: { hoursByTeamByDate: {}, openRateByTeamByProduct: {} },
      actualThroughDate: "2026-09-01",
      importedAt: "2026-09-01T00:00:00.000Z",
    });

    expect(result.summary.issueCounts).toEqual({
      遅刻: 1,
      早退: 1,
      予定なしの出勤: 1,
      予定ありで打刻なし: 1,
    });
  });
});

function fixtureDir() {
  return process.env.KANRI_FIXTURES_DIR;
}

function readJson(file: string) {
  const dir = fixtureDir();
  if (!dir) return null;
  const path = join(dir, file);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeDate(value: unknown) {
  return String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
}

function peopleFromSeed() {
  const seed = readFileSync("supabase/migrations/20260904000002_system_kanri_person.sql", "utf8");
  return [...seed.matchAll(/\('([^']+)', '([^']+)', '([^']+)', '([^']+)', '([^']+)', ([^,]+), (true|false)\)/g)].map((match, index) => ({
    name: match[1],
    kot_name: match[2],
    team: match[3],
    department: match[4],
    employment_kind: match[5],
    base_wage: match[6] === "null" ? null : Number(match[6]),
    is_field_sales: match[7] === "true",
    active: true,
    sort_order: (index + 1) * 10,
  } satisfies KanriPerson));
}

const hasFixtures = Boolean(fixtureDir()) && existsSync(String(fixtureDir()));

describe.skipIf(!hasFixtures)("KOT daily fixture", () => {
  it("matches at least 72 of 81 August team-day hour cells", () => {
    const dir = String(fixtureDir());
    const text = decodeKotDailyCsv(readFileSync(join(dir, "KOT_日別_Garden管理表ポータル_2026-08.csv")));
    const rows = parseKotDailyCsv(text);
    const expected = readJson("入力_管理表.json");
    if (!expected) throw new Error("fixtures_missing");

    const result = calculateKotDailyImport({
      rows,
      people: peopleFromSeed(),
      currentInputs: { hoursByTeamByDate: {}, openRateByTeamByProduct: {} },
      actualThroughDate: "2026-08-31",
      importedAt: "2026-09-07T00:00:00.000Z",
    });

    const teams = [
      { team: "宮永チーム", column: "I" },
      { team: "小泉チーム", column: "AF" },
      { team: "石原チーム", column: "BC" },
    ];
    const mismatches: string[] = [];
    let matches = 0;
    for (let rowNumber = 8; rowNumber <= 38; rowNumber += 1) {
      const date = normalizeDate(expected[`C${rowNumber}`]);
      if (!date || expected[`B${rowNumber}`] === "定休日") continue;
      teams.forEach(({ team, column }) => {
        const expectedValue = numberValue(expected[`${column}${rowNumber}`]);
        const actual = result.inputs.hoursByTeamByDate[team]?.[date] ?? 0;
        if (Math.abs(expectedValue - actual) < 0.01) matches += 1;
        else mismatches.push(`${date} ${team} expected=${expectedValue} actual=${actual}`);
      });
    }

    expect(result.inputs.hoursByTeamByDate["宮永チーム"]["2026-08-01"]).toBe(61);
    expect(result.inputs.hoursByTeamByDate["小泉チーム"]["2026-08-01"]).toBe(50);
    expect(result.inputs.hoursByTeamByDate["石原チーム"]["2026-08-01"]).toBe(34);
    expect(matches, `一致 ${matches}/81\n${mismatches.join("\n")}`).toBe(72);
    expect(mismatches.map((item) => item.replace(/ expected=.+$/, ""))).toEqual([
      "2026-08-02 宮永チーム",
      "2026-08-02 小泉チーム",
      "2026-08-03 小泉チーム",
      "2026-08-04 小泉チーム",
      "2026-08-08 宮永チーム",
      "2026-08-08 石原チーム",
      "2026-08-19 宮永チーム",
      "2026-08-19 石原チーム",
      "2026-08-23 小泉チーム",
    ]);
  });
});
