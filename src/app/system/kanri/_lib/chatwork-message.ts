import type { KanriMode } from "./kanri-core";
import type { KanriSheetGrid } from "./calc/kanri-sheet";

type BuildKanriChatworkMessageInput = {
  targetDate: string;
  mode: KanriMode;
  creatorName: string;
  grid: Pick<KanriSheetGrid, "teams" | "totals">;
  siteUrl?: string | null;
};

function formatDate(value: string) {
  return value.replaceAll("-", "/");
}

function modeLabel(mode: KanriMode) {
  return mode === "closing" ? "締めチェック" : "デイリー";
}

function teamLabel(team: string) {
  return team.endsWith("チーム") ? team : `${team}チーム`;
}

function formatNumber(value: number, digits: number) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(value);
}

export function kanriPortalUrl(targetDate: string, siteUrl?: string | null) {
  const base = (siteUrl?.trim() || "https://garden-os.net").replace(/\/+$/, "");
  return `${base}/system/kanri?date=${encodeURIComponent(targetDate)}`;
}

export function buildKanriChatworkMessage(input: BuildKanriChatworkMessageInput) {
  const all = input.grid.totals.all;
  const teamPoints = input.grid.teams
    .map((team) => `${teamLabel(team)} ${formatNumber(input.grid.totals.teams[team]?.points ?? 0, 1)}P`)
    .join("／");

  return [
    `【管理表】${formatDate(input.targetDate)}（${modeLabel(input.mode)}）の管理表を ${input.creatorName} が作成しました。`,
    `テレマ全体：稼働 ${formatInteger(all.hours)}h・実数 ${formatInteger(all.total)} 件・ポイント ${formatNumber(all.points, 1)}P（効率 ${formatNumber(all.efficiency ?? 0, 3)}）`,
    teamPoints,
    kanriPortalUrl(input.targetDate, input.siteUrl),
  ].join("\n");
}
