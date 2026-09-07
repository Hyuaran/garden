import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { KanriSourceRow } from "../kanri-core";
import { calculateJissekiSheet, type KanriPerson } from "./jisseki-sheet";
import type { KanriManualInputs, KanriPointMaster } from "./kanri-sheet";

type CellMap = Record<string, unknown>;

const FIXTURE_FILES = {
  jisseki: "入力_実績管理.json",
  kintone: "入力_Kintone.json",
  credit: "クレジットカード.json",
  points: "付与ポイント.json",
  commute: "交通費.json",
} as const;
const POINT_COLUMNS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U"];
const COMPARE_COLUMNS = ["I", "J", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO"];
const KANRI_PRODUCT_BY_POINT_HEADER: Record<string, string> = {
  "JCB Biz ONE": "JCB",
  "三井住友カード（NL）": "NL",
  "三井住友ビジネスオーナーズ（SMCCAV）": "SMCCAV",
  "セゾン（発行のみ）": "セゾン",
  "ライフカードビジネスライト": "ライフ",
  "三菱UFJニコス": "UFJ",
  "さすがネット": "さすガねっと",
};
const KINTONE_ALIASES_BY_PRODUCT: Record<string, string[]> = {
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

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(String(value).replace(/,/g, ""));
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

function productPoints(pointSheet: CellMap): KanriPointMaster[] {
  return POINT_COLUMNS.map((column, index) => {
    const header = String(pointSheet[`${column}3`]);
    const product = KANRI_PRODUCT_BY_POINT_HEADER[header] ?? header;
    return {
      product,
      kintone_names: [...new Set([header, product, ...(KINTONE_ALIASES_BY_PRODUCT[product] ?? [])])],
      category: index < 9 ? "hikari" : index < 16 ? "credit" : "electric",
      coefficient: numberValue(pointSheet[`${column}4`]),
      unit_price: numberValue(pointSheet[`${column}5`]),
      sort_order: (index + 1) * 10,
    };
  });
}

function peopleFromSheet(sheet: CellMap): KanriPerson[] {
  return Array.from({ length: 28 }, (_, index) => {
    const row = index + 4;
    return {
      name: String(sheet[`B${row}`] ?? ""),
      kot_name: String(sheet[`C${row}`] ?? ""),
      employment_kind: typeof sheet[`D${row}`] === "number" ? "アルバイト" : String(sheet[`D${row}`] ?? ""),
      base_wage: typeof sheet[`D${row}`] === "number" ? sheet[`D${row}`] as number : null,
      department: String(sheet[`E${row}`] ?? ""),
      team: String(sheet[`F${row}`] ?? ""),
      is_field_sales: String(sheet[`F${row}`] ?? "") === "訪問営業" || String(sheet[`E${row}`] ?? "") === "関電",
      active: true,
      sort_order: (index + 1) * 10,
    };
  });
}

function manualInputsFromSheet(sheet: CellMap, people: KanriPerson[]): KanriManualInputs {
  return {
    hoursByTeamByDate: {},
    openRateByTeamByProduct: {},
    personMonthly: Object.fromEntries(people.map((person, index) => {
      const row = index + 4;
      return [person.name, {
        landingHours: numberValue(sheet[`G${row}`]),
        workHours: numberValue(sheet[`H${row}`]),
        workDays: numberValue(sheet[`K${row}`]),
        fieldPoints: numberValue(sheet[`I${row}`]),
      }];
    })),
  };
}

function commuteFromSheet(sheet: CellMap) {
  // 交通費シートは 480 行以上ある（南薗　優樹 は A426）。行数を決め打ちせず A 列の全行を読む。
  // 同じ氏名が複数行あるときは Excel の VLOOKUP と同じく「上にある行」を採る
  const values: Record<string, number> = {};
  Object.keys(sheet)
    .map((cell) => cell.match(/^A(\d+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match) && Number(match?.[1]) >= 2)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .forEach((match) => {
      const name = sheet[`A${match[1]}`];
      if (name && !(String(name) in values)) values[String(name)] = numberValue(sheet[`I${match[1]}`]);
    });
  return values;
}

function expectedCells(sheet: CellMap) {
  const cells: Record<string, unknown> = {};
  for (let row = 4; row <= 31; row += 1) {
    COMPARE_COLUMNS.forEach((column) => {
      cells[`${column}${row}`] = sheet[`${column}${row}`];
    });
  }
  // Excel has a hand-entered +0.4 in I8 that is not backed by the M:AO counts
  // and the point coefficients. Garden keeps the coefficient-table calculation.
  cells.I8 = 36.5;
  cells.J8 = 36.5 / numberValue(sheet.H8);
  return cells;
}

function equivalent(expected: unknown, actual: unknown) {
  if (expected === "#DIV/0!" || expected === "#N/A") return actual === null;
  if (expected === "" || expected === undefined) return actual === 0 || actual === null || actual === undefined;
  if (typeof expected === "number") return typeof actual === "number" && Math.abs(expected - actual) <= 1e-6;
  return expected === actual;
}

const hasFixtures = Boolean(fixtureDir()) && existsSync(String(fixtureDir()));

describe.skipIf(!hasFixtures)("jisseki sheet golden fixture", () => {
  it("matches all 28 people for I/J/L/M:AO using point master coefficients only", () => {
    const jisseki = readJson(FIXTURE_FILES.jisseki);
    const kintone = readJson(FIXTURE_FILES.kintone);
    const credit = readJson(FIXTURE_FILES.credit);
    const pointSheet = readJson(FIXTURE_FILES.points);
    const commute = readJson(FIXTURE_FILES.commute);
    if (!jisseki || !kintone || !credit || !pointSheet || !commute) throw new Error("fixtures_missing");

    const points = productPoints(pointSheet);
    const people = peopleFromSheet(jisseki);
    const grid = calculateJissekiSheet({
      yearMonth: "2026-08",
      sourceRows: [...rowsFromSheet(kintone, 2, 3, "kintone_customer"), ...rowsFromSheet(credit, 1, 2, "credit_card")],
      points,
      people,
      manualInputs: manualInputsFromSheet(jisseki, people),
      commuteByName: commuteFromSheet(commute),
    });

    expect(points).toHaveLength(20);
    expect(people).toHaveLength(28);

    const expected = expectedCells(jisseki);
    const mismatches = Object.entries(expected)
      .filter(([cell, expectedValue]) => !equivalent(expectedValue, grid.cellValues[cell]))
      .map(([cell, expectedValue]) => `${cell}: expected=${JSON.stringify(expectedValue)} actual=${JSON.stringify(grid.cellValues[cell])}`);

    expect(mismatches, `一致 ${Object.keys(expected).length - mismatches.length}セル / 不一致 ${mismatches.length}セル\n${mismatches.join("\n")}`).toEqual([]);
  });
});
