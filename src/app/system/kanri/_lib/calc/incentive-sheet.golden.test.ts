import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AporanSheetGrid } from "./aporan-sheet";
import { calculateIncentiveSheet } from "./incentive-sheet";
import type { JissekiRow, JissekiSheetGrid } from "./jisseki-sheet";
import type { KanriDayResult, KanriManualInputs, KanriSheetGrid, KanriTeamTotal } from "./kanri-sheet";

type CellMap = Record<string, unknown>;

const TEAM_COLUMNS = ["J", "K"] as const;
const TEAM_ROWS = [3, 4, 5, 6, 7, 8, 10, 12, 13, 15, 16, 17, 18] as const;
const OVERALL_COLUMNS = ["C", "D", "E", "F", "G"] as const;

function fixtureDir() {
  return process.env.KANRI_FIXTURES_DIR;
}

function readJson(file: string) {
  const dir = fixtureDir();
  if (!dir) return null;
  const path = join(dir, file);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as CellMap;
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function nullableNumberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function dateValue(value: unknown, fallback: string) {
  return String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? fallback;
}

function emptyTeam(points: number): KanriTeamTotal {
  return {
    hours: 0,
    efficiency: null,
    total: 0,
    points,
    amount: 0,
    products: {},
    pointsByProduct: {},
    amountByProduct: {},
  };
}

function kanriGridFromSheet(sheet: CellMap): KanriSheetGrid {
  const teams = ["宮永チーム", "小泉チーム", "石原チーム"];
  const days: KanriDayResult[] = Array.from({ length: 31 }, (_, index) => {
    const row = index + 8;
    const fallback = `2026-08-${String(index + 1).padStart(2, "0")}`;
    const dayValue = sheet[`B${row}`];
    return {
      day: typeof dayValue === "number" ? dayValue : "定休日",
      date: dateValue(sheet[`C${row}`], fallback),
      weekday: String(sheet[`D${row}`] ?? ""),
      all: { hours: 0, efficiency: null, total: 0 },
      teams: {},
    };
  });
  return {
    yearMonth: "2026-08",
    products: [],
    teams,
    days,
    totals: {
      all: { hours: 0, efficiency: null, total: 0, points: numberValue(sheet.G5), amount: 0, pointEfficiency: null, amountPerHour: null },
      teams: {
        宮永チーム: emptyTeam(numberValue(sheet.K5)),
        小泉チーム: emptyTeam(numberValue(sheet.AH5)),
        石原チーム: emptyTeam(numberValue(sheet.BE5)),
      },
    },
    openRate: {},
    cellValues: {},
  };
}

function aporanGridFromSheet(sheet: CellMap): AporanSheetGrid {
  const team = (key: "all" | "miyanaga" | "koizumi" | "ishihara" | "newcomer", label: string, actualPoints: number, landingHours: number) => ({
    key,
    label,
    actualPoints,
    targetPoints: 0,
    currentRequiredPoints: null,
    workHours: landingHours,
    landingHours,
    efficiency: landingHours === 0 ? null : actualPoints / landingHours,
    landingPoints: null,
    achievementRate: null,
  });
  return {
    yearMonth: "2026-08",
    targetDate: "2026-09-01",
    teamOrder: ["all", "miyanaga", "koizumi", "ishihara", "newcomer"],
    teams: {
      all: team("all", "テレマ全体", numberValue(sheet.D5), numberValue(sheet.D9)),
      miyanaga: team("miyanaga", "宮永チーム", numberValue(sheet.E5), numberValue(sheet.E9)),
      koizumi: team("koizumi", "小泉チーム", numberValue(sheet.F5), numberValue(sheet.F9)),
      ishihara: team("ishihara", "石原チーム", numberValue(sheet.G5), numberValue(sheet.G9)),
      newcomer: team("newcomer", "新人チーム", numberValue(sheet.H5), numberValue(sheet.H9)),
    },
    ranking: [],
    cellValues: {},
  };
}

function jissekiGridFromSheet(sheet: CellMap): JissekiSheetGrid {
  const rows: JissekiRow[] = Array.from({ length: 28 }, (_, index) => {
    const row = index + 4;
    const workHours = numberValue(sheet[`H${row}`]);
    const totalPoints = numberValue(sheet[`I${row}`]);
    return {
      personName: String(sheet[`B${row}`] ?? ""),
      kotName: String(sheet[`C${row}`] ?? ""),
      wageLabel: typeof sheet[`D${row}`] === "number" ? numberValue(sheet[`D${row}`]) : String(sheet[`D${row}`] ?? ""),
      department: String(sheet[`E${row}`] ?? ""),
      team: String(sheet[`F${row}`] ?? ""),
      landingHours: numberValue(sheet[`G${row}`]),
      workHours,
      totalPoints,
      efficiency: workHours === 0 ? 0 : totalPoints / workHours,
      workDays: numberValue(sheet[`K${row}`]),
      commuteDailyAllowance: 0,
      missingCommute: false,
      counts: {},
    };
  });
  return { yearMonth: "2026-08", products: [], productColumns: [], rows, missingCommuteNames: [], cellValues: {} };
}

function manualInputsFromIncentive(sheet: CellMap): KanriManualInputs {
  return {
    hoursByTeamByDate: {},
    openRateByTeamByProduct: {},
    monthlySettings: {
      incentive: {
        targetPoints: nullableNumberValue(sheet.J5),
        achievementBonusTotal: nullableNumberValue(sheet.F16),
        teamVictoryBonus: nullableNumberValue(sheet.J15),
      },
    },
  };
}

function expectedCells(sheet: CellMap, aporan: CellMap) {
  const cells: Record<string, unknown> = {};
  TEAM_COLUMNS.forEach((column) => {
    TEAM_ROWS.forEach((row) => {
      cells[`${column}${row}`] = sheet[`${column}${row}`];
    });
  });
  OVERALL_COLUMNS.forEach((column) => {
    cells[`${column}16`] = sheet[`${column}16`];
  });

  // Excel の小泉列 K4/K6 は宮永列を参照しているため、Garden では小泉チームの値に補正して比較する。
  cells.K4 = aporan.F9;
  cells.K6 = aporan.F5;
  cells.K7 = numberValue(aporan.F5) / numberValue(sheet.K5);
  cells.K8 = numberValue(aporan.F5) / numberValue(aporan.F9);
  // Excel の C16/D16 は宮永チームの着地予想hを参照しているため、Garden では全体の値に補正して比較する。
  cells.C16 = aporan.D9;
  cells.D16 = numberValue(sheet.E16) / numberValue(aporan.D9);
  return cells;
}

function equivalent(expected: unknown, actual: unknown) {
  if (expected === "#DIV/0!" || expected === "#N/A") return actual === null;
  if (expected === "" || expected === undefined) return actual === 0 || actual === null || actual === undefined;
  if (typeof expected === "number") return typeof actual === "number" && Math.abs(expected - actual) <= 1e-6;
  return expected === actual;
}

const hasFixtures = Boolean(fixtureDir()) && existsSync(String(fixtureDir()));

describe.skipIf(!hasFixtures)("incentive sheet golden fixture", () => {
  it("matches team block and overall cells with documented Excel reference corrections", () => {
    const incentive = readJson("インセ計算.json");
    const aporan = readJson("入力_アポラン.json");
    const kanri = readJson("入力_管理表.json");
    const jisseki = readJson("入力_実績管理.json");
    if (!incentive || !aporan || !kanri || !jisseki) throw new Error("fixtures_missing");

    const grid = calculateIncentiveSheet({
      yearMonth: "2026-08",
      kanriGrid: kanriGridFromSheet(kanri),
      aporanGrid: aporanGridFromSheet(aporan),
      jissekiGrid: jissekiGridFromSheet(jisseki),
      manualInputs: manualInputsFromIncentive(incentive),
    });
    const expected = expectedCells(incentive, aporan);
    const mismatches = Object.entries(expected)
      .filter(([cell, expectedValue]) => !equivalent(expectedValue, grid.cellValues[cell]))
      .map(([cell, expectedValue]) => `${cell}: expected=${JSON.stringify(expectedValue)} actual=${JSON.stringify(grid.cellValues[cell])}`);

    expect(mismatches, `一致 ${Object.keys(expected).length - mismatches.length}セル / 不一致 ${mismatches.length}セル / 補正 K4,K6,K7,K8,C16,D16\n${mismatches.join("\n")}`).toEqual([]);
  });
});
