import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateKanriSheet, type KanriManualInputs, type KanriPointMaster, type KanriTeamMaster } from "./kanri-sheet";
import type { KanriSourceRow } from "../kanri-core";

type CellMap = Record<string, unknown>;

const PRODUCT_COLUMNS = ["L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD"];
const TEAM_BLOCKS = [
  { teamCell: "I2", hours: "I", openRateStart: "L" },
  { teamCell: "AF2", hours: "AF", openRateStart: "AI" },
  { teamCell: "BC2", hours: "BC", openRateStart: "BF" },
];
const CALC_COLUMNS = ["E", "F", "G", "I", "J", "K", ...PRODUCT_COLUMNS, "AF", "AG", "AH", ...PRODUCT_COLUMNS.map((column) => shiftColumn(column, 23)), "BC", "BD", "BE", ...PRODUCT_COLUMNS.map((column) => shiftColumn(column, 46))];
const FIXTURE_FILES = {
  kanri: "入力_管理表.json",
  kintone: "入力_Kintone.json",
  credit: "クレジットカード.json",
  points: "付与ポイント.json",
} as const;
const POINT_HEADER_BY_KANRI_PRODUCT: Record<string, string> = {
  JCB: "JCB Biz ONE",
  NL: "三井住友カード（NL）",
  SMCCAV: "三井住友ビジネスオーナーズ（SMCCAV）",
  セゾン: "セゾン（発行のみ）",
  ライフ: "ライフカードビジネスライト",
  UFJ: "三菱UFJニコス",
  ACマスター: "ACマスター",
  さすガねっと: "さすがネット",
};
const KINTONE_ALIASES_BY_KANRI_PRODUCT: Record<string, string[]> = {
  AU光: ["au光　Sonet", "au光　BIGLOBE", "au光"],
  Docomo光: ["docomo光"],
  JCB: ["JCB Biz ONE"],
  NL: ["三井住友カード（NL）"],
  SMCCAV: ["三井住友ビジネスオーナーズ（SMCCAV）"],
  セゾン: ["セゾン（発行のみ）"],
  ライフ: ["ライフカード", "ライフカードビジネスライト"],
  UFJ: ["三菱UFJニコス"],
  ACマスター: ["ACマスターカード"],
  さすガねっと: ["さすがネット"],
};

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

