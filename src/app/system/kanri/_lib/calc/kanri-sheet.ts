import { fieldValue, monthRange, weekdayJa, type KanriSourceRow } from "../kanri-core";

export type KanriPointMaster = {
  product: string;
  kintone_names: string[] | null;
  category: string;
  coefficient: number | string | null;
  unit_price: number | string | null;
  sort_order: number | null;
  active?: boolean | null;
};

export type KanriTeamMaster = {
  team: string;
  sort_order: number | null;
  active?: boolean | null;
};

export type KanriManualInputs = {
  hoursByTeamByDate: Record<string, Record<string, number>>;
  openRateByTeamByProduct: Record<string, Record<string, number>>;
  unitPriceByTeamByProduct?: Record<string, Record<string, number>>;
};

export type KanriDayTeamResult = {
  hours: number;
  efficiency: number | null;
  total: number;
  products: Record<string, number>;
};

export type KanriDayResult = {
  day: number | "定休日";
  date: string;
  weekday: string;
  all: { hours: number; efficiency: number | null; total: number };
  teams: Record<string, KanriDayTeamResult>;
};

export type KanriTeamTotal = {
  hours: number;
  efficiency: number | null;
  total: number;
  points: number;
  amount: number;
  products: Record<string, number>;
  pointsByProduct: Record<string, number>;
  amountByProduct: Record<string, number>;
};

export type KanriSheetGrid = {
  yearMonth: string;
  products: string[];
  teams: string[];
  days: KanriDayResult[];
    totals: {
    all: { hours: number; efficiency: number | null; total: number; points: number; amount: number; pointEfficiency: number | null; amountPerHour: number | null };
    teams: Record<string, KanriTeamTotal>;
  };
  openRate: Record<string, Record<string, number>>;
  cellValues: Record<string, number | string | null>;
};

export type KanriSheetInput = {
  yearMonth: string;
  holidays: string[];
  sourceRows: KanriSourceRow[];
  points: KanriPointMaster[];
  teams: KanriTeamMaster[];
  manualInputs: KanriManualInputs;
};

export const KANRI_TEAM_BLOCKS = [
  { hours: "I", efficiency: "J", total: "K", firstProduct: "L" },
  { hours: "AF", efficiency: "AG", total: "AH", firstProduct: "AI" },
  { hours: "BC", efficiency: "BD", total: "BE", firstProduct: "BF" },
] as const;

const ALL_COLUMNS = { hours: "E", efficiency: "F", total: "G", amountPerPoint: "E", amount: "G" } as const;
const CREDIT_DATE_FIELDS = ["日付_4", "紹介日"];
const CREDIT_TEAM_FIELDS = ["文字列__1行__26", "チーム名"];
const CREDIT_PRODUCT_FIELDS = ["ドロップダウン_12", "商材名区分2"];
const CUSTOMER_DATE_FIELDS = ["実績日"];
const CUSTOMER_TEAM_FIELDS = ["チーム名"];
const CUSTOMER_PRODUCT_FIELDS = ["商材名区分2"];

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sortByOrder<T extends { sort_order: number | null }>(items: T[]) {
  return [...items].sort((a, b) => (a.sort_order ?? 1000) - (b.sort_order ?? 1000));
}

