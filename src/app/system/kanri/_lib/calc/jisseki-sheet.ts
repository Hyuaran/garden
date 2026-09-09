import { fieldValue, normalizeName, type KanriSourceRow } from "../kanri-core";
import type { HouhanSheetGrid } from "./houhan-sheet";
import type { KanriManualInputs, KanriPointMaster } from "./kanri-sheet";

export type KanriPerson = {
  id?: string;
  name: string;
  kot_name: string | null;
  team: string;
  department: string;
  employment_kind: "社員" | "アルバイト" | "派遣" | string;
  base_wage: number | string | null;
  is_field_sales: boolean | null;
  active?: boolean | null;
  sort_order: number | null;
};

export type JissekiProductColumn = {
  product: string;
  kind: "hikari_toss" | "hikari_ap" | "single";
  label: string;
};

export type JissekiRow = {
  personName: string;
  kotName: string;
  wageLabel: string | number;
  department: string;
  team: string;
  landingHours: number;
  workHours: number;
  totalPoints: number;
  efficiency: number;
  workDays: number;
  commuteDailyAllowance: number;
  missingCommute: boolean;
  counts: Record<string, number>;
};

export type JissekiSheetGrid = {
  yearMonth: string;
  products: string[];
  productColumns: JissekiProductColumn[];
  rows: JissekiRow[];
  missingCommuteNames: string[];
  cellValues: Record<string, number | string | null>;
};

export type JissekiSheetInput = {
  yearMonth: string;
  sourceRows: KanriSourceRow[];
  points: KanriPointMaster[];
  people: KanriPerson[];
  manualInputs: KanriManualInputs;
  commuteByName: Record<string, number | string | null>;
  houhan?: HouhanSheetGrid | null;
};

const CUSTOMER_DATE_FIELDS = ["実績日"];
const CUSTOMER_PRODUCT_FIELDS = ["商材名区分2"];
// トス名は Kintone 顧客一覧では「文字列__1行__46」（ラベル「トス名」）。「前確者名」は前確担当（責任者）なのでトスには使わない（2026-09-09 本番照合で判明）
const CUSTOMER_TOSS_FIELDS = ["トス名", "文字列__1行__46"];
const CUSTOMER_AP_FIELDS = ["AP名"];
const CREDIT_PRODUCT_FIELDS = ["ドロップダウン_12", "商材名区分2"];
const CREDIT_AP_FIELDS = ["AP名", "文字列__1行__6", "文字列__1行__3"];
const FIRST_DATA_ROW = 4;

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function sortByOrder<T extends { sort_order: number | null }>(items: T[]) {
  return [...items].sort((a, b) => (a.sort_order ?? 1000) - (b.sort_order ?? 1000));
}

function active<T extends { active?: boolean | null }>(item: T) {
  return item.active !== false;
}

function firstFieldValue(row: KanriSourceRow, fields: string[]) {
  for (const field of fields) {
    const value = fieldValue(row.payload, field);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return "";
}

function monthOf(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).match(/^(\d{4}-\d{2})-\d{2}/)?.[1] ?? "";
}

function productAliasMap(points: KanriPointMaster[]) {
  const aliases = new Map<string, string>();
  points.filter(active).forEach((point) => {
    aliases.set(point.product, point.product);
    (point.kintone_names ?? []).forEach((name) => aliases.set(name, point.product));
  });
  return aliases;
}

function productKind(point: KanriPointMaster, index: number) {
  const category = String(point.category ?? "").toLowerCase();
  if (category.includes("credit") || category.includes("クレ")) return "credit";
  if (category.includes("electric") || category.includes("電")) return "electric";
  if (category.includes("hikari") || category.includes("光")) return "hikari";
  if (index < 9) return "hikari";
  if (index < 16) return "credit";
  return "electric";
}

function productColumns(points: KanriPointMaster[]) {
  const columns: JissekiProductColumn[] = [];
  points.forEach((point, index) => {
    const kind = productKind(point, index);
    if (kind === "hikari") {
      columns.push({ product: point.product, kind: "hikari_toss", label: `${point.product} トス` });
      columns.push({ product: point.product, kind: "hikari_ap", label: "AP" });
    } else {
      columns.push({ product: point.product, kind: "single", label: point.product });
    }
  });
  return columns;
}

