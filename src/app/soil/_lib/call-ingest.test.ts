import { describe, expect, it } from "vitest";

import { mapFileMakerCallRow, parseCallIngestBody } from "./call-ingest";

const baseRow = {
  主キー: "1001.000", コールID: "1000", 営業ID: "42.0", 社員名: "庭 太郎",
  コール日: "2026-08-11T00:00:00", コール時間: "09:10:11", コール終了時間: "09:12:00",
  結果フラグ: "担不", 新リスト名: "新規A", 旧リスト名: "旧A", 電話番号: "090-0000-0000",
  作成日: "2026/08/11 09:10", 修正日: "2026/08/11 09:12", トス: 1, s_有効: "2", DATA0: "raw",
};

describe("call ingest mapping", () => {
  it("preserves decimal identifiers as normalized strings and maps business fields", () => {
    const row = mapFileMakerCallRow(baseRow, "2026-08-11T01:00:00.000Z");
    expect(row.external_call_id).toBe("1001");
    expect(row.external_call_code).toBe("1000");
    expect(row.external_sales_id).toBe("42");
    expect(row.call_date).toBe("2026-08-11");
    expect(row.call_time).toBe("09:10:11");
    expect(row.result_flag).toBe("担不");
    expect(row.fm_aggregate_raw).toMatchObject({ トス: 1, s_有効: "2", DATA0: "raw" });
  });

  it("rejects missing IDs and invalid call dates without exposing row values", () => {
    expect(() => mapFileMakerCallRow({ ...baseRow, 主キー: "" }, "now")).toThrow("主キー");
    expect(() => mapFileMakerCallRow({ ...baseRow, コール日: "not-a-date" }, "now")).toThrow("コール日");
  });

  it("keeps valid rows and reports invalid rows for a partial batch", () => {
    const result = parseCallIngestBody({
      run_id: "123e4567-e89b-42d3-a456-426614174000", batch_index: 0,
      range_from: "2026-08-10", range_to: "2026-08-11", rows: [baseRow, { ...baseRow, 主キー: null }],
    }, "2026-08-11T01:00:00.000Z");
    expect(result.valid).toHaveLength(1);
    expect(result.rejected).toEqual([{ index: 1, code: "INVALID_EXTERNAL_CALL_ID", message: "主キーが有効なDECIMALではありません" }]);
  });

  it("rejects duplicate FileMaker primary keys within one batch", () => {
    const result = parseCallIngestBody({
      run_id: "123e4567-e89b-42d3-a456-426614174000", batch_index: 0, rows: [baseRow, baseRow],
    });
    expect(result.valid).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ index: 1, code: "DUPLICATE_EXTERNAL_CALL_ID" });
  });

  it("rejects an oversized batch", () => {
    expect(() => parseCallIngestBody({
      run_id: "123e4567-e89b-42d3-a456-426614174000", batch_index: 0,
      rows: Array.from({ length: 501 }, () => baseRow),
    })).toThrow("1-500");
  });
});
