/**
 * insertTreeCallRecordWithQueue.ts — ユニットテスト
 *
 * テストケース（最低 3 件）:
 *   1. オンライン時: insertTreeCallRecord を直接呼出す
 *   2. オフライン時: enqueue されて offline=true が返る
 *   3. オフライン + オーバーフロー: overflow=true + success=false が返る
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// insertTreeCallRecord をモック
vi.mock("../../_actions/insertTreeCallRecord", () => ({
  insertTreeCallRecord: vi.fn(),
}));

import { insertTreeCallRecord } from "../../_actions/insertTreeCallRecord";
import { insertTreeCallRecordWithQueue } from "../insertTreeCallRecordWithQueue";
import type { InsertTreeCallRecordInput } from "../../_actions/insertTreeCallRecord";

const DUMMY_PAYLOAD: InsertTreeCallRecordInput = {
  session_id: "session-001",
  campaign_code: "CAMP-001",
  result_code: "toss",
  result_group: "positive",
  memo: "テストメモ",
  accessToken: "dummy-token",
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  // navigator.onLine を元に戻す
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });
});

describe("オンライン時の動作", () => {
  it("navigator.onLine=true の時は insertTreeCallRecord を直接呼出す", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    const mockInsert = vi.mocked(insertTreeCallRecord);
    mockInsert.mockResolvedValue({ success: true, call_id: "call-uuid-online" });

    const result = await insertTreeCallRecordWithQueue(DUMMY_PAYLOAD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.call_id).toBe("call-uuid-online");
    }
    expect(result.offline).toBeUndefined();
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith(DUMMY_PAYLOAD);
  });

  it("オンライン時に insertTreeCallRecord がエラーを返した場合はそのまま返す", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    const mockInsert = vi.mocked(insertTreeCallRecord);
    mockInsert.mockResolvedValue({
      success: false,
      errorCode: "DB_ERROR",
      errorMessage: "DB接続エラー",
    });

    const result = await insertTreeCallRecordWithQueue(DUMMY_PAYLOAD);

    expect(result.success).toBe(false);
    expect(result.offline).toBeUndefined();
  });
});

describe("オフライン時の動作", () => {
  it("navigator.onLine=false の時は enqueue されて offline=true + success=true が返る", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    const mockInsert = vi.mocked(insertTreeCallRecord);

    const result = await insertTreeCallRecordWithQueue(DUMMY_PAYLOAD);

    expect(result.success).toBe(true);
    expect(result.offline).toBe(true);
    if (result.success) {
      expect(result.call_id).toContain("offline-");
    }
    // オフライン時は insertTreeCallRecord を呼出さない
    expect(mockInsert).not.toHaveBeenCalled();

    // localStorage にエンキューされていること
    const raw = localStorage.getItem("tree_offline_queue_v1");
    expect(raw).not.toBeNull();
    const queue = JSON.parse(raw!);
    expect(queue).toHaveLength(1);
  });
});

describe("オフライン + オーバーフロー時の動作", () => {
  it("キューが 500 件上限に達している時は overflow=true + success=false が返る", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    // 500件を localStorage に直接書き込んで上限状態を作る
    const items = Array.from({ length: 500 }, (_, i) => ({
      id: `id-${i}`,
      payload: DUMMY_PAYLOAD,
      ts: Date.now(),
      retries: 0,
    }));
    localStorage.setItem("tree_offline_queue_v1", JSON.stringify(items));

    const mockInsert = vi.mocked(insertTreeCallRecord);

    const result = await insertTreeCallRecordWithQueue(DUMMY_PAYLOAD);

    expect(result.success).toBe(false);
    expect(result.overflow).toBe(true);
    if (!result.success) {
      expect(result.errorMessage).toContain("500");
    }
    // オーバーフロー時も insertTreeCallRecord は呼出さない
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
