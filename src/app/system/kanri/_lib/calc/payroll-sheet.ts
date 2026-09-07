import { normalizeName } from "../kanri-core";
import type { AporanRankingRow, AporanSheetGrid } from "./aporan-sheet";
import type { JissekiRow, JissekiSheetGrid } from "./jisseki-sheet";
import type { KanriManualInputs, KanriPayrollPersonInput } from "./kanri-sheet";

export type PayrollRow = {
  rank: number;
  department: string;
  personName: string;
  currentStatus: string | null;
  timeEfficiency: number;
  currentWage: string | number;
  nextStatus: string;
  wageAdjustment: number;
  nextWage: number | null;
  apHourlyWage: number | null;
  acquiredPoints: number;
  referralPoints: number;
  totalPoints: number;
  basePay: number;
  apIncentive: number | null;
  trainingHours: number;
  trainingAllowance: number;
  presidentAward: number;
  pointAward: number;
  hiringBonus: number;
  talentReferralIncentive: number;
  dealIncentive: number;
  totalPayout: number | null;
  scheduledHours: number;
  workDays: number;
  commuteDailyAllowance: number;
  commuteTotal: number;
  periodStart: string;
  periodEnd: string;
  scheduledPayDate: string;
};

export type PayrollPeriod = {
  start: string;
  end: string;
  scheduledPayDate: string;
};

export type PayrollSheetGrid = {
  yearMonth: string;
  settings: {
    baseWage: number;
    trainingWage: number;
  };
  period: PayrollPeriod;
  rows: PayrollRow[];
  cellValues: Record<string, number | string | null>;
};

export type PayrollSheetInput = {
  yearMonth: string;
  aporanGrid: AporanSheetGrid;
  jissekiGrid: JissekiSheetGrid;
  manualInputs: KanriManualInputs;
};

export const DEFAULT_PAYROLL_BASE_WAGE = 1177;
export const DEFAULT_PAYROLL_TRAINING_WAGE = 1500;

export const PRESIDENT_AWARD_BY_RANK = [
  { maxRank: 1, amount: 50000 },
  { maxRank: 2, amount: 30000 },
  { maxRank: 3, amount: 20000 },
  { maxRank: 4, amount: 10000 },
  { maxRank: 5, amount: 5000 },
] as const;

export const POINT_AWARD_THRESHOLDS = [
  { minimumPoints: 60, amount: 60000 },
  { minimumPoints: 50, amount: 50000 },
  { minimumPoints: 40, amount: 30000 },
  { minimumPoints: 30, amount: 20000 },
  { minimumPoints: 20, amount: 5000 },
] as const;

const FIRST_DATA_ROW = 24;

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function toSettingNumber(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : fallback;
}

function toText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function wageNumber(value: string | number) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function presidentAward(rank: number) {
  return PRESIDENT_AWARD_BY_RANK.find((award) => rank <= award.maxRank)?.amount ?? 0;
}