function active<T extends { active?: boolean | null }>(item: T) {
  return item.active !== false;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function firstFieldValue(row: KanriSourceRow, fields: string[]) {
  for (const field of fields) {
    const value = fieldValue(row.payload, field);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return "";
}

function divide(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator;
}

function addDays(yearMonth: string) {
  const { end } = monthRange(`${yearMonth}-01`);
  const count = Number(end.slice(-2));
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;
    const date = `${yearMonth}-${String(day).padStart(2, "0")}`;
    return { day, date, weekday: weekdayJa(date) };
  });
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

function productColumn(firstProduct: string, index: number) {
  return numberToColumn(columnToNumber(firstProduct) + index);
}

function productAliasMap(points: KanriPointMaster[]) {
  const aliases = new Map<string, string>();
  points.filter(active).forEach((point) => {
    aliases.set(point.product, point.product);
    (point.kintone_names ?? []).forEach((name) => aliases.set(name, point.product));
  });
  return aliases;
}

function countSourceProducts(rows: KanriSourceRow[], points: KanriPointMaster[]) {
  const aliases = productAliasMap(points);
  const counts = new Map<string, number>();
  const increment = (date: string, team: string, productName: string) => {
    const product = aliases.get(productName);
    if (!date || !team || !product) return;
    const key = `${date}\t${team}\t${product}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  rows.forEach((row) => {
    if (row.source === "kintone_customer") {
      increment(
        normalizeDate(firstFieldValue(row, CUSTOMER_DATE_FIELDS)),
        String(firstFieldValue(row, CUSTOMER_TEAM_FIELDS)),
        String(firstFieldValue(row, CUSTOMER_PRODUCT_FIELDS)),
      );
    }
    if (row.source === "credit_card") {
      increment(
        normalizeDate(firstFieldValue(row, CREDIT_DATE_FIELDS)),
        String(firstFieldValue(row, CREDIT_TEAM_FIELDS)),
        String(firstFieldValue(row, CREDIT_PRODUCT_FIELDS)),
      );
    }
  });

  return counts;
}

function makeEmptyProducts(products: string[]) {
  return Object.fromEntries(products.map((product) => [product, 0]));
}

export function calculateKanriSheet(input: KanriSheetInput): KanriSheetGrid {
  const products = sortByOrder(input.points.filter(active)).map((point) => point.product);
  const pointByProduct = new Map(input.points.map((point) => [point.product, point]));
  const teams = sortByOrder(input.teams.filter(active)).map((team) => team.team);
  const holidays = new Set(input.holidays);
  const sourceCounts = countSourceProducts(input.sourceRows, input.points);

  const teamTotals = Object.fromEntries(teams.map((team) => [team, {
    hours: 0,
    efficiency: null,
    total: 0,
    points: 0,
    amount: 0,
    products: makeEmptyProducts(products),
    pointsByProduct: makeEmptyProducts(products),
    amountByProduct: makeEmptyProducts(products),
  } as KanriTeamTotal]));

  const days = addDays(input.yearMonth).map(({ day, date, weekday }) => {
    const dayTeams: Record<string, KanriDayTeamResult> = {};
    teams.forEach((team) => {
      const hours = holidays.has(date) ? 0 : toNumber(input.manualInputs.hoursByTeamByDate[team]?.[date]);
      const productCounts = makeEmptyProducts(products);
      products.forEach((product) => {
        productCounts[product] = holidays.has(date) ? 0 : (sourceCounts.get(`${date}\t${team}\t${product}`) ?? 0);
      });
      const total = Object.values(productCounts).reduce((sum, value) => sum + value, 0);
      dayTeams[team] = { hours, efficiency: divide(total, hours), total, products: productCounts };
      teamTotals[team].hours += hours;
      teamTotals[team].total += total;
      products.forEach((product) => {
        teamTotals[team].products[product] += productCounts[product];
      });
    });
    const allHours = teams.reduce((sum, team) => sum + dayTeams[team].hours, 0);
    const allTotal = teams.reduce((sum, team) => sum + dayTeams[team].total, 0);
    const dayLabel: number | "定休日" = holidays.has(date) ? "定休日" : day;
    return {
      day: dayLabel,
      date,
      weekday,
      all: { hours: allHours, efficiency: divide(allTotal, allHours), total: allTotal },
      teams: dayTeams,
    };
  });

  teams.forEach((team) => {
    const total = teamTotals[team];
    total.efficiency = divide(total.total, total.hours);
    products.forEach((product) => {
      const point = pointByProduct.get(product);
      const count = total.products[product];
      const openRate = toNumber(input.manualInputs.openRateByTeamByProduct[team]?.[product]);
      const unitPrice = toNumber(point?.unit_price);
      total.pointsByProduct[product] = count * toNumber(point?.coefficient);
      total.amountByProduct[product] = count * openRate * unitPrice;
      total.points += total.pointsByProduct[product];
      total.amount += total.amountByProduct[product];
    });
  });

  const allHours = teams.reduce((sum, team) => sum + teamTotals[team].hours, 0);
  const allTotal = teams.reduce((sum, team) => sum + teamTotals[team].total, 0);
  const allPoints = teams.reduce((sum, team) => sum + teamTotals[team].points, 0);
  const allAmount = teams.reduce((sum, team) => sum + teamTotals[team].amount, 0);
  const grid: KanriSheetGrid = {
    yearMonth: input.yearMonth,
    products,
    teams,
    days,
    totals: {
      all: {
        hours: allHours,
        efficiency: divide(allTotal, allHours),
        total: allTotal,
        points: allPoints,
        amount: allAmount,
        pointEfficiency: divide(allPoints, allHours),
        amountPerHour: divide(allAmount, allHours),
      },
      teams: teamTotals,
    },
    openRate: input.manualInputs.openRateByTeamByProduct,
    cellValues: {},
  };
  grid.cellValues = kanriSheetCells(grid);
  return grid;
}

export function kanriSheetCells(grid: Omit<KanriSheetGrid, "cellValues">) {
  const cells: Record<string, number | string | null> = {
    E4: grid.totals.all.hours,
    F4: grid.totals.all.efficiency,
    G4: grid.totals.all.total,
    E5: grid.totals.all.hours,
    G5: grid.totals.all.points,
    F5: grid.totals.all.pointEfficiency,
    E6: grid.totals.all.amountPerHour,
    G6: grid.totals.all.amount,
  };

  grid.teams.forEach((team, teamIndex) => {
    const block = KANRI_TEAM_BLOCKS[teamIndex];
    if (!block) return;
    const total = grid.totals.teams[team];
    cells[`${block.hours}4`] = total.hours;
    cells[`${block.efficiency}4`] = total.efficiency;
    cells[`${block.total}4`] = total.total;
    cells[`${block.hours}5`] = total.hours;
    cells[`${block.efficiency}5`] = divide(total.points, total.hours);
    cells[`${block.total}5`] = total.points;
    cells[`${block.hours}6`] = divide(total.amount, total.hours);
    cells[`${block.total}6`] = total.amount;
    grid.products.forEach((product, productIndex) => {
      const column = productColumn(block.firstProduct, productIndex);
      cells[`${column}4`] = total.products[product];
      cells[`${column}5`] = total.pointsByProduct[product];
      cells[`${column}6`] = total.amountByProduct[product];
    });
  });

  grid.days.forEach((day, dayIndex) => {
    const row = 8 + dayIndex;
    cells[`B${row}`] = day.day;
    cells[`C${row}`] = `${day.date}T00:00:00`;
    cells[`D${row}`] = day.weekday;
    cells[`${ALL_COLUMNS.hours}${row}`] = day.all.hours;
    cells[`${ALL_COLUMNS.efficiency}${row}`] = day.all.efficiency;
    cells[`${ALL_COLUMNS.total}${row}`] = day.all.total;
    grid.teams.forEach((team, teamIndex) => {
      const block = KANRI_TEAM_BLOCKS[teamIndex];
      if (!block) return;
      const teamDay = day.teams[team];
      cells[`${block.hours}${row}`] = teamDay.hours;
      cells[`${block.efficiency}${row}`] = teamDay.efficiency;
      cells[`${block.total}${row}`] = teamDay.total;
      grid.products.forEach((product, productIndex) => {
        cells[`${productColumn(block.firstProduct, productIndex)}${row}`] = teamDay.products[product];
      });
    });
  });

  return cells;
}
