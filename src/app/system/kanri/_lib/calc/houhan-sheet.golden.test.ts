import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { KanriSourceRow } from "../kanri-core";
import { calculateHouhanSheet, HOUHAN_PRODUCTS } from "./houhan-sheet";
import type { KanriPerson } from "./jisseki-sheet";
import type { KanriManualInputs } from "./kanri-sheet";

type CellMap = Record<string, unknown>;

const BLOCKS = [
  { title: "A1", totalActual: "B2", totalPoints: "D2", status: "F", hours: "G", firstProduct: "H" },
  { title: "X1", totalActual: "Y2", totalPoints: "AA2", status: "AC", hours: "AD", firstProduct: "AE" },
  { title: "AU1", totalActual: "AV2", totalPoints: "AX2", status: "AZ", hours: "BA", firstProduct: "BB" },
] as const;
const KANDEN_COLUMNS = ["F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"] as const;

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

function offsetColumn(first: string, offset: number) {
  return numberToColumn(columnToNumber(first) + offset);
}

function personName(value: unknown) {
  const text = String(value ?? "").replace(/^■/, "").replace(/\s+/g, "");
  if (text.length <= 2) return text;
  return `${text.slice(0, -2)}　${text.slice(-2)}`;
}

function sourceRowsFromKanden(sheet: CellMap): KanriSourceRow[] {
  const rowNumbers = new Set<number>();
  Object.keys(sheet).forEach((cell) => {
    const match = cell.match(/^[A-Z]+(\d+)$/);
    if (match && Number(match[1]) >= 2) rowNumbers.add(Number(match[1]));
  });
  return [...rowNumbers].sort((a, b) => a - b).map((rowNumber) => {
    const payload: Record<string, unknown> = {
      staff_name: sheet[`B${rowNumber}`],
      work_date: sheet[`C${rowNumber}`],
      report_time: sheet[`D${rowNumber}`],
    };
    HOUHAN_PRODUCTS.slice(0, 13).forEach((product, index) => {
      payload[product.sourceField ?? product.key] = sheet[`${KANDEN_COLUMNS[index]}${rowNumber}`];
    });
    return { source: "kanden_report", sourceApp: null, recordId: String(rowNumber), payload } satisfies KanriSourceRow;
  });
}

function manualInputsFromSheet(sheet: CellMap): { inputs: KanriManualInputs; people: KanriPerson[] } {
  const people = BLOCKS.map((block, index) => ({
    name: personName(sheet[block.title]),
    kot_name: personName(sheet[block.title]).replace("　", " "),
    team: "訪問営業",
    department: "関電",
    employment_kind: "社員",
    base_wage: null,
    is_field_sales: true,
    active: true,
    sort_order: (index + 1) * 10,
  }));
  const weights = Object.fromEntries(HOUHAN_PRODUCTS.map((product, index) => [
    product.key,
    numberValue(sheet[`${offsetColumn("H", index)}3`]),
  ]));
  const byPerson = Object.fromEntries(BLOCKS.map((block, index) => {
    const days: Record<string, { status?: string; hours?: number; rental?: number; sales?: number }> = {};
    for (let day = 1; day <= 31; day += 1) {
      const row = day + 3;
      const date = `2026-08-${String(day).padStart(2, "0")}`;
      const rawStatus = sheet[`${block.status}${row}`];
      const status = rawStatus === "●" ? "出勤" : rawStatus === "公休" ? "公休" : rawStatus === "ゼロ" ? "ゼロ" : "";
      days[date] = {
        status,
        hours: numberValue(sheet[`${block.hours}${row}`]),
        rental: numberValue(sheet[`${offsetColumn(block.firstProduct, 13)}${row}`]),
        sales: numberValue(sheet[`${offsetColumn(block.firstProduct, 14)}${row}`]),
      };
    }
    return [people[index].name, { days }];
  }));
  return {
    people,
    inputs: {
      hoursByTeamByDate: {},
      openRateByTeamByProduct: {},
      fieldSales: { weights, byPerson },
    },
  };
}

function expectedCells(sheet: CellMap) {
  const cells: Record<string, unknown> = {};
  BLOCKS.forEach((block) => {
    cells[block.totalActual] = sheet[block.totalActual];
    cells[block.totalPoints] = sheet[block.totalPoints];
    cells[`${block.hours}35`] = sheet[`${block.hours}35`];
    for (let row = 4; row <= 34; row += 1) {
      ["A", "B", "C"].forEach((relative) => {
        const column = offsetColumn(block.title.replace(/\d+$/, ""), columnToNumber(relative) - 1);
        cells[`${column}${row}`] = sheet[`${column}${row}`];
      });
      for (let index = 0; index < 13; index += 1) {
        const column = offsetColumn(block.firstProduct, index);
        cells[`${column}${row}`] = sheet[`${column}${row}`];
      }
    }
    for (let index = 0; index < 15; index += 1) {
      const column = offsetColumn(block.firstProduct, index);
      cells[`${column}35`] = sheet[`${column}35`];
    }
  });
  // The second block's left result column has no formula on the final day in the fixture.
  // Garden keeps the same row formula as the other days.
  cells.X34 = sheet.Z34;
  return cells;
}

function equivalent(expected: unknown, actual: unknown) {
  if (expected === "" || expected === undefined) return actual === null || actual === undefined || actual === 0;
  if (typeof expected === "number") return typeof actual === "number" && Math.abs(expected - actual) <= 1e-6;
  return expected === actual;
}

const hasFixtures = Boolean(fixtureDir()) && existsSync(String(fixtureDir()));

describe.skipIf(!hasFixtures)("houhan sheet golden fixture", () => {
  it("matches three field sales blocks without deriving coefficients from answers", () => {
    const kanden = readJson("関電貼り付け.json");
    const houhan = readJson("入力_訪問販売.json");
    if (!kanden || !houhan) throw new Error("fixtures_missing");

    const { inputs, people } = manualInputsFromSheet(houhan);
    const grid = calculateHouhanSheet({
      yearMonth: "2026-08",
      sourceRows: sourceRowsFromKanden(kanden),
      people,
      manualInputs: inputs,
    });
    const expected = expectedCells(houhan);
    const mismatches = Object.entries(expected)
      .filter(([cell, expectedValue]) => !equivalent(expectedValue, grid.cellValues[cell]))
      .map(([cell, expectedValue]) => `${cell}: expected=${JSON.stringify(expectedValue)} actual=${JSON.stringify(grid.cellValues[cell])}`);

    expect(grid.people).toHaveLength(3);
    expect(mismatches, `一致 ${Object.keys(expected).length - mismatches.length}セル / 不一致 ${mismatches.length}セル\n${mismatches.join("\n")}`).toEqual([]);
  });
});
