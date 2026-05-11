/**
 * D-07 会計連携レポート CSV 生成 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-07-bank-transfer.md §3.4 + 4 次 follow-up 8 区分階層
 *
 * 網羅項目:
 *   1. escapeCsvCell（カンマ / ダブルクオート / 改行）
 *   2. buildAccountingCsvLines（8 大区分 + 小計 + 総合計）
 *   3. buildAccountingCsv（BOM + CRLF + ヘッダ）
 *   4. createEmptyHierarchy + addItemsToCategory（ヘルパー）
 */

import { describe, it, expect } from "vitest";
import {
  escapeCsvCell,
  buildAccountingCsvLines,
  buildAccountingCsv,
  createEmptyHierarchy,
  addItemsToCategory,
} from "../transfer-accounting-csv";
import { ACCOUNTING_CATEGORIES_ORDER, type CategoryHierarchy } from "../transfer-types";

// ============================================================
// 1. escapeCsvCell
// ============================================================

describe("escapeCsvCell", () => {
  it("通常文字列 → そのまま", () => {
    expect(escapeCsvCell("基本給")).toBe("基本給");
  });

  it("数値 → 文字列化", () => {
    expect(escapeCsvCell(123_456)).toBe("123456");
  });

  it("カンマ含む → ダブルクオート囲い", () => {
    expect(escapeCsvCell("a,b,c")).toBe('"a,b,c"');
  });

  it("ダブルクオート含む → エスケープ + 囲い", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("改行含む → 囲い", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

// ============================================================
// 2. buildAccountingCsvLines
// ============================================================

function buildSampleHierarchy(): CategoryHierarchy {
  return {
    役員報酬: {
      items: [
        { name: "役員報酬(後道翔太)", amount: 500_000 },
        { name: "役員報酬(後道愛美)", amount: 128_000 },
      ],
      subtotal: 628_000,
      isFutureUse: false,
    },
    給与: {
      items: [
        { name: "基本給", amount: 5_047_577 },
        { name: "役職手当", amount: 0 },
      ],
      subtotal: 5_047_577,
      isFutureUse: false,
    },
    賞与: {
      items: [],
      subtotal: 0,
      isFutureUse: true,
    },
    交通費: {
      items: [
        { name: "通勤手当", amount: 350_000 },
        { name: "出張交通費", amount: 42_000 },
      ],
      subtotal: 392_000,
      isFutureUse: false,
    },
    会社負担社保等: {
      items: [
        { name: "健保会社負担", amount: 250_000 },
        { name: "厚年会社負担", amount: 460_000 },
      ],
      subtotal: 710_000,
      isFutureUse: false,
    },
    外注費: {
      items: [{ name: "業務委託(株式会社A)", amount: 200_000 }],
      subtotal: 200_000,
      isFutureUse: false,
    },
    販売促進費: {
      items: [{ name: "広告料(C社)", amount: 100_000 }],
      subtotal: 100_000,
      isFutureUse: false,
    },
    固定費等: {
      items: [{ name: "賃料(本社)", amount: 300_000 }],
      subtotal: 300_000,
      isFutureUse: false,
    },
  };
}

describe("buildAccountingCsvLines", () => {
  it("8 区分 + 各小計 + 総合計（役員給与系除く）", () => {
    const lines = buildAccountingCsvLines(buildSampleHierarchy());

    // 役員報酬: 2 明細 + 小計
    expect(lines).toContain("役員報酬,役員報酬(後道翔太),500000");
    expect(lines).toContain("役員報酬,役員報酬(後道愛美),128000");
    expect(lines).toContain("役員報酬,小計,628000");

    // 給与: 2 明細 + 小計
    expect(lines).toContain("給与,基本給,5047577");
    expect(lines).toContain("給与,小計,5047577");

    // 賞与: 将来発生時 + 小計 0
    expect(lines).toContain("賞与,(将来発生時),0");
    expect(lines).toContain("賞与,小計,0");

    // 総合計（役員給与系除く）
    // = 5047577 + 0 + 392000 + 710000 + 200000 + 100000 + 300000 = 6749577
    expect(lines).toContain("総合計,(役員給与系を除く),6749577");
  });

  it("カンマを含む小区分名 → ダブルクオート囲い", () => {
    const hierarchy: CategoryHierarchy = {
      役員報酬: { items: [{ name: "役員報酬(後道,愛美)", amount: 1000 }], subtotal: 1000, isFutureUse: false },
      給与: { items: [], subtotal: 0, isFutureUse: true },
      賞与: { items: [], subtotal: 0, isFutureUse: true },
      交通費: { items: [], subtotal: 0, isFutureUse: true },
      会社負担社保等: { items: [], subtotal: 0, isFutureUse: true },
      外注費: { items: [], subtotal: 0, isFutureUse: true },
      販売促進費: { items: [], subtotal: 0, isFutureUse: true },
      固定費等: { items: [], subtotal: 0, isFutureUse: true },
    };
    const lines = buildAccountingCsvLines(hierarchy);
    expect(lines).toContain('役員報酬,"役員報酬(後道,愛美)",1000');
  });

  it("固定順序（役員報酬 → 給与 → 賞与 → ... → 固定費等）", () => {
    const hierarchy = buildSampleHierarchy();
    const lines = buildAccountingCsvLines(hierarchy);
    const subtotalLines = lines.filter((l) => l.includes(",小計,"));
    const expectedOrder = [
      "役員報酬",
      "給与",
      "賞与",
      "交通費",
      "会社負担社保等",
      "外注費",
      "販売促進費",
      "固定費等",
    ];
    for (let i = 0; i < expectedOrder.length; i++) {
      expect(subtotalLines[i].startsWith(expectedOrder[i])).toBe(true);
    }
  });

  it("全区分 future_use → 全て (将来発生時) + 小計 0 + 総合計 0", () => {
    const empty = createEmptyHierarchy();
    const lines = buildAccountingCsvLines(empty);
    expect(lines).toContain("総合計,(役員給与系を除く),0");
    // 8 区分 × ((将来発生時) + 小計) = 16 行 + 総合計 = 17 行
    expect(lines.length).toBe(17);
  });
});

// ============================================================
// 3. buildAccountingCsv
// ============================================================

describe("buildAccountingCsv", () => {
  it("BOM + CRLF + ヘッダ", () => {
    const result = buildAccountingCsv(buildSampleHierarchy(), "2026-05");
    // UTF-8 BOM
    expect(result.content.charCodeAt(0)).toBe(0xfeff);
    // CRLF 改行確認（少なくとも 1 件含まれる）
    expect(result.content).toContain("\r\n");
    // ヘッダ行
    expect(result.content).toContain("大区分,小区分,2026-05");
  });

  it("末尾改行あり", () => {
    const result = buildAccountingCsv(buildSampleHierarchy(), "2026-05");
    expect(result.content.endsWith("\r\n")).toBe(true);
  });

  it("総合計（役員給与系除く）= 5047577 + 392000 + 710000 + 200000 + 100000 + 300000 = 6749577（賞与 0 含む）", () => {
    const result = buildAccountingCsv(buildSampleHierarchy(), "2026-05");
    expect(result.grandTotalExceptExecutive).toBe(6_749_577);
  });

  it("yearMonth が結果に保持される", () => {
    const result = buildAccountingCsv(buildSampleHierarchy(), "2026-05");
    expect(result.yearMonth).toBe("2026-05");
  });
});

// ============================================================
// 4. createEmptyHierarchy + addItemsToCategory
// ============================================================

describe("createEmptyHierarchy", () => {
  it("8 区分すべてが空 + isFutureUse=true で初期化", () => {
    const empty = createEmptyHierarchy();
    for (const c of ACCOUNTING_CATEGORIES_ORDER) {
      expect(empty[c].items).toEqual([]);
      expect(empty[c].subtotal).toBe(0);
      expect(empty[c].isFutureUse).toBe(true);
    }
  });
});

describe("addItemsToCategory", () => {
  it("空 hierarchy に items 追加 → subtotal 自動計算 + isFutureUse=false", () => {
    const empty = createEmptyHierarchy();
    const updated = addItemsToCategory(empty, "役員報酬", [
      { name: "役員報酬(A)", amount: 500_000 },
      { name: "役員報酬(B)", amount: 128_000 },
    ]);
    expect(updated.役員報酬.items.length).toBe(2);
    expect(updated.役員報酬.subtotal).toBe(628_000);
    expect(updated.役員報酬.isFutureUse).toBe(false);
    // 他区分は変わらず
    expect(updated.給与.isFutureUse).toBe(true);
  });

  it("既存 items に追加（累積）", () => {
    let h = createEmptyHierarchy();
    h = addItemsToCategory(h, "給与", [{ name: "基本給", amount: 5_000_000 }]);
    h = addItemsToCategory(h, "給与", [{ name: "役職手当", amount: 100_000 }]);
    expect(h.給与.items.length).toBe(2);
    expect(h.給与.subtotal).toBe(5_100_000);
  });

  it("空配列追加 → 何も変わらず", () => {
    const empty = createEmptyHierarchy();
    const updated = addItemsToCategory(empty, "給与", []);
    expect(updated.給与.items.length).toBe(0);
    expect(updated.給与.isFutureUse).toBe(true);
  });
});
