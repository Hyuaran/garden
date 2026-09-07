import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateAporanSheet } from "./aporan-sheet";
import type { JissekiRow, JissekiSheetGrid } from "./jisseki-sheet";
import type { KanriDayResult, KanriManualInputs, KanriSheetGrid, KanriTeamTotal } from "./kanri-sheet";

type CellMap = Record<string, unknown>;

const TEAM_COLUMNS = ["D", "E", "F", "G", "H"] as const;
const RANKING_COLUMNS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K"] as const;

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

function manualInputsFromAporan(sheet: CellMap): KanriManualInputs {
  return {
    hoursByTeamByDate: {},
    openRateByTeamByProduct: {},
    monthlySettings: {
      aporanTargets: {
        all: numberValue(sheet.D6),
        miyanaga: numberValue(sheet.E6),
        koizumi: numberValue(sheet.F6),
        ishihara: numberValue(sheet.G6),
        newcomer: numberValue(sheet.H6),
      },
    },
  };
}

function expectedCells(sheet: CellMap) {
  const cells: Record<string, unknown> = {};
  for (let row = 4; row <= 11; row += 1) {
    TEAM_COLUMNS.forEach((column) => {
      cells[`${column}${row}`] = sheet[`${column}${row}`];
    });
  }
  for (let row = 21; row <= 48; row += 1) {
    RANKING_COLUMNS.forEach((column) => {
      cells[`${column}${row}`] = sheet[`${column}${row}`];
    });
  }
  return cells;
}

function equivalent(expected: unknown, actual: unknown) {
  if (expected === "#DIV/0!" || expected === "#N/A") return actual === null;
  if (expected === "" || expected === undefined) return actual === 0 || actual === null || actual === undefined;
  if (typeof expected === "number") return typeof actual === "number" && Math.abs(expected - actual) <= 1e-6;
  return expected === actual;
}

const hasFixtures = Boolean(fixtureDir()) && existsSync(String(fixtureDir()));

describe.skipIf(!hasFixtures)("aporan sheet golden fixture", () => {
  it("matches team block and 28 ranking rows", () => {
    const aporan = readJson("入力_アポラン.json");
    const kanri = readJson("入力_管理表.json");
    const jisseki = readJson("入力_実績管理.json");
    if (!aporan || !kanri || !jisseki) throw new Error("fixtures_missing");

    const grid = calculateAporanSheet({
      yearMonth: "2026-08",
      targetDate: "2026-09-01",
      kanriGrid: kanriGridFromSheet(kanri),
      jissekiGrid: jissekiGridFromSheet(jisseki),
      manualInputs: manualInputsFromAporan(aporan),
    });
    const expected = expectedCells(aporan);
    const mismatches = Object.entries(expected)
      .filter(([cell, expectedValue]) => !equivalent(expectedValue, grid.cellValues[cell]))
      .map(([cell, expectedValue]) => `${cell}: expected=${JSON.stringify(expectedValue)} actual=${JSON.stringify(grid.cellValues[cell])}`);

    expect(mismatches, `一致 ${Object.keys(expected).length - mismatches.length}セル / 不一致 ${mismatches.length}セル\n${mismatches.join("\n")}`).toEqual([]);
  });
});
