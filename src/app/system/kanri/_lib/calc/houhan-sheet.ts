import { fieldValue, monthRange, normalizeName, weekdayJa, type KanriSourceRow } from "../kanri-core";
import type { KanriPerson } from "./jisseki-sheet";
import type { KanriFieldSalesDayInput, KanriManualInputs } from "./kanri-sheet";

export type HouhanProduct = {
  key: string;
  label: string;
  sourceField?: string;
  manualKey?: "rental" | "sales";
  defaultWeight: number;
};

export type HouhanDayRow = {
  date: string;
  day: number;
  weekday: string;
  status: string;
  hours: number | null;
  products: Record<string, number | null>;
  actualCount: number | null;
  personalPoints: number | null;
  missingReport: boolean;
};

export type HouhanPersonResult = {
  personName: string;
  days: HouhanDayRow[];
  totals: {
    hours: number;
    actualCount: number;
    points: number;
    pointsByProduct: Record<string, number>;
    countsByProduct: Record<string, number>;
  };
};

export type HouhanSheetGrid = {
  yearMonth: string;
  products: HouhanProduct[];
  weights: Record<string, number>;
  people: HouhanPersonResult[];
  cellValues: Record<string, number | string | null>;
};

export type HouhanSheetInput = {
  yearMonth: string;
  sourceRows: KanriSourceRow[];
  people: KanriPerson[];
  manualInputs: KanriManualInputs;
};

export const HOUHAN_PRODUCTS: HouhanProduct[] = [
  { key: "奪還_なっとくプラン_なっとく電気", label: "なっとくプラン＋電気", sourceField: "奪還_なっとくプラン_なっとく電気", defaultWeight: 0.5 },
  { key: "奪還_なっとくプラン_なっとく電気BIZ", label: "同BIZ", sourceField: "奪還_なっとくプラン_なっとく電気BIZ", defaultWeight: 0.8 },
  { key: "奪還_なっとく電気", label: "なっとく電気", sourceField: "奪還_なっとく電気", defaultWeight: 0.3 },
  { key: "奪還_なっとく電気BIZ", label: "電気BIZ", sourceField: "奪還_なっとく電気BIZ", defaultWeight: 0.6 },
  { key: "奪還_ビジネス電灯", label: "ビジネス電灯", sourceField: "奪還_ビジネス電灯", defaultWeight: 0.6 },
  { key: "奪還_ビジネス動力_1", label: "動力", sourceField: "奪還_ビジネス動力_1", defaultWeight: 0.3 },
  { key: "奪還_eおとく", label: "eおとく", sourceField: "奪還_eおとく", defaultWeight: 0.3 },
  { key: "囲込_なっとくプラン", label: "囲込 なっとくプラン", sourceField: "囲込_なっとくプラン", defaultWeight: 0.2 },
  { key: "囲込_なっとくプラン_なっとく電気", label: "同＋電気", sourceField: "囲込_なっとくプラン_なっとく電気", defaultWeight: 0.4 },
  { key: "囲込_なっとくプラン_なっとく電気BIZ", label: "同＋電気BIZ", sourceField: "囲込_なっとくプラン_なっとく電気BIZ", defaultWeight: 0.4 },
  { key: "囲込_Eスマート", label: "Eスマート", sourceField: "囲込_Eスマート", defaultWeight: 0.2 },
  { key: "囲込_Eおとく_なっとく_なっとくBIZ", label: "Eおとくほか", sourceField: "囲込_Eおとく_なっとく_なっとくBIZ", defaultWeight: 0.2 },
  { key: "遠方手当", label: "遠方手当", sourceField: "travel_allowance", defaultWeight: 0.1 },
  { key: "レンタル", label: "レンタル", manualKey: "rental", defaultWeight: 1 },
  { key: "販売", label: "販売", manualKey: "sales", defaultWeight: 10 },
];

const FIRST_DATA_ROW = 4;
const TOTAL_ROW = 35;
const BLOCK_FIRST_COLUMNS = ["A", "X", "AU"] as const;

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
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

function daysInMonth(yearMonth: string) {
  const { end } = monthRange(`${yearMonth}-01`);
  return Number(end.slice(-2));
}

function active<T extends { active?: boolean | null }>(item: T) {
  return item.active !== false;
}

function sortByOrder<T extends { sort_order: number | null }>(items: T[]) {
  return [...items].sort((a, b) => (a.sort_order ?? 1000) - (b.sort_order ?? 1000));
}

function weightsFromInputs(inputs: KanriManualInputs) {
  const saved = inputs.fieldSales?.weights ?? inputs.monthlySettings?.fieldSalesWeights ?? {};
  return Object.fromEntries(HOUHAN_PRODUCTS.map((product) => {
    const value = saved[product.key];
    return [product.key, value === null || value === undefined || value === "" ? product.defaultWeight : toNumber(value)];
  }));
}

function personDayInput(inputs: KanriManualInputs, person: KanriPerson, date: string): KanriFieldSalesDayInput {
  return inputs.fieldSales?.byPerson?.[person.name]?.days?.[date]
    ?? inputs.fieldSales?.byPerson?.[person.kot_name ?? ""]?.days?.[date]
    ?? {};
}

