import type { JissekiRow, JissekiSheetGrid } from "./jisseki-sheet";
import type { KanriManualInputs, KanriSheetGrid } from "./kanri-sheet";

export type AporanTeamKey = "all" | "miyanaga" | "koizumi" | "ishihara" | "newcomer";

export type AporanTeamSummary = {
  key: AporanTeamKey;
  label: string;
  actualPoints: number;
  targetPoints: number;
  currentRequiredPoints: number | null;
  workHours: number;
  landingHours: number;
  efficiency: number | null;
  landingPoints: number | null;
  achievementRate: number | null;
};

export type AporanRankingRow = {
  rank: number;
  department: string;
  personName: string;
  status: string | null;
  wageLabel: string | number;
  totalPoints: number;
  workHours: number;
  efficiency: number;
  displayEfficiency: number;
  landingHours: number;
  digitalLanding: number;
};

export type AporanSheetGrid = {
  yearMonth: string;
  targetDate: string;
  teams: Record<AporanTeamKey, AporanTeamSummary>;
  teamOrder: AporanTeamKey[];
  ranking: AporanRankingRow[];
  cellValues: Record<string, number | string | null>;
};

export type AporanSheetInput = {
  yearMonth: string;
  targetDate: string;
  kanriGrid: KanriSheetGrid;
  jissekiGrid: JissekiSheetGrid;
  manualInputs: KanriManualInputs;
};

export const APORAN_TEAM_ORDER: AporanTeamKey[] = ["all", "miyanaga", "koizumi", "ishihara", "newcomer"];

export const APORAN_TEAM_LABELS: Record<AporanTeamKey, string> = {
  all: "テレマ全体",
  miyanaga: "宮永チーム",
  koizumi: "小泉チーム",
  ishihara: "石原チーム",
  newcomer: "新人チーム",
};

const TEAM_COLUMNS: Record<AporanTeamKey, string> = {
  all: "D",
  miyanaga: "E",
  koizumi: "F",
  ishihara: "G",
  newcomer: "H",
};

const DEFAULT_TARGETS: Record<AporanTeamKey, number> = {
  all: 240,
  miyanaga: 80,
  koizumi: 80,
  ishihara: 80,
  newcomer: 0,
};

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function roundDown(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.trunc(value * factor) / factor;
}

function divide(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator;
}

function targetFor(inputs: KanriManualInputs, key: AporanTeamKey) {
  const targets = inputs.monthlySettings?.aporanTargets ?? {};
  return toNumber(targets[key] ?? targets[APORAN_TEAM_LABELS[key]] ?? DEFAULT_TARGETS[key]);
}

function teamNameFor(grid: KanriSheetGrid, key: AporanTeamKey) {
  const label = APORAN_TEAM_LABELS[key];
  return grid.teams.find((team) => team === label || team.includes(label.slice(0, 2))) ?? label;
}

function targetDayNumber(kanriGrid: KanriSheetGrid, targetDate: string) {
  const day = kanriGrid.days.find((item) => item.date === targetDate);
  return typeof day?.day === "number" ? day.day : null;
}

function workingDayCount(kanriGrid: KanriSheetGrid) {
  return kanriGrid.days.filter((day) => typeof day.day === "number").length;
}

function statusFromWage(wageLabel: string | number) {
  if (wageLabel === "社員" || wageLabel === "派遣") return wageLabel;
  const wage = toNumber(wageLabel);
  if (wage >= 2000) return "ブラック";
  if (wage >= 1800) return "ダイヤモンド";
  if (wage >= 1600) return "プラチナ";
  if (wage >= 1400) return "ゴールド";
  if (wage > 1200) return "シルバー";
  return null;
}

