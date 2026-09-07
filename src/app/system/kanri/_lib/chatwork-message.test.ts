import { describe, expect, it } from "vitest";
import { buildKanriChatworkMessage, kanriPortalUrl } from "./chatwork-message";
import type { KanriSheetGrid } from "./calc/kanri-sheet";

const grid = {
  teams: ["宮永", "小泉", "石原"],
  totals: {
    all: { hours: 2966, efficiency: 0.087876, total: 222, points: 260.6, amount: 0, pointEfficiency: 0.087876, amountPerHour: null },
    teams: {
      宮永: { hours: 1, efficiency: 1, total: 1, points: 87.2, amount: 0, products: {}, pointsByProduct: {}, amountByProduct: {} },
      小泉: { hours: 1, efficiency: 1, total: 1, points: 87, amount: 0, products: {}, pointsByProduct: {}, amountByProduct: {} },
      石原: { hours: 1, efficiency: 1, total: 1, points: 86.4, amount: 0, products: {}, pointsByProduct: {}, amountByProduct: {} },
    },
  },
} as Pick<KanriSheetGrid, "teams" | "totals">;

describe("buildKanriChatworkMessage", () => {
  it("formats target date, mode, creator, totals, teams, and URL", () => {
    const message = buildKanriChatworkMessage({
      targetDate: "2026-08-31",
      mode: "closing",
      creatorName: "東海林 美琴",
      grid,
      siteUrl: "https://example.com/",
    });

    expect(message).toBe([
      "【管理表】2026/08/31（締めチェック）の管理表を 東海林 美琴 が作成しました。",
      "テレマ全体：稼働 2,966h・実数 222 件・ポイント 260.6P（効率 0.088）",
      "宮永チーム 87.2P／小泉チーム 87.0P／石原チーム 86.4P",
      "https://example.com/system/kanri?date=2026-08-31",
    ].join("\n"));
  });

  it("uses daily label and default site URL", () => {
    const message = buildKanriChatworkMessage({
      targetDate: "2026-09-01",
      mode: "daily",
      creatorName: "担当者",
      grid,
    });

    expect(message).toContain("（デイリー）");
    expect(message).toContain("https://garden-os.net/system/kanri?date=2026-09-01");
  });
});

describe("kanriPortalUrl", () => {
  it("removes trailing slashes from the base URL", () => {
    expect(kanriPortalUrl("2026-08-31", "https://garden-os.net///")).toBe("https://garden-os.net/system/kanri?date=2026-08-31");
  });
});
