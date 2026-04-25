/**
 * Garden Root — sanitize-payload 単体テスト
 *
 * 対象:
 *   sanitizeUpsertPayload<T>(payload, options?) — upsert/insert 前 payload クレンジング
 *   NULLABLE_DATE_KEYS — マスタごとの nullable date/timestamptz 列一覧
 */

import { describe, it, expect } from "vitest";
import {
  sanitizeUpsertPayload,
  NULLABLE_DATE_KEYS,
} from "@/app/root/_lib/sanitize-payload";

// ============================================================
// sanitizeUpsertPayload
// ============================================================

describe("sanitizeUpsertPayload — AUTO_MANAGED_KEYS の除外", () => {
  it("created_at が空文字でも常に除外される", () => {
    const result = sanitizeUpsertPayload({ id: "1", name: "foo", created_at: "" });
    expect(result).not.toHaveProperty("created_at");
  });

  it("updated_at が空文字でも常に除外される", () => {
    const result = sanitizeUpsertPayload({ id: "1", updated_at: "" });
    expect(result).not.toHaveProperty("updated_at");
  });

  it("created_at が実 ISO 文字列でも除外される", () => {
    const result = sanitizeUpsertPayload({
      id: "1",
      created_at: "2026-04-25T12:00:00.000Z",
    });
    expect(result).not.toHaveProperty("created_at");
  });

  it("updated_at が実 ISO 文字列でも除外される", () => {
    const result = sanitizeUpsertPayload({
      id: "1",
      updated_at: "2026-04-25T12:00:00.000Z",
    });
    expect(result).not.toHaveProperty("updated_at");
  });

  it("excludeKeys を指定しなくても created_at / updated_at の両方が除外される", () => {
    const result = sanitizeUpsertPayload({
      id: "2",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });
    expect(result).not.toHaveProperty("created_at");
    expect(result).not.toHaveProperty("updated_at");
    expect(result).toHaveProperty("id", "2");
  });
});

// ------------------------------------------------------------
describe("sanitizeUpsertPayload — excludeKeys オプション", () => {
  it("excludeKeys に指定したキーが除外される", () => {
    const result = sanitizeUpsertPayload(
      { id: "3", name: "bar", temp_id: "tmp-99" },
      { excludeKeys: ["temp_id"] },
    );
    expect(result).not.toHaveProperty("temp_id");
    expect(result).toHaveProperty("id", "3");
    expect(result).toHaveProperty("name", "bar");
  });

  it("複数の excludeKeys がすべて除外される", () => {
    const result = sanitizeUpsertPayload(
      { id: "4", temp_id: "t1", draft_flag: true, name: "baz" },
      { excludeKeys: ["temp_id", "draft_flag"] },
    );
    expect(result).not.toHaveProperty("temp_id");
    expect(result).not.toHaveProperty("draft_flag");
    expect(result).toHaveProperty("id", "4");
    expect(result).toHaveProperty("name", "baz");
  });

  it("存在しないキーを excludeKeys に指定しても他のキーに影響しない (no-op)", () => {
    const result = sanitizeUpsertPayload(
      { id: "5", name: "qux" },
      { excludeKeys: ["nonexistent_key"] },
    );
    expect(result).toHaveProperty("id", "5");
    expect(result).toHaveProperty("name", "qux");
  });

  it("excludeKeys に created_at を重複指定しても問題なく 1 回だけ除外される", () => {
    const result = sanitizeUpsertPayload(
      { id: "6", created_at: "2026-04-01T00:00:00Z", name: "dup" },
      { excludeKeys: ["created_at"] },
    );
    expect(result).not.toHaveProperty("created_at");
    expect(result).toHaveProperty("id", "6");
    expect(result).toHaveProperty("name", "dup");
  });
});

// ------------------------------------------------------------
describe("sanitizeUpsertPayload — nullableDateKeys オプション", () => {
  it("nullableDateKeys に指定したキーの値が空文字 '' ならキーごと省かれる", () => {
    const result = sanitizeUpsertPayload(
      { id: "7", termination_date: "" },
      { nullableDateKeys: ["termination_date"] },
    );
    expect(result).not.toHaveProperty("termination_date");
    expect(result).toHaveProperty("id", "7");
  });

  it("nullableDateKeys に指定したキーの値が null → null として保持される (空文字のみスキップ)", () => {
    const result = sanitizeUpsertPayload(
      { id: "8", termination_date: null as unknown as string },
      { nullableDateKeys: ["termination_date"] },
    );
    expect(result).toHaveProperty("termination_date", null);
  });

  it("nullableDateKeys に指定したキーの値が実日付 → そのまま保持される", () => {
    const result = sanitizeUpsertPayload(
      { id: "9", termination_date: "2026-04-25" },
      { nullableDateKeys: ["termination_date"] },
    );
    expect(result).toHaveProperty("termination_date", "2026-04-25");
  });

  it("nullableDateKeys に指定 *しなかった* キーの空文字値 → そのまま '' として保持される", () => {
    const result = sanitizeUpsertPayload(
      { id: "10", notes: "" },
      { nullableDateKeys: ["termination_date"] },
    );
    expect(result).toHaveProperty("notes", "");
  });

  it("nullableDateKeys 未指定のとき空文字値は保持される", () => {
    const result = sanitizeUpsertPayload({ id: "11", notes: "" });
    expect(result).toHaveProperty("notes", "");
  });
});