function summarizeTeam(input: AporanSheetInput, key: AporanTeamKey, dayNumber: number | null, workdayCount: number) {
  const miyanaga = teamNameFor(input.kanriGrid, "miyanaga");
  const koizumi = teamNameFor(input.kanriGrid, "koizumi");
  const ishihara = teamNameFor(input.kanriGrid, "ishihara");
  const teamName = key === "all" || key === "newcomer" ? "" : teamNameFor(input.kanriGrid, key);
  const knownTeamPoints = [miyanaga, koizumi, ishihara].reduce((sum, team) => sum + toNumber(input.kanriGrid.totals.teams[team]?.points), 0);
  const targetPoints = targetFor(input.manualInputs, key);
  const matchingRows = key === "all"
    ? input.jissekiGrid.rows.filter((row) => [miyanaga, koizumi, ishihara, APORAN_TEAM_LABELS.newcomer].includes(row.department))
    : input.jissekiGrid.rows.filter((row) => row.department === (key === "newcomer" ? APORAN_TEAM_LABELS.newcomer : teamName));
  const actualPoints = key === "all"
    ? toNumber(input.kanriGrid.totals.all.points)
    : key === "newcomer"
      ? toNumber(input.kanriGrid.totals.all.points) - knownTeamPoints
      : toNumber(input.kanriGrid.totals.teams[teamName]?.points);
  const workHours = matchingRows.reduce((sum, row) => sum + row.workHours, 0);
  const landingHours = matchingRows.reduce((sum, row) => sum + row.landingHours, 0);
  const currentRequiredPoints = dayNumber && workdayCount > 0 ? roundDown((dayNumber / workdayCount) * targetPoints, 1) : null;
  const achievementRate = currentRequiredPoints ? divide(actualPoints, currentRequiredPoints) : null;
  return {
    key,
    label: APORAN_TEAM_LABELS[key],
    actualPoints,
    targetPoints,
    currentRequiredPoints,
    workHours,
    landingHours,
    efficiency: divide(actualPoints, workHours),
    landingPoints: achievementRate === null ? null : roundDown(targetPoints * achievementRate, 1),
    achievementRate,
  } satisfies AporanTeamSummary;
}

function rankingRows(rows: JissekiRow[]) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.totalPoints - a.row.totalPoints || a.index - b.index)
    .map(({ row }, index) => {
      const rank = index + 1;
      const digitalLanding = row.efficiency * row.landingHours;
      return {
        rank,
        department: row.department,
        personName: row.personName,
        status: statusFromWage(row.wageLabel),
        wageLabel: row.wageLabel,
        totalPoints: row.totalPoints,
        workHours: row.workHours,
        efficiency: row.efficiency,
        displayEfficiency: roundDown(row.efficiency, 2),
        landingHours: row.landingHours,
        digitalLanding,
      } satisfies AporanRankingRow;
    });
}

export function calculateAporanSheet(input: AporanSheetInput): AporanSheetGrid {
  const dayNumber = targetDayNumber(input.kanriGrid, input.targetDate);
  const workdayCount = workingDayCount(input.kanriGrid);
  const teams = Object.fromEntries(APORAN_TEAM_ORDER.map((key) => [
    key,
    summarizeTeam(input, key, dayNumber, workdayCount),
  ])) as Record<AporanTeamKey, AporanTeamSummary>;
  const grid: AporanSheetGrid = {
    yearMonth: input.yearMonth,
    targetDate: input.targetDate,
    teams,
    teamOrder: APORAN_TEAM_ORDER,
    ranking: rankingRows(input.jissekiGrid.rows),
    cellValues: {},
  };
  grid.cellValues = aporanSheetCells(grid);
  return grid;
}

export function aporanSheetCells(grid: Omit<AporanSheetGrid, "cellValues">) {
  const cells: Record<string, number | string | null> = {};
  grid.teamOrder.forEach((key) => {
    const column = TEAM_COLUMNS[key];
    const team = grid.teams[key];
    cells[`${column}4`] = team.efficiency;
    cells[`${column}5`] = team.actualPoints;
    cells[`${column}6`] = team.targetPoints;
    cells[`${column}7`] = team.currentRequiredPoints;
    cells[`${column}8`] = team.workHours;
    cells[`${column}9`] = team.landingHours;
    cells[`${column}10`] = team.landingPoints;
    cells[`${column}11`] = team.achievementRate;
  });
  grid.ranking.forEach((row, index) => {
    const excelRow = 21 + index;
    cells[`B${excelRow}`] = row.rank;
    cells[`C${excelRow}`] = row.department;
    cells[`D${excelRow}`] = row.personName;
    cells[`E${excelRow}`] = row.status;
    cells[`F${excelRow}`] = row.wageLabel;
    cells[`G${excelRow}`] = row.totalPoints;
    cells[`H${excelRow}`] = row.workHours;
    cells[`I${excelRow}`] = row.displayEfficiency;
    cells[`J${excelRow}`] = row.landingHours;
    cells[`K${excelRow}`] = row.digitalLanding;
  });
  return cells;
}
