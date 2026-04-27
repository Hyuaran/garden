import { describe, it, expect } from "vitest";
import {
  buildRegularTransferId,
  buildCashbackTransferId,
  parseTransferId,
} from "../transfer-id";

describe("buildRegularTransferId", () => {
  it("FK-YYYYMMDD-NNNNNN 形式を生成", () => {
    const id = buildRegularTransferId(new Date(2026, 3, 25), 1);
    expect(id).toBe("FK-20260425-000001");
  });

  it("連番が 6 桁の 0 埋め", () => {
    const id = buildRegularTransferId(new Date(2026, 3, 25), 123456);
    expect(id).toBe("FK-20260425-123456");
  });

  it("連番が 1,000,000 以上はエラー", () => {
    expect(() =>
      buildRegularTransferId(new Date(2026, 3, 25), 1_000_000),
    ).toThrow(/6 桁を超え/);
  });

  it("連番が 0 以下はエラー", () => {
    expect(() =>
      buildRegularTransferId(new Date(2026, 3, 25), 0),
    ).toThrow(/1 以上/);
  });
});

describe("buildCashbackTransferId", () => {
  it("CB-YYYYMMDD-G-NNN 形式を生成", () => {
    const id = buildCashbackTransferId(new Date(2026, 3, 25), 1);
    expect(id).toBe("CB-20260425-G-001");
  });

  it("連番が 3 桁の 0 埋め", () => {
    const id = buildCashbackTransferId(new Date(2026, 3, 25), 999);
    expect(id).toBe("CB-20260425-G-999");
  });

  it("連番が 1,000 以上はエラー", () => {
    expect(() =>
      buildCashbackTransferId(new Date(2026, 3, 25), 1000),
    ).toThrow(/3 桁を超え/);
  });
});

describe("parseTransferId", () => {
  it("通常振込 ID を分解", () => {
    const r = parseTransferId("FK-20260425-000042");
    expect(r).toEqual({
      category: "regular",
      datePart: "20260425",
      sequence: 42,
    });
  });

  it("キャッシュバック ID を分解", () => {
    const r = parseTransferId("CB-20260425-G-007");
    expect(r).toEqual({
      category: "cashback",
      datePart: "20260425",
      sequence: 7,
    });
  });

  it("不正な形式は null を返す", () => {
    expect(parseTransferId("INVALID")).toBeNull();
    expect(parseTransferId("FK-2026-04-25")).toBeNull();
    expect(parseTransferId("")).toBeNull();
  });

  it("旧形式 FRK-YYYY-MM-NNNN は null（非対応）", () => {
    expect(parseTransferId("FRK-2026-04-0001")).toBeNull();
  });
});
