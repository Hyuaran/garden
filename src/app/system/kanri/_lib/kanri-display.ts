import { weekdayJa } from "./kanri-core";
import type { AporanSheetGrid, AporanTeamKey, AporanTeamSummary } from "./calc/aporan-sheet";
import type { KanriSheetGrid } from "./calc/kanri-sheet";

export type KanriDisplayRowKey =
  | "efficiency"
  | "actualPoints"
  | "targetPoints"
  | "currentRequiredPoints"
  | "workHours"
  | "landingHours"
  | "landingPoints"
  | "achievementRate";

export type KanriDisplayColumn = {
  key: Exclude<AporanTeamKey, "newcomer">;
  label: string;
};

export type KanriDisplayRow = {
  key: KanriDisplayRowKey;
  label: string;
  emphasis: boolean;
  values: string[];
};

export type KanriDisplayPayload = {
  ok: true;
  empty: false;
  targetDate: string;
  title: string;
  columns: KanriDisplayColumn[];
  rows: KanriDisplayRow[];
  calculatedAt: string | null;
};

export const KANRI_DISPLAY_COLUMNS: KanriDisplayColumn[] = [
  { key: "all", label: "テレマ全体" },
  { key: "miyanaga", label: "宮永チーム" },
  { key: "koizumi", label: "小泉チーム" },
  { key: "ishihara", label: "石原チーム" },
];

export const KANRI_DISPLAY_ROWS: { key: KanriDisplayRowKey; label: string; format: "decimal2" | "points" | "hours" | "rate"; emphasis?: boolean }[] = [
  { key: "efficiency", label: "効率", format: "decimal2" },
  { key: "actualPoints", label: "実績P", format: "points", emphasis: true },
  { key: "targetPoints", label: "目標P", format: "points" },
  { key: "currentRequiredPoints", label: "現時点必要P", format: "points" },
  { key: "workHours", label: "稼働h", format: "hours" },
  { key: "landingHours", label: "着地予想h", format: "hours" },
  { key: "landingPoints", label: "着地予想P", format: "points", emphasis: true },
  { key: "achievementRate", label: "達成率", format: "rate", emphasis: true },
];

export function formatKanriDisplayValue(value: number | null | undefined, format: "decimal2" | "points" | "hours" | "rate") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (format === "decimal2") return value.toFixed(2);
  if (format === "rate") return `${(value * 100).toFixed(1)}%`;
  return `${value.toFixed(1)}${format === "points" ? "P" : "h"}`;
}

export function kanriDisplayTitle(targetDate: string, dayNumber?: number | null, workdayCount?: number | null) {
  const [, month, day] = targetDate.split("-").map(Number);
  const workdayLabel = typeof dayNumber === "number" && typeof workdayCount === "number"
    ? `　${dayNumber}/${workdayCount}稼働`
    : "";
  return `${month}月${day}日(${weekdayJa(targetDate)})時点の成績${workdayLabel}`;
}

export function kanriDisplayDayNumber(kanriGrid: Pick<KanriSheetGrid, "days"> | null | undefined, targetDate: string) {
  // 対象日までの稼働日（定休日でない日）の数
  const days = kanriGrid?.days ?? [];
  const index = days.findIndex((item) => item.date === targetDate);
  if (index < 0 || typeof days[index].day !== "number") return null;
  return days.slice(0, index + 1).filter((item) => typeof item.day === "number").length;
}

export function kanriDisplayWorkdayCount(kanriGrid: Pick<KanriSheetGrid, "days"> | null | undefined) {
  return kanriGrid?.days.filter((day) => typeof day.day === "number").length ?? null;
}

function teamValue(team: AporanTeamSummary, key: KanriDisplayRowKey) {
  return team[key];
}

export function buildKanriDisplayPayload(input: {
  aporanGrid: AporanSheetGrid;
  kanriGrid?: Pick<KanriSheetGrid, "days"> | null;
  calculatedAt?: string | null;
}): KanriDisplayPayload {
  const dayNumber = kanriDisplayDayNumber(input.kanriGrid, input.aporanGrid.targetDate);
  const workdayCount = kanriDisplayWorkdayCount(input.kanriGrid);
  return {
    ok: true,
    empty: false,
    targetDate: input.aporanGrid.targetDate,
    title: kanriDisplayTitle(input.aporanGrid.targetDate, dayNumber, workdayCount),
    columns: KANRI_DISPLAY_COLUMNS,
    rows: KANRI_DISPLAY_ROWS.map((row) => ({
      key: row.key,
      label: row.label,
      emphasis: Boolean(row.emphasis),
      values: KANRI_DISPLAY_COLUMNS.map((column) => formatKanriDisplayValue(teamValue(input.aporanGrid.teams[column.key], row.key), row.format)),
    })),
    calculatedAt: input.calculatedAt ?? null,
  };
}
