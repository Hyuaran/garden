import { describe, expect, it } from "vitest";
import seeds from "./initial-values.json";
import {
  CHANNELS,
  overlapping,
  pointFor,
  resolveChannel,
  splitPeriod,
  sumPoints,
  validateRow,
  type PointRow,
} from ".";

export const initialRows = seeds.flatMap((seed, index) =>
  Object.keys(CHANNELS).map(
    (channel) =>
      ({
        ...seed,
        id: `${index}-${channel}`,
        channel,
        start_date: "2026-11-01",
        end_date: null,
        closer_points:
          Math.round((seed.total_points - seed.toss_points) * 100) / 100,
        note: null,
        updated_at: "2026-11-12T00:00:00Z",
        updated_by: null,
      }) as PointRow,
  ),
);

describe("付与ポイント", () => {
  it("27商材を3つの獲得方法へ展開する", () => {
    expect(initialRows).toHaveLength(81);
    for (const row of initialRows) {
      expect(validateRow(row)).toBeNull();
      expect(row.closer_points).toBeCloseTo(row.total_points - row.toss_points);
      expect(overlapping(initialRows, row)).toBeUndefined();
      expect(row.toss_points).toBe(
        row.category === "kaisen" ? 0.2 : row.total_points,
      );
      expect(row.kintone_names).not.toContain("au光プラス");
    }
  });
  it("事業名とリスト名から獲得方法を判定する", () => {
    expect(resolveChannel({ 事業名: "アライアンス", リスト名: "WEB_1" })).toBe(
      "alliance",
    );
    expect(resolveChannel({ 事業名: "自社", リスト名: "WEB_1" })).toBe("lp");
    expect(resolveChannel({ 事業名: "自社" })).toBe("hakuchi");
    expect(resolveChannel({ 事業名: "その他" })).toBeNull();
  });
  it("受注日の開始・終了を含み、表記ゆれと不明商材を扱う", () => {
    const row = { ...initialRows[0], end_date: "2026-11-30" };
    for (const orderDate of [row.start_date, row.end_date]) {
      expect(
        pointFor([row], {
          productName: row.product,
          channel: row.channel,
          orderDate,
        }),
      ).toEqual(row);
    }
    expect(
      pointFor([row], {
        productName: row.product,
        channel: row.channel,
        orderDate: "2026-12-01",
      }),
    ).toBeNull();
    expect(
      pointFor(initialRows, {
        productName: "au光 Sonet",
        channel: "lp",
        orderDate: "2026-11-15",
      })?.product,
    ).toBe("AU光");
    expect(
      pointFor(initialRows, {
        productName: "SoftbankAir　割賦",
        channel: "hakuchi",
        orderDate: "2026-11-15",
      })?.total_points,
    ).toBe(1);
    expect(
      pointFor(initialRows, {
        productName: "au光プラス",
        channel: "lp",
        orderDate: "2026-11-15",
      }),
    ).toBeNull();
    expect(
      pointFor(initialRows, {
        productName: row.product,
        channel: null,
        orderDate: "2026-11-15",
      }),
    ).toBeNull();
  });
  it("終わりのない期間との重複を断り、翌日からの切り替えで2行にする", () => {
    const row = initialRows[0];
    const next = {
      ...row,
      id: "new",
      start_date: "2026-11-15",
      total_points: 2,
      closer_points: 1.8,
    };
    expect(overlapping([row], next)).toEqual(row);
    const result = splitPeriod([row], row, next);
    expect(result).toHaveLength(2);
    expect(result[0].end_date).toBe("2026-11-14");
    expect(
      pointFor(result, {
        productName: row.product,
        channel: row.channel,
        orderDate: "2026-11-15",
      })?.total_points,
    ).toBe(2);
    expect(() =>
      splitPeriod([row], row, { ...next, start_date: row.start_date }),
    ).toThrow();
    expect(row.end_date).toBeNull();
  });
  it("トスは合計以下であり、クローザーを超えてもよい", () => {
    expect(validateRow({ ...initialRows[0], toss_points: 2 })).toBeTruthy();
    const card = initialRows.find((row) => row.category === "credit")!;
    expect(card.closer_points).toBe(0);
    expect(card.toss_points).toBeGreaterThan(card.closer_points);
    expect(validateRow(card)).toBeNull();
  });
  it("獲得方法・配信の内訳・表にない商材を集計する", () => {
    const orders = [
      { productName: "au光", channel: "lp" as const, orderDate: "2026-11-01" },
      {
        productName: "JCB Biz ONE",
        channel: "alliance" as const,
        orderDate: "2026-11-01",
      },
      {
        productName: "未登録",
        channel: "hakuchi" as const,
        orderDate: "2026-11-01",
      },
    ];
    const result = sumPoints(orders, initialRows);
    expect(result.total).toEqual({
      total: 2,
      toss: 0.6,
      closer: 1.4,
      count: 2,
    });
    expect(result.byChannel.lp.total).toBe(1.6);
    expect(result.byReportGroup.credit.total).toBe(0.4);
    expect(result.missingProducts).toEqual([
      { productName: "未登録", count: 1 },
    ]);
  });
});
