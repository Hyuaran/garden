import type { AporanSheetGrid, AporanTeamKey } from "./aporan-sheet";
import type { JissekiSheetGrid } from "./jisseki-sheet";
import type { KanriManualInputs, KanriSheetGrid } from "./kanri-sheet";

export type IncentiveTeamKey = "miyanaga" | "koizumi";

export type IncentiveTeamSummary = {
  key: IncentiveTeamKey;
  label: string;
  workDays: number;
  landingHours: number;
  targetPoints: number | null;
  actualPoints: number;
  achievementRate: number | null;
  efficiency: number | null;
  leaderPoints: number;
  leaderPointRate: number | null;
  achievementBonus: number | null;
  achievementPayout: number | null;
  teamVictoryBonus: number | null;
  targetOverBonus: number | null;
  pointAchievementBonus: number;
  totalIncentive: number | null;
};

export type IncentiveOverallSummary = {
  landingHours: number;
  timeEfficiency: number | null;
  targetPoints: number | null;
  achievementBonusTotal: number | null;
  perPersonAchievementBonus: number | null;
};

export type IncentiveSheetGrid = {
  yearMonth: string;
  teams: Record<IncentiveTeamKey, IncentiveTeamSummary>;
  teamOrder: IncentiveTeamKey[];
  overall: IncentiveOverallSummary;
  cellValues: Record<string, number | string | null>;
};

export type IncentiveSheetInput = {
  yearMonth: string;
  kanriGrid: KanriSheetGrid;
  aporanGrid: AporanSheetGrid;
  jissekiGrid: JissekiSheetGrid;
  manualInputs: KanriManualInputs;
};

export const INCENTIVE_TEAM_ORDER: IncentiveTeamKey[] = ["miyanaga", "koizumi"];

export const INCENTIVE_TEAM_LABELS: Record<IncentiveTeamKey, string> = {
  miyanaga: "宮永チーム",
  koizumi: "小泉チーム",
};

const TEAM_COLUMNS: Record<IncentiveTeamKey, string> = {
  miyanaga: "J",
  koizumi: "K",
};

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function divide(numerator: number | null, denominator: number | null) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function roundDownThousands(value: number) {
  return Math.trunc(value / 1000) * 1000;
}

function workingDayCount(kanriGrid: KanriSheetGrid) {
  return kanriGrid.days.filter((day) => typeof day.day === "number").length;
}

function aporanKey(key: IncentiveTeamKey): AporanTeamKey {
  return key;
}

function leaderPoints(jissekiGrid: JissekiSheetGrid, label: string) {
  return jissekiGrid.rows
    .filter((row) => row.department === label && row.wageLabel === "社員")
    .reduce((sum, row) => sum + row.totalPoints, 0);
}

function teamSummary(
  input: IncentiveSheetInput,
  key: IncentiveTeamKey,
  targetPoints: number | null,
  achievementBonusTotal: number | null,
  teamVictoryBonusInput: number | null,
  opponentRate: number | null,
) {
  const aporanTeam = input.aporanGrid.teams[aporanKey(key)];
  const label = INCENTIVE_TEAM_LABELS[key];
  const actualPoints = toNumber(aporanTeam?.actualPoints);
  const landingHours = toNumber(aporanTeam?.landingHours);
  const achievementRate = divide(actualPoints, targetPoints);
  const efficiency = divide(actualPoints, landingHours);
  const leaderTotal = leaderPoints(input.jissekiGrid, label);
  const achievementBonus = achievementBonusTotal === null ? null : achievementBonusTotal / INCENTIVE_TEAM_ORDER.length;
  const achievementPayout = targetPoints === null || achievementBonus === null
    ? null
    : actualPoints >= targetPoints ? achievementBonus : 0;
  const teamVictoryBonus = teamVictoryBonusInput === null || achievementRate === null || opponentRate === null
    ? null
    : achievementRate >= opponentRate ? teamVictoryBonusInput : 0;
  const targetOverBonus = targetPoints === null
    ? null
    : actualPoints > targetPoints ? roundDownThousands((actualPoints - targetPoints) * 1000) / 2 : 0;
  const pointAchievementBonus = 0;
  const totalIncentive = achievementPayout === null || teamVictoryBonus === null || targetOverBonus === null
    ? null
    : achievementPayout + teamVictoryBonus + targetOverBonus + pointAchievementBonus;

  return {
    key,
    label,
    workDays: workingDayCount(input.kanriGrid),
    landingHours,
    targetPoints,
    actualPoints,
    achievementRate,
    efficiency,
    leaderPoints: leaderTotal,
    leaderPointRate: divide(leaderTotal, actualPoints),
    achievementBonus,
    achievementPayout,
    teamVictoryBonus,
    targetOverBonus,
    pointAchievementBonus,
    totalIncentive,
  } satisfies IncentiveTeamSummary;
}