function pointAward(points: number) {
  return POINT_AWARD_THRESHOLDS.find((award) => points >= award.minimumPoints)?.amount ?? 0;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function payrollPeriod(yearMonth: string): PayrollPeriod {
  const [year, month] = yearMonth.split("-").map(Number);
  const endDay = daysInMonth(year, month);
  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const nextYear = nextMonthDate.getUTCFullYear();
  const nextMonth = nextMonthDate.getUTCMonth() + 1;
  const payDay = daysInMonth(nextYear, nextMonth);
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(endDay).padStart(2, "0")}`,
    scheduledPayDate: `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(payDay).padStart(2, "0")}`,
  };
}

function manualInputFor(inputs: KanriManualInputs, personName: string): KanriPayrollPersonInput {
  const key = normalizeName(personName);
  const entries = Object.entries(inputs.payrollByPerson ?? {});
  return inputs.payrollByPerson?.[personName]
    ?? entries.find(([name]) => normalizeName(name) === key)?.[1]
    ?? {};
}

function jissekiByName(jissekiGrid: JissekiSheetGrid) {
  return new Map(jissekiGrid.rows.map((row) => [normalizeName(row.personName), row]));
}

function makeRow(
  ranking: AporanRankingRow,
  jisseki: JissekiRow | undefined,
  manual: KanriPayrollPersonInput,
  baseWage: number,
  trainingWage: number,
  period: PayrollPeriod,
): PayrollRow {
  const wageAdjustment = toNumber(manual.wageAdjustment);
  const currentWageNumber = wageNumber(ranking.wageLabel);
  const nextWage = currentWageNumber === null ? null : currentWageNumber + wageAdjustment;
  const apHourlyWage = nextWage === null ? null : nextWage - baseWage;
  const referralPoints = toNumber(manual.referralPoints);
  const totalPoints = ranking.totalPoints + referralPoints;
  const trainingHours = toNumber(manual.trainingHours);
  const scheduledHours = ranking.workHours - trainingHours;
  const basePay = baseWage * scheduledHours;
  const apIncentive = apHourlyWage === null ? null : apHourlyWage * scheduledHours;
  const trainingAllowance = trainingHours * trainingWage;
  const hiringBonus = toNumber(manual.hiringBonus);
  const talentReferralIncentive = toNumber(manual.talentReferralIncentive);
  const dealIncentive = toNumber(manual.dealIncentive);
  const totalPayout = apIncentive === null
    ? null
    : basePay + apIncentive + trainingAllowance + presidentAward(ranking.rank) + pointAward(totalPoints) + hiringBonus + talentReferralIncentive + dealIncentive;
  const workDays = jisseki?.workDays ?? 0;
  const commuteDailyAllowance = jisseki?.commuteDailyAllowance ?? 0;

  return {
    rank: ranking.rank,
    department: ranking.department,
    personName: ranking.personName,
    currentStatus: ranking.status,
    timeEfficiency: ranking.displayEfficiency,
    currentWage: ranking.wageLabel,
    nextStatus: toText(manual.nextStatus),
    wageAdjustment,
    nextWage,
    apHourlyWage,
    acquiredPoints: ranking.totalPoints,
    referralPoints,
    totalPoints,
    basePay,
    apIncentive,
    trainingHours,
    trainingAllowance,
    presidentAward: presidentAward(ranking.rank),
    pointAward: pointAward(totalPoints),
    hiringBonus,
    talentReferralIncentive,
    dealIncentive,
    totalPayout,
    scheduledHours,
    workDays,
    commuteDailyAllowance,
    commuteTotal: workDays * commuteDailyAllowance,
    periodStart: period.start,
    periodEnd: period.end,
    scheduledPayDate: period.scheduledPayDate,
  };
}

export function calculatePayrollSheet(input: PayrollSheetInput): PayrollSheetGrid {
  const payrollSettings = input.manualInputs.monthlySettings?.payroll ?? {};
  const baseWage = toSettingNumber(payrollSettings.baseWage, DEFAULT_PAYROLL_BASE_WAGE);
  const trainingWage = toSettingNumber(payrollSettings.trainingWage, DEFAULT_PAYROLL_TRAINING_WAGE);
  const period = payrollPeriod(input.yearMonth);
  const jissekiRows = jissekiByName(input.jissekiGrid);
  const rows = input.aporanGrid.ranking.map((ranking) => makeRow(
    ranking,
    jissekiRows.get(normalizeName(ranking.personName)),
    manualInputFor(input.manualInputs, ranking.personName),
    baseWage,
    trainingWage,
    period,
  ));
  const grid: PayrollSheetGrid = {
    yearMonth: input.yearMonth,
    settings: { baseWage, trainingWage },
    period,
    rows,
    cellValues: {},
  };
  grid.cellValues = payrollSheetCells(grid);
  return grid;
}

export function payrollSheetCells(grid: Omit<PayrollSheetGrid, "cellValues">) {
  const cells: Record<string, number | string | null> = {};
  grid.rows.forEach((row, index) => {
    const excelRow = FIRST_DATA_ROW + index;
    cells[`B${excelRow}`] = row.rank;
    cells[`C${excelRow}`] = row.department;
    cells[`D${excelRow}`] = row.personName;
    cells[`E${excelRow}`] = row.currentStatus;
    cells[`F${excelRow}`] = row.timeEfficiency;
    cells[`G${excelRow}`] = row.currentWage;
    cells[`H${excelRow}`] = row.nextStatus;
    cells[`I${excelRow}`] = row.wageAdjustment;
    cells[`J${excelRow}`] = row.nextWage;
    cells[`K${excelRow}`] = row.apHourlyWage;
    cells[`L${excelRow}`] = row.acquiredPoints;
    cells[`M${excelRow}`] = row.referralPoints;
    cells[`N${excelRow}`] = row.totalPoints;
    cells[`O${excelRow}`] = row.basePay;
    cells[`P${excelRow}`] = row.apIncentive;
    cells[`Q${excelRow}`] = row.trainingHours;
    cells[`R${excelRow}`] = row.presidentAward;
    cells[`S${excelRow}`] = row.pointAward;
    cells[`T${excelRow}`] = row.hiringBonus;
    cells[`U${excelRow}`] = row.talentReferralIncentive;
    cells[`V${excelRow}`] = row.dealIncentive;
    cells[`W${excelRow}`] = row.totalPayout;
    cells[`X${excelRow}`] = row.scheduledHours;
    cells[`Y${excelRow}`] = row.workDays;
    cells[`Z${excelRow}`] = row.commuteDailyAllowance;
    cells[`AA${excelRow}`] = row.commuteTotal;
    cells[`AB${excelRow}`] = row.periodStart;
    cells[`AC${excelRow}`] = row.periodEnd;
    cells[`AD${excelRow}`] = row.scheduledPayDate;
  });
  return cells;
}
