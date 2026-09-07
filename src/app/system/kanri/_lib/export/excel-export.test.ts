import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildKanriWorkbook, writeKanriWorkbookBuffer, type KanriExcelResults } from "./excel-export";
import labels from "./template-labels.json";
import type { KanriPointMaster, KanriSheetGrid } from "../calc/kanri-sheet";
import type { JissekiSheetGrid } from "../calc/jisseki-sheet";
import type { AporanSheetGrid } from "../calc/aporan-sheet";
import type { HouhanSheetGrid } from "../calc/houhan-sheet";
import type { IncentiveSheetGrid } from "../calc/incentive-sheet";
import type { PayrollSheetGrid } from "../calc/payroll-sheet";

const points: KanriPointMaster[] = [
  { product: "商品A", kintone_names: ["商品A"], category: "hikari", coefficient: 1.2, unit_price: 30000, sort_order: 10, active: true },
  { product: "商品B", kintone_names: ["商品B"], category: "credit", coefficient: 0.5, unit_price: 10000, sort_order: 20, active: true },
];

const results: KanriExcelResults = {
  kanri: {
    yearMonth: "2026-08",
    products: ["商品A", "商品B"],
    teams: ["宮永チーム"],
    days: [],
    totals: {
      all: { hours: 10, efficiency: 1, total: 10, points: 12, amount: 1000, pointEfficiency: 1.2, amountPerHour: 100 },
      teams: {},
    },
    openRate: { 宮永チーム: { 商品A: 0.8, 商品B: 0.5 } },
    cellValues: { G5: 12, C8: "2026-08-01T00:00:00" },
  } as KanriSheetGrid,
  jisseki: { yearMonth: "2026-08", products: [], productColumns: [], rows: [], missingCommuteNames: [], cellValues: { I8: 51.1 } } as JissekiSheetGrid,
  aporan: { yearMonth: "2026-08", targetDate: "2026-08-31", teams: {}, teamOrder: [], ranking: [], cellValues: { D5: 51.1 } } as unknown as AporanSheetGrid,
  houhan: { yearMonth: "2026-08", products: [], weights: {}, people: [], cellValues: { B2: 7 } } as HouhanSheetGrid,
  incentive: { yearMonth: "2026-08", teams: {}, teamOrder: [], overall: {}, cellValues: { J18: 96000 } } as unknown as IncentiveSheetGrid,
  payroll: { yearMonth: "2026-08", settings: { baseWage: 1177, trainingWage: 1500 }, period: { start: "2026-08-01", end: "2026-08-31", scheduledPayDate: "2026-09-30" }, rows: [], cellValues: { W28: 195000, AB28: "2026-08-01" } } as PayrollSheetGrid,
};

describe("kanri Excel export", () => {
  it("creates six calculated sheets and the point sheet", () => {
    const workbook = buildKanriWorkbook({ run: { id: "run-1", target_date: "2026-08-31" }, results, points });

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "【入力】管理表",
      "【入力】実績管理",
      "【入力】アポラン",
      "【入力】訪問販売",
      "インセ計算",
      "【月1】給与計算用",
      "付与ポイント",
    ]);
    expect(workbook.getWorksheet("【入力】Kintone")).toBeUndefined();
    expect(workbook.getWorksheet("交通費")).toBeUndefined();
  });

  it("writes cell values to the same addresses and keeps dates as dates", async () => {
    const workbook = await loadWorkbook();

    expect(workbook.getWorksheet("【入力】管理表")?.getCell("G5").value).toBe(12);
    expect(workbook.getWorksheet("【入力】実績管理")?.getCell("I8").value).toBe(51.1);
    expect(workbook.getWorksheet("【入力】アポラン")?.getCell("D5").value).toBe(51.1);
    expect(workbook.getWorksheet("【入力】訪問販売")?.getCell("B2").value).toBe(7);
    expect(workbook.getWorksheet("インセ計算")?.getCell("J18").value).toBe(96000);
    expect(workbook.getWorksheet("【月1】給与計算用")?.getCell("W28").value).toBe(195000);
    expect(workbook.getWorksheet("【入力】管理表")?.getCell("C8").value).toBeInstanceOf(Date);
    expect(workbook.getWorksheet("【月1】給与計算用")?.getCell("AB28").value).toBeInstanceOf(Date);
  });

  it("writes point master products, coefficients, and unit prices", async () => {
    const sheet = (await loadWorkbook()).getWorksheet("付与ポイント");

    expect(sheet?.getCell("B3").value).toBe("商品A");
    expect(sheet?.getCell("B4").value).toBe(1.2);
    expect(sheet?.getCell("B5").value).toBe(30000);
    expect(sheet?.getCell("C3").value).toBe("商品B");
  });

  it("does not write formulas", async () => {
    const workbook = await loadWorkbook();
    const formulaCells: string[] = [];

    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          const value = cell.value;
          if (value && typeof value === "object" && "formula" in value) formulaCells.push(`${sheet.name}!${cell.address}`);
        });
      });
    });

    expect(formulaCells).toEqual([]);
  });

  it("does not keep personal static cells in the bundled labels", () => {
    const bundled = labels as Record<string, { static_cells: Record<string, unknown> }>;

    expect(Object.keys(bundled["【入力】実績管理"].static_cells).some((cell) => {
      const row = rowNumber(cell);
      const column = columnNumber(cell);
      return row >= 4 && column >= columnNumber("B") && column <= columnNumber("F");
    })).toBe(false);
    expect(Object.keys(bundled["【入力】アポラン"].static_cells).some((cell) => rowNumber(cell) >= 21)).toBe(false);
    expect(Object.keys(bundled["【月1】給与計算用"].static_cells).some((cell) => rowNumber(cell) >= 24)).toBe(false);
    expect(bundled["【入力】訪問販売"].static_cells.A1).toBeUndefined();
    expect(bundled["【入力】訪問販売"].static_cells.X1).toBeUndefined();
    expect(bundled["【入力】訪問販売"].static_cells.AU1).toBeUndefined();
  });
});