export function calculateIncentiveSheet(input: IncentiveSheetInput): IncentiveSheetGrid {
  const settings = input.manualInputs.monthlySettings?.incentive ?? {};
  const targetPoints = toNullableNumber(settings.targetPoints);
  const achievementBonusTotal = toNullableNumber(settings.achievementBonusTotal);
  const teamVictoryBonus = toNullableNumber(settings.teamVictoryBonus);
  const rates = Object.fromEntries(INCENTIVE_TEAM_ORDER.map((key) => {
    const actualPoints = toNumber(input.aporanGrid.teams[aporanKey(key)]?.actualPoints);
    return [key, divide(actualPoints, targetPoints)];
  })) as Record<IncentiveTeamKey, number | null>;

  const teams = {
    miyanaga: teamSummary(input, "miyanaga", targetPoints, achievementBonusTotal, teamVictoryBonus, rates.koizumi),
    koizumi: teamSummary(input, "koizumi", targetPoints, achievementBonusTotal, teamVictoryBonus, rates.miyanaga),
  } satisfies Record<IncentiveTeamKey, IncentiveTeamSummary>;
  const overallLandingHours = toNumber(input.aporanGrid.teams.all?.landingHours);
  const grid: IncentiveSheetGrid = {
    yearMonth: input.yearMonth,
    teams,
    teamOrder: INCENTIVE_TEAM_ORDER,
    overall: {
      landingHours: overallLandingHours,
      timeEfficiency: divide(targetPoints, overallLandingHours),
      targetPoints,
      achievementBonusTotal,
      perPersonAchievementBonus: achievementBonusTotal === null ? null : achievementBonusTotal / INCENTIVE_TEAM_ORDER.length,
    },
    cellValues: {},
  };
  grid.cellValues = incentiveSheetCells(grid);
  return grid;
}

export function incentiveSheetCells(grid: Omit<IncentiveSheetGrid, "cellValues">) {
  const cells: Record<string, number | string | null> = {};
  grid.teamOrder.forEach((key) => {
    const column = TEAM_COLUMNS[key];
    const team = grid.teams[key];
    cells[`${column}3`] = team.workDays;
    cells[`${column}4`] = team.landingHours;
    cells[`${column}5`] = team.targetPoints;
    cells[`${column}6`] = team.actualPoints;
    cells[`${column}7`] = team.achievementRate;
    cells[`${column}8`] = team.efficiency;
    cells[`${column}10`] = team.leaderPoints;
    cells[`${column}11`] = team.leaderPointRate;
    cells[`${column}12`] = team.achievementBonus;
    cells[`${column}13`] = team.achievementPayout;
    cells[`${column}14`] = team.teamVictoryBonus;
    cells[`${column}15`] = team.teamVictoryBonus;
    cells[`${column}16`] = team.targetOverBonus;
    cells[`${column}17`] = team.pointAchievementBonus;
    cells[`${column}18`] = team.totalIncentive;
  });
  cells.C16 = grid.overall.landingHours;
  cells.D16 = grid.overall.timeEfficiency;
  cells.E16 = grid.overall.targetPoints;
  cells.F16 = grid.overall.achievementBonusTotal;
  cells.G16 = grid.overall.perPersonAchievementBonus;
  return cells;
}