// ------------------------------------------------------------
describe("sanitizeUpsertPayload — その他キー・値の保持", () => {
  it("文字列・数値・真偽値・null・ネストオブジェクトがすべて通過する", () => {
    const result = sanitizeUpsertPayload({
      str: "hello",
      num: 42,
      bool: false,
      nil: null as null,
      nested: { a: 1 },
    });
    expect(result).toMatchObject({
      str: "hello",
      num: 42,
      bool: false,
      nil: null,
      nested: { a: 1 },
    });
  });

  it("undefined 値はそのまま通過する (除外されない)", () => {
    const result = sanitizeUpsertPayload({
      id: "12",
      maybe: undefined as undefined,
    });
    // Object.entries は undefined 値のキーも返すため保持される
    expect(Object.prototype.hasOwnProperty.call(result, "maybe")).toBe(true);
    expect(result.maybe).toBeUndefined();
  });

  it("空配列 [] と空オブジェクト {} は保持される", () => {
    const result = sanitizeUpsertPayload({ arr: [] as string[], obj: {} as Record<string, never> });
    expect(result).toHaveProperty("arr");
    expect(Array.isArray(result.arr)).toBe(true);
    expect(result).toHaveProperty("obj");
  });

  it("返り値は入力と別の参照 (shallow copy)", () => {
    const input = { id: "13", name: "ref-check" };
    const result = sanitizeUpsertPayload(input);
    expect(result).not.toBe(input);
  });
});

// ------------------------------------------------------------
describe("sanitizeUpsertPayload — 型安全性", () => {
  interface Sample {
    id: string;
    name: string;
    created_at: string;
  }

  it("型パラメータを明示して Partial<T> を受け取れる", () => {
    const input: Sample = { id: "x", name: "type-test", created_at: "2026-04-25T00:00:00Z" };
    const result = sanitizeUpsertPayload<Sample>(input);
    // created_at は除外されているため undefined
    expect(result.id).toBe("x");
    expect(result.name).toBe("type-test");
    expect(result.created_at).toBeUndefined();
  });
});

// ------------------------------------------------------------
describe("sanitizeUpsertPayload — エッジケース", () => {
  it("空の payload {} → 空の結果 {}", () => {
    const result = sanitizeUpsertPayload({});
    expect(result).toEqual({});
  });

  it("AUTO_MANAGED_KEYS のみのpayload → 空の結果 {}", () => {
    const result = sanitizeUpsertPayload({
      created_at: "2026-04-25T00:00:00Z",
      updated_at: "2026-04-25T00:00:00Z",
    });
    expect(result).toEqual({});
  });
});

// ============================================================
// NULLABLE_DATE_KEYS
// ============================================================

describe("NULLABLE_DATE_KEYS — キー一覧の存在確認", () => {
  it("companies キーが存在する", () => {
    expect(NULLABLE_DATE_KEYS).toHaveProperty("companies");
  });

  it("bank_accounts キーが存在する", () => {
    expect(NULLABLE_DATE_KEYS).toHaveProperty("bank_accounts");
  });

  it("vendors キーが存在する", () => {
    expect(NULLABLE_DATE_KEYS).toHaveProperty("vendors");
  });

  it("employees キーが存在する", () => {
    expect(NULLABLE_DATE_KEYS).toHaveProperty("employees");
  });

  it("salary_systems キーが存在する", () => {
    expect(NULLABLE_DATE_KEYS).toHaveProperty("salary_systems");
  });

  it("insurance キーが存在する", () => {
    expect(NULLABLE_DATE_KEYS).toHaveProperty("insurance");
  });

  it("attendance キーが存在する", () => {
    expect(NULLABLE_DATE_KEYS).toHaveProperty("attendance");
  });
});

describe("NULLABLE_DATE_KEYS — 空配列マスタの確認", () => {
  it("companies は空配列", () => {
    expect(NULLABLE_DATE_KEYS.companies).toEqual([]);
  });

  it("bank_accounts は空配列", () => {
    expect(NULLABLE_DATE_KEYS.bank_accounts).toEqual([]);
  });

  it("vendors は空配列", () => {
    expect(NULLABLE_DATE_KEYS.vendors).toEqual([]);
  });

  it("salary_systems は空配列", () => {
    expect(NULLABLE_DATE_KEYS.salary_systems).toEqual([]);
  });
});

describe("NULLABLE_DATE_KEYS — employees の列名確認", () => {
  it("termination_date が含まれる", () => {
    expect(NULLABLE_DATE_KEYS.employees).toContain("termination_date");
  });

  it("contract_end_on が含まれる", () => {
    expect(NULLABLE_DATE_KEYS.employees).toContain("contract_end_on");
  });

  it("deleted_at が含まれる", () => {
    expect(NULLABLE_DATE_KEYS.employees).toContain("deleted_at");
  });

  // NOTE: 下記の .toHaveLength() は意図的な guard rail。
  // 新 nullable date 列を追加した際は、本テストと sanitize-payload.ts の両方を同期させるための検出テスト。
  it("employees は 3 要素", () => {
    expect(NULLABLE_DATE_KEYS.employees).toHaveLength(3);
  });
});

describe("NULLABLE_DATE_KEYS — insurance / attendance の列名確認", () => {
  it("insurance に effective_to が含まれる", () => {
    expect(NULLABLE_DATE_KEYS.insurance).toContain("effective_to");
  });

  it("insurance は 1 要素", () => {
    expect(NULLABLE_DATE_KEYS.insurance).toHaveLength(1);
  });

  it("attendance に imported_at が含まれる", () => {
    expect(NULLABLE_DATE_KEYS.attendance).toContain("imported_at");
  });

  it("attendance は 1 要素", () => {
    expect(NULLABLE_DATE_KEYS.attendance).toHaveLength(1);
  });
});