function addCount(counts: Map<string, number>, personName: unknown, product: string, suffix: string) {
  const person = normalizeName(personName);
  if (!person || !product) return;
  const key = `${person}\t${product}\t${suffix}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sourceCounts(input: JissekiSheetInput, points: KanriPointMaster[]) {
  const aliases = productAliasMap(points);
  const counts = new Map<string, number>();
  input.sourceRows.forEach((row) => {
    if (row.source === "kintone_customer") {
      if (monthOf(firstFieldValue(row, CUSTOMER_DATE_FIELDS)) !== input.yearMonth) return;
      const product = aliases.get(String(firstFieldValue(row, CUSTOMER_PRODUCT_FIELDS)));
      if (!product) return;
      const point = points.find((item) => item.product === product);
      const kind = point ? productKind(point, points.indexOf(point)) : "electric";
      if (kind === "hikari") {
        addCount(counts, firstFieldValue(row, CUSTOMER_TOSS_FIELDS), product, "toss");
        addCount(counts, firstFieldValue(row, CUSTOMER_AP_FIELDS), product, "ap");
      } else if (kind === "electric") {
        addCount(counts, firstFieldValue(row, CUSTOMER_TOSS_FIELDS), product, "single");
      }
    }
    if (row.source === "credit_card") {
      const product = aliases.get(String(firstFieldValue(row, CREDIT_PRODUCT_FIELDS)));
      if (!product) return;
      addCount(counts, firstFieldValue(row, CREDIT_AP_FIELDS), product, "single");
    }
  });
  return counts;
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

function columnFromM(index: number) {
  return numberToColumn(columnToNumber("M") + index);
}

function wageLabel(person: KanriPerson) {
  if (person.employment_kind === "社員") return "社員";
  if (person.employment_kind === "派遣") return "派遣";
  return toNumber(person.base_wage);
}

function commuteFor(person: KanriPerson, commuteByName: Record<string, number | string | null>) {
  const candidates = [person.name, person.kot_name ?? ""].map(normalizeName).filter(Boolean);
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(commuteByName, candidate)) return { value: toNumber(commuteByName[candidate]), found: true };
  }
  return { value: 0, found: false };
}

export function normalizeCommuteMap(rows: { name: string | null; commute_daily_allowance: number | string | null }[]) {
  return Object.fromEntries(rows.map((row) => [normalizeName(row.name), row.commute_daily_allowance]));
}

export function calculateJissekiSheet(input: JissekiSheetInput): JissekiSheetGrid {
  const points = sortByOrder(input.points.filter(active));
  const products = points.map((point) => point.product);
  const columns = productColumns(points);
  const counts = sourceCounts(input, points);
  const pointByProduct = new Map(points.map((point, index) => [point.product, { point, index }]));
  const commuteByName = Object.fromEntries(Object.entries(input.commuteByName).map(([name, value]) => [normalizeName(name), value]));
  const houhanByPerson = new Map((input.houhan?.people ?? []).map((person) => [normalizeName(person.personName), person]));

  const rows = sortByOrder(input.people.filter(active)).map((person) => {
    const monthly = input.manualInputs.personMonthly?.[person.name] ?? input.manualInputs.personMonthly?.[person.kot_name ?? ""] ?? {};
    const houhan = person.is_field_sales ? houhanByPerson.get(normalizeName(person.name)) : undefined;
    const nameKey = normalizeName(person.name);
    const landingHours = toNumber(monthly.landingHours);
    const workHours = houhan ? houhan.totals.hours : toNumber(monthly.workHours);
    const workDays = toNumber(monthly.workDays);
    const commute = commuteFor(person, commuteByName);
    const commuteDailyAllowance = commute.value;
    const rowCounts: Record<string, number> = {};
    let totalPoints = 0;

    columns.forEach((column) => {
      const suffix = column.kind === "hikari_toss" ? "toss" : column.kind === "hikari_ap" ? "ap" : "single";
      const key = `${column.product}:${suffix}`;
      const count = person.is_field_sales ? 0 : (counts.get(`${nameKey}\t${column.product}\t${suffix}`) ?? 0);
      rowCounts[key] = count;
      const point = pointByProduct.get(column.product)?.point;
      const coefficient = toNumber(point?.coefficient);
      if (column.kind === "hikari_toss") totalPoints += count * 0.2;
      else if (column.kind === "hikari_ap") totalPoints += count * (coefficient - 0.2);
      else totalPoints += count * coefficient;
    });

    if (person.is_field_sales) totalPoints = houhan ? houhan.totals.points : toNumber(monthly.fieldPoints);
    return {
      personName: person.name,
      kotName: person.kot_name ?? "",
      wageLabel: wageLabel(person),
      department: person.department,
      team: person.team,
      landingHours,
      workHours,
      totalPoints,
      efficiency: workHours === 0 ? 0 : totalPoints / workHours,
      workDays,
      commuteDailyAllowance,
      missingCommute: !commute.found,
      counts: rowCounts,
    };
  });

  const grid: JissekiSheetGrid = {
    yearMonth: input.yearMonth,
    products,
    productColumns: columns,
    rows,
    missingCommuteNames: rows.filter((row) => row.missingCommute).map((row) => row.personName),
    cellValues: {},
  };
  grid.cellValues = jissekiSheetCells(grid);
  return grid;
}

export function jissekiSheetCells(grid: Omit<JissekiSheetGrid, "cellValues">) {
  const cells: Record<string, number | string | null> = {};
  grid.rows.forEach((row, index) => {
    const excelRow = FIRST_DATA_ROW + index;
    cells[`B${excelRow}`] = row.personName;
    cells[`C${excelRow}`] = row.kotName;
    cells[`D${excelRow}`] = row.wageLabel;
    cells[`E${excelRow}`] = row.department;
    cells[`F${excelRow}`] = row.team;
    cells[`G${excelRow}`] = row.landingHours;
    cells[`H${excelRow}`] = row.workHours;
    cells[`I${excelRow}`] = row.totalPoints;
    cells[`J${excelRow}`] = row.efficiency;
    cells[`K${excelRow}`] = row.workDays;
    cells[`L${excelRow}`] = row.missingCommute ? null : row.commuteDailyAllowance;
    grid.productColumns.forEach((column, columnIndex) => {
      const suffix = column.kind === "hikari_toss" ? "toss" : column.kind === "hikari_ap" ? "ap" : "single";
      cells[`${columnFromM(columnIndex)}${excelRow}`] = row.counts[`${column.product}:${suffix}`] ?? 0;
    });
  });
  return cells;
}