function latestKandenRows(input: HouhanSheetInput) {
  const rows = new Map<string, KanriSourceRow>();
  input.sourceRows.filter((row) => row.source === "kanden_report").forEach((row) => {
    if (String(fieldValue(row.payload, "report_time") ?? "") !== "最終") return;
    const date = normalizeDate(fieldValue(row.payload, "work_date"));
    if (!date.startsWith(input.yearMonth)) return;
    const name = normalizeName(fieldValue(row.payload, "staff_name"));
    if (!name || !date) return;
    const key = `${name}\t${date}`;
    const current = rows.get(key);
    if (!current || toNumber(row.recordId) >= toNumber(current.recordId)) rows.set(key, row);
  });
  return rows;
}

function emptyProductValues(value: number | null) {
  return Object.fromEntries(HOUHAN_PRODUCTS.map((product) => [product.key, value]));
}

export function calculateHouhanSheet(input: HouhanSheetInput): HouhanSheetGrid {
  const weights = weightsFromInputs(input.manualInputs);
  const sourceByPersonDate = latestKandenRows(input);
  const people = sortByOrder(input.people.filter((person) => active(person) && Boolean(person.is_field_sales))).map((person) => {
    const totals = {
      hours: 0,
      actualCount: 0,
      points: 0,
      pointsByProduct: Object.fromEntries(HOUHAN_PRODUCTS.map((product) => [product.key, 0])),
      countsByProduct: Object.fromEntries(HOUHAN_PRODUCTS.map((product) => [product.key, 0])),
    };
    const normalizedPerson = normalizeName(person.name);
    const days = Array.from({ length: daysInMonth(input.yearMonth) }, (_, index) => {
      const day = index + 1;
      const date = `${input.yearMonth}-${String(day).padStart(2, "0")}`;
      const manual = personDayInput(input.manualInputs, person, date);
      const status = String(manual.status ?? "");
      const isWork = status === "出勤";
      const isZero = status === "ゼロ";
      const sourceRow = sourceByPersonDate.get(`${normalizedPerson}\t${date}`);
      const products = emptyProductValues(null);
      let actualCount: number | null = 0;
      let personalPoints: number | null = null;
      const hours: number | null = isWork || isZero ? toNumber(manual.hours === undefined || manual.hours === null || manual.hours === "" ? 7 : manual.hours) : null;

      if (isWork || isZero) {
        let activeActualCount = 0;
        let activePersonalPoints = 0;
        HOUHAN_PRODUCTS.forEach((product) => {
          const count = isZero
            ? 0
            : product.manualKey
              ? toNumber(manual[product.manualKey])
              : toNumber(sourceRow ? fieldValue(sourceRow.payload, product.sourceField ?? "") : 0);
          products[product.key] = count;
          activeActualCount += count;
          activePersonalPoints += count * weights[product.key];
          totals.countsByProduct[product.key] += count;
        });
        actualCount = activeActualCount;
        personalPoints = activePersonalPoints;
        totals.hours += hours ?? 0;
        totals.actualCount += activeActualCount;
        totals.points += activePersonalPoints;
      }

      return {
        date,
        day,
        weekday: weekdayJa(date),
        status,
        hours,
        products,
        actualCount,
        personalPoints,
        missingReport: isWork && !sourceRow,
      };
    });
    HOUHAN_PRODUCTS.forEach((product) => {
      totals.pointsByProduct[product.key] = totals.countsByProduct[product.key] * weights[product.key];
    });
    return { personName: person.name, days, totals };
  });

  const grid: HouhanSheetGrid = { yearMonth: input.yearMonth, products: HOUHAN_PRODUCTS, weights, people, cellValues: {} };
  grid.cellValues = houhanSheetCells(grid);
  return grid;
}

export function houhanSheetCells(grid: Omit<HouhanSheetGrid, "cellValues">) {
  const cells: Record<string, number | string | null> = {};
  grid.people.forEach((person, personIndex) => {
    const first = BLOCK_FIRST_COLUMNS[personIndex];
    if (!first) return;
    cells[`${first}1`] = `■${person.personName.replace(/\s+/g, "")}`;
    cells[`${offsetColumn(first, 1)}2`] = "実数";
    cells[`${offsetColumn(first, 3)}2`] = person.totals.points;
    grid.products.forEach((product, productIndex) => {
      cells[`${offsetColumn(first, 7 + productIndex)}3`] = grid.weights[product.key];
      cells[`${offsetColumn(first, 7 + productIndex)}${TOTAL_ROW}`] = person.totals.pointsByProduct[product.key];
    });
    cells[`${offsetColumn(first, 1)}${TOTAL_ROW}`] = person.totals.actualCount;
    cells[`${offsetColumn(first, 6)}${TOTAL_ROW}`] = person.totals.hours;
    person.days.forEach((day, dayIndex) => {
      const row = FIRST_DATA_ROW + dayIndex;
      cells[`${first}${row}`] = day.personalPoints;
      cells[`${offsetColumn(first, 1)}${row}`] = day.actualCount;
      cells[`${offsetColumn(first, 2)}${row}`] = day.personalPoints;
      cells[`${offsetColumn(first, 3)}${row}`] = `${day.date}T00:00:00`;
      cells[`${offsetColumn(first, 4)}${row}`] = day.weekday;
      cells[`${offsetColumn(first, 5)}${row}`] = day.status || null;
      cells[`${offsetColumn(first, 6)}${row}`] = day.hours;
      grid.products.forEach((product, productIndex) => {
        cells[`${offsetColumn(first, 7 + productIndex)}${row}`] = day.products[product.key];
      });
    });
  });
  return cells;
}
