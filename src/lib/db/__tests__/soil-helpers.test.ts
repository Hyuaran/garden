import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  normalizeKana,
  buildSoftDeletePayload,
  isSoilListSoftDeleted,
} from "../soil-helpers";

describe("normalizePhone", () => {
  it("ハイフン除去（市外局番付き固定電話）", () => {
    expect(normalizePhone("06-1234-5678")).toBe("+81612345678");
  });

  it("ハイフン除去（携帯）", () => {
    expect(normalizePhone("090-1234-5678")).toBe("+819012345678");
  });

  it("国際表記（既に +81）はそのまま", () => {
    expect(normalizePhone("+819012345678")).toBe("+819012345678");
  });

  it("国際表記（+81 のあとにハイフン）", () => {
    expect(normalizePhone("+81-90-1234-5678")).toBe("+819012345678");
  });

  it("先頭 0 のみ（10 桁）→ +81 補完", () => {
    expect(normalizePhone("0312345678")).toBe("+81312345678");
  });

  it("丸括弧含む", () => {
    expect(normalizePhone("(03)1234-5678")).toBe("+81312345678");
  });

  it("全角数字 → 半角", () => {
    expect(normalizePhone("０９０ー１２３４ー５６７８")).toBe("+819012345678");
  });

  it("空白除去", () => {
    expect(normalizePhone("090 1234 5678")).toBe("+819012345678");
  });

  it("空文字 / null / undefined は null", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("数字以外のみ → null", () => {
    expect(normalizePhone("---")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });

  it("桁数足りない場合（5 桁）はそのまま整形（後段の validation で弾く想定）", () => {
    expect(normalizePhone("12345")).toBe("+8112345");
  });
});

describe("normalizeKana", () => {
  it("半角カナ → 全角カナ", () => {
    expect(normalizeKana("ﾀﾅｶ ﾀﾛｳ")).toBe("タナカ タロウ");
  });

  it("濁点付き半角カナ", () => {
    expect(normalizeKana("ﾀﾞｲｺﾞ")).toBe("ダイゴ");
  });

  it("半濁点付き半角カナ", () => {
    expect(normalizeKana("ﾊﾟﾅｿﾆｯｸ")).toBe("パナソニック");
  });

  it("全角カナはそのまま", () => {
    expect(normalizeKana("ヤマダ ハナコ")).toBe("ヤマダ ハナコ");
  });

  it("ひらがな → カタカナ", () => {
    expect(normalizeKana("やまだ")).toBe("ヤマダ");
  });

  it("英数字混在は英数字部分そのまま、ひらがなのみ変換", () => {
    expect(normalizeKana("ABC やまだ 123")).toBe("ABC ヤマダ 123");
  });

  it("空文字 / null / undefined は空文字", () => {
    expect(normalizeKana("")).toBe("");
    expect(normalizeKana(null)).toBe("");
    expect(normalizeKana(undefined)).toBe("");
  });
});

describe("buildSoftDeletePayload", () => {
  it("削除実行者と理由を含む payload を返す", () => {
    const before = Date.now();
    const payload = buildSoftDeletePayload({
      deletedBy: "user-uuid-1",
      reason: "duplicate",
    });
    const after = Date.now();

    expect(payload.deleted_by).toBe("user-uuid-1");
    expect(payload.deleted_reason).toBe("duplicate");

    const ts = new Date(payload.deleted_at).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("理由なしでも生成可", () => {
    const payload = buildSoftDeletePayload({ deletedBy: "u" });
    expect(payload.deleted_by).toBe("u");
    expect(payload.deleted_reason).toBeNull();
  });

  it("UPDATE 用に updated_at + updated_by も含む（横断統一規格）", () => {
    const payload = buildSoftDeletePayload({ deletedBy: "u" });
    expect(payload.updated_by).toBe("u");
    expect(payload.updated_at).toBe(payload.deleted_at);
  });
});

describe("isSoilListSoftDeleted", () => {
  it("deleted_at が null → false", () => {
    const row = { deleted_at: null } as { deleted_at: string | null };
    expect(isSoilListSoftDeleted(row)).toBe(false);
  });

  it("deleted_at が ISO 文字列 → true", () => {
    const row = { deleted_at: "2026-05-07T10:00:00Z" } as { deleted_at: string | null };
    expect(isSoilListSoftDeleted(row)).toBe(true);
  });
});
