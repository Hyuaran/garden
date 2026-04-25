import { describe, it, expect } from "vitest";
import {
  validateBatchSize,
  filterIdsByStatus,
  summarizeBatchResult,
  BATCH_MAX_COUNT,
} from "../batch-transitions";

describe("validateBatchSize", () => {
  it("1 件は OK", () => {
    expect(validateBatchSize(["FK-20260425-0001"]).ok).toBe(true);
  });

  it("100 件（BATCH_MAX_COUNT）は OK", () => {
    const ids = Array.from(
      { length: BATCH_MAX_COUNT },
      (_, i) => `FK-20260425-${String(i).padStart(4, "0")}`,
    );
    expect(validateBatchSize(ids).ok).toBe(true);
  });

  it("101 件は NG", () => {
    const ids = Array.from(
      { length: BATCH_MAX_COUNT + 1 },
      (_, i) => `FK-20260425-${String(i).padStart(4, "0")}`,
    );
    const r = validateBatchSize(ids);
    expect(r.ok).toBe(false);
  });

  it("空配列は NG", () => {
    expect(validateBatchSize([]).ok).toBe(false);
  });

  it("重複ありは NG", () => {
    const r = validateBatchSize(["FK-001", "FK-002", "FK-001"]);
    expect(r.ok).toBe(false);
  });
});

describe("filterIdsByStatus", () => {
  it("期待ステータスに一致する ID のみ matching", () => {
    const rows = [
      { transfer_id: "FK-001", status: "承認待ち" as const },
      { transfer_id: "FK-002", status: "承認済み" as const },
      { transfer_id: "FK-003", status: "承認待ち" as const },
    ];
    const r = filterIdsByStatus(rows, "承認待ち");
    expect(r.matching).toEqual(["FK-001", "FK-003"]);
    expect(r.mismatch).toEqual([
      { transferId: "FK-002", actualStatus: "承認済み" },
    ]);
  });

  it("全件一致なら matching のみ", () => {
    const rows = [
      { transfer_id: "FK-001", status: "承認待ち" as const },
      { transfer_id: "FK-002", status: "承認待ち" as const },
    ];
    const r = filterIdsByStatus(rows, "承認待ち");
    expect(r.matching).toHaveLength(2);
    expect(r.mismatch).toHaveLength(0);
  });

  it("全件不一致なら mismatch のみ", () => {
    const rows = [{ transfer_id: "FK-001", status: "下書き" as const }];
    const r = filterIdsByStatus(rows, "承認待ち");
    expect(r.matching).toHaveLength(0);
    expect(r.mismatch).toHaveLength(1);
  });
});

describe("summarizeBatchResult", () => {
  it("全件成功", () => {
    expect(
      summarizeBatchResult({
        succeeded: ["FK-001", "FK-002"],
        failed: [],
      }),
    ).toBe("2 件すべて成功しました");
  });

  it("全件失敗", () => {
    expect(
      summarizeBatchResult({
        succeeded: [],
        failed: [
          { transferId: "FK-001", error: "e1", code: "DB_ERROR" },
          { transferId: "FK-002", error: "e2", code: "UNAUTHORIZED" },
        ],
      }),
    ).toBe("2 件すべて失敗しました");
  });

  it("一部失敗", () => {
    expect(
      summarizeBatchResult({
        succeeded: ["FK-001"],
        failed: [{ transferId: "FK-002", error: "e", code: "DB_ERROR" }],
      }),
    ).toBe("1 件成功、1 件失敗");
  });
});