function columnToNumber(column: string) {
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

function shiftColumn(column: string, offset: number) {
  return numberToColumn(columnToNumber(column) + offset);
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return "";
  return value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function rowsFromSheet(sheet: CellMap, headerRow: number, firstDataRow: number, source: "kintone_customer" | "credit_card") {
  const headers = new Map<string, string>();
  Object.entries(sheet).forEach(([cell, value]) => {
    const match = cell.match(/^([A-Z]+)(\d+)$/);
    if (match?.[2] === String(headerRow) && value) headers.set(match[1], String(value));
  });
  const rowNumbers = new Set<number>();
  Object.keys(sheet).forEach((cell) => {
    const match = cell.match(/^[A-Z]+(\d+)$/);
    if (match && Number(match[1]) >= firstDataRow) rowNumbers.add(Number(match[1]));
  });
  return [...rowNumbers].sort((a, b) => a - b).map((rowNumber) => {
    const payload: Record<string, unknown> = {};
    headers.forEach((header, column) => {
      payload[header] = sheet[`${column}${rowNumber}`];
    });
    return { source, sourceApp: null, recordId: String(payload["レコード番号"] ?? rowNumber), payload } satisfies KanriSourceRow;
  });
}

function pointColumns(pointSheet: CellMap) {
  const columns = new Map<string, string>();
  for (let index = 2; index <= 21; index += 1) {
    const column = numberToColumn(index);
    const product = pointSheet[`${column}3`];
    if (product) columns.set(String(product), column);
  }
  return columns;
}

function productPoints(kanri: CellMap, pointSheet: CellMap): KanriPointMaster[] {
  const pointColumnByProduct = pointColumns(pointSheet);
  return PRODUCT_COLUMNS.map((column, index) => {
    const product = String(kanri[`${column}3`]);
    const pointHeader = POINT_HEADER_BY_KANRI_PRODUCT[product] ?? product;
    const pointColumn = pointColumnByProduct.get(pointHeader);
    if (!pointColumn) throw new Error(`point_master_missing: ${product} -> ${pointHeader}`);
    return {
      product,
      kintone_names: [...new Set([pointHeader, product, ...(KINTONE_ALIASES_BY_KANRI_PRODUCT[product] ?? [])])],
      category: index < 8 ? "hikari" : index < 15 ? "credit" : "other",
      coefficient: numberValue(pointSheet[`${pointColumn}4`]),
      unit_price: numberValue(pointSheet[`${pointColumn}5`]),
      sort_order: (index + 1) * 10,
    };
  });
}

function pointColumnForKanriProduct(kanriProduct: string, pointSheet: CellMap) {
  const pointHeader = POINT_HEADER_BY_KANRI_PRODUCT[kanriProduct] ?? kanriProduct;
  const column = pointColumns(pointSheet).get(pointHeader);
  if (!column) throw new Error(`point_master_missing: ${kanriProduct} -> ${pointHeader}`);
  return column;
}

function teamsFromKanri(kanri: CellMap): KanriTeamMaster[] {
  return TEAM_BLOCKS.map((block, index) => ({
    team: String(kanri[block.teamCell]),
    sort_order: (index + 1) * 10,
  }));
}

function manualInputs(kanri: CellMap, products: string[], teams: string[]): KanriManualInputs {
  const hoursByTeamByDate: KanriManualInputs["hoursByTeamByDate"] = {};
  const openRateByTeamByProduct: KanriManualInputs["openRateByTeamByProduct"] = {};
  teams.forEach((team, teamIndex) => {
    const block = TEAM_BLOCKS[teamIndex];
    hoursByTeamByDate[team] = {};
    openRateByTeamByProduct[team] = {};
    for (let row = 8; row <= 38; row += 1) {
      const date = normalizeDate(kanri[`C${row}`]);
      if (date) hoursByTeamByDate[team][date] = numberValue(kanri[`${block.hours}${row}`]);
    }
    products.forEach((product, productIndex) => {
      const column = shiftColumn(block.openRateStart, productIndex);
      openRateByTeamByProduct[team][product] = numberValue(kanri[`${column}2`]);
    });
  });
  return { hoursByTeamByDate, openRateByTeamByProduct };
}

function correctedAmountRow(cells: Record<string, unknown>, pointSheet: CellMap) {
  const sofbankUnitPrice = numberValue(pointSheet[`${pointColumnForKanriProduct("Sofbank光", pointSheet)}5`]);
  const acMasterUnitPrice = numberValue(pointSheet[`${pointColumnForKanriProduct("ACマスター", pointSheet)}5`]);
  for (const column of ["S", "AP", "BM"]) {
    cells[`${column}6`] = numberValue(cells[`${column}4`]) * numberValue(cells[`${column}2`]) * sofbankUnitPrice;
  }
  cells.BT6 = numberValue(cells.BT4) * numberValue(cells.BT2) * acMasterUnitPrice;

  for (const block of [
    { amountPerHour: "I6", amount: "K6", hours: "I5", first: "L", last: "AD" },
    { amountPerHour: "AF6", amount: "AH6", hours: "AF5", first: "AI", last: "BA" },
    { amountPerHour: "BC6", amount: "BE6", hours: "BC5", first: "BF", last: "BX" },
  ]) {
    let amount = 0;
    for (let index = columnToNumber(block.first); index <= columnToNumber(block.last); index += 1) {
      amount += numberValue(cells[`${numberToColumn(index)}6`]);
    }
    cells[block.amount] = amount;
    cells[block.amountPerHour] = amount / numberValue(cells[block.hours]);
  }
  cells.G6 = numberValue(cells.K6) + numberValue(cells.AH6) + numberValue(cells.BE6);
  cells.E6 = numberValue(cells.G6) / numberValue(cells.E5);
}

function expectedCells(kanri: CellMap, pointSheet: CellMap) {
  const cells: Record<string, unknown> = {};
  for (let row = 2; row <= 2; row += 1) CALC_COLUMNS.forEach((column) => { cells[`${column}${row}`] = kanri[`${column}${row}`]; });
  for (let row = 4; row <= 6; row += 1) CALC_COLUMNS.forEach((column) => { cells[`${column}${row}`] = kanri[`${column}${row}`]; });
  for (let row = 8; row <= 38; row += 1) CALC_COLUMNS.forEach((column) => { cells[`${column}${row}`] = kanri[`${column}${row}`]; });
  correctedAmountRow(cells, pointSheet);
  delete cells.BE5;
  delete cells.BD5;
  delete cells.F5;
  delete cells.G5;
  CALC_COLUMNS.forEach((column) => { delete cells[`${column}2`]; });
  return cells;
}

function equivalent(expected: unknown, actual: unknown) {
  if (expected === "#DIV/0!") return actual === null;
  if (expected === "" || expected === undefined) return actual === 0 || actual === null || actual === undefined;
  if (typeof expected === "number") return typeof actual === "number" && Math.abs(expected - actual) <= 1e-6;
  return expected === actual;
}

const hasFixtures = Boolean(fixtureDir()) && existsSync(String(fixtureDir()));

describe.skipIf(!hasFixtures)("kanri sheet golden fixture", () => {
  it("matches the 2026-08-31 Excel calculated cells using point master rates only", () => {
    const kanri = readJson(FIXTURE_FILES.kanri);
    const kintone = readJson(FIXTURE_FILES.kintone);
    const credit = readJson(FIXTURE_FILES.credit);
    const pointSheet = readJson(FIXTURE_FILES.points);
    if (!kanri || !kintone || !credit || !pointSheet) throw new Error("fixtures_missing");

    const points = productPoints(kanri, pointSheet);
    const teams = teamsFromKanri(kanri);
    const grid = calculateKanriSheet({
      yearMonth: "2026-08",
      holidays: Array.from({ length: 31 }, (_, index) => index + 8)
        .filter((row) => kanri[`B${row}`] === "定休日")
        .map((row) => normalizeDate(kanri[`C${row}`])),
      sourceRows: [...rowsFromSheet(kintone, 2, 3, "kintone_customer"), ...rowsFromSheet(credit, 1, 2, "credit_card")],
      points,
      teams,
      manualInputs: manualInputs(kanri, points.map((point) => point.product), teams.map((team) => team.team)),
    });

    expect(points).toHaveLength(19);
    expect(points.find((point) => point.product === "Sofbank光")?.unit_price).toBe(30000);
    expect(points.find((point) => point.product === "ACマスター")?.unit_price).toBe(25000);

    const expected = expectedCells(kanri, pointSheet);
    const mismatches = Object.entries(expected)
      .filter(([cell, expectedValue]) => !equivalent(expectedValue, grid.cellValues[cell]))
      .map(([cell, expectedValue]) => `${cell}: expected=${JSON.stringify(expectedValue)} actual=${JSON.stringify(grid.cellValues[cell])}`);

    expect(mismatches, `一致 ${Object.keys(expected).length - mismatches.length}セル / 不一致 ${mismatches.length}セル\n${mismatches.join("\n")}`).toEqual([]);
  });
});
