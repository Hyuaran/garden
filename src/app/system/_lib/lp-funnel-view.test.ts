import { describe, expect, it } from "vitest";

import type { LpFunnelResult } from "./lp-funnel";
import { lpFunnelTableA, lpFunnelTableB, lpFunnelTreeLinks } from "./lp-funnel-view";

const counts = (connected: number, notConnected: number, noCall: number) => ({ connected, notConnected, noCall });
export const funnelFixture = {
  asOf: "2026-10-14T12:00:00Z", notes: [], totals: null,
  businesses: [{
    bizCode: "hikari-pro", bizName: "ヒカリのプロ",
    total: 15, inbound: 12, answered: 10, unanswered: 2, callbackConnected: 1, callbackNotConnected: 1, noCallback: 0, forms: 3,
    withSlot: 2, onTime: counts(2, 0, 0), late: counts(0, 0, 0), pendingWithSlot: counts(0, 0, 0),
    noSlot: 1, noSlotOnTime: counts(1, 0, 0), noSlotLate: counts(0, 0, 0), noSlotPending: counts(0, 0, 0),
    invalidNumberForms: 0, unknownInboundCalls: 2, answerRate: 10 / 12, spoke: 14, spokeInbound: 10, spokeCallback: 1, spokeForm: 3,
    won: 9, inProgress: 3, lost: 1, excluded: 0, noRecord: 1, contactRate: 14 / 15, wonRate: 9 / 14, excludedRate: 0, effectiveWonRate: 9 / 14,
    pendingCount: 0, noRecordList: [], calcNotes: [],
  }],
} as unknown as LpFunnelResult;

describe("WEBインバウンドの表（階層つき・2026-10-15）", () => {
  it("表A は「うち」を使わず、深さで親子を表す（初回応答率は区切りの下）", () => {
    const rows = lpFunnelTableA(funnelFixture);
    expect(rows.some((row) => row.label.startsWith("うち"))).toBe(false);
    expect(rows.map((row) => [row.label.slice(0, 6), row.level, row.kind])).toEqual([
      ["総数（入電＋", 0, "node"], ["入電（番号あ", 1, "node"], ["応答できた", 2, "node"], ["応答できなか", 2, "node"],
      ["折り返して繋", 3, "node"], ["折り返しても", 3, "node"], ["折り返してい", 3, "node"],
      ["フォーム", 1, "node"], ["時間の指定あ", 2, "node"], ["指定どおり（", 3, "node"], ["指定どおりで", 3, "node"], ["判定待ち（繋", 3, "node"],
      ["時間の指定な", 2, "node"], ["締切まで（繋", 3, "node"], ["締切超（繋が", 3, "node"], ["判定待ち（繋", 3, "node"], ["番号不備", 2, "node"],
      ["初回応答率（", 0, "rate"], ["（参考）番号", 0, "note"],
    ]);
  });

  it("表A の罫線：最後の子は └、上の階層に続きがあれば縦の線を続ける", () => {
    const rows = lpFunnelTableA(funnelFixture);
    const links = lpFunnelTreeLinks(rows);
    const at = (label: string) => links[rows.findIndex((row) => row.label === label)];
    expect(at("入電（番号あり）")).toEqual({ continues: [], last: false });
    expect(at("フォーム")).toEqual({ continues: [], last: true });
    expect(at("応答できなかった")).toEqual({ continues: [true], last: true });
    // 入電の下（フォームが後に続く）→ 深さ 1 の線は続ける。応答できなかったは最後の子 → 深さ 2 の線は続けない
    expect(at("折り返していない")).toEqual({ continues: [true, false], last: true });
    // フォームは最後の子 → その下では深さ 1 の線を続けない。時間の指定ありの後に指定なしが続く → 深さ 2 は続ける
    expect(links[rows.findIndex((row) => row.label === "指定どおり（繋がった・繋がらない）")]).toEqual({ continues: [false, true], last: false });
    expect(at("番号不備")).toEqual({ continues: [false], last: true });
  });

  it("表B は「話せた」の下に 2 つの枝（どうやって／どうなったか）、どちらも足すと話せたに戻る", () => {
    const rows = lpFunnelTableB(funnelFixture);
    const links = lpFunnelTreeLinks(rows);
    const route = rows.filter((row, i) => row.level === 2 && i < rows.findIndex((r) => r.label.startsWith("どうなったか")));
    const result = rows.filter((row, i) => row.level === 2 && i > rows.findIndex((r) => r.label.startsWith("どうなったか")));
    const sum = (list: typeof rows) => list.reduce((total, row) => total + Number(row.values[0]), 0);
    expect(rows[0]).toMatchObject({ label: "話せた", level: 0, values: ["14"] });
    expect(sum(route)).toBe(14);
    expect(sum(result)).toBe(14);
    expect(rows.find((row) => row.label === "どうやって話せたか")).toMatchObject({ kind: "group", values: [""] });
    expect(links[rows.findIndex((row) => row.label === "どうやって話せたか")]).toEqual({ continues: [], last: false });
    expect(links[rows.findIndex((row) => row.label === "フォームで繋がった")]).toEqual({ continues: [true], last: true });
    expect(links[rows.findIndex((row) => row.label === "Kintone記録なし")]).toEqual({ continues: [false], last: true });
    expect(rows.filter((row) => row.kind === "rate").map((row) => row.label.slice(0, 4))).toEqual(["対応率（", "受注率（", "対象外率", "有効受注"]);
  });
});