const fixtureDir = process.env.KANRI_FIXTURES_DIR;
const hasFixtures = Boolean(fixtureDir) && existsSync(String(fixtureDir));

describe.skipIf(!hasFixtures)("kanri Excel export golden fixture", () => {
  it("writes representative fixture cells to the same addresses", async () => {
    const fixtureResults: KanriExcelResults = {
      kanri: fixtureGrid("入力_管理表.json") as KanriSheetGrid,
      jisseki: fixtureGrid("入力_実績管理.json") as JissekiSheetGrid,
      aporan: fixtureGrid("入力_アポラン.json") as unknown as AporanSheetGrid,
      houhan: fixtureGrid("入力_訪問販売.json") as HouhanSheetGrid,
      incentive: fixtureGrid("インセ計算.json") as unknown as IncentiveSheetGrid,
      payroll: fixtureGrid("月1_給与計算用.json") as PayrollSheetGrid,
    };
    const pointSheet = readFixtureJson("付与ポイント.json");
    const fixturePoints = Array.from({ length: 20 }, (_, index) => {
      const column = numberToColumn(2 + index);
      return {
        product: String(pointSheet[`${column}3`] ?? ""),
        kintone_names: null,
        category: "fixture",
        coefficient: pointSheet[`${column}4`] as number | null,
        unit_price: pointSheet[`${column}5`] as number | null,
        sort_order: (index + 1) * 10,
        active: true,
      } satisfies KanriPointMaster;
    }).filter((point) => point.product);

    const buffer = await writeKanriWorkbookBuffer({
      run: { id: "fixture", target_date: "2026-08-31" },
      results: fixtureResults,
      points: fixturePoints,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expectCell(workbook, "【入力】管理表", "G5", fixtureResults.kanri.cellValues.G5);
    expectCell(workbook, "【入力】実績管理", "I8", fixtureResults.jisseki.cellValues.I8);
    expectCell(workbook, "【入力】アポラン", "D5", fixtureResults.aporan.cellValues.D5);
    expectCell(workbook, "【入力】訪問販売", "B2", fixtureResults.houhan.cellValues.B2);
    expectCell(workbook, "インセ計算", "J18", fixtureResults.incentive.cellValues.J18);
    expectCell(workbook, "【月1】給与計算用", "W28", fixtureResults.payroll.cellValues.W28);
  });
});

async function loadWorkbook() {
  const buffer = await writeKanriWorkbookBuffer({ run: { id: "run-1", target_date: "2026-08-31" }, results, points });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function rowNumber(cell: string) {
  return Number(cell.match(/\d+$/)?.[0] ?? 0);
}

function columnNumber(cellOrColumn: string) {
  const column = cellOrColumn.match(/^[A-Z]+/)?.[0] ?? "";
  return [...column].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function numberToColumn(value: number) {
  let number = value;
  let result = "";
  while (number > 0) {
    const mod = (number - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    number = Math.floor((number - mod) / 26);
  }
  return result;
}

function fixtureGrid(filename: string) {
  return { cellValues: readFixtureJson(filename) };
}

function readFixtureJson(filename: string) {
  return JSON.parse(readFileSync(join(String(fixtureDir), filename), "utf8")) as Record<string, number | string | null>;
}

function expectCell(workbook: ExcelJS.Workbook, sheetName: string, address: string, expected: unknown) {
  const actual = workbook.getWorksheet(sheetName)?.getCell(address).value;
  if (typeof expected === "number") expect(actual).toBeCloseTo(expected, 6);
  else if (typeof expected === "string" && expected.match(/^\d{4}-\d{2}-\d{2}T00:00:00$/)) expect(actual).toBeInstanceOf(Date);
  else expect(actual).toBe(expected ?? null);
}
