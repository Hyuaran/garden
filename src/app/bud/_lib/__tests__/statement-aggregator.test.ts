import { describe, it, expect } from "vitest";
import {
  aggregateByCategory,
  aggregateByDate,
  aggregateByBankAccount,
  totalAggregate,
  monthBoundary,
} from "../statement-aggregator";

describe("totalAggregate", () => {
  it("入金・出金・件数・差引を集計", () => {
    const rows = [
      { amount: 1000 },
      { amount: -500 },
      { amount: 2000 },
      { amount: -300 },
    ];
    const r = totalAggregate(rows);
    expect(r.inflow).toBe(3000);
    expect(r.outflow).toBe(800);
    expect(r.count).toBe(4);
    expect(r.netChange).toBe(2200);
  });

  it("空配列はゼロ", () => {
    const r = totalAggregate([]);
    expect(r).toEqual({ inflow: 0, outflow: 0, count: 0, netChange: 0 });
  });
});

describe("aggregateByCategory", () => {
  it("category 別に集計、null は「（未分類）」", () => {
    const rows = [
      { amount: -3000, category: "会議費" },
      { amount: -2000, category: "会議費" },
      { amount: -10000, category: "外注費" },
      { amount: -1000, category: null },
    ];
    const r = aggregateByCategory(rows);
    const map = Object.fromEntries(r.map((e) => [e.key, e]));
    expect(map["会議費"].outflow).toBe(5000);
    expect(map["会議費"].count).toBe(2);
    expect(map["外注費"].outflow).toBe(10000);
    expect(map["（未分類）"].outflow).toBe(1000);
  });

  it("総額（出金 + 入金）の降順で並ぶ", () => {
    const rows = [
      { amount: -1000, category: "A" },
      { amount: -5000, category: "B" },
      { amount: -2000, category: "C" },
    ];
    const r = aggregateByCategory(rows);
    expect(r[0].key).toBe("B");
    expect(r[1].key).toBe("C");
    expect(r[2].key).toBe("A");
  });
});

describe("aggregateByDate", () => {
  it("日付別に集計、日付昇順", () => {
    const rows = [
      { amount: -500, transaction_date: "2026-04-26" },
      { amount: 1000, transaction_date: "2026-04-25" },
      { amount: -300, transaction_date: "2026-04-25" },
    ];
    const r = aggregateByDate(rows);
    expect(r[0].key).toBe("2026-04-25");
    expect(r[0].inflow).toBe(1000);
    expect(r[0].outflow).toBe(300);
    expect(r[0].count).toBe(2);
    expect(r[1].key).toBe("2026-04-26");
    expect(r[1].outflow).toBe(500);
  });
});

describe("aggregateByBankAccount", () => {
  it("口座別に集計", () => {
    const rows = [
      { amount: -1000, bank_account_id: "ACC-001" },
      { amount: -2000, bank_account_id: "ACC-002" },
      { amount: 5000, bank_account_id: "ACC-001" },
    ];
    const r = aggregateByBankAccount(rows);
    const map = Object.fromEntries(r.map((e) => [e.key, e]));
    expect(map["ACC-001"].inflow).toBe(5000);
    expect(map["ACC-001"].outflow).toBe(1000);
    expect(map["ACC-002"].outflow).toBe(2000);
  });
});

describe("monthBoundary", () => {
  it("月初・月末を YYYY-MM-DD で返す", () => {
    expect(monthBoundary("2026-04")).toEqual({
      from: "2026-04-01",
      to: "2026-04-30",
    });
    expect(monthBoundary("2026-02")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(monthBoundary("2024-02")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
  });

  it("ゼロ詰めなしも許容", () => {
    expect(monthBoundary("2026-4")).toEqual({
      from: "2026-04-01",
      to: "2026-04-30",
    });
  });

  it("不正フォーマットは null", () => {
    expect(monthBoundary("2026/04")).toBeNull();
    expect(monthBoundary("2026")).toBeNull();
    expect(monthBoundary("not-a-month")).toBeNull();
  });

  it("範囲外の月は null", () => {
    expect(monthBoundary("2026-00")).toBeNull();
    expect(monthBoundary("2026-13")).toBeNull();
  });
});
