import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AporanRankingRow, AporanSheetGrid } from "./aporan-sheet";
import type { JissekiRow, JissekiSheetGrid } from "./jisseki-sheet";
import type { KanriManualInputs } from "./kanri-sheet";
import { calculatePayrollSheet } from "./payroll-sheet";

type CellMap = Record<string, unknown>;

const PAYROLL_COLUMNS = [
  "B", "C", "D", "E", "F", "G", "H", "I", "J", "K",
  "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U",
  "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD",
] as const;

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
  if (value === null || value === undefined || value === "" || value === "#VALUE!" || value === "#N/A") return 0;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function nullableNumberValue(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "#VALUE!" || value === "#N/A") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function textValue(value: unknown) {
  return value === null || value === undefined || value === "#N/A" ? "" : String(value);
}

function dateOnly(value: unknown) {
  return String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? String(value ?? "");
}

function aporanGridFromSheet(sheet: CellMap): AporanSheetGrid {
  const ranking: AporanRankingRow[] = Array.from({ length: 28 }, (_, index) => {
    const row = index + 21;
    return {
      rank: numberValue(sheet[`B${row}`]),
      department: textValue(sheet[`C${row}`]),
      personName: textValue(sheet[`D${row}`]),
      status: textValue(sheet[`E${row}`]) || null,
      wageLabel: typeof sheet[`F${row}`] === "number" ? numberValue(sheet[`F${row}`]) : textValue(sheet[`F${row}`]),
      totalPoints: numberValue(sheet[`G${row}`]),
      workHours: numberValue(sheet[`H${row}`]),
      efficiency: numberValue(sheet[`I${row}`]),
      displayEfficiency: numberValue(sheet[`I${row}`]),
      landingHours: numberValue(sheet[`J${row}`]),
      digitalLanding: numberValue(sheet[`K${row}`]),
    };
  });
  return {
    yearMonth: "2026-08",
    targetDate: "2026-09-01",
    teamOrder: ["all", "miyanaga", "koizumi", "ishihara", "newcomer"],
    teams: {} as AporanSheetGrid["teams"],
    ranking,
    cellValues: {},
  };
}

function jissekiGridFromSheet(sheet: CellMap): JissekiSheetGrid {
  const rows: JissekiRow[] = Array.from({ length: 28 }, (_, index) => {
    const row = index + 4;
    const workHours = numberValue(sheet[`H${row}`]);
    const totalPoints = numberValue(sheet[`I${row}`]);
    return {
      personName: textValue(sheet[`B${row}`]),
      kotName: textValue(sheet[`C${row}`]),
      wageLabel: typeof sheet[`D${row}`] === "number" ? numberValue(sheet[`D${row}`]) : textValue(sheet[`D${row}`]),
      department: textValue(sheet[`E${row}`]),
      team: textValue(sheet[`F${row}`]),
      landingHours: numberValue(sheet[`G${row}`]),
      workHours,
      totalPoints,
      efficiency: workHours === 0 ? 0 : totalPoints / workHours,
      workDays: numberValue(sheet[`K${row}`]),
      commuteDailyAllowance: numberValue(sheet[`L${row}`]),
      missingCommute: false,
      counts: {},
    };
  });
  return { yearMonth: "2026-08", products: [], productColumns: [], rows, missingCommuteNames: [], cellValues: {} };
}

function manualInputsFromPayroll(sheet: CellMap): KanriManualInputs {
  const payrollByPerson: NonNullable<KanriManualInputs["payrollByPerson"]> = {};
  for (let row = 24; row <= 51; row += 1) {
    const name = textValue(sheet[`D${row}`]);
    payrollByPerson[name] = {
      nextStatus: textValue(sheet[`H${row}`]),
      wageAdjustment: numberValue(sheet[`I${row}`]),
      referralPoints: numberValue(sheet[`M${row}`]),
      trainingHours: numberValue(sheet[`Q${row}`]),
      hiringBonus: numberValue(sheet[`T${row}`]),
      talentReferralIncentive: numberValue(sheet[`U${row}`]),
      dealIncentive: numberValue(sheet[`V${row}`]),
    };
  }
  return {
    hoursByTeamByDate: {},
    openRateByTeamByProduct: {},
    monthlySettings: {
      payroll: {
        baseWage: nullableNumberValue(sheet.O23) ?? 1177,
        trainingWage: 1500,
      },
    },
    payrollByPerson,
  };
}

function expectedCells(sheet: CellMap) {
  const cells: Record<string, unknown> = {};
  for (let row = 24; row <= 51; row += 1) {
    PAYROLL_COLUMNS.forEach((column) => {
      cells[`${column}${row}`] = sheet[`${column}${row}`];
    });
    if (nullableNumberValue(sheet[`P${row}`]) === null) {
      cells[`W${row}`] = null;
    } else {
      cells[`W${row}`] = numberValue(sheet[`O${row}`])
        + numberValue(sheet[`P${row}`])
        + numberValue(sheet[`Q${row}`]) * 1500
        + numberValue(sheet[`R${row}`])
        + numberValue(sheet[`S${row}`])
        + numberValue(sheet[`T${row}`])
        + numberValue(sheet[`U${row}`])
        + numberValue(sheet[`V${row}`]);
    }
  }
  return cells;
}

function equivalent(expected: unknown, actual: unknown) {
  if (expected === "#VALUE!") return actual === null;
  if (expected === "#N/A") return actual === null || actual === 0;
  if (expected === "" || expected === undefined) return actual === "" || actual === 0 || actual === null || actual === undefined;
  if (typeof expected === "number") return typeof actual === "number" && Math.abs(expected - actual) <= 1e-6;
  if (typeof expected === "string" && /^-?\d+(\.\d+)?$/.test(expected)) return typeof actual === "number" && Math.abs(Number(expected) - actual) <= 1e-6;
  if (typeof actual === "string" && /^\d{4}-\d{2}-\d{2}$/.test(actual)) return dateOnly(expected) === actual;
  return expected === actual;
}

const hasFixtures = Boolean(fixtureDir()) && existsSync(String(fixtureDir()));

describe.skipIf(!hasFixtures)("payroll sheet golden fixture", () => {
  it("matches payroll rows with documented payout correction", () => {
    const payroll = readJson("月1_給与計算用.json");
    const aporan = readJson("入力_アポラン.json");
    const jisseki = readJson("入力_実績管理.json");
    if (!payroll || !aporan || !jisseki) throw new Error("fixtures_missing");

    const grid = calculatePayrollSheet({
      yearMonth: "2026-08",
      aporanGrid: aporanGridFromSheet(aporan),
      jissekiGrid: jissekiGridFromSheet(jisseki),
      manualInputs: manualInputsFromPayroll(payroll),
    });
    const expected = expectedCells(payroll);
    const mismatches = Object.entries(expected)
      .filter(([cell, expectedValue]) => !equivalent(expectedValue, grid.cellValues[cell]))
      .map(([cell, expectedValue]) => `${cell}: expected=${JSON.stringify(expectedValue)} actual=${JSON.stringify(grid.cellValues[cell])}`);

    expect(mismatches, `一致 ${Object.keys(expected).length - mismatches.length}セル / 不一致 ${mismatches.length}セル / 補正 W24:W51\n${mismatches.join("\n")}`).toEqual([]);
  });
});
