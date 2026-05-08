import { describe, it, expect } from "vitest";
import {
  findMatchingTransfer,
  bulkMatch,
  type MatchableStatement,
  type MatchableTransfer,
} from "../statement-matcher";

function tx(
  overrides: Partial<MatchableTransfer> = {},
): MatchableTransfer {
  return {
    transfer_id: "FK-20260425-0001",
    amount: 1000,
    scheduled_date: "2026-04-27",
    payee_name: "株式会社山田",
    status: "承認済み",
    executed_date: null,
    ...overrides,
  };
}

function stmt(
  overrides: Partial<MatchableStatement> = {},
): MatchableStatement {
  return {
    transaction_date: "2026-04-27",
    amount: -1000,
    description: "株式会社山田",
    ...overrides,
  };
}

describe("findMatchingTransfer — exact match", () => {
  it("金額・日付・取引先名が一致 → exact", () => {
    const r = findMatchingTransfer(stmt(), [tx()]);
    expect(r).toEqual({ transferId: "FK-20260425-0001", confidence: "exact" });
  });

  it("複数候補のうち取引先名一致が 1 件 → exact", () => {
    const candidates = [
      tx({ transfer_id: "FK-001", payee_name: "違う会社" }),
      tx({ transfer_id: "FK-002", payee_name: "株式会社山田" }),
    ];
    const r = findMatchingTransfer(stmt(), candidates);
    expect(r?.transferId).toBe("FK-002");
    expect(r?.confidence).toBe("exact");
  });

  it("vendor_name が優先される（payee_name より）", () => {
    const r = findMatchingTransfer(stmt({ description: "ABC商事" }), [
      tx({ payee_name: "違う会社", vendor_name: "ABC商事" }),
    ]);
    expect(r?.confidence).toBe("exact");
  });
});

describe("findMatchingTransfer — high match", () => {
  it("同日・金額のみ一致（名前一致なし）で候補 1 件 → high", () => {
    const r = findMatchingTransfer(stmt({ description: "全く違う説明" }), [
      tx({ payee_name: "山田" }),
    ]);
    expect(r?.confidence).toBe("high");
  });

  it("±3 日内・金額一致で候補 1 件 → high", () => {
    const r = findMatchingTransfer(stmt({ transaction_date: "2026-04-28" }), [
      tx({ scheduled_date: "2026-04-27" }),
    ]);
    expect(r?.confidence).toBe("high");
  });
});

describe("findMatchingTransfer — null（マッチなし）", () => {
  it("金額が違う → null", () => {
    const r = findMatchingTransfer(stmt({ amount: -2000 }), [tx()]);
    expect(r).toBeNull();
  });

  it("候補が振込完了済 → null", () => {
    const r = findMatchingTransfer(stmt(), [
      tx({ status: "振込完了", executed_date: "2026-04-27" }),
    ]);
    expect(r).toBeNull();
  });

  it("候補が下書きステータス → null（未承認）", () => {
    const r = findMatchingTransfer(stmt(), [tx({ status: "下書き" })]);
    expect(r).toBeNull();
  });

  it("候補が複数で名前一致なし → null（high で同日の場合は唯一性必要）", () => {
    const r = findMatchingTransfer(stmt({ description: "全く違う" }), [
      tx({ transfer_id: "FK-001" }),
      tx({ transfer_id: "FK-002" }),
    ]);
    expect(r).toBeNull();
  });

  it("4 日以上ずれは window 外 → null", () => {
    const r = findMatchingTransfer(stmt({ transaction_date: "2026-05-02" }), [
      tx({ scheduled_date: "2026-04-27" }),
    ]);
    expect(r).toBeNull();
  });
});

describe("bulkMatch", () => {
  it("複数明細を順次マッチング、同じ振込は 1 度しか使わない", () => {
    const statements = [
      stmt({ amount: -1000, description: "ABC商事" }),
      stmt({ amount: -2000, description: "DEF商事" }),
    ];
    const candidates = [
      tx({ transfer_id: "FK-001", amount: 1000, payee_name: "ABC商事" }),
      tx({ transfer_id: "FK-002", amount: 2000, payee_name: "DEF商事" }),
    ];
    const r = bulkMatch(statements, candidates);
    expect(r.matched).toHaveLength(2);
    const matchedIds = r.matched.map((m) => m.result.transferId);
    expect(new Set(matchedIds).size).toBe(2);
  });

  it("入金（amount > 0）は unmatched に分類", () => {
    const r = bulkMatch([stmt({ amount: 1000 })], [tx()]);
    expect(r.matched).toHaveLength(0);
    expect(r.unmatched).toEqual([0]);
  });

  it("exactCount / highCount を集計", () => {
    const r = bulkMatch(
      [stmt(), stmt({ description: "違う" })],
      [tx({ transfer_id: "FK-001" }), tx({ transfer_id: "FK-002" })],
    );
    expect(r.exactCount + r.highCount).toBe(r.matched.length);
  });
});
